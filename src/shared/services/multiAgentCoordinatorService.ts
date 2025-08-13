/**
 * Multi-Agent Coordinator Service for AI Chain Traversal Extension
 * Coordinates multiple AI agents for parallel processing and task distribution
 */

import * as vscode from 'vscode';
import { WorkItem, Priority } from '../types';
import { PerformanceMonitorService } from './performanceMonitorService';
import { TokenManagementService } from './tokenManagementService';

export interface AgentConfiguration {
  agentId: string;
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  priority: Priority;
  specialization?: AgentSpecialization;
}

export type AgentCapability = 
  | 'entity_discovery'
  | 'relationship_mapping'
  | 'semantic_analysis'
  | 'dependency_tracing'
  | 'validation'
  | 'reporting'
  | 'cross_reference';

export type AgentSpecialization = 
  | 'frontend_components'
  | 'backend_services'
  | 'database_entities'
  | 'api_endpoints'
  | 'configuration'
  | 'testing'
  | 'generic';

export interface TaskDistributionStrategy {
  strategy: 'round_robin' | 'capability_based' | 'load_balanced' | 'priority_weighted';
  considerSpecialization: boolean;
  balanceWorkload: boolean;
  prioritizeExperience: boolean;
}

export interface AgentStatus {
  agentId: string;
  status: 'available' | 'busy' | 'error' | 'disconnected';
  currentTasks: WorkItem[];
  completedTasks: number;
  failedTasks: number;
  lastHeartbeat: Date;
  performance: {
    averageTaskDuration: number;
    successRate: number;
    throughput: number;
  };
}

export interface CoordinationSession {
  sessionId: string;
  registeredAgents: Map<string, AgentConfiguration>;
  agentStatuses: Map<string, AgentStatus>;
  taskQueue: WorkItem[];
  completedTasks: WorkItem[];
  distributionStrategy: TaskDistributionStrategy;
  startTime: Date;
  statistics: {
    totalTasksDistributed: number;
    totalTasksCompleted: number;
    totalTasksFailed: number;
    averageCompletionTime: number;
    parallelismEfficiency: number;
  };
}

export class MultiAgentCoordinatorService {
  // Context and token manager available for future advanced coordination features
  private readonly context: vscode.ExtensionContext;
  private readonly performanceMonitor: PerformanceMonitorService;
  private readonly tokenManager: TokenManagementService;
  private coordinationSession: CoordinationSession | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;

  constructor(
    context: vscode.ExtensionContext,
    performanceMonitor: PerformanceMonitorService,
    tokenManager: TokenManagementService
  ) {
    this.context = context;
    this.performanceMonitor = performanceMonitor;
    this.tokenManager = tokenManager;
  }

  /**
   * Initialize a new coordination session
   */
  async initializeCoordinationSession(
    sessionId: string,
    distributionStrategy: TaskDistributionStrategy = {
      strategy: 'capability_based',
      considerSpecialization: true,
      balanceWorkload: true,
      prioritizeExperience: true
    }
  ): Promise<CoordinationSession> {
    this.coordinationSession = {
      sessionId,
      registeredAgents: new Map(),
      agentStatuses: new Map(),
      taskQueue: [],
      completedTasks: [],
      distributionStrategy,
      startTime: new Date(),
      statistics: {
        totalTasksDistributed: 0,
        totalTasksCompleted: 0,
        totalTasksFailed: 0,
        averageCompletionTime: 0,
        parallelismEfficiency: 0
      }
    };

    this.startHeartbeatMonitoring();
    
    console.log(`🚀 Multi-agent coordination session initialized: ${sessionId}`);
    vscode.window.showInformationMessage(`🤖 Multi-agent coordination active: ${sessionId}`);

    return this.coordinationSession;
  }

  /**
   * Register a new agent for coordination
   */
  async registerAgent(config: AgentConfiguration): Promise<boolean> {
    if (!this.coordinationSession) {
      throw new Error('No active coordination session. Initialize session first.');
    }

    // Check if we can accept more agents
    if (!this.performanceMonitor.canAcceptNewAgent()) {
      console.warn(`⚠️ Cannot register agent ${config.agentId}: Maximum concurrent agents reached`);
      return false;
    }

    // Register with performance monitor
    this.performanceMonitor.registerAgent(config.agentId);

    // Add to coordination session
    this.coordinationSession.registeredAgents.set(config.agentId, config);
    this.coordinationSession.agentStatuses.set(config.agentId, {
      agentId: config.agentId,
      status: 'available',
      currentTasks: [],
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: new Date(),
      performance: {
        averageTaskDuration: 0,
        successRate: 0,
        throughput: 0
      }
    });

    console.log(`✅ Agent registered: ${config.agentId} with capabilities: ${config.capabilities.join(', ')}`);
    
    return true;
  }

  /**
   * Unregister an agent from coordination
   */
  async unregisterAgent(agentId: string): Promise<void> {
    if (!this.coordinationSession) {
      return;
    }

    // Reassign any current tasks
    const agentStatus = this.coordinationSession.agentStatuses.get(agentId);
    if (agentStatus && agentStatus.currentTasks.length > 0) {
      // Put tasks back in queue for redistribution
      this.coordinationSession.taskQueue.push(...agentStatus.currentTasks);
      console.log(`📋 Reassigned ${agentStatus.currentTasks.length} tasks from disconnected agent ${agentId}`);
    }

    this.coordinationSession.registeredAgents.delete(agentId);
    this.coordinationSession.agentStatuses.delete(agentId);

    console.log(`❌ Agent unregistered: ${agentId}`);
  }

  /**
   * Add tasks to the coordination queue
   */
  async addTasksToQueue(tasks: WorkItem[]): Promise<void> {
    if (!this.coordinationSession) {
      throw new Error('No active coordination session');
    }

    // Sort tasks by priority
    const sortedTasks = tasks.sort((a, b) => a.priority - b.priority);
    this.coordinationSession.taskQueue.push(...sortedTasks);

    console.log(`📋 Added ${tasks.length} tasks to coordination queue`);

    // Trigger immediate task distribution
    await this.distributeTasks();
  }

  /**
   * Distribute tasks to available agents based on strategy
   */
  async distributeTasks(): Promise<void> {
    if (!this.coordinationSession || this.coordinationSession.taskQueue.length === 0) {
      return;
    }

    const availableAgents = this.getAvailableAgents();
    if (availableAgents.length === 0) {
      console.log('📋 No available agents for task distribution');
      return;
    }

    const strategy = this.coordinationSession.distributionStrategy;
    let distributedCount = 0;

    switch (strategy.strategy) {
      case 'capability_based':
        distributedCount = await this.distributeByCapability(availableAgents);
        break;
      case 'load_balanced':
        distributedCount = await this.distributeByLoadBalance(availableAgents);
        break;
      case 'priority_weighted':
        distributedCount = await this.distributeByPriorityWeight(availableAgents);
        break;
      case 'round_robin':
      default:
        distributedCount = await this.distributeRoundRobin(availableAgents);
        break;
    }

    if (distributedCount > 0) {
      this.coordinationSession.statistics.totalTasksDistributed += distributedCount;
      console.log(`🚀 Distributed ${distributedCount} tasks to ${availableAgents.length} agents`);
    }
  }

  /**
   * Distribute tasks based on agent capabilities
   */
  private async distributeByCapability(availableAgents: string[]): Promise<number> {
    let distributedCount = 0;
    const tasks = [...this.coordinationSession!.taskQueue];

    for (const task of tasks) {
      const suitableAgent = this.findBestAgentForTask(task, availableAgents);
      if (suitableAgent) {
        await this.assignTaskToAgent(task, suitableAgent);
        this.removeTaskFromQueue(task.id);
        distributedCount++;
      }
    }

    return distributedCount;
  }

  /**
   * Find the best agent for a specific task
   */
  private findBestAgentForTask(task: WorkItem, availableAgents: string[]): string | null {
    const session = this.coordinationSession!;
    const candidates: { agentId: string; score: number }[] = [];

    for (const agentId of availableAgents) {
      const config = session.registeredAgents.get(agentId);
      const status = session.agentStatuses.get(agentId);

      if (!config || !status || status.status !== 'available') {
        continue;
      }

      let score = 0;

      // Capability matching
      const taskCapability = this.getRequiredCapabilityForTask(task);
      if (config.capabilities.includes(taskCapability)) {
        score += 100;
      }

      // Specialization matching
      if (session.distributionStrategy.considerSpecialization && config.specialization) {
        const taskSpecialization = this.inferTaskSpecialization(task);
        if (config.specialization === taskSpecialization) {
          score += 50;
        }
      }

      // Experience and performance
      if (session.distributionStrategy.prioritizeExperience) {
        score += status.performance.successRate * 30;
        score -= status.performance.averageTaskDuration / 1000; // Prefer faster agents
      }

      // Load balancing
      if (session.distributionStrategy.balanceWorkload) {
        const currentLoad = status.currentTasks.length / config.maxConcurrentTasks;
        score -= currentLoad * 25; // Prefer less loaded agents
      }

      candidates.push({ agentId, score });
    }

    // Return agent with highest score
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].agentId : null;
  }

  /**
   * Get required capability for a task type
   */
  private getRequiredCapabilityForTask(task: WorkItem): AgentCapability {
    switch (task.taskType) {
      case 'discover_entity':
        return 'entity_discovery';
      case 'analyze_entity':
        return 'semantic_analysis';
      case 'find_usages':
        return 'dependency_tracing';
      case 'map_relationships':
        return 'relationship_mapping';
      case 'validate_chain':
        return 'validation';
      case 'generate_summary':
        return 'reporting';
      case 'cross_reference':
        return 'cross_reference';
      default:
        return 'entity_discovery';
    }
  }

  /**
   * Infer task specialization from context
   */
  private inferTaskSpecialization(task: WorkItem): AgentSpecialization {
    const entityId = task.entityId.toLowerCase();
    
    if (entityId.includes('component') || entityId.includes('ui') || entityId.includes('frontend')) {
      return 'frontend_components';
    } else if (entityId.includes('service') || entityId.includes('api') || entityId.includes('controller')) {
      return 'backend_services';
    } else if (entityId.includes('entity') || entityId.includes('model') || entityId.includes('repository')) {
      return 'database_entities';
    } else if (entityId.includes('endpoint') || entityId.includes('route')) {
      return 'api_endpoints';
    } else if (entityId.includes('config') || entityId.includes('setting')) {
      return 'configuration';
    } else if (entityId.includes('test') || entityId.includes('spec')) {
      return 'testing';
    }
    
    return 'generic';
  }

  /**
   * Distribute tasks using load balancing
   */
  private async distributeByLoadBalance(availableAgents: string[]): Promise<number> {
    const session = this.coordinationSession!;
    let distributedCount = 0;

    // Sort agents by current load (ascending)
    const sortedAgents = availableAgents
      .map(agentId => {
        const config = session.registeredAgents.get(agentId)!;
        const status = session.agentStatuses.get(agentId)!;
        const load = status.currentTasks.length / config.maxConcurrentTasks;
        return { agentId, load };
      })
      .sort((a, b) => a.load - b.load);

    // Distribute tasks to least loaded agents first
    for (const task of [...session.taskQueue]) {
      const leastLoadedAgent = sortedAgents.find(({ agentId }) => {
        const status = session.agentStatuses.get(agentId)!;
        const config = session.registeredAgents.get(agentId)!;
        return status.currentTasks.length < config.maxConcurrentTasks;
      });

      if (leastLoadedAgent) {
        await this.assignTaskToAgent(task, leastLoadedAgent.agentId);
        this.removeTaskFromQueue(task.id);
        distributedCount++;
        
        // Update load for next iteration
        leastLoadedAgent.load = (session.agentStatuses.get(leastLoadedAgent.agentId)!.currentTasks.length) / 
                                 session.registeredAgents.get(leastLoadedAgent.agentId)!.maxConcurrentTasks;
        sortedAgents.sort((a, b) => a.load - b.load);
      } else {
        break; // All agents at capacity
      }
    }

    return distributedCount;
  }

  /**
   * Distribute tasks using priority weighting
   */
  private async distributeByPriorityWeight(availableAgents: string[]): Promise<number> {
    const session = this.coordinationSession!;
    let distributedCount = 0;

    // Group tasks by priority
    const tasksByPriority = new Map<Priority, WorkItem[]>();
    for (const task of session.taskQueue) {
      if (!tasksByPriority.has(task.priority)) {
        tasksByPriority.set(task.priority, []);
      }
      tasksByPriority.get(task.priority)!.push(task);
    }

    // Process highest priority tasks first
    const priorities = Array.from(tasksByPriority.keys()).sort((a, b) => a - b);
    
    for (const priority of priorities) {
      const priorityTasks = tasksByPriority.get(priority)!;
      
      for (const task of priorityTasks) {
        const availableAgent = availableAgents.find(agentId => {
          const status = session.agentStatuses.get(agentId)!;
          const config = session.registeredAgents.get(agentId)!;
          return status.currentTasks.length < config.maxConcurrentTasks;
        });

        if (availableAgent) {
          await this.assignTaskToAgent(task, availableAgent);
          this.removeTaskFromQueue(task.id);
          distributedCount++;
        }
      }
    }

    return distributedCount;
  }

  /**
   * Distribute tasks using round-robin strategy
   */
  private async distributeRoundRobin(availableAgents: string[]): Promise<number> {
    const session = this.coordinationSession!;
    let distributedCount = 0;
    let agentIndex = 0;

    for (const task of [...session.taskQueue]) {
      let assigned = false;
      const startIndex = agentIndex;

      // Try each agent starting from current index
      do {
        const agentId = availableAgents[agentIndex];
        const status = session.agentStatuses.get(agentId)!;
        const config = session.registeredAgents.get(agentId)!;

        if (status.currentTasks.length < config.maxConcurrentTasks) {
          await this.assignTaskToAgent(task, agentId);
          this.removeTaskFromQueue(task.id);
          distributedCount++;
          assigned = true;
        }

        agentIndex = (agentIndex + 1) % availableAgents.length;
      } while (!assigned && agentIndex !== startIndex);

      if (!assigned) {
        break; // All agents at capacity
      }
    }

    return distributedCount;
  }

  /**
   * Assign a task to a specific agent
   */
  private async assignTaskToAgent(task: WorkItem, agentId: string): Promise<void> {
    const session = this.coordinationSession!;
    const status = session.agentStatuses.get(agentId)!;

    // Calculate token cost for task assignment using token manager
    const taskText = JSON.stringify(task);
    const estimatedTokens = this.tokenManager.estimateTokenCount(taskText);

    // Update task assignment
    task.assignedAgent = agentId;
    task.status = 'assigned';
    task.updatedAt = new Date();

    // Update agent status
    status.currentTasks.push(task);
    status.status = 'busy';

    // Update performance monitor
    this.performanceMonitor.setAgentStatus(agentId, 'processing', task);

    console.log(`📋 Task ${task.id} assigned to agent ${agentId} (estimated ${estimatedTokens} tokens)`);
  }

  /**
   * Handle task completion from an agent
   */
  async handleTaskCompletion(
    agentId: string,
    taskId: string,
    success: boolean,
    _result?: unknown, // Parameter kept for API compatibility but marked as unused
    error?: string
  ): Promise<void> {
    if (!this.coordinationSession) {
      return;
    }

    const session = this.coordinationSession;
    const status = session.agentStatuses.get(agentId);
    
    if (!status) {
      console.warn(`⚠️ Task completion from unknown agent: ${agentId}`);
      return;
    }

    // Find and remove task from agent's current tasks
    const taskIndex = status.currentTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      console.warn(`⚠️ Task ${taskId} not found in agent ${agentId} current tasks`);
      return;
    }

    const task = status.currentTasks.splice(taskIndex, 1)[0];
    const taskDuration = Date.now() - task.updatedAt.getTime();

    // Update task status
    task.status = success ? 'completed' : 'failed';
    task.completedAt = new Date();
    task.actualEffort = taskDuration;
    if (error) {
      task.errorMessage = error;
    }

    // Update agent status
    if (success) {
      status.completedTasks++;
    } else {
      status.failedTasks++;
    }

    // Update performance metrics
    const totalTasks = status.completedTasks + status.failedTasks;
    status.performance.successRate = status.completedTasks / totalTasks;
    status.performance.averageTaskDuration = (status.performance.averageTaskDuration + taskDuration) / 2;
    status.performance.throughput = status.completedTasks / ((Date.now() - session.startTime.getTime()) / 1000);

    // Update agent availability
    if (status.currentTasks.length === 0) {
      status.status = 'available';
    }

    // Update performance monitor
    this.performanceMonitor.updateAgentPerformance(agentId, taskDuration, success);
    this.performanceMonitor.setAgentStatus(agentId, status.currentTasks.length > 0 ? 'processing' : 'idle');

    // Update session statistics
    if (success) {
      session.statistics.totalTasksCompleted++;
      session.completedTasks.push(task);
    } else {
      session.statistics.totalTasksFailed++;
    }

    session.statistics.averageCompletionTime = 
      (session.statistics.averageCompletionTime + taskDuration) / 2;

    console.log(`✅ Task ${taskId} ${success ? 'completed' : 'failed'} by agent ${agentId} in ${taskDuration}ms`);

    // Try to distribute more tasks
    await this.distributeTasks();
  }

  /**
   * Get agents that are available for new tasks
   */
  private getAvailableAgents(): string[] {
    if (!this.coordinationSession) {
      return [];
    }

    const availableAgents: string[] = [];
    
    for (const [agentId, status] of this.coordinationSession.agentStatuses) {
      const config = this.coordinationSession.registeredAgents.get(agentId);
      
      if (config && status.status === 'available' && status.currentTasks.length < config.maxConcurrentTasks) {
        availableAgents.push(agentId);
      }
    }

    return availableAgents;
  }

  /**
   * Remove task from queue
   */
  private removeTaskFromQueue(taskId: string): void {
    if (!this.coordinationSession) {
      return;
    }

    const index = this.coordinationSession.taskQueue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      this.coordinationSession.taskQueue.splice(index, 1);
    }
  }

  /**
   * Start heartbeat monitoring for agent health
   */
  private startHeartbeatMonitoring(): void {
    // Store monitoring state in extension context for recovery
    this.context.globalState.update('coordination-monitoring', {
      active: true,
      startTime: Date.now()
    });

    this.heartbeatTimer = setInterval(() => {
      this.checkAgentHeartbeats();
    }, 60000); // Check every minute
  }

  /**
   * Check agent heartbeats and handle disconnections
   */
  private checkAgentHeartbeats(): void {
    if (!this.coordinationSession) {
      return;
    }

    const now = new Date();
    const timeoutMs = 5 * 60 * 1000; // 5 minute timeout

    for (const [agentId, status] of this.coordinationSession.agentStatuses) {
      const timeSinceHeartbeat = now.getTime() - status.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > timeoutMs && status.status !== 'disconnected') {
        console.warn(`💔 Agent ${agentId} heartbeat timeout - marking as disconnected`);
        status.status = 'disconnected';
        
        // Reassign tasks from disconnected agent
        if (status.currentTasks.length > 0) {
          this.coordinationSession.taskQueue.push(...status.currentTasks);
          status.currentTasks = [];
          console.log(`📋 Reassigned tasks from disconnected agent ${agentId}`);
        }
      }
    }
  }

  /**
   * Update agent heartbeat
   */
  updateAgentHeartbeat(agentId: string): void {
    if (!this.coordinationSession) {
      return;
    }

    const status = this.coordinationSession.agentStatuses.get(agentId);
    if (status) {
      status.lastHeartbeat = new Date();
      if (status.status === 'disconnected') {
        status.status = 'available';
        console.log(`💚 Agent ${agentId} reconnected`);
      }
    }
  }

  /**
   * Get coordination session statistics
   */
  getCoordinationStatistics(): CoordinationSession['statistics'] | null {
    if (!this.coordinationSession) {
      return null;
    }

    // Calculate parallelism efficiency
    const session = this.coordinationSession;
    const totalTasks = session.statistics.totalTasksCompleted + session.statistics.totalTasksFailed;
    const activeAgents = Array.from(session.agentStatuses.values())
      .filter(status => status.status === 'busy' || status.status === 'available').length;
    
    session.statistics.parallelismEfficiency = totalTasks > 0 ? 
      (session.statistics.totalTasksCompleted / totalTasks) * (activeAgents / session.registeredAgents.size) : 0;

    return session.statistics;
  }

  /**
   * Get detailed agent information
   */
  getAgentDetails(): { config: AgentConfiguration; status: AgentStatus }[] {
    if (!this.coordinationSession) {
      return [];
    }

    const details: { config: AgentConfiguration; status: AgentStatus }[] = [];
    
    for (const [agentId, config] of this.coordinationSession.registeredAgents) {
      const status = this.coordinationSession.agentStatuses.get(agentId);
      if (status) {
        details.push({ config, status });
      }
    }

    return details;
  }

  /**
   * Cleanup and stop coordination
   */
  async stopCoordination(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.coordinationSession) {
      console.log(`🛑 Stopping coordination session: ${this.coordinationSession.sessionId}`);
      
      // Save session state to context for potential recovery
      await this.context.globalState.update(`coordination-${this.coordinationSession.sessionId}`, {
        sessionId: this.coordinationSession.sessionId,
        endTime: Date.now(),
        state: 'stopped',
        finalStatistics: this.coordinationSession.statistics
      });
      
      this.coordinationSession = undefined;
    }

    // Update monitoring state in context
    await this.context.globalState.update('coordination-monitoring', {
      active: false,
      endTime: Date.now()
    });
  }

  /**
   * Get comprehensive coordination report
   */
  getCoordinationReport(): {
    session: CoordinationSession | null;
    statistics: CoordinationSession['statistics'] | null;
    agentDetails: { config: AgentConfiguration; status: AgentStatus }[];
    queueInfo: {
      pending: number;
      inProgress: number;
      completed: number;
      failed: number;
    };
  } {
    const queueInfo = this.coordinationSession ? {
      pending: this.coordinationSession.taskQueue.length,
      inProgress: Array.from(this.coordinationSession.agentStatuses.values())
        .reduce((sum, status) => sum + status.currentTasks.length, 0),
      completed: this.coordinationSession.statistics.totalTasksCompleted,
      failed: this.coordinationSession.statistics.totalTasksFailed
    } : { pending: 0, inProgress: 0, completed: 0, failed: 0 };

    return {
      session: this.coordinationSession || null,
      statistics: this.getCoordinationStatistics(),
      agentDetails: this.getAgentDetails(),
      queueInfo
    };
  }
}
