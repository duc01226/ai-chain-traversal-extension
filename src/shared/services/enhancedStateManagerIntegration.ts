/**
 * Enhanced State Manager Integration
 * 
 * This file demonstrates how to integrate the enhanced graph builder
 * with the existing AI Chain Traversal tools infrastructure.
 */

import * as vscode from 'vscode';
import { 
  EntityNode, 
  RelationshipEdge, 
  ExternalStateManager,
  DiscoverySession 
} from '../types';
import { WorkspaceStateManagerVscode } from './workspaceStateManagerVscode';
import { 
  ConcurrentSafeStateManager, 
  EnhancedGraphBuilderFactory,
  DiscoveryContext 
} from './enhancedGraphBuilder';

/**
 * Feature flags for enhanced graph builder functionality
 */
export interface EnhancedStateManagerConfig {
  enableSmartMerging: boolean;
  enableConflictResolution: boolean;
  enableConcurrentSafety: boolean;
  enablePerformanceLogging: boolean;
}

/**
 * Default configuration - can be overridden via VS Code settings
 */
const DEFAULT_ENHANCED_CONFIG: EnhancedStateManagerConfig = {
  enableSmartMerging: true,
  enableConflictResolution: true,
  enableConcurrentSafety: true,
  enablePerformanceLogging: false
};

/**
 * Enhanced State Manager Wrapper
 * 
 * This wrapper provides backward compatibility while adding enhanced functionality.
 * It can be used as a drop-in replacement for WorkspaceStateManagerVscode.
 */
export class EnhancedStateManagerWrapper implements ExternalStateManager {
  private readonly baseManager: WorkspaceStateManagerVscode;
  private readonly enhancedManager: ConcurrentSafeStateManager | null;
  private readonly config: EnhancedStateManagerConfig;

  constructor(
    context: vscode.ExtensionContext,
    workspaceRoot: string,
    customConfig?: Partial<EnhancedStateManagerConfig>
  ) {
    // Initialize base manager (always required)
    this.baseManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
    
    // Get configuration
    this.config = this.getConfiguration(customConfig);
    
    // Initialize enhanced manager if any enhanced features are enabled
    this.enhancedManager = this.shouldUseEnhanced() 
      ? EnhancedGraphBuilderFactory.createWithFeatureFlags(this.baseManager, this.config)
      : null;
  }

  /**
   * Enhanced addEntity with smart merging and concurrent safety
   * Supports both the standard interface and enhanced features
   */
  async addEntity(entity: EntityNode, discoveryContext?: DiscoveryContext): Promise<void> {
    if (this.enhancedManager) {
      // Use enhanced manager for smart merging and concurrent safety
      await this.enhancedManager.addEntity(entity, discoveryContext);
    } else {
      // Fallback to base manager
      await this.baseManager.addEntity(entity);
    }
  }

  /**
   * Enhanced addRelationship with relationship preservation
   */
  async addRelationship(relationship: RelationshipEdge): Promise<void> {
    if (this.enhancedManager) {
      // Use enhanced manager for relationship safety
      await this.enhancedManager.addRelationship(relationship);
    } else {
      // Fallback to base manager
      await this.baseManager.addRelationship(relationship);
    }
  }

  // Delegate all other methods to base manager
  async initializeSession(taskDescription: string, workspaceRoot: string): Promise<DiscoverySession> {
    return this.baseManager.initializeSession(taskDescription, workspaceRoot);
  }

  async saveSession(session: DiscoverySession): Promise<void> {
    return this.baseManager.saveSession(session);
  }

  async loadSession(sessionId: string): Promise<DiscoverySession | null> {
    return this.baseManager.loadSession(sessionId);
  }

  async saveCheckpoint(sessionId: string, checkpoint: any): Promise<void> {
    return this.baseManager.saveCheckpoint(sessionId, checkpoint);
  }

  async loadCheckpoint(sessionId: string, checkpointId?: string): Promise<any> {
    return this.baseManager.loadCheckpoint(sessionId, checkpointId);
  }

  async listCheckpoints(sessionId: string): Promise<any[]> {
    return this.baseManager.listCheckpoints(sessionId);
  }

  async getEntity(entityId: string): Promise<EntityNode | null> {
    return this.baseManager.getEntity(entityId);
  }

  async getAllEntities(filter?: Partial<EntityNode>): Promise<EntityNode[]> {
    return this.baseManager.getAllEntities(filter);
  }

  async updateEntity(entityId: string, updates: Partial<EntityNode>): Promise<void> {
    return this.baseManager.updateEntity(entityId, updates);
  }

  async getAllRelationships(): Promise<RelationshipEdge[]> {
    return this.baseManager.getAllRelationships();
  }

  async getRelationships(entityId: string, relationshipType?: any): Promise<RelationshipEdge[]> {
    return this.baseManager.getRelationships(entityId, relationshipType);
  }

  async findPath(fromEntityId: string, toEntityId: string): Promise<string[]> {
    return this.baseManager.findPath(fromEntityId, toEntityId);
  }

  async addWorkItem(workItem: any): Promise<void> {
    return this.baseManager.addWorkItem(workItem);
  }

  async getNextWorkItem(priority?: number, agentId?: string): Promise<any> {
    return this.baseManager.getNextWorkItem(priority as any, agentId);
  }

  async updateWorkItemStatus(workItemId: string, status: any, errorMessage?: string): Promise<void> {
    return this.baseManager.updateWorkItemStatus(workItemId, status, errorMessage);
  }

  async getWorkQueueStats(): Promise<any> {
    return this.baseManager.getWorkQueueStats();
  }

  async addChain(chain: any): Promise<void> {
    return this.baseManager.addChain(chain);
  }

  async updateChainStatus(chainId: string, status: any): Promise<void> {
    return this.baseManager.updateChainStatus(chainId, status);
  }

  async validateChain(chainId: string): Promise<any> {
    return this.baseManager.validateChain(chainId);
  }

  async getAllChains(): Promise<any[]> {
    return this.baseManager.getAllChains();
  }

  async generateReport(sessionId: string): Promise<any> {
    return this.baseManager.generateReport(sessionId);
  }

  async exportToYaml(sessionId: string, filePath: string): Promise<void> {
    return this.baseManager.exportToYaml(sessionId, filePath);
  }

  async exportToGraph(sessionId: string, format: 'dot' | 'json' | 'svg'): Promise<string> {
    return this.baseManager.exportToGraph(sessionId, format);
  }

  // Configuration management
  private getConfiguration(customConfig?: Partial<EnhancedStateManagerConfig>): EnhancedStateManagerConfig {
    const vscodeConfig = vscode.workspace.getConfiguration('aiChainTraversal.enhancedGraphBuilder');
    
    return {
      enableSmartMerging: customConfig?.enableSmartMerging ?? 
                         vscodeConfig.get('enableSmartMerging', DEFAULT_ENHANCED_CONFIG.enableSmartMerging),
      enableConflictResolution: customConfig?.enableConflictResolution ?? 
                               vscodeConfig.get('enableConflictResolution', DEFAULT_ENHANCED_CONFIG.enableConflictResolution),
      enableConcurrentSafety: customConfig?.enableConcurrentSafety ?? 
                             vscodeConfig.get('enableConcurrentSafety', DEFAULT_ENHANCED_CONFIG.enableConcurrentSafety),
      enablePerformanceLogging: customConfig?.enablePerformanceLogging ?? 
                               vscodeConfig.get('enablePerformanceLogging', DEFAULT_ENHANCED_CONFIG.enablePerformanceLogging)
    };
  }

  private shouldUseEnhanced(): boolean {
    return this.config.enableSmartMerging || 
           this.config.enableConflictResolution || 
           this.config.enableConcurrentSafety;
  }

  /**
   * Get current configuration for debugging/monitoring
   */
  getConfig(): EnhancedStateManagerConfig {
    return { ...this.config };
  }

  /**
   * Performance monitoring for enhanced features
   */
  async getPerformanceMetrics(): Promise<any> {
    if (this.config.enablePerformanceLogging) {
      // Implementation would go here for gathering performance metrics
      return {
        enhancedFeaturesEnabled: this.shouldUseEnhanced(),
        config: this.config,
        timestamp: new Date()
      };
    }
    return null;
  }
}

/**
 * Factory function for creating enhanced state managers
 * This is the recommended way to create state managers in tools
 */
export function createStateManager(
  context: vscode.ExtensionContext,
  workspaceRoot: string,
  options?: {
    enhanced?: boolean;
    config?: Partial<EnhancedStateManagerConfig>;
  }
): ExternalStateManager {
  
  if (options?.enhanced !== false) {
    // Default to enhanced unless explicitly disabled
    return new EnhancedStateManagerWrapper(context, workspaceRoot, options?.config);
  } else {
    // Use original implementation
    return new WorkspaceStateManagerVscode(context, workspaceRoot);
  }
}

/**
 * Migration utility for existing tools
 * 
 * Usage in existing tools:
 * 
 * OLD:
 * this.stateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
 * 
 * NEW:
 * this.stateManager = createStateManager(context, workspaceRoot);
 * 
 * Or with custom configuration:
 * this.stateManager = createStateManager(context, workspaceRoot, {
 *   config: { enableSmartMerging: true, enableConcurrentSafety: false }
 * });
 */
export function migrateToEnhancedStateManager(
  context: vscode.ExtensionContext,
  workspaceRoot: string
): ExternalStateManager {
  return createStateManager(context, workspaceRoot);
}
