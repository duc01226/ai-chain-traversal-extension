/**
 * AI Chain Traversal Tools Extension Entry Point
 * Provides external state management and chain-aware analysis for AI agents
 */

import * as vscode from 'vscode';
import { Logger } from './shared/errorHandling';
import { StatusBarManager } from './base/baseTool';
import { AIToolsProvider } from './providers/aiToolsProvider';
import { ChatSessionManager } from './shared/services/chatSessionManager';

let aiToolsProvider: AIToolsProvider | undefined;
let toolDisposables: vscode.Disposable[] = [];

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        Logger.initialize(getDebugLoggingEnabled());
        Logger.info('🚀 Activating AI Chain Traversal Tools extension...');

        // Initialize status bar with context for panel support
        StatusBarManager.initialize(context);

        // Initialize chat session manager
        ChatSessionManager.getInstance(context);

        // Initialize AI Tools Provider
        aiToolsProvider = new AIToolsProvider(context);

        // Register Language Model Tools
        toolDisposables = await aiToolsProvider.registerTools();
        
        // Add disposables to context
        context.subscriptions.push(...toolDisposables);
        context.subscriptions.push({
            dispose: () => {
                StatusBarManager.dispose();
                Logger.dispose();
                aiToolsProvider?.dispose();
                
                // Clean up singletons
                const { PerformanceMonitorService } = require('./shared/services/performanceMonitorService');
                PerformanceMonitorService.disposeInstance();
                ChatSessionManager.disposeInstance();
            }
        });

        // Test tools
        const testResult = await aiToolsProvider.testTools();
        if (testResult.success) {
            Logger.info('✅ AI Chain Traversal Tools extension activated successfully');
            // Don't show status bar immediately - wait for tool usage
            StatusBarManager.updateStatus('Ready', 'AI Chain Traversal Tools ready for use');
        } else {
            Logger.error('⚠️ AI Chain Traversal Tools activated with issues', testResult.details);
            StatusBarManager.showError('Chain Traversal Issues');
        }

        // Register commands
        registerCommands(context);

        Logger.info('AI Chain Traversal Tools extension activation completed');
        
    } catch (error) {
        Logger.error('Failed to activate AI Chain Traversal Tools extension', error);
        
        vscode.window.showErrorMessage(
            `Failed to activate AI Chain Traversal Tools: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        
        throw error;
    }
}

/**
 * Extension deactivation function
 */
export function deactivate(): void {
    Logger.info('🔄 Deactivating AI Chain Traversal Tools extension...');
    
    // Dispose of tool registrations
    for (const disposable of toolDisposables) {
        disposable.dispose();
    }
    toolDisposables = [];
    
    // Dispose of provider
    aiToolsProvider?.dispose();
    aiToolsProvider = undefined;
    
    // Dispose of infrastructure
    StatusBarManager.dispose();
    Logger.dispose();
    
    // Clean up singletons
    const { PerformanceMonitorService } = require('./shared/services/performanceMonitorService');
    PerformanceMonitorService.disposeInstance();
    ChatSessionManager.disposeInstance();
    
    Logger.info('✅ AI Chain Traversal Tools extension deactivated successfully');
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // Command to show tool status
    const showStatusCommand = vscode.commands.registerCommand(
        'chainTraversal.showStatus',
        async () => {
            if (aiToolsProvider) {
                const stats = aiToolsProvider.getToolStatistics();
                const message = `AI Chain Traversal Tools Status:\n\n` +
                    `Total Tools: ${stats.totalTools}\n` +
                    `Registered Tools: ${stats.registeredTools.join(', ')}\n\n` +
                    `Extension is active and ready for AI agent coordination.`;
                
                vscode.window.showInformationMessage(message, { modal: true });
            } else {
                vscode.window.showWarningMessage('AI Chain Traversal Tools provider not initialized');
            }
        }
    );

    // Command to test tools
    const testToolsCommand = vscode.commands.registerCommand(
        'chainTraversal.testTools',
        async () => {
            if (aiToolsProvider) {
                const result = await aiToolsProvider.testTools();
                if (result.success) {
                    vscode.window.showInformationMessage(`✅ Tool Test Passed: ${result.details}`);
                } else {
                    vscode.window.showErrorMessage(`❌ Tool Test Failed: ${result.details}`);
                }
            } else {
                vscode.window.showWarningMessage('AI Chain Traversal Tools provider not initialized');
            }
        }
    );

    // Command to show output logs
    const showLogsCommand = vscode.commands.registerCommand(
        'chainTraversal.showLogs',
        () => {
            Logger.showOutputChannel();
        }
    );

    // Command to open extension documentation
    const openDocsCommand = vscode.commands.registerCommand(
        'chainTraversal.openDocs',
        () => {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/duc01226/ai-chain-traversal-extension#readme'));
        }
    );

    // Command to show status panel
    const showStatusPanelCommand = vscode.commands.registerCommand(
        'aiChainTraversal.showStatusPanel',
        async () => {
            await StatusBarManager.showStatusPanel();
        }
    );

    // Register all commands
    context.subscriptions.push(
        showStatusCommand,
        testToolsCommand, 
        showLogsCommand,
        openDocsCommand,
        showStatusPanelCommand
    );
}

/**
 * Get debug logging configuration
 */
function getDebugLoggingEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('aiChainTraversal');
    return config.get<boolean>('enableDebugLogging', false);
}

/**
 * Export API for other extensions (optional)
 */
export interface AIChainTraversalAPI {
    getToolsProvider(): AIToolsProvider | undefined;
    getToolStatistics(): { totalTools: number; registeredTools: string[] } | undefined;
    testTools(): Promise<{ success: boolean; details: string }> | undefined;
}

export function getAPI(): AIChainTraversalAPI {
    return {
        getToolsProvider(): AIToolsProvider | undefined {
            return aiToolsProvider;
        },
        getToolStatistics() {
            return aiToolsProvider?.getToolStatistics();
        },
        testTools() {
            return aiToolsProvider?.testTools();
        }
    };
}
