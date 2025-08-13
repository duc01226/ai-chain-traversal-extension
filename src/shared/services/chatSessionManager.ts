/**
 * Chat Session Manager for AI Chain Traversal Extension
 * Handles session lifecycle across different chat contexts
 */

import * as vscode from 'vscode';
import { PerformanceMonitorService } from './performanceMonitorService';

export interface ChatSessionState {
  sessionId?: string;
  chatId?: string | undefined;
  isActive: boolean;
  lastActivity: Date;
  stateSnapshot?: {
    entitiesCount: number;
    relationshipsCount: number;
    performanceMonitoring: boolean;
  };
}

export class ChatSessionManager {
  private static instance: ChatSessionManager | undefined;
  private readonly context: vscode.ExtensionContext;
  private currentChatState: ChatSessionState = { isActive: false, lastActivity: new Date() };

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadChatState();
  }

  public static getInstance(context: vscode.ExtensionContext): ChatSessionManager {
    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager(context);
    }
    return ChatSessionManager.instance;
  }

  public static disposeInstance(): void {
    if (ChatSessionManager.instance) {
      ChatSessionManager.instance.dispose();
      ChatSessionManager.instance = undefined;
    }
  }

  /**
   * Handle new chat session creation
   */
  public async handleNewChatSession(): Promise<void> {
    try {
      // Save current state if there's an active session
      if (this.currentChatState.isActive) {
        await this.saveCurrentSessionSnapshot();
      }

      // Reset for new chat
      this.currentChatState = {
        isActive: false,
        lastActivity: new Date()
      };

      // Stop any active performance monitoring
      const performanceMonitor = PerformanceMonitorService.getInstance(this.context);
      performanceMonitor.stopPerformanceMonitoring();

      // Clear current session context
      await this.context.globalState.update('currentSession', undefined);

      await this.saveChatState();
      
      console.log('🔄 New chat session initialized - previous state saved');
    } catch (error) {
      console.warn('Failed to handle new chat session:', error);
    }
  }

  /**
   * Handle session activation
   */
  public async activateSession(sessionId: string, chatId?: string): Promise<void> {
    this.currentChatState = {
      sessionId,
      chatId,
      isActive: true,
      lastActivity: new Date()
    };

    await this.saveChatState();
    console.log(`📍 Session activated: ${sessionId} in chat ${chatId || 'unknown'}`);
  }

  /**
   * Handle session deactivation
   */
  public async deactivateSession(): Promise<void> {
    if (this.currentChatState.isActive) {
      await this.saveCurrentSessionSnapshot();
    }

    this.currentChatState.isActive = false;
    this.currentChatState.lastActivity = new Date();

    // Stop performance monitoring
    const performanceMonitor = PerformanceMonitorService.getInstance(this.context);
    performanceMonitor.stopPerformanceMonitoring();

    await this.saveChatState();
    console.log('📍 Session deactivated');
  }

  /**
   * Get current chat state
   */
  public getCurrentState(): ChatSessionState {
    return { ...this.currentChatState };
  }

  /**
   * Check if should reset state for new analysis
   */
  public shouldResetForNewAnalysis(newTaskDescription: string): boolean {
    const currentSession = this.context.globalState.get<any>('currentSession');
    
    // Reset if:
    // 1. No current session
    // 2. Different task description suggests new analysis
    // 3. Session is old (more than 1 hour)
    if (!currentSession) {
      return true;
    }

    if (currentSession.taskDescription !== newTaskDescription) {
      return true;
    }

    const sessionAge = Date.now() - new Date(currentSession.timestamp).getTime();
    const oneHour = 60 * 60 * 1000;
    if (sessionAge > oneHour) {
      return true;
    }

    return false;
  }

  /**
   * Save current session snapshot
   */
  private async saveCurrentSessionSnapshot(): Promise<void> {
    if (!this.currentChatState.sessionId) {
      return;
    }

    try {
      // Get current metrics
      const performanceMonitor = PerformanceMonitorService.getInstance(this.context);
      const performanceReport = performanceMonitor.getPerformanceReport();
      
      this.currentChatState.stateSnapshot = {
        entitiesCount: performanceReport.cacheMetrics?.cacheMemoryUsageMB || 0,
        relationshipsCount: 0, // Would need access to state manager
        performanceMonitoring: performanceReport.currentMetrics !== undefined
      };

      // Store in context for potential recovery
      await this.context.globalState.update(
        `sessionSnapshot_${this.currentChatState.sessionId}`, 
        this.currentChatState.stateSnapshot
      );

      console.log(`💾 Session snapshot saved for ${this.currentChatState.sessionId}`);
    } catch (error) {
      console.warn('Failed to save session snapshot:', error);
    }
  }

  /**
   * Load chat state from context
   */
  private loadChatState(): void {
    try {
      const savedState = this.context.globalState.get<ChatSessionState>('chatSessionState');
      if (savedState) {
        this.currentChatState = {
          ...savedState,
          lastActivity: new Date(savedState.lastActivity)
        };
      }
    } catch (error) {
      console.warn('Failed to load chat state:', error);
    }
  }

  /**
   * Save chat state to context
   */
  private async saveChatState(): Promise<void> {
    try {
      await this.context.globalState.update('chatSessionState', this.currentChatState);
    } catch (error) {
      console.warn('Failed to save chat state:', error);
    }
  }

  /**
   * Get session recommendations for user
   */
  public getSessionRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.currentChatState.isActive) {
      recommendations.push('💡 Start a new analysis session with ai-chain-traversal_initializeSession');
    }

    if (this.currentChatState.stateSnapshot) {
      const snapshot = this.currentChatState.stateSnapshot;
      if (snapshot.entitiesCount > 0) {
        recommendations.push(`🔗 Previous session had ${snapshot.entitiesCount} entities discovered`);
      }
      if (snapshot.performanceMonitoring) {
        recommendations.push('⚡ Performance monitoring was active in previous session');
      }
    }

    const sessionAge = Date.now() - this.currentChatState.lastActivity.getTime();
    const hours = Math.floor(sessionAge / (60 * 60 * 1000));
    if (hours > 0) {
      recommendations.push(`⏰ Last activity was ${hours} hour(s) ago - consider starting fresh`);
    }

    return recommendations;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    // Save current state before disposal
    this.saveChatState().catch(error => {
      console.warn('Failed to save chat state on disposal:', error);
    });
  }
}
