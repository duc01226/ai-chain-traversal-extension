/**
 * Initialize Discovery Session Tool
 * Creates a new AI-driven code discovery session with external state management
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { DiscoverySession } from '../shared/types';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { ChatSessionManager } from '../shared/services/chatSessionManager';
import { Logger } from '../shared/errorHandling';

interface InitializeSessionParameters {
  taskDescription: string;
  workspaceRoot?: string;
}

export class InitializeSessionTool extends BaseTool {
  public readonly name = TOOL_NAMES.INITIALIZE_SESSION;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    // Initialize with temporary workspace root, will be updated during session initialization
    const tempWorkspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, tempWorkspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Initialize Discovery Session';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting session initialization', options);
    
    // Extract dynamic token budget and tokenization options
    const maxTokens = this.getMaxTokens(options);
    const tokenizationOptions = this.getTokenizationOptions(options);
    
    this.logOperation('Token management configuration', {
      maxTokens,
      hasModelSpecificTokenizer: !!tokenizationOptions?.countTokens,
      tokenBudget: tokenizationOptions?.tokenBudget
    });
    
    // Type assertion to access the parameters
    const params = options.input as InitializeSessionParameters;
    
    try {
      // Validate parameters
      this.validateParameters(params);
      
      // Handle chat session context
      await this.handleChatSessionContext();
      
      // Determine workspace root
      const workspaceRoot = params.workspaceRoot || this.getWorkspaceRoot();
      
      this.checkCancellation(token);
      
      // Initialize the discovery session with token-aware configuration
      const session: DiscoverySession = await this.stateManager.initializeSession(
        params.taskDescription,
        workspaceRoot
      );
      
      // Store token configuration in session metadata for future tools
      await this.storeTokenConfigurationInSession(session.sessionId, maxTokens, tokenizationOptions);
      
      this.checkCancellation(token);
      
      this.logOperation('Session initialized successfully', { 
        sessionId: session.sessionId, 
        maxTokens,
        hasModelTokenizer: !!tokenizationOptions 
      });
      
      const tokenInfo = tokenizationOptions?.tokenBudget 
        ? `🎯 **Model Token Budget:** ${tokenizationOptions.tokenBudget.toLocaleString()} tokens (dynamic)\n`
        : `📊 **Configured Token Limit:** ${maxTokens.toLocaleString()} tokens (static)\n`;
      
      const response = this.formatSuccessResponse(
        `✅ Discovery session initialized successfully!

📋 **Session Details:**
- Session ID: ${session.sessionId}
- Task: ${session.taskDescription}
- Workspace: ${session.workspaceRoot}
- Timestamp: ${session.timestamp}
- Phase: ${session.currentPhase}

🧠 **Token Management:**
${tokenInfo}${tokenizationOptions?.countTokens ? '✅ Model-specific tokenizer available\n' : '⚠️ Using estimation-based tokenizer\n'}
- Warning threshold: 90% of token limit
- Auto-summarization: Enabled at 90% usage

🚀 **Status:** Session ready for entity discovery and chain traversal

**Next Steps:**
1. Use \`ai-chain-traversal_addEntity\` to discover and add code entities
2. Use \`ai-chain-traversal_addRelationship\` to map dependencies
3. Use \`ai-chain-traversal_getNextWorkItem\` to get prioritized work items
4. Use \`ai-chain-traversal_validateChains\` to check completeness`,
        {
          sessionId: session.sessionId,
          taskDescription: session.taskDescription,
          workspaceRoot: session.workspaceRoot,
          timestamp: session.timestamp,
          currentPhase: session.currentPhase,
          status: 'Session ready for entity discovery and chain traversal'
        }
      );
      
      // Store session in context for other tools to access
      this.context.globalState.update('currentSession', session);
      
      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Session initialization failed', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize discovery session';
      const errorResponse = this.formatErrorResponse(
        errorMessage,
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }

  /**
   * Store token configuration in session metadata for future tools
   */
  private async storeTokenConfigurationInSession(
    sessionId: string, 
    maxTokens: number, 
    tokenizationOptions?: vscode.LanguageModelToolTokenizationOptions
  ): Promise<void> {
    try {
      const tokenConfig = {
        maxTokens,
        hasModelTokenizer: !!tokenizationOptions?.countTokens,
        tokenBudget: tokenizationOptions?.tokenBudget,
        configuredAt: new Date().toISOString()
      };
      
      // Store in global state for access by other tools
      await this.context.globalState.update(`tokenConfig_${sessionId}`, tokenConfig);
      
      this.logOperation('Token configuration stored', { sessionId, tokenConfig });
    } catch (error) {
      Logger.error('Failed to store token configuration', { error });
      // Non-critical error, continue execution
    }
  }

  /**
   * Validate the input parameters
   */
  private validateParameters(params: InitializeSessionParameters): void {
    if (!params.taskDescription || typeof params.taskDescription !== 'string' || params.taskDescription.trim().length === 0) {
      throw new Error('taskDescription is required and must be a non-empty string');
    }

    if (params.workspaceRoot !== undefined && (typeof params.workspaceRoot !== 'string' || params.workspaceRoot.trim().length === 0)) {
      throw new Error('workspaceRoot must be a non-empty string if provided');
    }
  }

  /**
   * Get current session from context
   */
  public static getCurrentSession(context: vscode.ExtensionContext): DiscoverySession | undefined {
    return context.globalState.get<DiscoverySession>('currentSession');
  }

  /**
   * Check if a session is currently active
   */
  public static hasActiveSession(context: vscode.ExtensionContext): boolean {
    const session = this.getCurrentSession(context);
    return session !== undefined;
  }

  /**
   * Handle chat session context for proper state management
   */
  private async handleChatSessionContext(): Promise<void> {
    // Get chat session manager
    const chatSessionManager = ChatSessionManager.getInstance(this.context);
    
    // Check current chat state
    const currentState = chatSessionManager.getCurrentState();
    
    // Log context switch for debugging
    this.logOperation('Handling chat session context', {
      isActive: currentState.isActive,
      hasSnapshot: !!currentState.stateSnapshot,
      lastActivity: currentState.lastActivity,
      recommendations: chatSessionManager.getSessionRecommendations()
    });

    // Handle new chat session initialization
    await chatSessionManager.handleNewChatSession();
    
    this.logOperation('Chat session context handled', {
      note: 'New session initialization - created isolated state',
      recommendation: 'Each chat session maintains independent discovery context'
    });
  }
}
