/**
 * Add Entity Tool
 * Adds a discovered code entity to the external state graph
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { EntityNode, EntityType, ENTITY_TYPES } from '../shared/types';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { InitializeSessionTool } from './initializeSessionTool';
import { Logger } from '../shared/errorHandling';

interface AddEntityParameters {
  entities?: Array<{
    id: string;
    type: string;
    filePath: string;
    businessContext: string;
    chainContext: string;
    [key: string]: unknown;
  }>;
  filePathsToExpand?: string[];
  expansionContext?: {
    businessDomain: string;
    analysisGoal: string;
    entityTypeFocus?: string[];
  };
}

export class AddEntityTool extends BaseTool {
  public readonly name = TOOL_NAMES.ADD_ENTITY;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    // Initialize with temporary workspace root, will be updated from session
    const tempWorkspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, tempWorkspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Add Entity to Graph';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting entity addition', options);
    
    // Extract dynamic token configuration
    const maxTokens = this.getMaxTokens(options);
    const tokenizationOptions = this.getTokenizationOptions(options);
    
    // Type assertion to access the parameters
    const params = options.input as AddEntityParameters;
    
    try {
      // Check if session is active
      if (!InitializeSessionTool.hasActiveSession(this.context)) {
        return this.createErrorResult(
          this.formatErrorResponse('No active discovery session. Please initialize a session first using the initializeSession tool.')
        );
      }

      // Validate parameters and determine processing mode
      this.validateParameters(params);
      
      this.checkCancellation(token);
      
      let addedEntities: EntityNode[] = [];
      
      // Handle different input modes
      if (params.entities) {
        // Batch entities mode (including single entity as array of one)
        for (const entityData of params.entities) {
          this.checkCancellation(token);
          const entityNode = this.createEntityNode(entityData);
          await this.stateManager.addEntity(entityNode);
          addedEntities.push(entityNode);
        }
        
      } else if (params.filePathsToExpand && params.expansionContext) {
        // File expansion mode - analyze files to discover entities
        const discoveredEntities = await this.expandEntitiesFromFiles(
          params.filePathsToExpand, 
          params.expansionContext,
          token
        );
        
        for (const entityNode of discoveredEntities) {
          this.checkCancellation(token);
          await this.stateManager.addEntity(entityNode);
          addedEntities.push(entityNode);
        }
      }
      
      this.checkCancellation(token);

      // Monitor token usage with model-specific configuration
      await this.monitorTokenUsage(maxTokens, tokenizationOptions);
      
      this.logOperation('Entities added successfully', { 
        entityCount: addedEntities.length,
        entityIds: addedEntities.map(e => e.id)
      });
      
      const response = this.formatSuccessResponse(
        `✅ Successfully added ${addedEntities.length} ${addedEntities.length === 1 ? 'entity' : 'entities'} to discovery graph!`,
        {
          addedEntities: addedEntities.map(e => ({
            entityId: e.id,
            entityType: e.type,
            filePath: e.filePath,
            businessContext: e.businessContext
          })),
          totalEntities: addedEntities.length,
          status: 'Entities registered and ready for relationship mapping'
        }
      );
      
      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Entity addition failed', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to add entities to discovery graph';
      const errorResponse = this.formatErrorResponse(
        errorMessage,
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }

  /**
   * Monitor token usage for the current session using model-specific configuration
   */
  private async monitorTokenUsage(
    maxTokens: number, 
    tokenizationOptions?: vscode.LanguageModelToolTokenizationOptions
  ): Promise<void> {
    try {
      // Get current session entities and relationships
      const entities = await this.stateManager.getAllEntities();
      const relationships = await this.stateManager.getAllRelationships();
      
      // Use async token calculation with model-specific tokenizer if available
      if (tokenizationOptions?.countTokens) {
        const tokenManager = new (await import('../shared/services/tokenManagementService')).TokenManagementService(this.context);
        const metrics = await tokenManager.calculateTokenUsageAsync(
          entities, 
          relationships, 
          '', // no additional context for this check
          maxTokens,
          tokenizationOptions
        );
        
        this.logOperation('Token usage monitored (model-specific)', {
          currentTokens: metrics.currentTokens,
          maxTokens: metrics.maxTokens,
          usagePercentage: metrics.usagePercentage,
          warningThreshold: metrics.warningThreshold
        });
        
        if (metrics.usagePercentage >= metrics.warningThreshold) {
          this.logOperation('Token usage warning triggered', metrics);
        }
      } else {
        // Fall back to synchronous calculation
        const tokenManager = new (await import('../shared/services/tokenManagementService')).TokenManagementService(this.context);
        const metrics = tokenManager.calculateTokenUsage(entities, relationships, '', maxTokens);
        
        this.logOperation('Token usage monitored (estimation)', {
          currentTokens: metrics.currentTokens,
          maxTokens: metrics.maxTokens,
          usagePercentage: metrics.usagePercentage
        });
      }
    } catch (error) {
      Logger.error('Failed to monitor token usage', { error });
      // Non-critical error, continue execution
    }
  }

  /**
   * Validate the input parameters
   */
  private validateParameters(params: AddEntityParameters): void {
    // Check that exactly one input method is provided
    const hasEntities = !!params.entities;
    const hasFileExpansion = !!params.filePathsToExpand && !!params.expansionContext;
    
    const inputCount = [hasEntities, hasFileExpansion].filter(Boolean).length;
    
    if (inputCount === 0) {
      throw new Error('One of the following is required: entities, or filePathsToExpand with expansionContext');
    }
    
    if (inputCount > 1) {
      throw new Error('Only one input method can be used at a time: entities, or filePathsToExpand');
    }

    // Validate batch entities
    if (params.entities) {
      if (!Array.isArray(params.entities) || params.entities.length === 0) {
        throw new Error('entities must be a non-empty array');
      }
      
      for (let i = 0; i < params.entities.length; i++) {
        try {
          this.validateEntityData(params.entities[i]);
        } catch (error) {
          throw new Error(`Invalid entity at index ${i}: ${error instanceof Error ? error.message : 'validation failed'}`);
        }
      }
    }

    // Validate file expansion
    if (params.filePathsToExpand) {
      if (!Array.isArray(params.filePathsToExpand) || params.filePathsToExpand.length === 0) {
        throw new Error('filePathsToExpand must be a non-empty array');
      }
      
      if (!params.expansionContext) {
        throw new Error('expansionContext is required when using filePathsToExpand');
      }
      
      if (!params.expansionContext.businessDomain || typeof params.expansionContext.businessDomain !== 'string') {
        throw new Error('expansionContext.businessDomain is required and must be a string');
      }
      
      if (!params.expansionContext.analysisGoal || typeof params.expansionContext.analysisGoal !== 'string') {
        throw new Error('expansionContext.analysisGoal is required and must be a string');
      }
    }
  }

  /**
   * Validate individual entity data
   */
  private validateEntityData(entity: any): void {
    if (!entity || typeof entity !== 'object') {
      throw new Error('entity must be an object');
    }

    if (!entity.id || typeof entity.id !== 'string' || entity.id.trim().length === 0) {
      throw new Error('entity.id is required and must be a non-empty string');
    }

    if (!entity.type || typeof entity.type !== 'string' || entity.type.trim().length === 0) {
      throw new Error('entity.type is required and must be a non-empty string');
    }

    if (!entity.filePath || typeof entity.filePath !== 'string' || entity.filePath.trim().length === 0) {
      throw new Error('entity.filePath is required and must be a non-empty string');
    }

    if (!entity.businessContext || typeof entity.businessContext !== 'string' || entity.businessContext.trim().length === 0) {
      throw new Error('entity.businessContext is required and must be a non-empty string');
    }

    if (!entity.chainContext || typeof entity.chainContext !== 'string' || entity.chainContext.trim().length === 0) {
      throw new Error('entity.chainContext is required and must be a non-empty string');
    }
  }

  /**
   * Expand entities from file paths using basic analysis
   */
  private async expandEntitiesFromFiles(
    filePaths: string[],
    context: NonNullable<AddEntityParameters['expansionContext']>,
    token: vscode.CancellationToken
  ): Promise<EntityNode[]> {
    const discoveredEntities: EntityNode[] = [];
    
    for (const filePath of filePaths) {
      this.checkCancellation(token);
      
      try {
        // Basic entity discovery from file path and context
        const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
        const entityId = this.generateEntityIdFromFile(fileName, filePath);
        const entityType = this.inferEntityTypeFromFile(fileName, filePath, context.entityTypeFocus);
        
        const entity: EntityNode = {
          id: entityId,
          type: entityType,
          filePath: filePath,
          businessContext: context.businessDomain,
          chainContext: `Discovered from file expansion: ${context.analysisGoal}`,
          discoveryMethod: 'file_search',
          processed: false,
          priority: 3,
          dependencies: [],
          dependents: [],
          timestamp: new Date()
        };
        
        discoveredEntities.push(entity);
        
      } catch (error) {
        Logger.error(`Failed to expand entity from file: ${filePath}`, error);
        // Continue with other files even if one fails
      }
    }
    
    return discoveredEntities;
  }

  /**
   * Generate entity ID from file information
   */
  private generateEntityIdFromFile(fileName: string, filePath: string): string {
    // Remove extension and clean up
    const baseName = fileName.replace(/\.[^.]*$/, '');
    const cleanName = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Add path context to make it unique
    const pathParts = filePath.split(/[/\\]/);
    const contextPart = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
    
    return contextPart ? `${contextPart}_${cleanName}` : cleanName;
  }

  /**
   * Infer entity type from file information
   */
  private inferEntityTypeFromFile(fileName: string, filePath: string, typeFocus?: string[]): EntityType {
    const lowerFileName = fileName.toLowerCase();
    const lowerFilePath = filePath.toLowerCase();
    
    // If specific types are requested, try to match them first
    if (typeFocus && typeFocus.length > 0) {
      for (const focusType of typeFocus) {
        if (ENTITY_TYPES.includes(focusType as EntityType)) {
          return focusType as EntityType;
        }
      }
    }
    
    // Pattern-based inference
    if (lowerFileName.includes('controller') || lowerFilePath.includes('controller')) {
      return 'Controller';
    }
    if (lowerFileName.includes('service') || lowerFilePath.includes('service')) {
      return 'Service';
    }
    if (lowerFileName.includes('component') || lowerFilePath.includes('component')) {
      return 'Component';
    }
    if (lowerFileName.includes('model') || lowerFilePath.includes('model')) {
      return 'Model';
    }
    if (lowerFileName.includes('repository') || lowerFilePath.includes('repository') || lowerFilePath.includes('repo')) {
      return 'Repository';
    }
    if (lowerFileName.includes('interface') || lowerFileName.includes('dto')) {
      return 'Interface';
    }
    if (lowerFileName.includes('util') || lowerFileName.includes('helper')) {
      return 'Utility';
    }
    if (lowerFileName.includes('config') || lowerFileName.includes('setting')) {
      return 'Configuration';
    }
    if (lowerFileName.includes('test') || lowerFileName.includes('spec')) {
      return 'Test';
    }
    
    // Default based on file extension or structure
    if (lowerFileName.endsWith('.component.ts') || lowerFileName.endsWith('.vue') || lowerFileName.endsWith('.jsx')) {
      return 'Component';
    }
    
    // Fallback
    return 'Other';
  }

  /**
   * Create an EntityNode from entity data with proper type validation
   */
  private createEntityNode(entityData: NonNullable<AddEntityParameters['entities']>[0]): EntityNode {
    // Use the centralized ENTITY_TYPES constant to ensure consistency
    // with the EntityType union definition
    if (!ENTITY_TYPES.includes(entityData.type as EntityType)) {
      // Provide helpful error with common types
      const commonTypes = ['Controller', 'Service', 'Component', 'Model', 'Repository', 'API', 'Hook', 'Page', 'Utility'];
      throw new Error(
        `Invalid entity type: "${entityData.type}". ` +
        `Must be one of the defined EntityType values. ` +
        `Common types include: ${commonTypes.join(', ')}. ` +
        `See EntityType definition for complete list of ${ENTITY_TYPES.length} supported types.`
      );
    }

    const entityNode: EntityNode = {
      id: entityData.id,
      type: entityData.type as EntityType,
      filePath: entityData.filePath,
      businessContext: entityData.businessContext,
      chainContext: entityData.chainContext,
      discoveryMethod: 'manual',
      processed: false,
      priority: 3, // Default normal priority
      dependencies: [],
      dependents: [],
      timestamp: new Date()
    };

    // Add optional properties if they exist
    if (entityData.processingAgent && typeof entityData.processingAgent === 'string') {
      entityNode.processingAgent = entityData.processingAgent;
    }

    if (entityData.domainContext && typeof entityData.domainContext === 'string') {
      entityNode.domainContext = entityData.domainContext;
    }

    return entityNode;
  }
}
