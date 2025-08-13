/**
 * AI Tools Provider for Chain Traversal Extension
 * Manages registration and coordination of Language Model Tools
 */

import * as vscode from 'vscode';
import { Logger } from '../shared/errorHandling';
import { StatusBarManager } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { InitializeSessionTool } from '../tools/initializeSessionTool';
import { AddEntityTool } from '../tools/addEntityTool';
import { AddRelationshipTool } from '../tools/addRelationshipTool';
import { GetNextWorkItemTool } from '../tools/getNextWorkItemTool';
import { MarkProcessedTool } from '../tools/markProcessedTool';
import { ValidateChainsTool } from '../tools/validateChainsTool';
import { GenerateReportTool } from '../tools/generateReportTool';
import { CoordinateAgentsTool } from '../tools/coordinateAgentsTool';
import { RecoverContextTool } from '../tools/recoverContextTool';
import { AnalyzeBackupsTool } from '../tools/analyzeBackupsTool';
import { OutputResultsTool } from '../tools/outputResultsTool';

export class AIToolsProvider {
  private readonly tools: Map<string, vscode.LanguageModelTool<object>>;
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.tools = new Map();
    this.initializeTools();
  }

  /**
   * Initialize all Language Model Tools
   */
  private initializeTools(): void {
    Logger.info('Initializing AI Chain Traversal Tools...');

    try {
      // Initialize all tools
      const initializeSessionTool = new InitializeSessionTool(this.context);
      const addEntityTool = new AddEntityTool(this.context);
      const addRelationshipTool = new AddRelationshipTool(this.context);
      const getNextWorkItemTool = new GetNextWorkItemTool(this.context);
      const markProcessedTool = new MarkProcessedTool(this.context);
      const validateChainsTool = new ValidateChainsTool(this.context);
      const generateReportTool = new GenerateReportTool(this.context);
      const coordinateAgentsTool = new CoordinateAgentsTool(this.context);
      const recoverContextTool = new RecoverContextTool(this.context);
      const analyzeBackupsTool = new AnalyzeBackupsTool(this.context);
      const outputResultsTool = new OutputResultsTool(this.context);

      // Register tools
      this.tools.set(TOOL_NAMES.INITIALIZE_SESSION, initializeSessionTool);
      this.tools.set(TOOL_NAMES.ADD_ENTITY, addEntityTool);
      this.tools.set(TOOL_NAMES.ADD_RELATIONSHIP, addRelationshipTool);
      this.tools.set(TOOL_NAMES.GET_NEXT_WORK_ITEM, getNextWorkItemTool);
      this.tools.set(TOOL_NAMES.MARK_PROCESSED, markProcessedTool);
      this.tools.set(TOOL_NAMES.VALIDATE_CHAINS, validateChainsTool);
      this.tools.set(TOOL_NAMES.GENERATE_REPORT, generateReportTool);
      this.tools.set(TOOL_NAMES.COORDINATE_AGENTS, coordinateAgentsTool);
      this.tools.set(TOOL_NAMES.RECOVER_CONTEXT, recoverContextTool);
      this.tools.set(TOOL_NAMES.ANALYZE_BACKUPS, analyzeBackupsTool);
      this.tools.set(TOOL_NAMES.OUTPUT_RESULTS, outputResultsTool);

      Logger.info(`Initialized ${this.tools.size} AI Chain Traversal Tools`);
    } catch (error) {
      Logger.error('Failed to initialize AI Tools', error);
      throw error;
    }
  }

  /**
   * Register all tools with VS Code Language Model API
   */
  public async registerTools(): Promise<vscode.Disposable[]> {
    const disposables: vscode.Disposable[] = [];

    Logger.info('Registering Language Model Tools with VS Code...');

    try {
      for (const [toolName, tool] of this.tools) {
        Logger.debug(`Registering tool: ${toolName}`);
        
        const disposable = vscode.lm.registerTool(toolName, tool);
        disposables.push(disposable);
        
        Logger.debug(`Successfully registered tool: ${toolName}`);
      }

      Logger.info(`Successfully registered ${disposables.length} Language Model Tools`);
      StatusBarManager.updateStatus('Chain Traversal Ready', 'AI Chain Traversal Tools loaded and ready');

      return disposables;
    } catch (error) {
      Logger.error('Failed to register Language Model Tools', error);
      
      // Clean up any successfully registered tools
      for (const disposable of disposables) {
        disposable.dispose();
      }
      
      throw error;
    }
  }

  /**
   * Get a specific tool instance
   */
  public getTool(toolName: string): vscode.LanguageModelTool<object> | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get all registered tool names
   */
  public getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  public hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Get tool statistics
   */
  public getToolStatistics(): { totalTools: number; registeredTools: string[] } {
    return {
      totalTools: this.tools.size,
      registeredTools: this.getToolNames()
    };
  }

  /**
   * Dispose of all tools and cleanup resources
   */
  public dispose(): void {
    Logger.info('Disposing AI Tools Provider...');
    
    this.tools.clear();
    
    Logger.info('AI Tools Provider disposed');
  }

  /**
   * Test tool registration and basic functionality
   */
  public async testTools(): Promise<{ success: boolean; details: string }> {
    try {
      Logger.info('Testing AI Chain Traversal Tools...');

      const toolCount = this.tools.size;
      const expectedTools = [
        TOOL_NAMES.INITIALIZE_SESSION,
        TOOL_NAMES.ADD_ENTITY,
        TOOL_NAMES.ADD_RELATIONSHIP,
        TOOL_NAMES.GET_NEXT_WORK_ITEM,
        TOOL_NAMES.MARK_PROCESSED,
        TOOL_NAMES.VALIDATE_CHAINS,
        TOOL_NAMES.GENERATE_REPORT,
        TOOL_NAMES.COORDINATE_AGENTS,
        TOOL_NAMES.RECOVER_CONTEXT,
        TOOL_NAMES.ANALYZE_BACKUPS,
        TOOL_NAMES.OUTPUT_RESULTS
      ];

      // Check if all expected tools are registered
      const missingTools = expectedTools.filter(toolName => !this.tools.has(toolName));
      
      if (missingTools.length > 0) {
        const message = `Missing tools: ${missingTools.join(', ')}`;
        Logger.error('Tool test failed', { missingTools });
        return { success: false, details: message };
      }

      // Test tool accessibility
      for (const toolName of expectedTools) {
        const tool = this.tools.get(toolName);
        if (!tool) {
          const message = `Tool ${toolName} is not properly initialized`;
          Logger.error('Tool test failed', { failedTool: toolName });
          return { success: false, details: message };
        }
      }

      const successMessage = `✅ All ${toolCount} tools are properly registered and accessible`;
      Logger.info('Tool test completed successfully', { toolCount, toolNames: expectedTools });
      
      return { success: true, details: successMessage };
    } catch (error) {
      const errorMessage = `Tool test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      Logger.error('Tool test failed', error);
      return { success: false, details: errorMessage };
    }
  }
}
