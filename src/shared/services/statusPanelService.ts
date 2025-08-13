/**
 * Status Panel Service for AI Chain Traversal Extension
 * Provides comprehensive status information in a webview panel
 */

import * as vscode from 'vscode';
import { PerformanceMonitorService } from './performanceMonitorService';
import { WorkspaceStateManagerVscode } from './workspaceStateManagerVscode';
import { DiscoverySession, EntityNode, RelationshipEdge } from '../types';

export interface StatusPanelData {
  systemStatus: {
    isActive: boolean;
    currentActivity: string;
    activeSessions: number;
    performanceMonitoring: boolean;
  };
  currentSession?: {
    sessionId: string;
    taskDescription: string;
    workspaceRoot: string;
    startTime: Date;
    entitiesCount: number;
    relationshipsCount: number;
    completionPercentage: number;
  };
  graph: {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: { [type: string]: number };
    chainCompleteness: number;
  };
  performance: {
    memoryUsage: {
      usedMB: number;
      maxMB: number;
      percentage: number;
    };
    activeAgents: number;
    processingSpeed: {
      entitiesPerSecond: number;
      relationshipsPerSecond: number;
    };
    recommendations: string[];
  };
  chatSessions: {
    currentChatId?: string;
    totalSessions: number;
    sessionHistory: Array<{
      sessionId: string;
      taskDescription: string;
      startTime: Date;
      isActive: boolean;
    }>;
  };
}

export class StatusPanelService {
  private static instance: StatusPanelService | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private readonly context: vscode.ExtensionContext;
  private refreshTimer: NodeJS.Timeout | undefined;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public static getInstance(context: vscode.ExtensionContext): StatusPanelService {
    if (!StatusPanelService.instance) {
      StatusPanelService.instance = new StatusPanelService(context);
    }
    return StatusPanelService.instance;
  }

  public static disposeInstance(): void {
    if (StatusPanelService.instance) {
      StatusPanelService.instance.dispose();
      StatusPanelService.instance = undefined;
    }
  }

  /**
   * Show the status panel
   */
  public async showStatusPanel(): Promise<void> {
    if (this.panel) {
      // Panel already exists, just reveal it
      this.panel.reveal(vscode.ViewColumn.Two);
      await this.updatePanelContent();
      return;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      'chainTraversalStatus',
      'Chain Traversal Status',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.context.extensionUri]
      }
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.stopAutoRefresh();
    });

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(async (message) => {
      try {
        await this.handleWebviewMessage(message);
      } catch (error) {
        console.error('Error handling webview message:', error);
        vscode.window.showErrorMessage(`Status panel error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Set initial content
    await this.updatePanelContent();

    // Start auto-refresh
    this.startAutoRefresh();
  }

  /**
   * Update panel content with current status
   */
  private async updatePanelContent(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      const statusData = await this.collectStatusData();
      const html = this.generateStatusHTML(statusData);
      this.panel.webview.html = html;
    } catch (error) {
      console.error('Error updating panel content:', error);
      
      // Show a fallback error page
      const errorHtml = this.generateErrorHTML(error instanceof Error ? error.message : 'Unknown error');
      this.panel.webview.html = errorHtml;
    }
  }

  /**
   * Collect comprehensive status data
   */
  private async collectStatusData(): Promise<StatusPanelData> {
    const performanceMonitor = PerformanceMonitorService.getInstance(this.context);
    const tempWorkspaceRoot = this.getWorkspaceRoot();
    const stateManager = new WorkspaceStateManagerVscode(this.context, tempWorkspaceRoot);

    // Get current session from context
    let currentSession: StatusPanelData['currentSession'] | undefined;
    let allSessions: DiscoverySession[] = [];
    let allEntities: EntityNode[] = [];
    let allRelationships: RelationshipEdge[] = [];

    try {
      // Get current active session from VS Code context
      const activeSession = this.context.globalState.get<DiscoverySession>('currentSession');
      
      if (activeSession) {
        allEntities = await stateManager.getAllEntities();
        allRelationships = await stateManager.getAllRelationships();

        // Calculate completion percentage (simple heuristic)
        const entityTypes = new Set(allEntities.map(e => e.type));
        const hasRelationships = allRelationships.length > 0;
        const completionPercentage = Math.min(100, 
          (entityTypes.size * 20) + (hasRelationships ? 20 : 0) + 
          Math.min(40, allEntities.length * 2)
        );

        currentSession = {
          sessionId: activeSession.sessionId,
          taskDescription: activeSession.taskDescription,
          workspaceRoot: activeSession.workspaceRoot,
          startTime: activeSession.timestamp,
          entitiesCount: allEntities.length,
          relationshipsCount: allRelationships.length,
          completionPercentage
        };

        // Add current session to the sessions list
        allSessions = [activeSession];
      }
    } catch (error) {
      console.warn('Failed to collect session data:', error);
    }

    // Get performance metrics
    const performanceReport = performanceMonitor.getPerformanceReport();
    const currentMetrics = performanceReport.currentMetrics;

    // Analyze entity types
    const entityTypes: { [type: string]: number } = {};
    allEntities.forEach(entity => {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    });

    // Calculate chain completeness
    const chainCompleteness = allEntities.length > 0 && allRelationships.length > 0 
      ? Math.min(100, (allRelationships.length / allEntities.length) * 100)
      : 0;

    const result: StatusPanelData = {
      systemStatus: {
        isActive: !!currentSession,
        currentActivity: this.getCurrentActivity(currentSession, performanceReport),
        activeSessions: currentSession ? 1 : 0,
        performanceMonitoring: currentMetrics !== undefined
      },
      graph: {
        totalEntities: allEntities.length,
        totalRelationships: allRelationships.length,
        entityTypes,
        chainCompleteness
      },
      performance: {
        memoryUsage: currentMetrics?.memoryUsage || { usedMB: 0, maxMB: 2048, percentage: 0 },
        activeAgents: currentMetrics?.agentCoordination.activeAgents || 0,
        processingSpeed: currentMetrics?.processingSpeed || { entitiesPerSecond: 0, relationshipsPerSecond: 0 },
        recommendations: currentMetrics?.recommendations || []
      },
      chatSessions: {
        ...(currentSession?.sessionId ? { currentChatId: currentSession.sessionId } : {}),
        totalSessions: allSessions.length,
        sessionHistory: allSessions.slice(-10).map(s => ({
          sessionId: s.sessionId,
          taskDescription: s.taskDescription,
          startTime: s.timestamp,
          isActive: !!currentSession && s.sessionId === currentSession.sessionId
        }))
      }
    };

    if (currentSession) {
      result.currentSession = currentSession;
    }

    return result;
  }

  /**
   * Get workspace root from VS Code workspace
   */
  private getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return process.cwd(); // Fallback to current working directory
    }
    return workspaceFolders[0].uri.fsPath;
  }

  /**
   * Generate error HTML when status panel fails to load
   */
  private generateErrorHTML(errorMessage: string): string {
    const nonce = this.generateNonce();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; worker-src 'none'; connect-src 'none';">
    <title>Chain Traversal Status - Error</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        .error-container {
            max-width: 600px;
            margin: 50px auto;
            padding: 30px;
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 8px;
            background-color: var(--vscode-inputValidation-errorBackground);
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .error-message {
            margin-bottom: 20px;
            color: var(--vscode-inputValidation-errorForeground);
        }
        .retry-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 20px;
        }
        .retry-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">❌</div>
        <h2>Status Panel Error</h2>
        <div class="error-message">
            <strong>Failed to load status information:</strong><br>
            ${errorMessage}
        </div>
        <p>This could be due to:</p>
        <ul style="text-align: left;">
            <li>Service worker conflicts in webview context</li>
            <li>Content Security Policy restrictions</li>
            <li>Data collection errors</li>
        </ul>
        <button class="retry-button" onclick="sendMessage('refresh')">🔄 Retry</button>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        function sendMessage(action, data = {}) {
            try {
                vscode.postMessage({ action, ...data });
            } catch (error) {
                console.error('Failed to send message to extension:', error);
            }
        }
    </script>
</body>
</html>`;
  }

  /**
   * Generate nonce for CSP
   */
  private generateNonce(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Determine current activity description
   */
  private getCurrentActivity(
    currentSession: StatusPanelData['currentSession'] | undefined,
    performanceReport: any
  ): string {
    if (!currentSession) {
      return 'Idle - No active analysis session';
    }

    const activeAgents = performanceReport.currentMetrics?.agentCoordination.activeAgents || 0;
    
    if (activeAgents > 0) {
      return `Active analysis - ${activeAgents} agent(s) processing`;
    }
    
    if (currentSession.entitiesCount > 0) {
      return `Session active - ${currentSession.entitiesCount} entities discovered`;
    }

    return 'Session initialized - Ready for analysis';
  }

  /**
   * Generate HTML content for the status panel
   */
  private generateStatusHTML(data: StatusPanelData): string {
    const entityTypesChart = this.generateEntityTypesChart(data.graph.entityTypes);
    const progressBar = this.generateProgressBar(data.currentSession?.completionPercentage || 0);
    const nonce = this.generateNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; worker-src 'none'; connect-src 'none';">
    <title>Chain Traversal Status</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        .status-active {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
        }
        .status-idle {
            background-color: var(--vscode-terminal-ansiYellow);
            color: var(--vscode-editor-background);
        }
        .section {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
        }
        .section h3 {
            margin-top: 0;
            color: var(--vscode-terminalCommandDecoration-defaultBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 8px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        .metric {
            padding: 10px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-input-border);
        }
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .metric-value {
            font-size: 18px;
            font-weight: bold;
            color: var(--vscode-terminalCommandDecoration-successBackground);
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
        }
        .entity-chart {
            margin: 15px 0;
        }
        .entity-type {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .recommendations {
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        .session-history {
            max-height: 200px;
            overflow-y: auto;
        }
        .session-item {
            padding: 8px;
            margin: 4px 0;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-terminal-ansiBlue);
        }
        .session-item.active {
            border-left-color: var(--vscode-terminal-ansiGreen);
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .actions {
            margin-top: 20px;
            text-align: center;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 8px;
        }
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin: 0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            position: relative;
            transition: all 0.2s ease;
            white-space: nowrap;
            min-width: 120px;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .action-button[title]:hover::after {
            content: attr(title);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--vscode-tooltip-background);
            color: var(--vscode-tooltip-foreground);
            border: 1px solid var(--vscode-tooltip-border);
            padding: 8px 12px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 1000;
            font-size: 12px;
            margin-bottom: 5px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            opacity: 0;
            animation: tooltip-appear 0.2s ease forwards;
        }
        @keyframes tooltip-appear {
            from { opacity: 0; transform: translateX(-50%) translateY(5px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .refresh-info {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔗 AI Chain Traversal Status</h1>
        <div>
            <span class="status-badge ${data.systemStatus.isActive ? 'status-active' : 'status-idle'}">
                ${data.systemStatus.isActive ? 'ACTIVE' : 'IDLE'}
            </span>
            <span>${data.systemStatus.currentActivity}</span>
        </div>
    </div>

    ${data.currentSession ? `
    <div class="section">
        <h3>📊 Current Session</h3>
        <div class="metric-grid">
            <div class="metric">
                <div class="metric-label">Session ID</div>
                <div class="metric-value">${data.currentSession.sessionId.substring(0, 8)}...</div>
            </div>
            <div class="metric">
                <div class="metric-label">Task</div>
                <div class="metric-value">${data.currentSession.taskDescription}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Entities Found</div>
                <div class="metric-value">${data.currentSession.entitiesCount}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Relationships</div>
                <div class="metric-value">${data.currentSession.relationshipsCount}</div>
            </div>
        </div>
        <div class="metric-label">Analysis Progress</div>
        ${progressBar}
        <div style="text-align: center; margin-top: 5px;">${data.currentSession.completionPercentage}% Complete</div>
    </div>
    ` : ''}

    <div class="section">
        <h3>🕸️ Graph Status</h3>
        <div class="metric-grid">
            <div class="metric">
                <div class="metric-label">Total Entities</div>
                <div class="metric-value">${data.graph.totalEntities}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Relationships</div>
                <div class="metric-value">${data.graph.totalRelationships}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Chain Completeness</div>
                <div class="metric-value">${data.graph.chainCompleteness.toFixed(1)}%</div>
            </div>
        </div>
        ${entityTypesChart}
    </div>

    <div class="section">
        <h3>⚡ Performance</h3>
        <div class="metric-grid">
            <div class="metric">
                <div class="metric-label">Memory Usage</div>
                <div class="metric-value">${data.performance.memoryUsage.usedMB}MB (${data.performance.memoryUsage.percentage.toFixed(1)}%)</div>
            </div>
            <div class="metric">
                <div class="metric-label">Active Agents</div>
                <div class="metric-value">${data.performance.activeAgents}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Processing Speed</div>
                <div class="metric-value">${data.performance.processingSpeed.entitiesPerSecond.toFixed(1)}/s</div>
            </div>
        </div>
        ${data.performance.recommendations.length > 0 ? `
        <div class="recommendations">
            <strong>💡 Recommendations:</strong>
            <ul>
                ${data.performance.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
    </div>

    <div class="section">
        <h3>💬 Chat Sessions</h3>
        <div class="metric-grid">
            <div class="metric">
                <div class="metric-label">Current Chat</div>
                <div class="metric-value">${data.chatSessions.currentChatId ? data.chatSessions.currentChatId.substring(0, 8) + '...' : 'None'}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Total Sessions</div>
                <div class="metric-value">${data.chatSessions.totalSessions}</div>
            </div>
        </div>
        <div class="session-history">
            ${data.chatSessions.sessionHistory.map(session => `
            <div class="session-item ${session.isActive ? 'active' : ''}">
                <div><strong>${session.taskDescription}</strong></div>
                <div style="font-size: 12px; color: var(--vscode-descriptionForeground);">
                    ${session.sessionId.substring(0, 8)}... • ${session.startTime.toLocaleString()}
                    ${session.isActive ? ' • ACTIVE' : ''}
                </div>
            </div>
            `).join('')}
        </div>
    </div>

    <div class="actions">
        <button class="action-button" onclick="sendMessage('refresh')" title="Manually refresh the status panel and reload all current data">
            🔄 Refresh
        </button>
        <button class="action-button" onclick="sendMessage('stopMonitoring')" title="Stop performance monitoring and agent coordination tracking">
            ⏹️ Stop Monitoring
        </button>
        <button class="action-button" onclick="sendMessage('newSession')" title="Initialize a new AI chain traversal discovery session">
            ➕ New Session
        </button>
        <button class="action-button" onclick="sendMessage('exportReport')" title="Export current status and analysis data as a markdown report">
            📋 Export Report
        </button>
        <button class="action-button" onclick="sendMessage('manageData')" title="Manage and clean up old sessions, entities, and analysis data">
            🗂️ Manage Data
        </button>
    </div>

    <div class="refresh-info">
        Auto-refreshes every 10 seconds • Last updated: ${new Date().toLocaleTimeString()}
    </div>

    <script nonce="${nonce}">
        // Prevent service worker errors in webview context
        if ('serviceWorker' in navigator) {
            // Override service worker to prevent registration attempts
            Object.defineProperty(navigator, 'serviceWorker', {
                value: undefined,
                writable: false
            });
        }
        
        const vscode = acquireVsCodeApi();
        
        function sendMessage(action, data = {}) {
            try {
                vscode.postMessage({ action, ...data });
            } catch (error) {
                console.error('Failed to send message to extension:', error);
            }
        }
        
        // Auto-scroll session history to active session
        document.addEventListener('DOMContentLoaded', () => {
            try {
                const activeSession = document.querySelector('.session-item.active');
                if (activeSession) {
                    activeSession.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } catch (error) {
                console.error('Failed to scroll to active session:', error);
            }
        });

        // Prevent any potential service worker registration attempts
        window.addEventListener('error', (event) => {
            if (event.message && event.message.includes('ServiceWorker')) {
                event.preventDefault();
                console.log('Service worker error prevented in webview context');
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate entity types chart HTML
   */
  private generateEntityTypesChart(entityTypes: { [type: string]: number }): string {
    if (Object.keys(entityTypes).length === 0) {
      return '<div style="text-align: center; color: var(--vscode-descriptionForeground); padding: 20px;">No entities discovered yet</div>';
    }

    const total = Object.values(entityTypes).reduce((sum, count) => sum + count, 0);
    
    return `
      <div class="entity-chart">
        <div class="metric-label">Entity Types Distribution</div>
        ${Object.entries(entityTypes).map(([type, count]) => {
          const percentage = ((count / total) * 100).toFixed(1);
          return `
            <div class="entity-type">
              <span>${type}</span>
              <span>${count} (${percentage}%)</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Generate progress bar HTML
   */
  private generateProgressBar(percentage: number): string {
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    return `
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${clampedPercentage}%; background-color: var(--vscode-progressBar-background);"></div>
      </div>
    `;
  }

  /**
   * Handle messages from webview
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.action) {
      case 'refresh':
        await this.updatePanelContent();
        break;
      
      case 'stopMonitoring':
        const performanceMonitor = PerformanceMonitorService.getInstance(this.context);
        performanceMonitor.stopPerformanceMonitoring();
        vscode.window.showInformationMessage('Performance monitoring stopped');
        await this.updatePanelContent();
        break;
      
      case 'newSession':
        vscode.commands.executeCommand('workbench.action.openSettings', 'chainTraversal');
        break;
      
      case 'exportReport':
        await this.exportStatusReport();
        break;
      
      case 'manageData':
        await this.showDataManagementDialog();
        break;
    }
  }

  /**
   * Export status report to a file
   */
  private async exportStatusReport(): Promise<void> {
    try {
      const statusData = await this.collectStatusData();
      const reportContent = this.generateTextReport(statusData);
      
      const doc = await vscode.workspace.openTextDocument({
        content: reportContent,
        language: 'markdown'
      });
      
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage('Status report exported successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export report: ${error}`);
    }
  }

  /**
   * Generate text report for export
   */
  private generateTextReport(data: StatusPanelData): string {
    const timestamp = new Date().toISOString();
    
    return `# AI Chain Traversal Status Report
Generated: ${timestamp}

## System Status
- **Status**: ${data.systemStatus.isActive ? 'ACTIVE' : 'IDLE'}
- **Current Activity**: ${data.systemStatus.currentActivity}
- **Active Sessions**: ${data.systemStatus.activeSessions}
- **Performance Monitoring**: ${data.systemStatus.performanceMonitoring ? 'Enabled' : 'Disabled'}

${data.currentSession ? `## Current Session
- **Session ID**: ${data.currentSession.sessionId}
- **Task**: ${data.currentSession.taskDescription}
- **Workspace**: ${data.currentSession.workspaceRoot}
- **Started**: ${data.currentSession.startTime.toISOString()}
- **Entities**: ${data.currentSession.entitiesCount}
- **Relationships**: ${data.currentSession.relationshipsCount}
- **Progress**: ${data.currentSession.completionPercentage}%

` : ''}## Graph Analysis
- **Total Entities**: ${data.graph.totalEntities}
- **Total Relationships**: ${data.graph.totalRelationships}
- **Chain Completeness**: ${data.graph.chainCompleteness.toFixed(1)}%

### Entity Types
${Object.entries(data.graph.entityTypes).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

## Performance Metrics
- **Memory Usage**: ${data.performance.memoryUsage.usedMB}MB (${data.performance.memoryUsage.percentage.toFixed(1)}%)
- **Active Agents**: ${data.performance.activeAgents}
- **Processing Speed**: ${data.performance.processingSpeed.entitiesPerSecond.toFixed(1)} entities/second

${data.performance.recommendations.length > 0 ? `### Recommendations
${data.performance.recommendations.map(rec => `- ${rec}`).join('\n')}
` : ''}
## Session History
${data.chatSessions.sessionHistory.map(session => 
  `- **${session.taskDescription}** (${session.sessionId.substring(0, 8)}...) - ${session.startTime.toISOString()} ${session.isActive ? '[ACTIVE]' : ''}`
).join('\n')}
`;
  }

  /**
   * Start auto-refresh timer
   */
  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(async () => {
      await this.updatePanelContent();
    }, 10000); // Refresh every 10 seconds
  }

  /**
   * Stop auto-refresh timer
   */
  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Show data management dialog for cleaning up old sessions
   */
  private async showDataManagementDialog(): Promise<void> {
    try {
      const availableSessions = await this.getAvailableSessions();
      
      if (availableSessions.length === 0) {
        vscode.window.showInformationMessage('No sessions found to manage');
        return;
      }
      
      const actions = [
        'View Session Details',
        'Clear Old Sessions (Keep Last 5)',
        'Clear All Sessions',
        'Clear Cache and Checkpoints',
        'Export Session Data',
        'Cancel'
      ];
      
      const selectedAction = await vscode.window.showQuickPick(actions, {
        placeHolder: `Manage ${availableSessions.length} session(s) - Select an action`
      });
      
      if (!selectedAction || selectedAction === 'Cancel') {
        return;
      }
      
      switch (selectedAction) {
        case 'View Session Details':
          await this.showSessionDetails(availableSessions);
          break;
        case 'Clear Old Sessions (Keep Last 5)':
          await this.clearOldSessions(availableSessions, 5);
          break;
        case 'Clear All Sessions':
          await this.clearAllSessions();
          break;
        case 'Clear Cache and Checkpoints':
          await this.clearCacheAndCheckpoints();
          break;
        case 'Export Session Data':
          await this.exportSessionData(availableSessions);
          break;
      }
      
      // Refresh the panel after any data management action
      await this.updatePanelContent();
      
    } catch (error) {
      vscode.window.showErrorMessage(`Data management error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available sessions from workspace
   */
  private async getAvailableSessions(): Promise<Array<{id: string, created: Date, description: string}>> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      
      if (!workspaceRoot) {
        return [];
      }
      
      const chainTraversalPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.vscode', 'chain-traversal');
      const sessionsPath = vscode.Uri.joinPath(chainTraversalPath, 'sessions');
      
      try {
        const sessionFiles = await vscode.workspace.fs.readDirectory(sessionsPath);
        const sessions: Array<{id: string, created: Date, description: string}> = [];
        
        for (const [filename, fileType] of sessionFiles) {
          if (fileType === vscode.FileType.File && filename.endsWith('.json')) {
            try {
              const sessionFile = vscode.Uri.joinPath(sessionsPath, filename);
              const content = await vscode.workspace.fs.readFile(sessionFile);
              const sessionData = JSON.parse(content.toString());
              
              sessions.push({
                id: sessionData.sessionId || filename.replace('.json', ''),
                created: new Date(sessionData.createdAt || sessionData.timestamp || 0),
                description: sessionData.taskDescription || 'No description'
              });
            } catch (parseError) {
              console.warn(`Failed to parse session file ${filename}:`, parseError);
            }
          }
        }
        
        // Sort by creation date, newest first
        return sessions.sort((a, b) => b.created.getTime() - a.created.getTime());
        
      } catch (dirError) {
        // Sessions directory doesn't exist
        return [];
      }
      
    } catch (error) {
      console.error('Error getting available sessions:', error);
      return [];
    }
  }

  /**
   * Show detailed information about sessions
   */
  private async showSessionDetails(sessions: Array<{id: string, created: Date, description: string}>): Promise<void> {
    const sessionItems = sessions.map(session => ({
      label: `$(clock) ${session.id}`,
      description: session.description,
      detail: `Created: ${session.created.toLocaleString()}`,
      session
    }));
    
    const selectedSession = await vscode.window.showQuickPick(sessionItems, {
      placeHolder: 'Select a session to view details'
    });
    
    if (selectedSession) {
      const details = `Session: ${selectedSession.session.id}
Created: ${selectedSession.session.created.toLocaleString()}
Description: ${selectedSession.session.description}

This session contains analysis data for AI chain traversal discovery.`;
      
      vscode.window.showInformationMessage(details, { modal: true });
    }
  }

  /**
   * Clear old sessions, keeping the most recent ones
   */
  private async clearOldSessions(sessions: Array<{id: string, created: Date, description: string}>, keepCount: number): Promise<void> {
    if (sessions.length <= keepCount) {
      vscode.window.showInformationMessage(`Only ${sessions.length} session(s) found. No cleanup needed.`);
      return;
    }
    
    const sessionsToDelete = sessions.slice(keepCount);
    const confirmation = await vscode.window.showWarningMessage(
      `Delete ${sessionsToDelete.length} old session(s)? This will keep the ${keepCount} most recent sessions.`,
      { modal: true },
      'Delete Old Sessions'
    );
    
    if (confirmation === 'Delete Old Sessions') {
      let deletedCount = 0;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      
      if (workspaceRoot) {
        const chainTraversalPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.vscode', 'chain-traversal');
        
        for (const session of sessionsToDelete) {
          try {
            // Delete session file
            const sessionFile = vscode.Uri.joinPath(chainTraversalPath, 'sessions', `${session.id}.json`);
            await vscode.workspace.fs.delete(sessionFile);
            
            // Delete related entities and relationships if they exist
            try {
              const entitiesFile = vscode.Uri.joinPath(chainTraversalPath, 'entities', `${session.id}.json`);
              await vscode.workspace.fs.delete(entitiesFile);
            } catch { /* File might not exist */ }
            
            try {
              const relationshipsFile = vscode.Uri.joinPath(chainTraversalPath, 'relationships', `${session.id}.json`);
              await vscode.workspace.fs.delete(relationshipsFile);
            } catch { /* File might not exist */ }
            
            deletedCount++;
          } catch (error) {
            console.warn(`Failed to delete session ${session.id}:`, error);
          }
        }
      }
      
      vscode.window.showInformationMessage(`Successfully deleted ${deletedCount} old session(s)`);
    }
  }

  /**
   * Clear all sessions
   */
  private async clearAllSessions(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      'Delete ALL session data? This cannot be undone.',
      { modal: true },
      'Delete All Data'
    );
    
    if (confirmation === 'Delete All Data') {
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        if (workspaceRoot) {
          const chainTraversalPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.vscode', 'chain-traversal');
          await vscode.workspace.fs.delete(chainTraversalPath, { recursive: true });
          vscode.window.showInformationMessage('All session data cleared successfully');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to clear all sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Clear cache and checkpoint files
   */
  private async clearCacheAndCheckpoints(): Promise<void> {
    const confirmation = await vscode.window.showWarningMessage(
      'Clear all cache and checkpoint files? Sessions will remain but cached data will be removed.',
      { modal: true },
      'Clear Cache'
    );
    
    if (confirmation === 'Clear Cache') {
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        if (workspaceRoot) {
          const chainTraversalPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.vscode', 'chain-traversal');
          
          // Clear checkpoints
          try {
            const checkpointsPath = vscode.Uri.joinPath(chainTraversalPath, 'checkpoints');
            await vscode.workspace.fs.delete(checkpointsPath, { recursive: true });
          } catch { /* Directory might not exist */ }
          
          // Clear context backups
          try {
            const contextBackupsPath = vscode.Uri.joinPath(chainTraversalPath, 'context-backups');
            await vscode.workspace.fs.delete(contextBackupsPath, { recursive: true });
          } catch { /* Directory might not exist */ }
          
          // Clear performance logs
          try {
            const performanceLogsPath = vscode.Uri.joinPath(chainTraversalPath, 'performance-logs');
            await vscode.workspace.fs.delete(performanceLogsPath, { recursive: true });
          } catch { /* Directory might not exist */ }
          
          vscode.window.showInformationMessage('Cache and checkpoint files cleared successfully');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Export session data to files
   */
  private async exportSessionData(sessions: Array<{id: string, created: Date, description: string}>): Promise<void> {
    const sessionItems = sessions.map(session => ({
      label: `$(database) ${session.id}`,
      description: session.description,
      detail: `Created: ${session.created.toLocaleString()}`,
      session
    }));
    
    const selectedSession = await vscode.window.showQuickPick(sessionItems, {
      placeHolder: 'Select a session to export'
    });
    
    if (selectedSession) {
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        if (workspaceRoot) {
          const chainTraversalPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), '.vscode', 'chain-traversal');
          const sessionId = selectedSession.session.id;
          
          // Read session data
          const sessionFile = vscode.Uri.joinPath(chainTraversalPath, 'sessions', `${sessionId}.json`);
          const sessionContent = await vscode.workspace.fs.readFile(sessionFile);
          
          // Create export content
          const exportData = {
            session: JSON.parse(sessionContent.toString()),
            entities: {},
            relationships: {},
            timestamp: new Date().toISOString()
          };
          
          // Try to read entities and relationships
          try {
            const entitiesFile = vscode.Uri.joinPath(chainTraversalPath, 'entities', `${sessionId}.json`);
            const entitiesContent = await vscode.workspace.fs.readFile(entitiesFile);
            exportData.entities = JSON.parse(entitiesContent.toString());
          } catch { /* File might not exist */ }
          
          try {
            const relationshipsFile = vscode.Uri.joinPath(chainTraversalPath, 'relationships', `${sessionId}.json`);
            const relationshipsContent = await vscode.workspace.fs.readFile(relationshipsFile);
            exportData.relationships = JSON.parse(relationshipsContent.toString());
          } catch { /* File might not exist */ }
          
          // Open export data in a new document
          const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(exportData, null, 2),
            language: 'json'
          });
          
          await vscode.window.showTextDocument(doc);
          vscode.window.showInformationMessage(`Session data for ${sessionId} exported successfully`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export session data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stopAutoRefresh();
    this.panel?.dispose();
    this.panel = undefined;
  }
}
