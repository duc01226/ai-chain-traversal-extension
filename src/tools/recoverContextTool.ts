/**
 * Recover Context Tool - Strategic External Storage Access
 * Provides intelligent recovery of context from external backup files with token management
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES, DEFAULT_TOKEN_THRESHOLDS } from '../shared/constants';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { TokenManagementService } from '../shared/services/tokenManagementService';
import { 
  RecoveryStrategy, 
  RecoveredContext, 
  EntityFilter, 
  EntityNode, 
  RelationshipEdge,
  BackupMetadata,
  DiscoverySession,
  TokenManagementThresholds
} from '../shared/types';
import { Logger } from '../shared/errorHandling';

interface RecoverContextInput {
  sessionId: string;
  recoveryStrategy?: 'selective' | 'progressive' | 'priority_based' | 'full' | 'metadata_only';
  maxTokens?: number;
  entityFilter?: EntityFilter;
  continueFrom?: number;
  outputFormat?: 'summary' | 'detailed' | 'markdown' | 'structured';
}

interface RecoverContextResult {
  success: boolean;
  recoveredContext: RecoveredContext;
  message: string;
  backupsAnalyzed: number;
  tokenCostEstimate: number;
  recommendations: string[];
  nextSteps?: string[];
}

export class RecoverContextTool extends BaseTool {
  public readonly name = TOOL_NAMES.RECOVER_CONTEXT;
  private stateManager: WorkspaceStateManagerVscode;
  private tokenManager: TokenManagementService;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
    this.tokenManager = new TokenManagementService(context);
  }

  /**
   * Get token management thresholds with fallback to defaults
   */
  private getTokenThresholds(): TokenManagementThresholds {
    const config = vscode.workspace.getConfiguration('aiChainTraversal');
    
    return {
      compressionTriggerThreshold: config.get('tokenManagement.compressionTriggerThreshold', DEFAULT_TOKEN_THRESHOLDS.COMPRESSION_TRIGGER_THRESHOLD),
      emergencyCompressionThreshold: config.get('tokenManagement.emergencyCompressionThreshold', DEFAULT_TOKEN_THRESHOLDS.EMERGENCY_COMPRESSION_THRESHOLD),
      highUsageWarningThreshold: config.get('tokenManagement.highUsageWarningThreshold', DEFAULT_TOKEN_THRESHOLDS.HIGH_USAGE_WARNING_THRESHOLD),
      cacheEvictionThreshold: config.get('tokenManagement.cacheEvictionThreshold', DEFAULT_TOKEN_THRESHOLDS.CACHE_EVICTION_THRESHOLD)
    };
  }

  protected getDisplayName(): string {
    return 'Recover External Context';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting context recovery', options);
    
    const params = options.input as RecoverContextInput;
    
    try {
      this.checkCancellation(token);
      
      // Validate session
      const session = await this.stateManager.loadSession(params.sessionId);
      if (!session) {
        throw new Error(`Session ${params.sessionId} not found. Cannot recover context.`);
      }

      // Set defaults - prioritize API token budget over user parameter
      const apiMaxTokens = this.getMaxTokens(options);
      const tokenizationOptions = this.getTokenizationOptions(options);
      
      // Use API-provided token budget first, then user parameter, then configurable fallback
      const recoveryConfig = vscode.workspace.getConfiguration('aiChainTraversal.recovery');
      const defaultMaxTokens = recoveryConfig.get<number>('defaultMetadataTokenLimit', 50000);
      const maxTokens = apiMaxTokens !== 128000 ? apiMaxTokens : (params.maxTokens || defaultMaxTokens);
      
      const strategy: RecoveryStrategy = {
        type: params.recoveryStrategy || 'selective',
        maxTokens,
        ...(params.entityFilter && { filter: params.entityFilter }),
        ...(params.continueFrom && { continueFrom: params.continueFrom })
      };

      this.logOperation('Context recovery configuration', {
        recoveryStrategy: strategy.type,
        maxTokens,
        hasModelTokenizer: !!tokenizationOptions?.countTokens,
        tokenBudget: tokenizationOptions?.tokenBudget,
        usingApiTokens: apiMaxTokens !== 128000
      });

      // Get available backups
      const backups = await this.findAvailableBackups(params.sessionId);
      if (backups.length === 0) {
        return this.createResult({
          success: true,  // Changed to true since this is expected behavior for new sessions
          recoveredContext: this.createEmptyContext(),
          message: 'ℹ️ No backup files found for this session - this is normal for new sessions',
          backupsAnalyzed: 0,
          tokenCostEstimate: 0,
          recommendations: [
            'This is expected behavior for new discovery sessions',
            'Backups are created automatically during entity discovery',
            'Use ai-chain-traversal_addEntity to start discovering entities'
          ]
        });
      }

      // Perform strategic recovery based on strategy
      const recoveredContext = await this.performStrategicRecovery(backups, strategy);
      
      // Generate AI-friendly output
      const outputContent = await this.generateOutputContent(
        recoveredContext, 
        params.outputFormat || 'summary'
      );

      // Calculate recommendations
      const recommendations = this.generateRecommendations(recoveredContext, strategy, backups);

      const result: RecoverContextResult = {
        success: true,
        recoveredContext,
        message: `Successfully recovered ${recoveredContext.entities.length} entities and ${recoveredContext.relationships.length} relationships from ${recoveredContext.sourceBackups.length} backup files`,
        backupsAnalyzed: backups.length,
        tokenCostEstimate: recoveredContext.tokenCost,
        recommendations,
        nextSteps: this.generateNextSteps(recoveredContext, strategy)
      };

      // Store recovery info in context for future reference
      await this.storeRecoveryInfo(params.sessionId, recoveredContext);

      this.logOperation('Context recovery completed successfully', result);
      return this.createResult(result, outputContent);

    } catch (error) {
      Logger.error('Context recovery failed', { error: error });
      throw error;
    }
  }

  /**
   * Find available backup files for a session
   */
  private async findAvailableBackups(sessionId: string): Promise<BackupMetadata[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const backupDir = vscode.Uri.joinPath(
      workspaceFolder.uri, 
      '.vscode', 
      'chain-traversal', 
      'context-backups'
    );

    try {
      const entries = await vscode.workspace.fs.readDirectory(backupDir);
      const backupFiles = entries
        .filter(([name, type]) => 
          type === vscode.FileType.File && 
          name.includes(sessionId) && 
          name.endsWith('.json')
        )
        .map(([name]) => name);

      const backups: BackupMetadata[] = [];
      
      for (const fileName of backupFiles) {
        const filePath = vscode.Uri.joinPath(backupDir, fileName);
        const stat = await vscode.workspace.fs.stat(filePath);
        
        // Parse filename to extract timestamp
        const timestampMatch = fileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
        const timestamp = timestampMatch 
          ? new Date(timestampMatch[1].replace(/-/g, ':').replace(/T/, 'T').replace(/:(\d{2})$/, '.$1'))
          : new Date(stat.mtime);

        // Read backup metadata without loading full content
        const metadata = await this.extractBackupMetadata(filePath);
        
        backups.push({
          filePath: filePath.fsPath,
          sessionId,
          timestamp,
          totalEntities: metadata.totalEntities,
          totalRelationships: metadata.totalRelationships,
          entityTypes: metadata.entityTypes,
          estimatedTokens: metadata.estimatedTokens,
          fileSize: stat.size
        });
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      Logger.error('Failed to find backup files', { error });
      return [];
    }
  }

  /**
   * Extract metadata from backup file without loading full content
   */
  private async extractBackupMetadata(filePath: vscode.Uri): Promise<{
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<string, number>;
    estimatedTokens: number;
  }> {
    try {
      const buffer = await vscode.workspace.fs.readFile(filePath);
      const content = new TextDecoder().decode(buffer);
      const backup = JSON.parse(content);

      // Extract metadata without processing full entities
      const totalEntities = backup.entities?.length || 0;
      const totalRelationships = backup.relationships?.length || 0;
      const entityTypes = backup.metadata?.entityTypes || {};
      
      // Estimate tokens based on content size
      const estimatedTokens = this.tokenManager.estimateTokenCountSync(content);

      return {
        totalEntities,
        totalRelationships,
        entityTypes,
        estimatedTokens
      };
    } catch (error) {
      Logger.error('extractBackupMetadata failed', error);
      return {
        totalEntities: 0,
        totalRelationships: 0,
        entityTypes: {},
        estimatedTokens: 0
      };
    }
  }

  /**
   * Perform strategic recovery based on strategy
   */
  private async performStrategicRecovery(
    backups: BackupMetadata[], 
    strategy: RecoveryStrategy
  ): Promise<RecoveredContext> {
    const startTime = Date.now();
    let entities: EntityNode[] = [];
    let relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    const thresholds = this.getTokenThresholds();

    switch (strategy.type) {
      case 'metadata_only':
        return await this.createMetadataOnlyContext(backups);

      case 'selective':
        ({ entities, relationships, tokenCost } = await this.performSelectiveRecovery(
          backups, 
          strategy
        ));
        break;

      case 'progressive':
        ({ entities, relationships, tokenCost } = await this.performProgressiveRecovery(
          backups, 
          strategy
        ));
        break;

      case 'priority_based':
        ({ entities, relationships, tokenCost } = await this.performPriorityRecovery(
          backups, 
          strategy
        ));
        break;

      case 'full':
        ({ entities, relationships, tokenCost } = await this.performFullRecovery(
          backups, 
          strategy
        ));
        break;
    }

    const recoveryTime = Date.now() - startTime;
    const hasMore = tokenCost >= strategy.maxTokens * thresholds.highUsageWarningThreshold;

    return {
      entities,
      relationships,
      tokenCost,
      recoveryTime,
      sourceBackups: backups.map(b => b.filePath),
      summary: this.generateRecoverySummary(entities, relationships, strategy),
      hasMore,
      nextOffset: strategy.continueFrom ? strategy.continueFrom + entities.length : entities.length
    };
  }

  /**
   * Selective recovery based on filters with intelligent compression
   */
  private async performSelectiveRecovery(
    backups: BackupMetadata[], 
    strategy: RecoveryStrategy
  ): Promise<{ entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number }> {
    const entities: EntityNode[] = [];
    const relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    const thresholds = this.getTokenThresholds();

    for (const backup of backups) {
      // NEW: Use configurable compression trigger instead of hard stop
      if (tokenCost >= strategy.maxTokens * thresholds.compressionTriggerThreshold) {
        // Apply compression and continue processing
        const compressionResult = await this.applyCompressionAndContinue(
          entities, 
          relationships, 
          strategy.maxTokens
        );
        entities.splice(0, entities.length, ...compressionResult.entities);
        relationships.splice(0, relationships.length, ...compressionResult.relationships);
        tokenCost = compressionResult.tokenCost;
        
        this.logOperation('Applied compression during selective recovery', {
          originalEntities: entities.length + compressionResult.compressedCount,
          preservedEntities: entities.length,
          compressionRatio: `${compressionResult.compressionRatio}%`,
          triggerThreshold: thresholds.compressionTriggerThreshold
        });
      }

      const backupData = await this.loadBackupFile(backup.filePath);
      if (!backupData) {
        continue;
      }

      // Filter entities based on criteria
      const filteredEntities = this.filterEntities(backupData.entities || [], strategy.filter);
      const entityIds = new Set(filteredEntities.map(e => e.id));

      // Filter relationships to include only those connecting filtered entities
      const filteredRelationships = (backupData.relationships || []).filter((r: any) =>
        entityIds.has(r.fromEntityId) && entityIds.has(r.toEntityId)
      );

      // Calculate token cost for this batch
      const batchContent = JSON.stringify({ entities: filteredEntities, relationships: filteredRelationships });
      const batchTokens = this.tokenManager.estimateTokenCountSync(batchContent);

      if (tokenCost + batchTokens <= strategy.maxTokens) {
        entities.push(...filteredEntities);
        relationships.push(...filteredRelationships);
        tokenCost += batchTokens;
      } else {
        // Progressive detail reduction - try compression first
        const compressedBatch = await this.applyProgressiveDetailReduction(
          filteredEntities,
          filteredRelationships,
          strategy.maxTokens - tokenCost
        );
        
        entities.push(...compressedBatch.entities);
        relationships.push(...compressedBatch.relationships);
        tokenCost += compressedBatch.tokenCost;
        
        // If still can't fit, do partial load as last resort
        if (compressedBatch.tokenCost === 0) {
          const remainingTokens = strategy.maxTokens - tokenCost;
          const partialResult = this.loadPartialContent(
            filteredEntities, 
            filteredRelationships, 
            remainingTokens
          );
          entities.push(...partialResult.entities);
          relationships.push(...partialResult.relationships);
          tokenCost += partialResult.tokenCost;
          break;
        }
      }
    }

    return { entities, relationships, tokenCost };
  }

  /**
   * Progressive recovery with pagination and intelligent compression
   */
  private async performProgressiveRecovery(
    backups: BackupMetadata[], 
    strategy: RecoveryStrategy
  ): Promise<{ entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number }> {
    const entities: EntityNode[] = [];
    const relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    let currentOffset = strategy.continueFrom || 0;
    const thresholds = this.getTokenThresholds();

    // Load entities progressively with pagination
    for (const backup of backups) {
      // NEW: Use configurable compression trigger instead of hard stop
      if (tokenCost >= strategy.maxTokens * thresholds.compressionTriggerThreshold) {
        // Apply compression and continue
        const compressionResult = await this.applyCompressionAndContinue(
          entities, 
          relationships, 
          strategy.maxTokens
        );
        entities.splice(0, entities.length, ...compressionResult.entities);
        relationships.splice(0, relationships.length, ...compressionResult.relationships);
        tokenCost = compressionResult.tokenCost;
        
        this.logOperation('Applied compression during progressive recovery', {
          compressionRatio: `${compressionResult.compressionRatio}%`,
          newTokenCost: tokenCost,
          triggerThreshold: thresholds.compressionTriggerThreshold
        });
      }

      const backupData = await this.loadBackupFile(backup.filePath);
      if (!backupData || !backupData.entities) {
        continue;
      }

      // Apply pagination with intelligent sizing using configurable estimate
      const config = vscode.workspace.getConfiguration('aiChainTraversal.recovery');
      const tokensPerEntity = config.get<number>('tokensPerEntityEstimate', 100);
      
      const availableTokens = strategy.maxTokens - tokenCost;
      const pageSize = Math.max(
        Math.floor(availableTokens / tokensPerEntity), // Configurable estimate
        5 // Minimum page size
      );
      const pagedEntities = backupData.entities.slice(currentOffset, currentOffset + pageSize);
      
      if (pagedEntities.length === 0) {
        currentOffset = 0; // Reset for next backup
        continue;
      }

      const entityIds = new Set(pagedEntities.map((e: any) => e.id));
      const pagedRelationships = (backupData.relationships || []).filter((r: any) =>
        entityIds.has(r.fromEntityId) && entityIds.has(r.toEntityId)
      );

      const batchContent = JSON.stringify({ entities: pagedEntities, relationships: pagedRelationships });
      const batchTokens = this.tokenManager.estimateTokenCountSync(batchContent);

      if (tokenCost + batchTokens <= strategy.maxTokens) {
        entities.push(...pagedEntities);
        relationships.push(...pagedRelationships);
        tokenCost += batchTokens;
        currentOffset += pagedEntities.length;
      } else {
        // Try progressive detail reduction before giving up
        const reducedBatch = await this.applyProgressiveDetailReduction(
          pagedEntities,
          pagedRelationships,
          availableTokens
        );
        
        if (reducedBatch.entities.length > 0) {
          entities.push(...reducedBatch.entities);
          relationships.push(...reducedBatch.relationships);
          tokenCost += reducedBatch.tokenCost;
          currentOffset += reducedBatch.entities.length;
        } else {
          // Only break if no compression/reduction helped
          break;
        }
      }
    }

    return { entities, relationships, tokenCost };
  }

  /**
   * Priority-based recovery focusing on high-value entities with compression
   */
  private async performPriorityRecovery(
    backups: BackupMetadata[], 
    strategy: RecoveryStrategy
  ): Promise<{ entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number }> {
    const entities: EntityNode[] = [];
    const relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    const thresholds = this.getTokenThresholds();

    // Priority order: controller > service > interface > component > others
    const priorityTypes = ['controller', 'service', 'interface', 'component'];

    for (const priorityType of priorityTypes) {
      // NEW: Use configurable compression trigger instead of hard stop
      if (tokenCost >= strategy.maxTokens * thresholds.compressionTriggerThreshold) {
        // Apply compression to make room for more priority entities
        const compressionResult = await this.applyCompressionAndContinue(
          entities, 
          relationships, 
          strategy.maxTokens
        );
        entities.splice(0, entities.length, ...compressionResult.entities);
        relationships.splice(0, relationships.length, ...compressionResult.relationships);
        tokenCost = compressionResult.tokenCost;
        
        this.logOperation('Applied compression during priority recovery', {
          priorityType,
          compressionRatio: `${compressionResult.compressionRatio}%`,
          triggerThreshold: thresholds.compressionTriggerThreshold
        });
      }

      for (const backup of backups) {
        // Check token usage before processing each backup using emergency threshold
        if (tokenCost >= strategy.maxTokens * thresholds.emergencyCompressionThreshold) {
          // Even after compression, we're at emergency threshold - apply final compression
          const finalCompression = await this.applyCompressionAndContinue(
            entities, 
            relationships, 
            strategy.maxTokens
          );
          entities.splice(0, entities.length, ...finalCompression.entities);
          relationships.splice(0, relationships.length, ...finalCompression.relationships);
          tokenCost = finalCompression.tokenCost;
          break;
        }

        const backupData = await this.loadBackupFile(backup.filePath);
        if (!backupData) {
          continue;
        }

        const priorityEntities = (backupData.entities || [])
          .filter((e: any) => e.type.toLowerCase().includes(priorityType))
          .sort((a: any, b: any) => (a.priority || 5) - (b.priority || 5)); // Lower number = higher priority

        for (const entity of priorityEntities) {
          // Check if we need compression before adding this entity using high usage threshold
          if (tokenCost >= strategy.maxTokens * thresholds.highUsageWarningThreshold) {
            const entityTokens = this.tokenManager.estimateTokenCountSync(JSON.stringify(entity));
            if (tokenCost + entityTokens > strategy.maxTokens) {
              // Try compression to make room
              const compressionResult = await this.applyCompressionAndContinue(
                entities, 
                relationships, 
                strategy.maxTokens
              );
              entities.splice(0, entities.length, ...compressionResult.entities);
              relationships.splice(0, relationships.length, ...compressionResult.relationships);
              tokenCost = compressionResult.tokenCost;
            }
          }

          const entityContent = JSON.stringify(entity);
          const entityTokens = this.tokenManager.estimateTokenCountSync(entityContent);

          if (tokenCost + entityTokens <= strategy.maxTokens) {
            entities.push(entity);
            tokenCost += entityTokens;

            // Add related relationships with dependency preservation using configurable types
            const config = vscode.workspace.getConfiguration('aiChainTraversal.relationships');
            const criticalTypes = config.get<string[]>('criticalTypes', ['DEPENDS_ON', 'CALLS', 'USES']);
            
            const relatedRelationships = (backupData.relationships || [])
              .filter((r: any) => r.fromEntityId === entity.id || r.toEntityId === entity.id)
              .sort((a: any, b: any) => {
                // Prioritize critical relationship types
                const aPriority = criticalTypes.indexOf(a.relationshipType);
                const bPriority = criticalTypes.indexOf(b.relationshipType);
                return (aPriority === -1 ? 100 : aPriority) - (bPriority === -1 ? 100 : bPriority);
              });
            
            for (const rel of relatedRelationships) {
              const relContent = JSON.stringify(rel);
              const relTokens = this.tokenManager.estimateTokenCountSync(relContent);
              
              if (tokenCost + relTokens <= strategy.maxTokens) {
                relationships.push(rel);
                tokenCost += relTokens;
              } else {
                break; // Stop adding relationships if we're out of token space
              }
            }
          }
        }
      }
    }

    return { entities, relationships, tokenCost };
  }

  /**
   * Full recovery with intelligent compression (limited by token budget)
   */
  private async performFullRecovery(
    backups: BackupMetadata[], 
    strategy: RecoveryStrategy
  ): Promise<{ entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number }> {
    const entities: EntityNode[] = [];
    const relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    const thresholds = this.getTokenThresholds();

    // Load most recent backup first
    for (const backup of backups) {
      // NEW: Use configurable compression trigger instead of hard stop
      if (tokenCost >= strategy.maxTokens * thresholds.compressionTriggerThreshold) {
        // Apply compression to make room for more data
        const compressionResult = await this.applyCompressionAndContinue(
          entities, 
          relationships, 
          strategy.maxTokens
        );
        entities.splice(0, entities.length, ...compressionResult.entities);
        relationships.splice(0, relationships.length, ...compressionResult.relationships);
        tokenCost = compressionResult.tokenCost;
        
        this.logOperation('Applied compression during full recovery', {
          backup: backup.filePath,
          compressionRatio: `${compressionResult.compressionRatio}%`,
          newTokenCost: tokenCost,
          triggerThreshold: thresholds.compressionTriggerThreshold
        });
      }

      const backupData = await this.loadBackupFile(backup.filePath);
      if (!backupData) {
        continue;
      }

      const batchContent = JSON.stringify(backupData);
      const batchTokens = this.tokenManager.estimateTokenCountSync(batchContent);

      if (tokenCost + batchTokens <= strategy.maxTokens) {
        entities.push(...(backupData.entities || []));
        relationships.push(...(backupData.relationships || []));
        tokenCost += batchTokens;
      } else {
        // Try progressive compression of the backup data before partial loading
        const compressedBackup = await this.applyProgressiveDetailReduction(
          backupData.entities || [],
          backupData.relationships || [],
          strategy.maxTokens - tokenCost
        );
        
        if (compressedBackup.entities.length > 0) {
          entities.push(...compressedBackup.entities);
          relationships.push(...compressedBackup.relationships);
          tokenCost += compressedBackup.tokenCost;
        } else {
          // Last resort: partial load with minimal data
          const remainingTokens = strategy.maxTokens - tokenCost;
          const partialResult = this.loadPartialContent(
            backupData.entities || [], 
            backupData.relationships || [], 
            remainingTokens
          );
          entities.push(...partialResult.entities);
          relationships.push(...partialResult.relationships);
          tokenCost += partialResult.tokenCost;
          break;
        }
      }
    }

    return { entities, relationships, tokenCost };
  }

  /**
   * Helper methods
   */
  private async createMetadataOnlyContext(backups: BackupMetadata[]): Promise<RecoveredContext> {
    const entities: EntityNode[] = [];
    const relationships: RelationshipEdge[] = [];
    let tokenCost = 0;
    const config = vscode.workspace.getConfiguration('aiChainTraversal.recovery');
    const maxTokens = config.get<number>('defaultMetadataTokenLimit', 50000); // Configurable limit for metadata context
    const thresholds = this.getTokenThresholds();

    for (const backup of backups) {
      // Apply compression if approaching token limit using configurable threshold
      if (tokenCost >= maxTokens * thresholds.compressionTriggerThreshold) {
        const compressionResult = await this.applyCompressionAndContinue(
          entities, 
          relationships, 
          maxTokens
        );
        entities.splice(0, entities.length, ...compressionResult.entities);
        relationships.splice(0, relationships.length, ...compressionResult.relationships);
        tokenCost = compressionResult.tokenCost;
        
        this.logOperation('Applied compression during metadata-only recovery', {
          backup: backup.filePath,
          compressionRatio: `${compressionResult.compressionRatio}%`,
          newTokenCost: tokenCost,
          triggerThreshold: thresholds.compressionTriggerThreshold
        });
      }

      const backupData = await this.loadBackupFile(backup.filePath);
      if (!backupData) {
        continue;
      }

      // Create metadata-only versions with minimal content
      const metadataEntities = (backupData.entities || []).map((entity: EntityNode) => ({
        id: entity.id,
        type: entity.type,
        filePath: entity.filePath,
        businessContext: entity.businessContext,
        chainContext: entity.chainContext,
        content: `[Metadata] ${entity.type}`,
        dependencies: entity.dependencies?.slice(0, 3) || [] // Limit dependencies
      }));

      const metadataRelationships = (backupData.relationships || []).map((rel: RelationshipEdge) => ({
        id: rel.id,
        fromEntityId: rel.fromEntityId,
        toEntityId: rel.toEntityId,
        relationshipType: rel.relationshipType,
        strength: rel.strength,
        context: '[Metadata]'
      }));

      const metadataContent = JSON.stringify({ 
        entities: metadataEntities, 
        relationships: metadataRelationships 
      });
      const metadataTokens = this.tokenManager.estimateTokenCountSync(metadataContent);

      if (tokenCost + metadataTokens <= maxTokens) {
        entities.push(...metadataEntities);
        relationships.push(...metadataRelationships);
        tokenCost += metadataTokens;
      } else {
        // Apply progressive compression to fit remaining metadata
        const compressedMetadata = await this.applyProgressiveDetailReduction(
          metadataEntities,
          metadataRelationships,
          maxTokens - tokenCost
        );
        
        entities.push(...compressedMetadata.entities);
        relationships.push(...compressedMetadata.relationships);
        tokenCost += compressedMetadata.tokenCost;
        break;
      }
    }
    
    const summary = `Metadata-only recovery: ${entities.length} entities, ${relationships.length} relationships from ${backups.length} backups`;
    
    return {
      entities,
      relationships,
      tokenCost,
      recoveryTime: 0,
      sourceBackups: backups.map(b => b.filePath),
      summary,
      hasMore: entities.length > 0,
      nextOffset: 0
    };
  }

  private createEmptyContext(): RecoveredContext {
    return {
      entities: [],
      relationships: [],
      tokenCost: 0,
      recoveryTime: 0,
      sourceBackups: [],
      summary: 'No context recovered',
      hasMore: false
    };
  }

  private async loadBackupFile(filePath: string): Promise<any> {
    try {
      const buffer = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = new TextDecoder().decode(buffer);
      return JSON.parse(content);
    } catch (error) {
      Logger.error('Failed to load backup file', { error, filePath });
      return null;
    }
  }

  private filterEntities(entities: EntityNode[], filter?: EntityFilter): EntityNode[] {
    if (!filter) {
      return entities;
    }

    return entities.filter(entity => {
      // Filter by types
      if (filter.types && !filter.types.includes(entity.type)) {
        return false;
      }

      // Filter by specific IDs
      if (filter.ids && !filter.ids.includes(entity.id)) {
        return false;
      }

      // Filter by time range
      if (filter.timeRange) {
        const entityTime = new Date(entity.timestamp);
        if (entityTime < filter.timeRange.from || entityTime > filter.timeRange.to) {
          return false;
        }
      }

      return true;
    });
  }

  private loadPartialContent(
    entities: EntityNode[], 
    relationships: RelationshipEdge[], 
    maxTokens: number
  ): { entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number } {
    const result: { entities: EntityNode[]; relationships: RelationshipEdge[]; tokenCost: number } = { 
      entities: [], 
      relationships: [], 
      tokenCost: 0 
    };
    
    // Load entities first, then relationships
    for (const entity of entities) {
      const entityContent = JSON.stringify(entity);
      const entityTokens = this.tokenManager.estimateTokenCountSync(entityContent);
      
      if (result.tokenCost + entityTokens <= maxTokens) {
        result.entities.push(entity);
        result.tokenCost += entityTokens;
      } else {
        break;
      }
    }

    // Load relationships that connect loaded entities
    const entityIds = new Set(result.entities.map(e => e.id));
    for (const rel of relationships) {
      if (!entityIds.has(rel.fromEntityId) || !entityIds.has(rel.toEntityId)) {
        continue;
      }

      const relContent = JSON.stringify(rel);
      const relTokens = this.tokenManager.estimateTokenCountSync(relContent);
      
      if (result.tokenCost + relTokens <= maxTokens) {
        result.relationships.push(rel);
        result.tokenCost += relTokens;
      } else {
        break;
      }
    }

    return result;
  }

  private generateRecoverySummary(
    entities: EntityNode[], 
    relationships: RelationshipEdge[], 
    strategy: RecoveryStrategy
  ): string {
    const entityTypes = entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const relationshipTypes = relationships.reduce((acc, r) => {
      acc[r.relationshipType] = (acc[r.relationshipType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `Recovered ${entities.length} entities (${Object.entries(entityTypes).map(([type, count]) => `${count} ${type}`).join(', ')}) and ${relationships.length} relationships (${Object.entries(relationshipTypes).map(([type, count]) => `${count} ${type}`).join(', ')}) using ${strategy.type} strategy.`;
  }

  private generateRecommendations(
    context: RecoveredContext, 
    strategy: RecoveryStrategy, 
    backups: BackupMetadata[]
  ): string[] {
    const recommendations: string[] = [];
    const thresholds = this.getTokenThresholds();

    if (context.hasMore) {
      recommendations.push(`Additional context available. Use continueFrom: ${context.nextOffset} to load more.`);
    }

    if (context.tokenCost > strategy.maxTokens * thresholds.highUsageWarningThreshold) {
      recommendations.push('Token usage high. Consider using selective or progressive recovery for next operations.');
    }

    if (backups.length > 1) {
      recommendations.push(`${backups.length} backup files available. Consider analyzing backup distribution for optimal recovery.`);
    }

    if (context.entities.length === 0) {
      recommendations.push('No entities recovered. Try adjusting filters or using a different recovery strategy.');
    }

    return recommendations;
  }

  private generateNextSteps(context: RecoveredContext, _strategy: RecoveryStrategy): string[] {
    const steps: string[] = [];

    if (context.entities.length > 0) {
      steps.push('Process recovered entities with appropriate analysis tools');
      steps.push('Validate relationships and dependency chains');
    }

    if (context.hasMore) {
      steps.push('Continue recovery with progressive loading if needed');
    }

    steps.push('Update current session with recovered context');
    steps.push('Generate comprehensive analysis report');

    return steps;
  }

  private async generateOutputContent(
    context: RecoveredContext, 
    format: string
  ): Promise<string> {
    switch (format) {
      case 'markdown':
        return this.generateMarkdownOutput(context);
      case 'detailed':
        return this.generateDetailedOutput(context);
      case 'structured':
        return JSON.stringify(context, null, 2);
      default:
        return this.generateSummaryOutput(context);
    }
  }

  private generateMarkdownOutput(context: RecoveredContext): string {
    return `
# Context Recovery Results

## Summary
${context.summary}

## Recovered Entities (${context.entities.length})
${context.entities.map(e => `- **${e.id}** (${e.type}) - ${e.filePath}`).join('\n')}

## Recovered Relationships (${context.relationships.length})
${context.relationships.map(r => `- ${r.fromEntityId} → ${r.toEntityId} (${r.relationshipType})`).join('\n')}

## Recovery Stats
- **Token Cost**: ${context.tokenCost}
- **Recovery Time**: ${context.recoveryTime}ms
- **Source Backups**: ${context.sourceBackups.length}
- **Has More**: ${context.hasMore ? 'Yes' : 'No'}

## AI Instructions for Next Steps
The recovered context contains structured entity and relationship data that can be used for:
1. Continuing chain traversal analysis
2. Validating dependency completeness  
3. Generating architectural insights
4. Processing entity relationships

To retrieve this data programmatically, use the structured output format or access via session state management tools.
`;
  }

  private generateDetailedOutput(context: RecoveredContext): string {
    return `Context Recovery Details:
${JSON.stringify({
  summary: context.summary,
  entityCount: context.entities.length,
  relationshipCount: context.relationships.length,
  tokenCost: context.tokenCost,
  hasMore: context.hasMore,
  nextOffset: context.nextOffset
}, null, 2)}`;
  }

  private generateSummaryOutput(context: RecoveredContext): string {
    return `${context.summary} Token cost: ${context.tokenCost}. ${context.hasMore ? `Additional data available from offset ${context.nextOffset}.` : 'Recovery complete.'}`;
  }

  private async storeRecoveryInfo(sessionId: string, context: RecoveredContext): Promise<void> {
    // Store recovery information in extension context for future reference
    const recoveryInfo = {
      lastRecovery: new Date().toISOString(),
      entitiesRecovered: context.entities.length,
      relationshipsRecovered: context.relationships.length,
      tokenCost: context.tokenCost,
      hasMore: context.hasMore,
      nextOffset: context.nextOffset
    };

    this.context.globalState.update(`recovery_${sessionId}`, recoveryInfo);
  }

  private createResult(result: RecoverContextResult, outputContent?: string): vscode.LanguageModelToolResult {
    const text = outputContent || `Recovery ${result.success ? 'completed' : 'failed'}: ${result.message}`;
    
    if (result.success) {
      return this.createSuccessResult(text);
    } else {
      return this.createErrorResult(text);
    }
  }

  /**
   * Apply compression and continue processing instead of stopping
   */
  private async applyCompressionAndContinue(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    _maxTokens: number
  ): Promise<{
    entities: EntityNode[];
    relationships: RelationshipEdge[];
    tokenCost: number;
    compressedCount: number;
    compressionRatio: number;
  }> {
    // Create a mock session for compression
    const mockSession: DiscoverySession = {
      sessionId: `recovery-${Date.now()}`,
      workspaceRoot: this.getWorkspaceRoot(),
      taskDescription: 'Context recovery compression',
      timestamp: new Date(),
      currentPhase: 'analysis',
      progress: {
        totalEntitiesDiscovered: entities.length,
        entitiesProcessed: entities.length,
        chainsIdentified: 0,
        chainsCompleted: 0,
        currentPriorityLevel: 3,
        estimatedTimeRemaining: undefined,
        lastUpdateTimestamp: new Date()
      },
      configuration: {
        maxEntityCacheSize: 10000,
        autoSaveInterval: 30000,
        enableDebugLogging: false,
        stateFileLocation: '.vscode/chain-traversal',
        parallelProcessing: true,
        checkpointFrequency: 5,
        tokenManagement: this.getTokenThresholds()
      }
    };

    // Get configurable settings for compression
    const relationshipConfig = vscode.workspace.getConfiguration('aiChainTraversal.relationships');
    const criticalTypes = relationshipConfig.get<string[]>('criticalTypes', 
      ['DEPENDS_ON', 'CALLS', 'USES', 'IMPLEMENTS', 'EXTENDS']
    );
    
    const tokenConfig = vscode.workspace.getConfiguration('aiChainTraversal.tokenManagement');
    const preserveTypes = tokenConfig.get<string[]>('preserveTypes', [
      'Entity', 'Controller', 'Service', 'CommandHandler', 'QueryHandler', 'EventHandler',
      'Component', 'DTO', 'Store', 'ViewModel', 'DataModel', 
      'UiState', 'DataState', 'Model', 'API', 'Presentation'
    ]);

    // Use TokenManagementService compression with configurable settings
    const compressionResult = await this.tokenManager.summarizeContext(
      entities,
      relationships,
      mockSession,
      {
        dependencyAwareCompression: true,
        compressionTarget: 70, // Target 70% reduction
        preserveTypes: preserveTypes.slice(0, 4) as any, // Use first 4 as critical types
        relationshipPreservationPriority: criticalTypes,
        maxEntitiesPerType: 20,
        prioritizeRecentlyProcessed: true,
        includeHighPriorityRelationships: true
      }
    );

    const newTokenCost = this.tokenManager.estimateTokenCountSync(
      JSON.stringify(compressionResult.preservedEntities) + 
      JSON.stringify(compressionResult.preservedRelationships)
    );

    return {
      entities: compressionResult.preservedEntities,
      relationships: compressionResult.preservedRelationships,
      tokenCost: newTokenCost,
      compressedCount: compressionResult.compressionMetadata.compressedEntityCount,
      compressionRatio: compressionResult.reductionPercentage
    };
  }

  /**
   * Apply progressive detail reduction to fit more entities
   */
  private async applyProgressiveDetailReduction(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    availableTokens: number
  ): Promise<{
    entities: EntityNode[];
    relationships: RelationshipEdge[];
    tokenCost: number;
  }> {
    if (availableTokens <= 0) {
      return { entities: [], relationships: [], tokenCost: 0 };
    }

    // Try different levels of detail reduction
    const reductionLevels = [
      { name: 'minimal', factor: 0.8 },
      { name: 'moderate', factor: 0.6 },
      { name: 'aggressive', factor: 0.4 }
    ];

    for (const level of reductionLevels) {
      const targetEntityCount = Math.floor(entities.length * level.factor);
      const reducedEntities = entities.slice(0, targetEntityCount);
      
      // Filter relationships to connect only included entities
      const entityIds = new Set(reducedEntities.map(e => e.id));
      const reducedRelationships = relationships.filter(r =>
        entityIds.has(r.fromEntityId) && entityIds.has(r.toEntityId)
      );

      const tokenCost = this.tokenManager.estimateTokenCountSync(
        JSON.stringify(reducedEntities) + JSON.stringify(reducedRelationships)
      );

      if (tokenCost <= availableTokens) {
        this.logOperation(`Applied ${level.name} detail reduction`, {
          originalEntities: entities.length,
          reducedEntities: reducedEntities.length,
          tokenCost,
          availableTokens
        });

        return {
          entities: reducedEntities,
          relationships: reducedRelationships,
          tokenCost
        };
      }
    }

    // If even aggressive reduction doesn't fit, return empty
    return { entities: [], relationships: [], tokenCost: 0 };
  }
}
