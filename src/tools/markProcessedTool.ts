/**
 * Mark Entity Processed Tool - Language Model Tool Implementation
 *       // Update entity status in state manager
      const entity = await this.stateManager.getEntity(params.entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${params.entityId}`);
      }

      // Update entity as processed
      const entityUpdates: Partial<EntityNode> = {
        processed: params.processingResult.success,
        timestamp: new Date()
      };

      if (params.agentId) {
        entityUpdates.processingAgent = params.agentId;
      }

      await this.stateManager.updateEntity(params.entityId, entityUpdates);ity as processed and updates its state
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { WorkItemStatus, EntityNode } from '../shared/types';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { Logger } from '../shared/errorHandling';

interface ProcessingResult {
  success: boolean;
  processingTime?: number;
  errorMessage?: string;
  discoveredRelationships?: number;
  qualityScore?: number;
}

interface MarkProcessedInput {
  entityId: string;
  processingResult: ProcessingResult;
  agentId?: string;
  notes?: string;
}

interface MarkProcessedResult {
  success: boolean;
  entityId: string;
  previousStatus: WorkItemStatus;
  newStatus: WorkItemStatus;
  processingTime?: number;
  timestamp: Date;
}

export class MarkProcessedTool extends BaseTool {
  public readonly name = TOOL_NAMES.MARK_PROCESSED;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Mark Entity Processed';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting mark entity processed', options);
    
    const params = options.input as MarkProcessedInput;
    
    try {
      this.checkCancellation(token);
      
      // Validate required parameters
      if (!params.entityId || typeof params.entityId !== 'string') {
        throw new Error('entityId is required and must be a string');
      }

      if (!params.processingResult) {
        throw new Error('processingResult is required');
      }

      // Get current session from context
      const currentSession = this.context.globalState.get('currentSession');
      if (!currentSession) {
        throw new Error('No active discovery session found. Please initialize a session first.');
      }

      // Update entity status in state manager
      const entity = await this.stateManager.getEntity(params.entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${params.entityId}`);
      }

      // Update entity as processed
      const entityUpdates: Partial<EntityNode> = {
        processed: params.processingResult.success,
        timestamp: new Date()
      };

      if (params.agentId) {
        entityUpdates.processingAgent = params.agentId;
      }

      await this.stateManager.updateEntity(params.entityId, entityUpdates);

      // If there's analysis data in the processing result, update it
      if (params.processingResult.success && params.processingResult.discoveredRelationships) {
        const analysisData = entity.analysisData || {
          usageCount: 0,
          inheritanceChain: [],
          architecturalPattern: '',
          relevanceScore: 0.5,
          members: [],
          isSummarized: false,
          businessRules: [],
          integrationPoints: [],
          testableUnits: []
        };
        
        await this.stateManager.updateEntity(params.entityId, {
          analysisData: {
            ...analysisData,
            relevanceScore: params.processingResult.qualityScore || analysisData.relevanceScore
          }
        });
      }

      const result: MarkProcessedResult = {
        success: true,
        entityId: params.entityId,
        previousStatus: entity.processed ? 'completed' : 'pending',
        newStatus: params.processingResult.success ? 'completed' : 'failed',
        processingTime: params.processingResult.processingTime || 1000,
        timestamp: new Date()
      };

      const response = this.formatSuccessResponse(
        `✅ Entity ${params.entityId} marked as ${result.newStatus}`,
        result
      );

      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Mark entity processed failed', error);
      
      const errorResponse = this.formatErrorResponse(
        'Failed to mark entity as processed',
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }
}
