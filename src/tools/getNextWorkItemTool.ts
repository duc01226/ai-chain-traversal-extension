/**
 * Get Next Work Item Tool - Language Model Tool Implementation
 * Retrieves the next priority work item for systematic processing
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { WorkItem, Priority } from '../shared/types';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { Logger } from '../shared/errorHandling';

interface GetNextWorkItemInput {
  priority?: number;
  agentId?: string;
  entityType?: string;
}

interface GetNextWorkItemResult {
  workItem: WorkItem | null;
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  hasMoreWork: boolean;
  estimatedTimeRemaining?: number;
}

export class GetNextWorkItemTool extends BaseTool {
  public readonly name = TOOL_NAMES.GET_NEXT_WORK_ITEM;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Get Next Work Item';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting get next work item', options);
    
    const params = options.input as GetNextWorkItemInput;
    
    try {
      this.checkCancellation(token);
      
      // Get current session from context
      const currentSession = this.context.globalState.get('currentSession');
      if (!currentSession) {
        throw new Error('No active discovery session found. Please initialize a session first.');
      }

      // Get next work item from state manager
      const priority = params.priority as Priority | undefined;
      const workItem = await this.stateManager.getNextWorkItem(priority, params.agentId);
      
      // Get current queue statistics
      const queueStats = await this.stateManager.getWorkQueueStats();
      
      const result: GetNextWorkItemResult = {
        workItem,
        queueStats,
        hasMoreWork: queueStats.pending > 0,
        estimatedTimeRemaining: queueStats.pending > 0 ? queueStats.pending * 60 : 0
      };

      const response = this.formatSuccessResponse(
        '✅ Retrieved next work item successfully',
        result
      );

      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Get next work item failed', error);
      
      const errorResponse = this.formatErrorResponse(
        'Failed to get next work item',
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }
}
