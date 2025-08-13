/**
 * Token Management Service for AI Chain Traversal Extension
 * Monitors token usage and provides context summarization when approaching limits
 */

import * as vscode from 'vscode';
import { EntityNode, RelationshipEdge, DiscoverySession, EntityType } from '../types';

export interface TokenUsageMetrics {
  currentTokens: number;
  maxTokens: number;
  usagePercentage: number;
  warningThreshold: number; // Default: 90%
  criticalThreshold: number; // Default: 95%
  reductionTarget: number; // Default: 70%
}

export interface ContextSummarizationOptions {
  preserveTypes: EntityType[];
  maxEntitiesPerType: number;
  prioritizeRecentlyProcessed: boolean;
  includeHighPriorityRelationships: boolean;
  dependencyAwareCompression: boolean; // NEW: Enable dependency-aware compression
  relationshipPreservationPriority: string[]; // NEW: Priority order for relationship types
  compressionTarget: number; // NEW: Target compression percentage (default: 70%)
}

export interface SummarizedContext {
  originalTokenCount: number;
  summarizedTokenCount: number;
  reductionPercentage: number;
  preservedEntities: EntityNode[];
  preservedRelationships: RelationshipEdge[];
  summaryData: string;
  externalStoragePath: string;
  compressionMetadata: CompressionMetadata; // NEW: Metadata about compression decisions
}

export interface CompressionMetadata {
  compressedEntityCount: number;
  preservedEntityCount: number;
  compressedRelationshipCount: number;
  preservedRelationshipCount: number;
  dependencyChainCount: number;
  externalReferences: EntityReference[];
}

export interface EntityReference {
  entityId: string;
  entityType: string;
  filePath: string;
  relationshipTypes: string[];
  compressionLevel: 'minimal' | 'summary' | 'reference_only';
}

export class TokenManagementService {
  private readonly context: vscode.ExtensionContext;
  private readonly defaultOptions: ContextSummarizationOptions;
  private readonly thresholds: Pick<TokenUsageMetrics, 'warningThreshold' | 'criticalThreshold' | 'reductionTarget'>;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Get configurable relationship preservation priority
    const relationshipConfig = vscode.workspace.getConfiguration('aiChainTraversal.relationships');
    const criticalTypes = relationshipConfig.get<string[]>('criticalTypes', 
      ['DEPENDS_ON', 'CALLS', 'USES', 'IMPLEMENTS', 'EXTENDS']
    );
    
    this.defaultOptions = {
      preserveTypes: this.getConfiguredPreserveTypes(),
      maxEntitiesPerType: 20,
      prioritizeRecentlyProcessed: true,
      includeHighPriorityRelationships: true,
      dependencyAwareCompression: true,
      relationshipPreservationPriority: criticalTypes,
      compressionTarget: 70
    };
    this.thresholds = {
      warningThreshold: 90,
      criticalThreshold: 95,
      reductionTarget: 70
    };
  }

  /**
   * Get configured preserve types from VS Code settings with fallback to defaults
   * 
   * These entity types are considered most architecturally important and are preserved
   * during token compression to maintain code understanding:
   * 
   * - Entity: Domain entities, core business objects
   * - Controller: API endpoints, request handlers, MVC controllers
   * - Service: Business logic layer, application services
   * - CommandHandler: CQRS command handlers, action processors  
   * - QueryHandler: CQRS query handlers, data retrievers
   * - EventHandler: Event handlers, message processors
   * - Component: UI components, React/Vue/Angular components
   * - DTO: Data transfer objects, API models
   * - Store: State management stores, Redux stores, Vuex stores
   * - ViewModel: Presentation layer models, MVVM view models
   * - DataModel: Data layer models, database entities
   * - UiState: UI state management objects
   * - DataState: Data state management objects
   * - Model: General models, domain models
   * - API: API definitions, service interfaces
   * - Presentation: Presentation layer components
   */
  private getConfiguredPreserveTypes(): EntityType[] {
    const config = vscode.workspace.getConfiguration('aiChainTraversal.tokenManagement');
    const configuredTypes = config.get<string[]>('preserveTypes', [
      'Entity', 'Controller', 'Service', 'CommandHandler', 'QueryHandler', 'EventHandler',
      'Component', 'DTO', 'Store', 'ViewModel', 'DataModel', 
      'UiState', 'DataState', 'Model', 'API', 'Presentation'
    ]);
    
    // Validate and filter configured types to ensure they're valid EntityTypes
    return configuredTypes.filter(type => this.isValidEntityType(type)) as EntityType[];
  }

  /**
   * Validate if a string is a valid EntityType
   */
  private isValidEntityType(type: string): type is EntityType {
    // This would ideally check against the ENTITY_TYPES array from types.ts
    // For now, we'll do basic validation
    const validTypes = [
      'Entity', 'Repository', 'Command', 'Query', 'Handler', 'Controller', 'Service', 
      'Component', 'Store', 'Event', 'Job', 'API', 'DTO', 'Interface', 'Configuration',
      'Page', 'Layout', 'Hook', 'Context', 'Provider', 'Reducer', 'Action', 'Selector',
      'CommandHandler', 'QueryHandler', 'EventHandler', 'ViewModel', 'DataModel', 'UiState', 'DataState',
      'Model', 'Presentation'
    ];
    return validTypes.includes(type);
  }

  /**
   * Check if an entity type should be preserved based on configured types
   * Uses case-insensitive comparison for backwards compatibility
   */
  private isEntityTypePreserved(entityType: EntityType, preserveTypes: EntityType[]): boolean {
    return preserveTypes.some(preserveType => 
      preserveType.toLowerCase() === entityType.toLowerCase()
    );
  }

  /**
   * Estimate token count for a given text (approximate)
   * Uses model-specific tokenizer if available, otherwise falls back to estimation
   */
  async estimateTokenCount(
    text: string, 
    tokenizationOptions?: vscode.LanguageModelToolTokenizationOptions
  ): Promise<number> {
    if (tokenizationOptions?.countTokens) {
      try {
        // Use model-specific tokenizer for accurate counting
        return await tokenizationOptions.countTokens(text);
      } catch (error) {
        console.warn('Failed to use model-specific tokenizer, falling back to estimation:', error);
      }
    }
    
    // Fallback: Rough estimation: 1 token ≈ 4 characters for GPT models
    // This is an approximation - real tokenization would need the actual model
    return Math.ceil(text.length / 4);
  }

  /**
   * Synchronous token estimation for backward compatibility
   */
  estimateTokenCountSync(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate current token usage from entities and relationships (synchronous version)
   */
  calculateTokenUsage(
    entities: EntityNode[], 
    relationships: RelationshipEdge[], 
    additionalContext: string = '',
    maxTokens: number = 128000 // GPT-4 Turbo default
  ): TokenUsageMetrics {
    let totalTokens = 0;

    // Count tokens from entities
    for (const entity of entities) {
      const entityText = JSON.stringify(entity);
      totalTokens += this.estimateTokenCountSync(entityText);
    }

    // Count tokens from relationships
    for (const relationship of relationships) {
      const relationshipText = JSON.stringify(relationship);
      totalTokens += this.estimateTokenCountSync(relationshipText);
    }

    // Count additional context tokens
    if (additionalContext) {
      totalTokens += this.estimateTokenCountSync(additionalContext);
    }

    const usagePercentage = (totalTokens / maxTokens) * 100;

    return {
      currentTokens: totalTokens,
      maxTokens,
      usagePercentage,
      warningThreshold: this.thresholds.warningThreshold,
      criticalThreshold: this.thresholds.criticalThreshold,
      reductionTarget: this.thresholds.reductionTarget
    };
  }

  /**
   * Calculate current token usage with model-specific tokenization (async version)
   */
  async calculateTokenUsageAsync(
    entities: EntityNode[], 
    relationships: RelationshipEdge[], 
    additionalContext: string = '',
    maxTokens: number = 128000,
    tokenizationOptions?: vscode.LanguageModelToolTokenizationOptions
  ): Promise<TokenUsageMetrics> {
    let totalTokens = 0;

    // Count tokens from entities
    for (const entity of entities) {
      const entityText = JSON.stringify(entity);
      totalTokens += await this.estimateTokenCount(entityText, tokenizationOptions);
    }

    // Count tokens from relationships
    for (const relationship of relationships) {
      const relationshipText = JSON.stringify(relationship);
      totalTokens += await this.estimateTokenCount(relationshipText, tokenizationOptions);
    }

    // Count additional context tokens
    if (additionalContext) {
      totalTokens += await this.estimateTokenCount(additionalContext, tokenizationOptions);
    }

    const usagePercentage = (totalTokens / maxTokens) * 100;

    return {
      currentTokens: totalTokens,
      maxTokens,
      usagePercentage,
      warningThreshold: this.thresholds.warningThreshold,
      criticalThreshold: this.thresholds.criticalThreshold,
      reductionTarget: this.thresholds.reductionTarget
    };
  }

  /**
   * Check if token usage requires action
   */
  shouldSummarizeContext(metrics: TokenUsageMetrics): boolean {
    // Store token usage metrics in context for tracking trends
    this.context.globalState.update('token-usage-history', {
      lastCheck: new Date().toISOString(),
      usagePercentage: metrics.usagePercentage,
      currentTokens: metrics.currentTokens,
      maxTokens: metrics.maxTokens,
      exceedsThreshold: metrics.usagePercentage >= metrics.warningThreshold
    });
    
    return metrics.usagePercentage >= metrics.warningThreshold;
  }

  /**
   * Check if token usage is critical
   */
  isTokenUsageCritical(metrics: TokenUsageMetrics): boolean {
    return metrics.usagePercentage >= metrics.criticalThreshold;
  }

  /**
   * Intelligently summarize context to reduce token usage while preserving critical information
   * Enhanced with dependency-aware compression and 70% reduction target
   */
  async summarizeContext(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    session: DiscoverySession,
    options?: Partial<ContextSummarizationOptions>
  ): Promise<SummarizedContext> {
    const opts = { ...this.defaultOptions, ...options };
    
    const originalContent = {
      entities: JSON.stringify(entities),
      relationships: JSON.stringify(relationships)
    };
    const originalTokenCount = this.estimateTokenCountSync(originalContent.entities + originalContent.relationships);

    // Store full data externally before summarization
    const externalStoragePath = await this.storeFullContextExternally(entities, relationships, session);

    // NEW: Dependency-aware compression
    let preservedEntities: EntityNode[];
    let preservedRelationships: RelationshipEdge[];
    let compressionMetadata: CompressionMetadata;

    if (opts.dependencyAwareCompression) {
      const compressionResult = await this.performDependencyAwareCompression(
        entities, 
        relationships, 
        opts
      );
      preservedEntities = compressionResult.preservedEntities;
      preservedRelationships = compressionResult.preservedRelationships;
      compressionMetadata = compressionResult.metadata;
    } else {
      // Fallback to original logic
      const prioritizedEntities = this.prioritizeEntities(entities, opts);
      preservedEntities = this.selectEntitiesForPreservation(prioritizedEntities, opts);
      
      const preservedEntityIds = new Set(preservedEntities.map(e => e.id));
      preservedRelationships = relationships.filter(r => 
        preservedEntityIds.has(r.fromEntityId) && preservedEntityIds.has(r.toEntityId)
      );

      compressionMetadata = this.createBasicCompressionMetadata(entities, relationships, preservedEntities, preservedRelationships);
    }

    // Generate summary data for omitted entities with external references
    const omittedEntities = entities.filter(e => !preservedEntities.some(pe => pe.id === e.id));
    const summaryData = this.generateEnhancedEntitySummary(omittedEntities, relationships, compressionMetadata);

    const summarizedContent = {
      entities: JSON.stringify(preservedEntities),
      relationships: JSON.stringify(preservedRelationships),
      summary: summaryData
    };
    const summarizedTokenCount = this.estimateTokenCountSync(
      summarizedContent.entities + summarizedContent.relationships + summarizedContent.summary
    );

    const reductionPercentage = ((originalTokenCount - summarizedTokenCount) / originalTokenCount) * 100;

    // Ensure we meet the compression target
    if (reductionPercentage < opts.compressionTarget) {
      const additionalCompressionResult = await this.applyAdditionalCompression(
        preservedEntities,
        preservedRelationships,
        opts.compressionTarget,
        originalTokenCount
      );
      preservedEntities = additionalCompressionResult.entities;
      preservedRelationships = additionalCompressionResult.relationships;
      compressionMetadata = { ...compressionMetadata, ...additionalCompressionResult.metadata };
    }

    // Recalculate final token count
    const finalContent = {
      entities: JSON.stringify(preservedEntities),
      relationships: JSON.stringify(preservedRelationships),
      summary: summaryData
    };
    const finalTokenCount = this.estimateTokenCountSync(
      finalContent.entities + finalContent.relationships + finalContent.summary
    );
    const finalReductionPercentage = ((originalTokenCount - finalTokenCount) / originalTokenCount) * 100;

    // Log the summarization
    this.logSummarization(originalTokenCount, finalTokenCount, finalReductionPercentage);

    return {
      originalTokenCount,
      summarizedTokenCount: finalTokenCount,
      reductionPercentage: finalReductionPercentage,
      preservedEntities,
      preservedRelationships,
      summaryData,
      externalStoragePath,
      compressionMetadata
    };
  }

  /**
   * Store full context data externally for potential recovery
   */
  private async storeFullContextExternally(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    session: DiscoverySession
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `context-backup-${session.sessionId}-${timestamp}.json`;
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found for external storage');
    }

    const backupDir = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'chain-traversal', 'context-backups');
    const backupFile = vscode.Uri.joinPath(backupDir, filename);

    const fullContextData = {
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      entities,
      relationships,
      metadata: {
        totalEntities: entities.length,
        totalRelationships: relationships.length,
        entityTypes: this.getEntityTypeDistribution(entities)
      }
    };

    try {
      // Ensure backup directory exists
      await vscode.workspace.fs.createDirectory(backupDir);
      
      // Write backup file
      const content = JSON.stringify(fullContextData, null, 2);
      await vscode.workspace.fs.writeFile(backupFile, Buffer.from(content, 'utf8'));
      
      return backupFile.fsPath;
    } catch (error) {
      console.error('Failed to store full context externally:', error);
      throw new Error(`External storage failed: ${error}`);
    }
  }

  /**
   * Prioritize entities based on importance criteria
   */
  private prioritizeEntities(entities: EntityNode[], options: ContextSummarizationOptions): EntityNode[] {
    const scored = entities.map(entity => ({
      entity,
      score: this.calculateEntityImportanceScore(entity, options)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.entity);
  }

  /**
   * Calculate importance score for an entity using configurable scoring weights
   */
  private calculateEntityImportanceScore(entity: EntityNode, options: ContextSummarizationOptions): number {
    let score = 0;

    // Type priority - use case-insensitive comparison for backwards compatibility
    if (this.isEntityTypePreserved(entity.type, options.preserveTypes)) {
      score += 100;
    }

    // Recently processed priority - use configurable threshold
    if (options.prioritizeRecentlyProcessed && entity.processed) {
      const config = vscode.workspace.getConfiguration('aiChainTraversal.scoring');
      const recentProcessingHours = config.get<number>('recentProcessingHours', 50);
      
      const processedTime = new Date(entity.timestamp).getTime();
      const timeDiff = Date.now() - processedTime;
      const hoursSinceProcessed = timeDiff / (1000 * 60 * 60);
      score += Math.max(0, recentProcessingHours - hoursSinceProcessed);
    }

    // Discovery method priority - use configurable scores
    const discoveryConfig = vscode.workspace.getConfiguration('aiChainTraversal.scoring');
    const discoveryMethodScores = discoveryConfig.get<Record<string, number>>('discoveryMethods', {
      'semantic_search': 30,
      'grep_search': 20,
      'list_code_usages': 40,
      'file_search': 35,
      'manual': 45,
      'inference': 25
    });
    
    const methodScore = discoveryMethodScores[entity.discoveryMethod] || 25;
    score += methodScore;

    // Priority level - use configurable scores
    const priorityLevelScores = discoveryConfig.get<Record<string, number>>('priorityLevels', {
      '1': 75, '2': 50, '3': 25, '4': 15, '5': 10
    });
    
    const priorityScore = priorityLevelScores[entity.priority.toString()] || 10;
    score += priorityScore;

    return score;
  }

  /**
   * Select entities for preservation based on options and limits
   */
  private selectEntitiesForPreservation(
    prioritizedEntities: EntityNode[], 
    options: ContextSummarizationOptions
  ): EntityNode[] {
    const preserved: EntityNode[] = [];
    const typeCounters: Record<string, number> = {};

    for (const entity of prioritizedEntities) {
      const currentCount = typeCounters[entity.type] || 0;
      
      if (currentCount < options.maxEntitiesPerType) {
        preserved.push(entity);
        typeCounters[entity.type] = currentCount + 1;
      }
    }

    return preserved;
  }

  /**
   * Generate summary for omitted entities
   */
  private generateEntitySummary(omittedEntities: EntityNode[], allRelationships: RelationshipEdge[]): string {
    const summary = {
      omittedCount: omittedEntities.length,
      typeDistribution: this.getEntityTypeDistribution(omittedEntities),
      keyPatterns: this.extractKeyPatterns(omittedEntities),
      relationshipSummary: this.summarizeOmittedRelationships(omittedEntities, allRelationships)
    };

    return `SUMMARIZED CONTEXT: ${omittedEntities.length} entities omitted to reduce token usage. 
Types: ${Object.entries(summary.typeDistribution).map(([type, count]) => `${type}(${count})`).join(', ')}. 
Key patterns: ${summary.keyPatterns.join(', ')}. 
Relationships: ${summary.relationshipSummary}. 
Full data stored externally for recovery.`;
  }

  /**
   * Get distribution of entity types
   */
  private getEntityTypeDistribution(entities: EntityNode[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    entities.forEach(entity => {
      distribution[entity.type] = (distribution[entity.type] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Extract key patterns from entities
   */
  private extractKeyPatterns(entities: EntityNode[]): string[] {
    const patterns = new Set<string>();
    
    entities.forEach(entity => {
      // Extract file path patterns
      const pathParts = entity.filePath.split(/[/\\]/);
      if (pathParts.length > 1) {
        patterns.add(pathParts[pathParts.length - 2]); // Parent directory
      }
      
      // Extract naming patterns
      if (entity.id.includes('Controller')) {
        patterns.add('Controller pattern');
      }
      if (entity.id.includes('Service')) {
        patterns.add('Service pattern');
      }
      if (entity.id.includes('Component')) {
        patterns.add('Component pattern');
      }
    });

    return Array.from(patterns).slice(0, 5); // Top 5 patterns
  }

  /**
   * Summarize relationships for omitted entities
   */
  private summarizeOmittedRelationships(omittedEntities: EntityNode[], allRelationships: RelationshipEdge[]): string {
    const omittedIds = new Set(omittedEntities.map(e => e.id));
    const omittedRelationships = allRelationships.filter(r => 
      omittedIds.has(r.fromEntityId) || omittedIds.has(r.toEntityId)
    );

    const typeDistribution: Record<string, number> = {};
    omittedRelationships.forEach(rel => {
      typeDistribution[rel.relationshipType] = (typeDistribution[rel.relationshipType] || 0) + 1;
    });

    return `${omittedRelationships.length} relationships affected (${Object.entries(typeDistribution).map(([type, count]) => `${type}:${count}`).join(', ')})`;
  }

  /**
   * Log summarization results
   */
  private logSummarization(originalTokens: number, summarizedTokens: number, reductionPercentage: number): void {
    const message = `Token Management: Reduced from ${originalTokens} to ${summarizedTokens} tokens (${reductionPercentage.toFixed(1)}% reduction)`;
    console.log(message);
    
    // Show notification for significant reductions
    if (reductionPercentage > 50) {
      vscode.window.showInformationMessage(
        `🧠 Context Summarized: ${reductionPercentage.toFixed(1)}% token reduction applied`
      );
    }
  }

  /**
   * Monitor token usage and provide warnings
   */
  async monitorTokenUsage(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    additionalContext: string = ''
  ): Promise<TokenUsageMetrics> {
    const metrics = this.calculateTokenUsage(entities, relationships, additionalContext);

    if (this.isTokenUsageCritical(metrics)) {
      vscode.window.showWarningMessage(
        `⚠️ Critical Token Usage: ${metrics.usagePercentage.toFixed(1)}% of limit reached. Summarization required.`
      );
    } else if (this.shouldSummarizeContext(metrics)) {
      vscode.window.showInformationMessage(
        `📊 Token Usage Warning: ${metrics.usagePercentage.toFixed(1)}% of limit reached. Consider summarization.`
      );
    }

    return metrics;
  }

  /**
   * Get token usage statistics for reporting
   */
  getTokenUsageStatistics(metrics: TokenUsageMetrics): Record<string, number> {
    return {
      currentTokens: metrics.currentTokens,
      maxTokens: metrics.maxTokens,
      usagePercentage: metrics.usagePercentage,
      remainingTokens: metrics.maxTokens - metrics.currentTokens,
      warningThreshold: metrics.warningThreshold,
      criticalThreshold: metrics.criticalThreshold
    };
  }

  /**
   * Perform dependency-aware compression to preserve relationship chains
   */
  private async performDependencyAwareCompression(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    options: ContextSummarizationOptions
  ): Promise<{
    preservedEntities: EntityNode[];
    preservedRelationships: RelationshipEdge[];
    metadata: CompressionMetadata;
  }> {
    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(entities, relationships);
    
    // Identify critical dependency chains
    const criticalChains = this.identifyCriticalDependencyChains(dependencyGraph, options);
    
    // Select entities based on dependency importance
    const preservedEntities = this.selectEntitiesWithDependencyAwareness(entities, criticalChains, options);
    
    // Preserve relationships that maintain dependency chains
    const preservedRelationships = this.preserveCriticalRelationships(
      relationships, 
      preservedEntities, 
      options.relationshipPreservationPriority
    );
    
    // Create external references for compressed entities
    const externalReferences = this.createExternalReferences(
      entities.filter(e => !preservedEntities.some(pe => pe.id === e.id)),
      relationships
    );
    
    const metadata: CompressionMetadata = {
      compressedEntityCount: entities.length - preservedEntities.length,
      preservedEntityCount: preservedEntities.length,
      compressedRelationshipCount: relationships.length - preservedRelationships.length,
      preservedRelationshipCount: preservedRelationships.length,
      dependencyChainCount: criticalChains.length,
      externalReferences
    };
    
    return {
      preservedEntities,
      preservedRelationships,
      metadata
    };
  }

  /**
   * Build dependency graph from entities and relationships using configurable critical types
   */
  private buildDependencyGraph(entities: EntityNode[], relationships: RelationshipEdge[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    // Initialize nodes
    entities.forEach(entity => {
      graph.set(entity.id, new Set());
    });
    
    // Get configurable critical relationship types
    const config = vscode.workspace.getConfiguration('aiChainTraversal.relationships');
    const criticalRelationshipTypes = config.get<string[]>('criticalTypes', 
      ['DEPENDS_ON', 'CALLS', 'USES', 'IMPLEMENTS', 'EXTENDS']
    );
    
    relationships
      .filter(rel => criticalRelationshipTypes.includes(rel.relationshipType))
      .forEach(rel => {
        const dependencies = graph.get(rel.fromEntityId);
        if (dependencies) {
          dependencies.add(rel.toEntityId);
        }
      });
    
    return graph;
  }

  /**
   * Identify critical dependency chains that should be preserved
   */
  private identifyCriticalDependencyChains(
    dependencyGraph: Map<string, Set<string>>,
    _options: ContextSummarizationOptions
  ): string[][] {
    const chains: string[][] = [];
    const visited = new Set<string>();
    
    // Find chains starting from high-priority entity types
    for (const [entityId, dependencies] of dependencyGraph) {
      if (!visited.has(entityId) && dependencies.size > 0) {
        const chain = this.traceDependencyChain(entityId, dependencyGraph, visited);
        if (chain.length > 1) { // Only consider chains with multiple entities
          chains.push(chain);
        }
      }
    }
    
    // Sort chains by importance (length and entity types)
    return chains.sort((a, b) => b.length - a.length);
  }

  /**
   * Trace a dependency chain from a starting entity
   */
  private traceDependencyChain(
    startId: string,
    graph: Map<string, Set<string>>,
    visited: Set<string>,
    currentChain: string[] = []
  ): string[] {
    if (visited.has(startId) || currentChain.includes(startId)) {
      return currentChain; // Avoid cycles
    }
    
    const newChain = [...currentChain, startId];
    visited.add(startId);
    
    const dependencies = graph.get(startId);
    if (!dependencies || dependencies.size === 0) {
      return newChain;
    }
    
    // Follow the most important dependency
    let longestChain = newChain;
    for (const depId of dependencies) {
      const chain = this.traceDependencyChain(depId, graph, new Set(visited), newChain);
      if (chain.length > longestChain.length) {
        longestChain = chain;
      }
    }
    
    return longestChain;
  }

  /**
   * Select entities with dependency awareness
   */
  private selectEntitiesWithDependencyAwareness(
    entities: EntityNode[],
    criticalChains: string[][],
    options: ContextSummarizationOptions
  ): EntityNode[] {
    const criticalEntityIds = new Set<string>();
    
    // Include all entities from critical dependency chains
    criticalChains.forEach(chain => {
      chain.forEach(entityId => criticalEntityIds.add(entityId));
    });
    
    // Add high-priority entity types
    const highPriorityEntities = entities.filter(entity =>
      this.isEntityTypePreserved(entity.type, options.preserveTypes) || 
      criticalEntityIds.has(entity.id)
    );
    
    // If we need to reduce further, prioritize by dependency importance
    const targetCount = Math.floor(entities.length * (options.compressionTarget / 100));
    if (highPriorityEntities.length > targetCount) {
      // Sort by dependency importance and take top entities
      const sortedEntities = highPriorityEntities.sort((a, b) => {
        const aInChains = criticalChains.filter(chain => chain.includes(a.id)).length;
        const bInChains = criticalChains.filter(chain => chain.includes(b.id)).length;
        return bInChains - aInChains;
      });
      return sortedEntities.slice(0, targetCount);
    }
    
    return highPriorityEntities;
  }

  /**
   * Preserve critical relationships that maintain dependency chains
   */
  private preserveCriticalRelationships(
    relationships: RelationshipEdge[],
    preservedEntities: EntityNode[],
    relationshipPriority: string[]
  ): RelationshipEdge[] {
    const preservedEntityIds = new Set(preservedEntities.map(e => e.id));
    
    // Filter relationships that connect preserved entities
    const candidateRelationships = relationships.filter(rel =>
      preservedEntityIds.has(rel.fromEntityId) && preservedEntityIds.has(rel.toEntityId)
    );
    
    // Sort by relationship type priority
    return candidateRelationships.sort((a, b) => {
      const aPriority = relationshipPriority.indexOf(a.relationshipType);
      const bPriority = relationshipPriority.indexOf(b.relationshipType);
      return (aPriority === -1 ? 1000 : aPriority) - (bPriority === -1 ? 1000 : bPriority);
    });
  }

  /**
   * Create external references for compressed entities
   */
  private createExternalReferences(
    compressedEntities: EntityNode[],
    allRelationships: RelationshipEdge[]
  ): EntityReference[] {
    return compressedEntities.map(entity => {
      const relatedRelationships = allRelationships.filter(rel =>
        rel.fromEntityId === entity.id || rel.toEntityId === entity.id
      );
      
      const relationshipTypes = [...new Set(relatedRelationships.map(rel => rel.relationshipType))];
      
      return {
        entityId: entity.id,
        entityType: entity.type,
        filePath: entity.filePath,
        relationshipTypes,
        compressionLevel: this.determineCompressionLevel(entity, relatedRelationships)
      };
    });
  }

  /**
   * Determine compression level based on entity importance using configurable thresholds
   */
  private determineCompressionLevel(
    entity: EntityNode,
    relationships: RelationshipEdge[]
  ): 'minimal' | 'summary' | 'reference_only' {
    const relationshipCount = relationships.length;
    const criticalTypes = this.getConfiguredPreserveTypes();
    
    // Get configurable compression thresholds
    const config = vscode.workspace.getConfiguration('aiChainTraversal.compression');
    const minimalThreshold = config.get<number>('minimalRelationshipThreshold', 5);
    const summaryThreshold = config.get<number>('summaryRelationshipThreshold', 2);
    
    if (this.isEntityTypePreserved(entity.type, criticalTypes) && relationshipCount > minimalThreshold) {
      return 'minimal'; // Keep some details
    } else if (relationshipCount > summaryThreshold) {
      return 'summary'; // Keep basic info
    } else {
      return 'reference_only'; // Just reference
    }
  }

  /**
   * Create basic compression metadata for fallback scenarios
   */
  private createBasicCompressionMetadata(
    originalEntities: EntityNode[],
    originalRelationships: RelationshipEdge[],
    preservedEntities: EntityNode[],
    preservedRelationships: RelationshipEdge[]
  ): CompressionMetadata {
    const compressedEntities = originalEntities.filter(e => 
      !preservedEntities.some(pe => pe.id === e.id)
    );
    
    return {
      compressedEntityCount: compressedEntities.length,
      preservedEntityCount: preservedEntities.length,
      compressedRelationshipCount: originalRelationships.length - preservedRelationships.length,
      preservedRelationshipCount: preservedRelationships.length,
      dependencyChainCount: 0,
      externalReferences: this.createExternalReferences(compressedEntities, originalRelationships)
    };
  }

  /**
   * Generate enhanced entity summary with external reference information
   */
  private generateEnhancedEntitySummary(
    omittedEntities: EntityNode[],
    allRelationships: RelationshipEdge[],
    compressionMetadata: CompressionMetadata
  ): string {
    const basicSummary = this.generateEntitySummary(omittedEntities, allRelationships);
    
    const referenceInfo = `
EXTERNAL_REFERENCES: ${compressionMetadata.externalReferences.length} entities available via external reference.
DEPENDENCY_CHAINS: ${compressionMetadata.dependencyChainCount} critical dependency chains preserved.
COMPRESSION_RATIO: ${compressionMetadata.compressedEntityCount}/${compressionMetadata.compressedEntityCount + compressionMetadata.preservedEntityCount} entities compressed.`;
    
    return basicSummary + referenceInfo;
  }

  /**
   * Apply additional compression if target not met
   */
  private async applyAdditionalCompression(
    entities: EntityNode[],
    relationships: RelationshipEdge[],
    targetPercentage: number,
    originalTokenCount: number
  ): Promise<{
    entities: EntityNode[];
    relationships: RelationshipEdge[];
    metadata: Partial<CompressionMetadata>;
  }> {
    const currentTokenCount = this.estimateTokenCountSync(
      JSON.stringify(entities) + JSON.stringify(relationships)
    );
    const currentReduction = ((originalTokenCount - currentTokenCount) / originalTokenCount) * 100;
    
    if (currentReduction >= targetPercentage) {
      return { entities, relationships, metadata: {} };
    }
    
    // Reduce entity details progressively
    const compressedEntities = entities.map(entity => this.compressEntityDetails(entity));
    
    // Remove less critical relationships using configurable types
    const config = vscode.workspace.getConfiguration('aiChainTraversal.relationships');
    const criticalRelationshipTypes = config.get<string[]>('criticalTypes', 
      ['DEPENDS_ON', 'CALLS', 'USES', 'IMPLEMENTS', 'EXTENDS']
    );
    const priorityRelationships = relationships.filter(rel => 
      criticalRelationshipTypes.slice(0, 3).includes(rel.relationshipType) // Use first 3 as highest priority
    );
    
    return {
      entities: compressedEntities,
      relationships: priorityRelationships,
      metadata: {
        compressedEntityCount: entities.length - compressedEntities.length,
        compressedRelationshipCount: relationships.length - priorityRelationships.length
      }
    };
  }

  /**
   * Compress entity details while preserving core information
   */
  private compressEntityDetails(entity: EntityNode): EntityNode {
    // Create a simplified copy with compressed data
    const compressed = { ...entity };
    
    // Compress analysisData if present
    if (compressed.analysisData) {
      compressed.analysisData = {
        usageCount: compressed.analysisData.usageCount,
        architecturalPattern: compressed.analysisData.architecturalPattern,
        relevanceScore: compressed.analysisData.relevanceScore,
        isSummarized: true,
        summaryConfidence: 'medium' as const,
        members: compressed.analysisData.members?.slice(0, 3) || [],
        inheritanceChain: compressed.analysisData.inheritanceChain?.slice(0, 2) || [],
        businessRules: compressed.analysisData.businessRules?.slice(0, 2) || [],
        integrationPoints: compressed.analysisData.integrationPoints?.slice(0, 2) || [],
        testableUnits: compressed.analysisData.testableUnits?.slice(0, 2) || []
      };
    }
    
    // Truncate dependency arrays
    compressed.dependencies = entity.dependencies.slice(0, 5);
    compressed.dependents = entity.dependents.slice(0, 5);
    
    // Compress domainContext if present
    if (compressed.domainContext && compressed.domainContext.length > 100) {
      compressed.domainContext = compressed.domainContext.substring(0, 100);
    }

    return compressed;
  }
}
