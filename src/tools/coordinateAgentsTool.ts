/**
 * Advanced Multi-Agent Coordinator Tool
 * Provides comprehensive multi-agent parallelism with token management and performance optimization
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { TokenManagementService } from '../shared/services/tokenManagementService';
import { PerformanceMonitorService } from '../shared/services/performanceMonitorService';
import { MultiAgentCoordinatorService, AgentConfiguration, TaskDistributionStrategy, CoordinationSession } from '../shared/services/multiAgentCoordinatorService';
import { WorkItem } from '../shared/types';

interface CoordinationStatistics {
  coordination: CoordinationSession['statistics'] | null;
  performance: {
    currentMetrics: any; // From PerformanceMonitorService
    historicalTrends: any[];
    cacheMetrics: any;
    agentInfo: any[];
    optimizationSuggestions: string[];
  } | null;
  tokenUsage: {
    totalTokens: number;
    entitiesTokens: number;
    relationshipsTokens: number;
    recommendSummarization?: boolean;
    summarizationUrgency?: 'critical' | 'recommended';
  } | null;
}

interface CoordinateAgentsInput {
  sessionId: string;
  agents: AgentConfiguration[];
  distributionStrategy?: TaskDistributionStrategy;
  maxTokens?: number;
  enableTokenManagement?: boolean;
  enablePerformanceOptimization?: boolean;
}

interface CoordinateAgentsResult {
  success: boolean;
  coordinationSessionId: string;
  registeredAgents: number;
  message: string;
  statistics?: CoordinationStatistics;
  warnings: string[];
  recommendations: string[];
}

export class CoordinateAgentsTool extends BaseTool {
  name = 'coordinate_agents';
  description = 'Coordinate multiple AI agents for parallel processing with token management and performance optimization';

  getDisplayName(): string {
    return 'Coordinate AI Agents';
  }

    // Note: stateManager is available for coordination context but not used directly
    // in the current coordination implementation - used by helper methods
    private stateManager: WorkspaceStateManagerVscode;
  private tokenManager: TokenManagementService;
  private performanceMonitor: PerformanceMonitorService;
  private coordinatorService: MultiAgentCoordinatorService;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
    this.tokenManager = new TokenManagementService(context);
    this.performanceMonitor = PerformanceMonitorService.getInstance(context);
    this.coordinatorService = new MultiAgentCoordinatorService(context, this.performanceMonitor, this.tokenManager);
  }

  get inputSchema() {
    return {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Unique identifier for the coordination session'
        },
        agents: {
          type: 'array',
          description: 'Array of agent configurations for registration',
          items: {
            type: 'object',
            properties: {
              agentId: { type: 'string', description: 'Unique agent identifier' },
              capabilities: {
                type: 'array',
                items: { type: 'string' },
                description: 'Agent capabilities (entity_discovery, relationship_mapping, etc.)'
              },
              maxConcurrentTasks: { type: 'number', description: 'Maximum concurrent tasks per agent' },
              priority: { type: 'number', minimum: 1, maximum: 5, description: 'Agent priority (1=highest)' },
              specialization: { 
                type: 'string', 
                description: 'Agent specialization (frontend_components, backend_services, etc.)' 
              }
            },
            required: ['agentId', 'capabilities', 'maxConcurrentTasks', 'priority']
          }
        },
        distributionStrategy: {
          type: 'object',
          description: 'Task distribution strategy configuration',
          properties: {
            strategy: {
              type: 'string',
              enum: ['round_robin', 'capability_based', 'load_balanced', 'priority_weighted'],
              description: 'Distribution strategy type'
            },
            considerSpecialization: { type: 'boolean', description: 'Consider agent specialization' },
            balanceWorkload: { type: 'boolean', description: 'Balance workload across agents' },
            prioritizeExperience: { type: 'boolean', description: 'Prioritize experienced agents' }
          }
        },
        maxTokens: { 
          type: 'number', 
          description: 'Maximum token limit for context management',
          default: 128000 
        },
        enableTokenManagement: { 
          type: 'boolean', 
          description: 'Enable automatic token management and context summarization',
          default: true 
        },
        enablePerformanceOptimization: { 
          type: 'boolean', 
          description: 'Enable performance monitoring and optimization',
          default: true 
        }
      },
      required: ['sessionId', 'agents']
    };
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      this.checkCancellation(token);

      const params = options.input as CoordinateAgentsInput;
      
      // Extract dynamic token configuration - prioritize API over user input
      const apiMaxTokens = this.getMaxTokens(options);
      const maxTokens = apiMaxTokens; // Always use API-provided value first
      const tokenizationOptions = this.getTokenizationOptions(options);
      
      console.log(`🚀 Starting multi-agent coordination: ${params.sessionId}`);
      console.log(`🧠 Token configuration - Max: ${maxTokens}, Model tokenizer: ${!!tokenizationOptions?.countTokens}`);

      // Configure token management with dynamic values
      if (params.enableTokenManagement !== false) {
        await this.configureTokenManagement(maxTokens, tokenizationOptions);
      }

      // Initialize coordination session first
      const distributionStrategy: TaskDistributionStrategy = params.distributionStrategy || {
        strategy: 'capability_based',
        considerSpecialization: true,
        balanceWorkload: true,
        prioritizeExperience: true
      };

      await this.coordinatorService.initializeCoordinationSession(params.sessionId, distributionStrategy);

      // Register all agents
      let registeredCount = 0;
      const warnings: string[] = [];

      for (const inputAgent of params.agents) {
        this.checkCancellation(token);
        
        // Convert input format to internal AgentConfiguration format
        const agentConfig: AgentConfiguration = {
          agentId: (inputAgent as any).id || (inputAgent as any).agentId,
          capabilities: (inputAgent as any).capabilities || ['entity_discovery'],
          maxConcurrentTasks: (inputAgent as any).maxConcurrentTasks || 2,
          priority: (inputAgent as any).priority || 3,
          specialization: (inputAgent as any).specialization
        };
        
        try {
          const registered = await this.coordinatorService.registerAgent(agentConfig);
          if (registered) {
            registeredCount++;
            console.log(`✅ Registered agent: ${agentConfig.agentId}`);
          } else {
            warnings.push(`Failed to register agent ${agentConfig.agentId}: System at capacity`);
          }
        } catch (error) {
          warnings.push(`Error registering agent ${agentConfig.agentId}: ${error}`);
        }
      }

      // Get existing work items from state manager if session exists
      const workItems = await this.getExistingWorkItems(params.sessionId);
      if (workItems.length > 0) {
        await this.coordinatorService.addTasksToQueue(workItems);
        console.log(`📋 Added ${workItems.length} existing work items to coordination queue`);
      }

      // Start performance monitoring ONLY when we have agents and work to do
      if (registeredCount > 0 && params.enablePerformanceOptimization !== false) {
        this.performanceMonitor.startPerformanceMonitoring();
        console.log(`📊 Performance monitoring started for ${registeredCount} agents`);
      }

      // Collect comprehensive statistics
      const statistics = await this.collectComprehensiveStatistics(params);

      // Generate recommendations
      const recommendations = this.generateRecommendations(statistics, registeredCount, params.agents.length);

      const result: CoordinateAgentsResult = {
        success: registeredCount > 0,
        coordinationSessionId: params.sessionId,
        registeredAgents: registeredCount,
        message: `Successfully coordinated ${registeredCount}/${params.agents.length} agents with ${distributionStrategy.strategy} distribution strategy`,
        statistics,
        warnings: warnings.length > 0 ? warnings : [],
        recommendations
      };

      if (registeredCount > 0) {
        vscode.window.showInformationMessage(
          `🤖 Multi-Agent Coordination Active: ${registeredCount} agents ready for parallel processing`
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ Multi-Agent Coordination Warning: No agents could be registered`
        );
      }

      return this.createSuccessResult(JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('Multi-agent coordination failed:', error);
      
      const errorResult: CoordinateAgentsResult = {
        success: false,
        coordinationSessionId: '',
        registeredAgents: 0,
        message: `Multi-agent coordination failed: ${error}`,
        warnings: [String(error)],
        recommendations: []
      };

      return this.createErrorResult(JSON.stringify(errorResult, null, 2));
    }
  }

  /**
   * Configure token management with dynamic values from Language Model API
   */
  private async configureTokenManagement(
    maxTokens: number, 
    tokenizationOptions?: vscode.LanguageModelToolTokenizationOptions
  ): Promise<void> {
    try {
      // Update the token manager with dynamic configuration
      if (tokenizationOptions?.countTokens) {
        console.log(`🎯 Using model-specific tokenizer with budget: ${maxTokens}`);
        // Store tokenization options for use by coordination processes
        await this.context.globalState.update('coordinationTokenOptions', {
          maxTokens,
          hasModelTokenizer: true,
          tokenBudget: tokenizationOptions.tokenBudget,
          configuredAt: new Date().toISOString()
        });
      } else {
        console.log(`📊 Using estimation-based tokenizer with limit: ${maxTokens}`);
        await this.context.globalState.update('coordinationTokenOptions', {
          maxTokens,
          hasModelTokenizer: false,
          configuredAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.warn('Failed to configure token management:', error);
      // Non-critical error, continue with defaults
    }
  }

  /**
   * Get existing work items from the current session
   */
  private async getExistingWorkItems(sessionId: string): Promise<WorkItem[]> {
    try {
      // Check if we have an active session that matches the requested session
      const currentSession = this.context.globalState.get('currentSession') as any;
      if (!currentSession || (sessionId && currentSession.sessionId && currentSession.sessionId !== sessionId)) {
        return [];
      }

      // Get work queue statistics to determine if there are pending items
      const queueStats = await this.stateManager.getWorkQueueStats();
      
      // If there are pending items, we can get them (though work queue management 
      // is typically handled by getNextWorkItem, this provides coordination context)
      if (queueStats.pending > 0) {
        // In a real scenario, we'd get actual pending work items
        // For now, we'll create representative work items based on entities in the system
        const entities = await this.stateManager.getAllEntities();
        const workItems: WorkItem[] = [];
        
        // Create work items for unprocessed entities
        const unprocessedEntities = entities.filter(entity => !entity.processed);
        
        for (const entity of unprocessedEntities.slice(0, 10)) { // Limit to 10 for coordination
          const workItem: WorkItem = {
            id: `work-${entity.id}-${Date.now()}`,
            entityId: entity.id,
            taskType: 'analyze_entity',
            priority: entity.priority,
            status: 'pending',
            dependencies: entity.dependencies.length > 0 ? [`dependency-${entity.dependencies[0]}`] : [],
            chainContext: entity.chainContext,
            estimatedEffort: 60000 + Math.random() * 180000, // 1-4 minutes
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          workItems.push(workItem);
        }
        
        return workItems;
      }

      return [];
    } catch (error) {
      console.error('Error getting existing work items:', error);
      return [];
    }
  }

  /**
   * Collect comprehensive statistics from all services
   */
  private async collectComprehensiveStatistics(params: CoordinateAgentsInput): Promise<CoordinationStatistics> {
    const statistics: CoordinationStatistics = {
      coordination: null,
      performance: null,
      tokenUsage: null
    };

    try {
      // Coordination statistics
      statistics.coordination = this.coordinatorService.getCoordinationStatistics();

      // Performance statistics (if enabled)
      if (params.enablePerformanceOptimization) {
        statistics.performance = this.performanceMonitor.getPerformanceReport();
      }

      // Token usage statistics (if enabled)
      if (params.enableTokenManagement) {
        // Get real entities and relationships for token calculation
        const entities = await this.stateManager.getAllEntities();
        const relationships = await this.stateManager.getAllRelationships();
        
        const tokenMetrics = this.tokenManager.calculateTokenUsage(
          entities, 
          relationships, 
          'Coordination context', 
          params.maxTokens
        );
        
        const baseTokenUsage = this.tokenManager.getTokenUsageStatistics(tokenMetrics);
        
        statistics.tokenUsage = {
          totalTokens: baseTokenUsage.totalTokens || 0,
          entitiesTokens: baseTokenUsage.entitiesTokens || 0,
          relationshipsTokens: baseTokenUsage.relationshipsTokens || 0
        };
        
        // Check if summarization is needed
        if (this.tokenManager.shouldSummarizeContext(tokenMetrics)) {
          statistics.tokenUsage.recommendSummarization = true;
          statistics.tokenUsage.summarizationUrgency = this.tokenManager.isTokenUsageCritical(tokenMetrics) ? 'critical' : 'recommended';
        }
      }

    } catch (error) {
      console.error('Error collecting statistics:', error);
      // Return the partial statistics we have
    }

    return statistics;
  }

  /**
   * Generate recommendations based on statistics
   */
  private generateRecommendations(statistics: CoordinationStatistics, registeredAgents: number, totalAgents: number): string[] {
    const recommendations: string[] = [];

    // Agent registration recommendations
    if (registeredAgents < totalAgents) {
      recommendations.push(`Consider reducing agent count or increasing system resources (${registeredAgents}/${totalAgents} agents registered)`);
    }

    // Token management recommendations
    if (statistics.tokenUsage?.recommendSummarization) {
      if (statistics.tokenUsage.summarizationUrgency === 'critical') {
        recommendations.push('🚨 URGENT: Context summarization required immediately to prevent token overflow');
      } else {
        recommendations.push('💡 Recommend context summarization to optimize token usage');
      }
    }

    // Performance recommendations
    if (statistics.performance?.optimizationSuggestions && statistics.performance.optimizationSuggestions.length > 0) {
      recommendations.push(...statistics.performance.optimizationSuggestions);
    }

    // Coordination strategy recommendations
    if (statistics.coordination?.parallelismEfficiency !== undefined && statistics.coordination.parallelismEfficiency < 0.7) {
      recommendations.push('Consider optimizing task distribution strategy for better parallelism efficiency');
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('✅ Multi-agent coordination is optimally configured');
      recommendations.push('💡 Monitor performance metrics for continued optimization');
    }

    return recommendations;
  }

  /**
   * Update agent heartbeat for health monitoring
   */
  updateAgentHeartbeat(agentId: string): void {
    this.coordinatorService.updateAgentHeartbeat(agentId);
  }

  /**
   * Handle task completion from agent
   */
  async handleTaskCompletion(
    agentId: string,
    taskId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.coordinatorService.handleTaskCompletion(agentId, taskId, success, undefined, error);
  }

  /**
   * Get comprehensive coordination report
   */
  getCoordinationReport() {
    return this.coordinatorService.getCoordinationReport();
  }

  /**
   * Stop coordination and cleanup
   */
  async stopCoordination(): Promise<void> {
    await this.coordinatorService.stopCoordination();
    this.performanceMonitor.dispose();
  }
}
