/**
 * Generate Report Tool - Language Model Tool Implementation
 * Generates comprehensive discovery reports in multiple formats
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { ERROR_MESSAGES, TOOL_NAMES } from '../shared/constants';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { Logger } from '../shared/errorHandling';

interface GenerateReportInput {
  format?: 'yaml' | 'json' | 'markdown';
  includeMetrics?: boolean;
  includeChainDetails?: boolean;
  includeVisualization?: boolean;
  outputPath?: string;
}

interface GenerateReportResult {
  success: boolean;
  reportPath: string;
  format: string;
  size: number;
  entitiesAnalyzed: number;
  relationshipsFound: number;
  chainsCompleted: number;
  generationTime: number;
  timestamp: Date;
}

export class GenerateReportTool extends BaseTool {
  public readonly name = TOOL_NAMES.GENERATE_REPORT;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Generate Discovery Report';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting report generation', options);
    
    const params = options.input as GenerateReportInput;
    
    try {
      this.checkCancellation(token);
      
      // Get current session from context
      const currentSession = this.context.globalState.get('currentSession');
      if (!currentSession) {
        // Instead of throwing an error, create a minimal report for empty session
        this.logOperation('No active session found, generating empty report');
        
        const result: GenerateReportResult = {
          success: true,
          reportPath: 'No active session',
          format: params.format || 'yaml',
          size: 0,
          entitiesAnalyzed: 0,
          relationshipsFound: 0,
          chainsCompleted: 0,
          generationTime: 0,
          timestamp: new Date()
        };

        const response = this.formatSuccessResponse(
          '⚠️ No active discovery session found. Please initialize a session first using ai-chain-traversal_initializeSession.',
          result
        );

        return this.createSuccessResult(response);
      }

      const sessionId = (currentSession as any).sessionId;

      // Set defaults
      const format = params.format || 'yaml';
      const includeMetrics = params.includeMetrics !== false;
      const includeChainDetails = params.includeChainDetails !== false;
      
      // Generate the actual report using state manager
      const report = await this.stateManager.generateReport(sessionId);
      
      // Customize report based on options
      let customizedReport = report;
      if (!includeMetrics) {
        // Remove performance metrics if not requested
        customizedReport = { ...report };
        delete (customizedReport as any).performanceMetrics;
      }
      
      if (!includeChainDetails) {
        // Simplify chain analysis if detailed chains not requested  
        customizedReport = { 
          ...customizedReport, 
          chainAnalysis: {
            identifiedChains: [],
            completedChains: [],
            blockedChains: [],
            averageChainLength: customizedReport.chainAnalysis.averageChainLength,
            longestChain: customizedReport.chainAnalysis.longestChain,
            criticalPathAnalysis: customizedReport.chainAnalysis.criticalPathAnalysis
          }
        };
      }
      
      // Export to specified format if requested
      const workspaceRoot = this.getWorkspaceRoot();
      const reportPath = params.outputPath || `${workspaceRoot}/.vscode/chain-traversal/discovery-report.${format}`;
      
      if (format === 'yaml') {
        await this.stateManager.exportToYaml(sessionId, reportPath);
      }
      
      const result: GenerateReportResult = {
        success: true,
        reportPath,
        format,
        size: JSON.stringify(customizedReport).length, // Approximate size in bytes
        entitiesAnalyzed: customizedReport.summary.totalEntitiesDiscovered,
        relationshipsFound: customizedReport.summary.totalRelationshipsFound,
        chainsCompleted: customizedReport.summary.completeChainsCount,
        generationTime: Date.now() - customizedReport.generatedAt.getTime(),
        timestamp: new Date()
      };

      const response = this.formatSuccessResponse(
        `✅ Discovery report generated successfully: ${reportPath}`,
        result
      );

      // Optionally show the report to the user
      if (format === 'markdown') {
        await this.showNotification(
          `📊 Discovery report generated: ${reportPath}`,
          'info'
        );
      }

      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Report generation failed', error);
      
      const errorResponse = this.formatErrorResponse(
        ERROR_MESSAGES.REPORT_GENERATION_FAILED,
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }
}
