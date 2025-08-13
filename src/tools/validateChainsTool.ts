/**
 * Validate Chains Tool - Language Model Tool Implementation
 * Validates the completeness and integrity of discovery chains
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { EntityNode, RelationshipEdge, DiscoveryChain } from '../shared/types';
import { Logger } from '../shared/errorHandling';

interface ChainValidationResult {
  isComplete: boolean;
  completionPercentage: number;
  missingEntities: string[];
  missingRelationships: string[];
  brokenChains: string[];
  recommendations: string[];
  validationTimestamp: Date;
  validationDuration: number;
}

interface ValidateChainsInput {
  chainIds?: string[];
  thoroughness?: 'basic' | 'comprehensive' | 'exhaustive';
  autoFix?: boolean;
}

export class ValidateChainsTool extends BaseTool {
  public readonly name = TOOL_NAMES.VALIDATE_CHAINS;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Validate Discovery Chains';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<ValidateChainsInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting chain validation', options);
    
    try {
      this.checkCancellation(token);
      
      // Get current session from context
      const currentSession = this.context.globalState.get('currentSession');
      if (!currentSession) {
        throw new Error('No active discovery session found. Please initialize a session first.');
      }

      const params = options.input || {};
      const thoroughness = params.thoroughness || 'comprehensive';
      const chainIds = params.chainIds;
      
      this.logOperation('Performing chain validation', { thoroughness, chainIds });
      
      // Get all entities and relationships from state manager
      const entities = await this.stateManager.getAllEntities();
      const relationships = await this.stateManager.getAllRelationships();
      const chains = await this.stateManager.getAllChains();
      
      // Perform comprehensive validation
      const validationResult = await this.performChainValidation(
        entities, 
        relationships, 
        chains, 
        chainIds, 
        thoroughness
      );

      const response = this.formatSuccessResponse(
        `✅ Chain validation completed: ${validationResult.completionPercentage}% complete`,
        validationResult
      );

      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Chain validation failed', error);
      
      const errorResponse = this.formatErrorResponse(
        'Failed to validate discovery chains',
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }

  /**
   * Perform comprehensive chain validation analysis
   */
  private async performChainValidation(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    chains: DiscoveryChain[],
    chainIds?: string[],
    thoroughness: 'basic' | 'comprehensive' | 'exhaustive' = 'comprehensive'
  ): Promise<ChainValidationResult> {
    const startTime = Date.now();
    
    // Filter chains if specific IDs provided
    const chainsToValidate = chainIds 
      ? chains.filter(chain => chainIds.includes(chain.id))
      : chains;

    const missingEntities: string[] = [];
    const missingRelationships: string[] = [];
    const brokenChains: string[] = [];
    const recommendations: string[] = [];

    // 1. Validate entity completeness
    for (const chain of chainsToValidate) {
      for (const entityId of chain.chainPath) {
        const entity = entities.find(e => e.id === entityId);
        if (!entity) {
          missingEntities.push(entityId);
          brokenChains.push(chain.id);
        }
      }
    }

    // 2. Validate relationship completeness
    for (const chain of chainsToValidate) {
      for (let i = 0; i < chain.chainPath.length - 1; i++) {
        const fromEntityId = chain.chainPath[i];
        const toEntityId = chain.chainPath[i + 1];
        
        const relationship = relationships.find(r => 
          (r.fromEntityId === fromEntityId && r.toEntityId === toEntityId) ||
          (r.bidirectional && r.fromEntityId === toEntityId && r.toEntityId === fromEntityId)
        );
        
        if (!relationship) {
          missingRelationships.push(`${fromEntityId} -> ${toEntityId}`);
          if (!brokenChains.includes(chain.id)) {
            brokenChains.push(chain.id);
          }
        }
      }
    }

    // 3. Check for orphaned entities (only in comprehensive/exhaustive mode)
    if (thoroughness !== 'basic') {
      const orphanedEntities = entities.filter(entity => 
        entity.dependencies.length === 0 && entity.dependents.length === 0
      );
      
      if (orphanedEntities.length > 0) {
        recommendations.push(`Found ${orphanedEntities.length} orphaned entities that might need integration`);
      }
    }

    // 4. Validate chain integrity (exhaustive mode)
    if (thoroughness === 'exhaustive') {
      for (const chain of chainsToValidate) {
        // Check if chain has circular dependencies
        const visitedEntities = new Set<string>();
        let hasCircularDependency = false;
        
        for (const entityId of chain.chainPath) {
          if (visitedEntities.has(entityId)) {
            hasCircularDependency = true;
            break;
          }
          visitedEntities.add(entityId);
        }
        
        if (hasCircularDependency) {
          recommendations.push(`Chain ${chain.id} has circular dependencies`);
        }
      }
    }

    // Calculate completion percentage
    const totalValidations = chainsToValidate.length;
    const completeChains = chainsToValidate.length - brokenChains.length;
    const completionPercentage = totalValidations > 0 
      ? Math.round((completeChains / totalValidations) * 100 * 100) / 100 
      : 100;

    // Generate recommendations
    if (missingEntities.length > 0) {
      recommendations.push(`Add missing entities: ${missingEntities.slice(0, 5).join(', ')}${missingEntities.length > 5 ? '...' : ''}`);
    }
    
    if (missingRelationships.length > 0) {
      recommendations.push(`Create missing relationships: ${missingRelationships.slice(0, 3).join(', ')}${missingRelationships.length > 3 ? '...' : ''}`);
    }
    
    if (brokenChains.length === 0) {
      recommendations.push('✅ All chains are complete and properly connected');
    }

    // Use configurable validation thresholds
    const config = vscode.workspace.getConfiguration('aiChainTraversal.validation');
    const excellentThreshold = config.get<number>('excellentThreshold', 95);
    const goodThreshold = config.get<number>('goodThreshold', 80);

    if (completionPercentage >= excellentThreshold) {
      recommendations.push('🎯 Discovery quality is excellent');
    } else if (completionPercentage >= goodThreshold) {
      recommendations.push('⚠️ Consider additional discovery to improve completeness');
    } else {
      recommendations.push('🚨 Significant gaps detected - comprehensive rediscovery recommended');
    }

    const validationDuration = Date.now() - startTime;

    return {
      isComplete: brokenChains.length === 0,
      completionPercentage,
      missingEntities,
      missingRelationships,
      brokenChains,
      recommendations,
      validationTimestamp: new Date(),
      validationDuration
    };
  }
}
