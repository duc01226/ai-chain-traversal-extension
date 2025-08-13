/**
 * Performance Monitor Service for AI Chain Traversal Extension
 * Monitors and optimizes performance across multi-agent processing
 */

import * as vscode from 'vscode';
import { EntityNode, RelationshipEdge, WorkItem } from '../types';

export interface PerformanceConfiguration {
  maxConcurrentAgents: number;
  maxMemoryUsageMB: number;
  maxProcessingTimeMs: number;
  optimizationThresholds: {
    memoryWarning: number; // Percentage
    memoryError: number; // Percentage
    responseTimeWarning: number; // Milliseconds
    responseTimeError: number; // Milliseconds
  };
  cacheConfiguration: {
    maxEntityCacheSize: number;
    maxRelationshipCacheSize: number;
    cacheExpirationMinutes: number;
    cacheEvictionThreshold: number; // Percentage (default: 0.8)
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  memoryUsage: {
    usedMB: number;
    maxMB: number;
    percentage: number;
  };
  processingSpeed: {
    entitiesPerSecond: number;
    relationshipsPerSecond: number;
    averageProcessingTimeMs: number;
  };
  agentCoordination: {
    activeAgents: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageWaitTimeMs: number;
  };
  bottlenecks: BottleneckAnalysis[];
  recommendations: string[];
}

export interface BottleneckAnalysis {
  type: 'memory' | 'cpu' | 'io' | 'coordination' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggestedActions: string[];
  affectedAgents?: string[];
}

export interface CacheMetrics {
  entityCacheHitRate: number;
  relationshipCacheHitRate: number;
  cacheMemoryUsageMB: number;
  evictionCount: number;
  lastOptimization: Date;
}

export interface AgentPerformanceInfo {
  agentId: string;
  status: 'active' | 'idle' | 'processing' | 'error';
  currentTask: WorkItem | undefined;
  tasksCompleted: number;
  averageTaskDurationMs: number;
  errorCount: number;
  lastActivity: Date;
  memoryUsageMB: number;
}

export class PerformanceMonitorService {
  private static instance: PerformanceMonitorService | undefined;
  private readonly context: vscode.ExtensionContext;
  private readonly config: PerformanceConfiguration;
  private readonly metricsHistory: PerformanceMetrics[] = [];
  private readonly entityCache = new Map<string, EntityNode>();
  private readonly relationshipCache = new Map<string, RelationshipEdge[]>();
  private readonly agentRegistry = new Map<string, AgentPerformanceInfo>();
  private monitoringTimer?: NodeJS.Timeout | undefined;
  private isMonitoringActive = false;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.config = this.loadConfiguration();
    // Don't start monitoring until requested
  }

  /**
   * Get singleton instance of PerformanceMonitorService
   */
  public static getInstance(context: vscode.ExtensionContext): PerformanceMonitorService {
    if (!PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance = new PerformanceMonitorService(context);
    }
    return PerformanceMonitorService.instance;
  }

  /**
   * Dispose singleton instance
   */
  public static disposeInstance(): void {
    if (PerformanceMonitorService.instance) {
      PerformanceMonitorService.instance.dispose();
      PerformanceMonitorService.instance = undefined;
    }
  }

  /**
   * Load performance configuration from VS Code settings
   */
  private loadConfiguration(): PerformanceConfiguration {
    const config = vscode.workspace.getConfiguration('chainTraversal.performance');
    
    return {
      maxConcurrentAgents: config.get('maxConcurrentAgents', 4),
      maxMemoryUsageMB: config.get('maxMemoryUsageMB', 2048),
      maxProcessingTimeMs: config.get('maxProcessingTimeMs', 300000), // 5 minutes
      optimizationThresholds: {
        memoryWarning: config.get('memoryWarningThreshold', 75),
        memoryError: config.get('memoryErrorThreshold', 90),
        responseTimeWarning: config.get('responseTimeWarningMs', 10000),
        responseTimeError: config.get('responseTimeErrorMs', 30000)
      },
      cacheConfiguration: {
        maxEntityCacheSize: config.get('maxEntityCacheSize', 10000),
        maxRelationshipCacheSize: config.get('maxRelationshipCacheSize', 50000),
        cacheExpirationMinutes: config.get('cacheExpirationMinutes', 30),
        cacheEvictionThreshold: config.get('tokenManagement.cacheEvictionThreshold', 0.8)
      }
    };
  }

  /**
   * Start continuous performance monitoring (only when needed)
   */
  public startPerformanceMonitoring(): void {
    if (this.isMonitoringActive) {
      return; // Already monitoring
    }

    this.isMonitoringActive = true;
    this.monitoringTimer = setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.analyzePerformance(metrics);
        this.updateStatusBarViaManager(metrics);
      } catch (error) {
        console.error('Performance monitoring error:', error);
      }
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Stop performance monitoring
   */
  public stopPerformanceMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
      this.isMonitoringActive = false;
    }
  }

  /**
   * Register a new agent for performance tracking
   */
  registerAgent(agentId: string): void {
    this.agentRegistry.set(agentId, {
      agentId,
      status: 'idle',
      currentTask: undefined,
      tasksCompleted: 0,
      averageTaskDurationMs: 0,
      errorCount: 0,
      lastActivity: new Date(),
      memoryUsageMB: 0
    });
  }

  /**
   * Update agent performance info
   */
  updateAgentPerformance(agentId: string, taskDurationMs: number, success: boolean): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.tasksCompleted += 1;
      agent.averageTaskDurationMs = (agent.averageTaskDurationMs + taskDurationMs) / 2;
      agent.lastActivity = new Date();
      
      if (!success) {
        agent.errorCount += 1;
      }
      
      this.agentRegistry.set(agentId, agent);
      
      // Store performance data in context for persistence
      this.context.globalState.update(`agent-performance-${agentId}`, {
        tasksCompleted: agent.tasksCompleted,
        averageTaskDurationMs: agent.averageTaskDurationMs,
        errorCount: agent.errorCount,
        lastUpdate: new Date().toISOString()
      });
    }
  }

  /**
   * Set agent status and current task
   */
  setAgentStatus(agentId: string, status: AgentPerformanceInfo['status'], currentTask?: WorkItem): void {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.status = status;
      agent.currentTask = currentTask;
      agent.lastActivity = new Date();
      this.agentRegistry.set(agentId, agent);
    }
  }

  /**
   * Check if system can handle additional concurrent agents
   */
  canAcceptNewAgent(): boolean {
    const activeAgents = Array.from(this.agentRegistry.values())
      .filter(agent => agent.status === 'active' || agent.status === 'processing').length;
    
    return activeAgents < this.config.maxConcurrentAgents;
  }

  /**
   * Get next available agent for task assignment
   */
  getNextAvailableAgent(): string | null {
    const idleAgents = Array.from(this.agentRegistry.entries())
      .filter(([, agent]) => agent.status === 'idle')
      .sort(([, a], [, b]) => a.tasksCompleted - b.tasksCompleted); // Prefer agents with fewer completed tasks
    
    return idleAgents.length > 0 ? idleAgents[0][0] : null;
  }

  /**
   * Optimize work distribution across agents
   */
  optimizeWorkDistribution(workItems: WorkItem[]): { agentId: string; tasks: WorkItem[] }[] {
    const availableAgents = Array.from(this.agentRegistry.entries())
      .filter(([, agent]) => agent.status === 'idle' || agent.status === 'active')
      .map(([agentId]) => agentId);

    if (availableAgents.length === 0) {
      return [];
    }

    // Group by priority and dependency complexity
    const highPriorityTasks = workItems.filter(item => item.priority <= 2);
    const mediumPriorityTasks = workItems.filter(item => item.priority === 3);
    const lowPriorityTasks = workItems.filter(item => item.priority >= 4);

    const distribution: { agentId: string; tasks: WorkItem[] }[] = [];
    
    // Distribute high priority tasks first
    this.distributeTasksToAgents(highPriorityTasks, availableAgents, distribution);
    this.distributeTasksToAgents(mediumPriorityTasks, availableAgents, distribution);
    this.distributeTasksToAgents(lowPriorityTasks, availableAgents, distribution);

    return distribution;
  }

  /**
   * Distribute tasks to agents in round-robin fashion
   */
  private distributeTasksToAgents(
    tasks: WorkItem[], 
    agents: string[], 
    distribution: { agentId: string; tasks: WorkItem[] }[]
  ): void {
    for (let i = 0; i < tasks.length; i++) {
      const agentId = agents[i % agents.length];
      let agentDistribution = distribution.find(d => d.agentId === agentId);
      
      if (!agentDistribution) {
        agentDistribution = { agentId, tasks: [] };
        distribution.push(agentDistribution);
      }
      
      agentDistribution.tasks.push(tasks[i]);
    }
  }

  /**
   * Cache entity with performance optimization
   */
  cacheEntity(entity: EntityNode): void {
    // Check cache size limits
    if (this.entityCache.size >= this.config.cacheConfiguration.maxEntityCacheSize) {
      this.evictOldestCacheEntries('entity');
    }
    
    this.entityCache.set(entity.id, entity);
  }

  /**
   * Get cached entity
   */
  getCachedEntity(entityId: string): EntityNode | undefined {
    return this.entityCache.get(entityId);
  }

  /**
   * Cache relationships for an entity
   */
  cacheRelationships(entityId: string, relationships: RelationshipEdge[]): void {
    if (this.relationshipCache.size >= this.config.cacheConfiguration.maxRelationshipCacheSize) {
      this.evictOldestCacheEntries('relationship');
    }
    
    this.relationshipCache.set(entityId, relationships);
  }

  /**
   * Get cached relationships
   */
  getCachedRelationships(entityId: string): RelationshipEdge[] | undefined {
    return this.relationshipCache.get(entityId);
  }

  /**
   * Evict oldest cache entries when size limits are reached
   */
  private evictOldestCacheEntries(cacheType: 'entity' | 'relationship'): void {
    const cache = cacheType === 'entity' ? this.entityCache : this.relationshipCache;
    const maxSize = cacheType === 'entity' 
      ? this.config.cacheConfiguration.maxEntityCacheSize 
      : this.config.cacheConfiguration.maxRelationshipCacheSize;
    
    // Use configurable cache eviction threshold instead of hardcoded 0.8
    const evictionThreshold = this.config.cacheConfiguration.cacheEvictionThreshold;
    const entriesToRemove = cache.size - Math.floor(maxSize * evictionThreshold);
    
    const iterator = cache.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = iterator.next().value;
      if (key) {
        cache.delete(key);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.entityCache.clear();
    this.relationshipCache.clear();
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics {
    // This is a simplified implementation - real cache hit rates would need tracking
    return {
      entityCacheHitRate: 0.85, // Placeholder - would track actual hits/misses
      relationshipCacheHitRate: 0.78,
      cacheMemoryUsageMB: (this.entityCache.size + this.relationshipCache.size) * 0.001, // Rough estimate
      evictionCount: 0, // Would track actual evictions
      lastOptimization: new Date()
    };
  }

  /**
   * Collect comprehensive performance metrics
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    const memoryUsage = this.getMemoryUsage();
    const processingSpeed = this.calculateProcessingSpeed();
    const agentCoordination = this.getAgentCoordinationMetrics();
    const bottlenecks = this.analyzeBottlenecks(memoryUsage, processingSpeed, agentCoordination);
    const recommendations = this.generateRecommendations(bottlenecks);

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      memoryUsage,
      processingSpeed,
      agentCoordination,
      bottlenecks,
      recommendations
    };

    // Keep metrics history (last 100 entries)
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift();
    }

    return metrics;
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): PerformanceMetrics['memoryUsage'] {
    const used = process.memoryUsage();
    const usedMB = Math.round((used.heapUsed + used.external) / 1024 / 1024);
    const maxMB = this.config.maxMemoryUsageMB;
    
    return {
      usedMB,
      maxMB,
      percentage: (usedMB / maxMB) * 100
    };
  }

  /**
   * Calculate processing speed metrics
   */
  private calculateProcessingSpeed(): PerformanceMetrics['processingSpeed'] {
    // Calculate based on actual processing history if available
    const recentEntities = Array.from(this.entityCache.values()).filter(entity => {
      const entityTime = new Date(entity.timestamp || Date.now()).getTime();
      const oneMinuteAgo = Date.now() - 60000; // Last minute
      return entityTime > oneMinuteAgo;
    });

    const recentRelationships = Array.from(this.relationshipCache.values()).flat().filter(rel => {
      const relTime = new Date(rel.timestamp || Date.now()).getTime();
      const oneMinuteAgo = Date.now() - 60000; // Last minute
      return relTime > oneMinuteAgo;
    });

    // If we have recent activity, calculate real speeds
    if (recentEntities.length > 0 || recentRelationships.length > 0) {
      return {
        entitiesPerSecond: recentEntities.length / 60, // Entities discovered in last minute
        relationshipsPerSecond: recentRelationships.length / 60, // Relationships discovered in last minute
        averageProcessingTimeMs: this.calculateAverageProcessingTime()
      };
    }

    // No recent activity - return zeros instead of placeholder values
    return {
      entitiesPerSecond: 0,
      relationshipsPerSecond: 0,
      averageProcessingTimeMs: 0
    };
  }

  /**
   * Calculate average processing time based on agent performance
   */
  private calculateAverageProcessingTime(): number {
    const agents = Array.from(this.agentRegistry.values());
    if (agents.length === 0) {
      return 0;
    }

    const totalTime = agents.reduce((sum, agent) => sum + agent.averageTaskDurationMs, 0);
    return totalTime / agents.length;
  }

  /**
   * Get agent coordination metrics
   */
  private getAgentCoordinationMetrics(): PerformanceMetrics['agentCoordination'] {
    const agents = Array.from(this.agentRegistry.values());
    
    return {
      activeAgents: agents.filter(a => a.status === 'active' || a.status === 'processing').length,
      queuedTasks: 0, // Would need access to work queue
      completedTasks: agents.reduce((sum, agent) => sum + agent.tasksCompleted, 0),
      failedTasks: agents.reduce((sum, agent) => sum + agent.errorCount, 0),
      averageWaitTimeMs: 150 // Placeholder
    };
  }

  /**
   * Analyze performance bottlenecks
   */
  private analyzeBottlenecks(
    memory: PerformanceMetrics['memoryUsage'],
    processing: PerformanceMetrics['processingSpeed'],
    coordination: PerformanceMetrics['agentCoordination']
  ): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Memory bottlenecks
    if (memory.percentage > this.config.optimizationThresholds.memoryError) {
      bottlenecks.push({
        type: 'memory',
        severity: 'critical',
        description: `Memory usage at ${memory.percentage.toFixed(1)}% (${memory.usedMB}MB)`,
        impact: 'System may become unstable, processing will slow down significantly',
        suggestedActions: [
          'Clear entity and relationship caches',
          'Reduce concurrent agent count',
          'Enable aggressive garbage collection',
          'Consider summarizing context to reduce memory footprint'
        ]
      });
    } else if (memory.percentage > this.config.optimizationThresholds.memoryWarning) {
      bottlenecks.push({
        type: 'memory',
        severity: 'high',
        description: `Memory usage at ${memory.percentage.toFixed(1)}% (${memory.usedMB}MB)`,
        impact: 'Performance degradation likely, may need optimization soon',
        suggestedActions: [
          'Optimize entity cache size',
          'Consider context summarization',
          'Monitor for memory leaks'
        ]
      });
    }

    // Processing speed bottlenecks
    if (processing.averageProcessingTimeMs > this.config.optimizationThresholds.responseTimeError) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'critical',
        description: `Average processing time ${processing.averageProcessingTimeMs}ms`,
        impact: 'Severe performance impact, users experiencing delays',
        suggestedActions: [
          'Increase parallel processing',
          'Optimize discovery algorithms',
          'Reduce complexity of analysis',
          'Check for infinite loops or excessive recursion'
        ]
      });
    }

    // Agent coordination bottlenecks
    if (coordination.activeAgents === 0 && coordination.queuedTasks > 0) {
      bottlenecks.push({
        type: 'coordination',
        severity: 'high',
        description: 'No active agents available but tasks are queued',
        impact: 'Work is not being processed, system appears stuck',
        suggestedActions: [
          'Check agent health status',
          'Restart failed agents',
          'Investigate agent coordination logic'
        ]
      });
    }

    return bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(bottlenecks: BottleneckAnalysis[]): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.some(b => b.type === 'memory' && b.severity === 'critical')) {
      recommendations.push('🚨 Immediate action required: Memory usage critical');
    }

    if (bottlenecks.some(b => b.type === 'cpu')) {
      recommendations.push('⚡ Consider optimizing processing algorithms');
    }

    if (bottlenecks.length === 0) {
      recommendations.push('✅ System performance is optimal');
    }

    return recommendations;
  }

  /**
   * Analyze performance and take automated optimization actions
   */
  private analyzePerformance(metrics: PerformanceMetrics): void {
    // Auto-optimize based on thresholds
    if (metrics.memoryUsage.percentage > this.config.optimizationThresholds.memoryWarning) {
      this.optimizeMemoryUsage();
    }

    // Log critical bottlenecks
    const criticalBottlenecks = metrics.bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      vscode.window.showWarningMessage(
        `⚠️ Performance Critical: ${criticalBottlenecks.length} critical bottlenecks detected`
      );
    }
  }

  /**
   * Optimize memory usage
   */
  private optimizeMemoryUsage(): void {
    // Clear old cache entries
    this.evictOldestCacheEntries('entity');
    this.evictOldestCacheEntries('relationship');

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    console.log('🧠 Memory optimization performed');
  }

  /**
   * Update status bar via the StatusBarManager (no duplication)
   */
  private updateStatusBarViaManager(metrics: PerformanceMetrics): void {
    const memoryPercent = metrics.memoryUsage.percentage.toFixed(0);
    const activeAgents = metrics.agentCoordination.activeAgents;
    const processingSpeed = metrics.processingSpeed.entitiesPerSecond;
    
    // Use existing StatusBarManager instead of creating new status bar items
    const { StatusBarManager } = require('../../base/baseTool');
    
    // Only show performance info if there's actual activity
    if (activeAgents > 0 || processingSpeed > 0) {
      StatusBarManager.updateStatus(
        `🧠 ${memoryPercent}% | 👥 ${activeAgents} | ⚡ ${processingSpeed.toFixed(1)}/s`,
        `Memory: ${memoryPercent}% | Active Agents: ${activeAgents} | Processing: ${processingSpeed.toFixed(1)} entities/sec`
      );
    } else {
      // Show idle status when no activity
      StatusBarManager.showIdle();
    }
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    currentMetrics: PerformanceMetrics;
    historicalTrends: PerformanceMetrics[];
    cacheMetrics: CacheMetrics;
    agentInfo: AgentPerformanceInfo[];
    optimizationSuggestions: string[];
  } {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    
    return {
      currentMetrics,
      historicalTrends: this.metricsHistory.slice(-20), // Last 20 entries
      cacheMetrics: this.getCacheMetrics(),
      agentInfo: Array.from(this.agentRegistry.values()),
      optimizationSuggestions: currentMetrics?.recommendations || []
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopPerformanceMonitoring();
    this.clearCaches();
    this.agentRegistry.clear();
  }
}
