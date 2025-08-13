/**
 * Output Results Tool - Simplified Version for Testing
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { TokenManagementService } from '../shared/services/tokenManagementService';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { EntityNode, RelationshipEdge, DiscoverySession } from '../shared/types';
import { Logger } from '../shared/errorHandling';

interface OutputResultsInput {
  sessionId: string;
  outputType?: 'user_markdown' | 'ai_summary' | 'comprehensive' | 'paginated' | 'chain_completion';
  includeChainDetails?: boolean;
  maxTokensPerPage?: number;
  pageNumber?: number;
}

interface OutputData {
  type: 'entities' | 'relationships' | 'session' | 'analysis' | 'mixed';
  entities?: EntityNode[];
  relationships?: RelationshipEdge[];
  session?: DiscoverySession;
}

interface OutputResultsResult {
  success: boolean;
  formattedOutput: string;
  totalItems: number;
  summary: string;
  aiReadyFormat: string;
  recommendations: string[];
}

export class OutputResultsTool extends BaseTool {
  public readonly name = TOOL_NAMES.OUTPUT_RESULTS;
  private tokenManager: TokenManagementService;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    this.tokenManager = new TokenManagementService(context);
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Format and Display Results';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting result output formatting', options);
    
    const params = options.input as OutputResultsInput;
    
    try {
      this.checkCancellation(token);
      
      // Fetch session data using sessionId
      const sessionId = params.sessionId;
      const outputType = params.outputType || 'comprehensive';

      // Get session data
      const session = await this.stateManager.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const entities = await this.stateManager.getAllEntities();
      const relationships = await this.stateManager.getAllRelationships();

      // Create output data structure
      const outputData: OutputData = {
        type: 'mixed',
        entities,
        relationships,
        session
      };

      // Generate appropriate output based on type
      const formattedOutput = this.generateBasicOutput(outputData, outputType);
      
      // Generate summary
      const summary = this.generateBasicSummary(outputData);
      
      // Generate recommendations
      const recommendations = this.generateBasicRecommendations(outputData);

      const result: OutputResultsResult = {
        success: true,
        formattedOutput,
        totalItems: entities.length + relationships.length,
        summary,
        aiReadyFormat: this.generateBasicAIFormat(outputData),
        recommendations
      };

      this.logOperation('Result output formatting completed', { 
        outputType, 
        totalItems: result.totalItems,
        tokenCount: this.tokenManager.estimateTokenCount(result.formattedOutput)
      });

      const response = this.formatSuccessResponse(
        `✅ Results formatted successfully in ${outputType} format`,
        result
      );

      return this.createSuccessResult(response);

    } catch (error) {
      Logger.error('Result output formatting failed', { error });
      
      const errorResponse = this.formatErrorResponse(
        'Failed to format output results',
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }

  private generateBasicOutput(data: OutputData, outputType: string): string {
    const entities = data.entities || [];
    const relationships = data.relationships || [];
    
    let output = `# Analysis Results\n\n`;
    output += `## Summary\n`;
    output += `- **Entities**: ${entities.length}\n`;
    output += `- **Relationships**: ${relationships.length}\n\n`;
    
    if (outputType === 'comprehensive' || outputType === 'user_markdown') {
      output += `## Entities\n`;
      entities.slice(0, 10).forEach(entity => {
        output += `- **${entity.id}** (${entity.type}): ${entity.filePath}\n`;
      });
      
      if (entities.length > 10) {
        output += `... and ${entities.length - 10} more entities\n`;
      }
      
      output += `\n## Relationships\n`;
      relationships.slice(0, 10).forEach(rel => {
        output += `- ${rel.fromEntityId} → ${rel.toEntityId} (${rel.relationshipType})\n`;
      });
      
      if (relationships.length > 10) {
        output += `... and ${relationships.length - 10} more relationships\n`;
      }
    }
    
    return output;
  }

  private generateBasicSummary(data: OutputData): string {
    const entities = data.entities || [];
    const relationships = data.relationships || [];
    
    return `Analysis complete: ${entities.length} entities and ${relationships.length} relationships found.`;
  }

  private generateBasicRecommendations(data: OutputData): string[] {
    const entities = data.entities || [];
    const recommendations: string[] = [];
    
    if (entities.length === 0) {
      recommendations.push('No entities found. Consider adding entities to the discovery session.');
    } else {
      recommendations.push(`Found ${entities.length} entities. Continue analysis for deeper insights.`);
    }
    
    return recommendations;
  }

  private generateBasicAIFormat(data: OutputData): string {
    const entities = data.entities || [];
    const relationships = data.relationships || [];
    
    return JSON.stringify({
      type: 'analysis_results',
      entityCount: entities.length,
      relationshipCount: relationships.length,
      entities: entities.slice(0, 5).map(e => ({ id: e.id, type: e.type, filePath: e.filePath })),
      relationships: relationships.slice(0, 5).map(r => ({ from: r.fromEntityId, to: r.toEntityId, type: r.relationshipType }))
    }, null, 2);
  }
}
