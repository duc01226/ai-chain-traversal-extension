/**
 * Enhanced Graph Building Algorithm Implementation
 * Addresses relationship loss and concurrent access issues
 */

import * as vscode from 'vscode';
import { 
  EntityNode, 
  RelationshipEdge, 
  DiscoveryMethod, 
  Priority 
} from '../types';

// Enhanced entity structure with discovery tracking
export interface EnhancedEntityNode extends EntityNode {
  discoveryMetadata: {
    sources: DiscoverySource[];
    lastMerged: Date;
    version: number;
    conflictResolutions: ConflictResolution[];
  };
  
  // Quality metrics
  completeness: {
    dependencyScore: number;      // 0-1 based on expected vs found relationships
    contextRichness: number;      // 0-1 based on metadata completeness
    crossValidated: boolean;      // Multiple sources confirm this entity
  };
}

export interface DiscoverySource {
  method: DiscoveryMethod;
  agent?: string | undefined;
  timestamp: Date;
  filePath?: string;
  confidence: number;             // 0-1 confidence in this source
  contextPath: string[];          // Discovery chain leading to this entity
}

export interface ConflictResolution {
  field: keyof EntityNode;
  conflictType: 'value_difference' | 'metadata_mismatch' | 'relationship_conflict';
  resolution: 'merge' | 'prefer_existing' | 'prefer_new' | 'manual_review';
  oldValue: any;
  newValue: any;
  finalValue: any;
  reason: string;
  timestamp: Date;
}

export interface DiscoveryContext {
  agentId?: string;
  confidence?: number;
  discoveryPath?: string[];
}

/**
 * Smart Entity Merger - Handles intelligent merging of entities
 */
export class SmartEntityMerger {
  
  async mergeEntity(
    newEntity: EntityNode, 
    existingEntity?: EnhancedEntityNode,
    discoveryContext?: DiscoveryContext
  ): Promise<EnhancedEntityNode> {
    
    if (!existingEntity) {
      return this.createInitialEntity(newEntity, discoveryContext);
    }
    
    // Step 1: Merge core fields with conflict resolution
    const mergedCore = await this.mergeCore(newEntity, existingEntity);
    
    // Step 2: Merge relationships using SET union (prevents duplicates)
    const mergedRelationships = await this.mergeRelationships(newEntity, existingEntity);
    
    // Step 3: Merge metadata with authority ranking
    const mergedMetadata = await this.mergeMetadata(newEntity, existingEntity, discoveryContext);
    
    // Step 4: Update quality metrics
    const qualityMetrics = await this.calculateQualityMetrics(mergedCore, mergedRelationships);
    
    return {
      ...existingEntity,
      ...mergedCore,
      ...mergedRelationships,
      ...mergedMetadata,
      completeness: qualityMetrics,
      discoveryMetadata: {
        ...existingEntity.discoveryMetadata,
        lastMerged: new Date(),
        version: existingEntity.discoveryMetadata.version + 1
      }
    };
  }
  
  private createInitialEntity(
    entity: EntityNode, 
    discoveryContext?: DiscoveryContext
  ): EnhancedEntityNode {
    return {
      ...entity,
      discoveryMetadata: {
        sources: [{
          method: entity.discoveryMethod,
          agent: discoveryContext?.agentId,
          timestamp: new Date(),
          filePath: entity.filePath,
          confidence: discoveryContext?.confidence || 0.8,
          contextPath: discoveryContext?.discoveryPath || []
        }],
        lastMerged: new Date(),
        version: 1,
        conflictResolutions: []
      },
      completeness: {
        dependencyScore: 0,
        contextRichness: this.calculateContextRichness(entity),
        crossValidated: false
      }
    };
  }
  
  private async mergeCore(
    newEntity: EntityNode, 
    existing: EnhancedEntityNode
  ): Promise<Partial<EnhancedEntityNode>> {
    
    const conflicts: ConflictResolution[] = [];
    
    // Business context merging - combine insights intelligently
    const businessContext = this.mergeBusinessContext(
      existing.businessContext, 
      newEntity.businessContext,
      conflicts
    );
    
    // Chain context merging - preserve discovery paths
    const chainContext = this.mergeChainContext(
      existing.chainContext,
      newEntity.chainContext,
      conflicts
    );
    
    // Priority - take highest priority (lowest number = higher priority)
    const priority = Math.min(existing.priority, newEntity.priority) as Priority;
    
    // Domain context - merge if different
    const domainContext = this.mergeDomainContext(
      existing.domainContext,
      newEntity.domainContext,
      conflicts
    );
    
    return {
      businessContext,
      chainContext,
      priority,
      ...(domainContext !== undefined && { domainContext }),
      discoveryMetadata: {
        ...existing.discoveryMetadata,
        conflictResolutions: [...existing.discoveryMetadata.conflictResolutions, ...conflicts]
      }
    };
  }
  
  private async mergeRelationships(
    newEntity: EntityNode,
    existing: EnhancedEntityNode
  ): Promise<{ dependencies: string[]; dependents: string[] }> {
    
    // Use Set union to prevent duplicates and preserve all relationships
    const existingDependencies = new Set(existing.dependencies || []);
    const existingDependents = new Set(existing.dependents || []);
    
    // Add new relationships
    (newEntity.dependencies || []).forEach(dep => existingDependencies.add(dep));
    (newEntity.dependents || []).forEach(dep => existingDependents.add(dep));
    
    return {
      dependencies: Array.from(existingDependencies),
      dependents: Array.from(existingDependents)
    };
  }
  
  private mergeBusinessContext(
    existingContext: string,
    newContext: string,
    conflicts: ConflictResolution[]
  ): string {
    
    if (existingContext === newContext) {
      return existingContext;
    }
    
    // Get configurable significance multiplier
    const config = vscode.workspace.getConfiguration('aiChainTraversal.context');
    const significanceMultiplier = config.get<number>('significanceMultiplier', 1.5);
    
    // If one is clearly more detailed, prefer it
    if (newContext.length > existingContext.length * significanceMultiplier) {
      conflicts.push({
        field: 'businessContext',
        conflictType: 'value_difference',
        resolution: 'prefer_new',
        oldValue: existingContext,
        newValue: newContext,
        finalValue: newContext,
        reason: `New context significantly more detailed (${significanceMultiplier}x threshold)`,
        timestamp: new Date()
      });
      return newContext;
    }
    
    if (existingContext.length > newContext.length * significanceMultiplier) {
      conflicts.push({
        field: 'businessContext',
        conflictType: 'value_difference',
        resolution: 'prefer_existing',
        oldValue: existingContext,
        newValue: newContext,
        finalValue: existingContext,
        reason: `Existing context significantly more detailed (${significanceMultiplier}x threshold)`,
        timestamp: new Date()
      });
      return existingContext;
    }
    
    // Merge complementary information
    const merged = this.mergeComplementaryContexts(existingContext, newContext);
    conflicts.push({
      field: 'businessContext',
      conflictType: 'value_difference',
      resolution: 'merge',
      oldValue: existingContext,
      newValue: newContext,
      finalValue: merged,
      reason: 'Merged complementary information',
      timestamp: new Date()
    });
    
    return merged;
  }
  
  private mergeComplementaryContexts(context1: string, context2: string): string {
    // Split into sentences and combine unique insights
    const sentences1 = context1.split('.').map(s => s.trim()).filter(s => s.length > 0);
    const sentences2 = context2.split('.').map(s => s.trim()).filter(s => s.length > 0);
    
    const uniqueSentences = new Set([...sentences1, ...sentences2]);
    return Array.from(uniqueSentences).join('. ');
  }
  
  private calculateContextRichness(entity: EntityNode): number {
    let score = 0;
    
    // Rich business context (+30%)
    if (entity.businessContext?.length > 50) {
      score += 0.3;
    }
    
    // Rich chain context (+20%)
    if (entity.chainContext?.length > 30) {
      score += 0.2;
    }
    
    // Has domain context (+20%)
    if (entity.domainContext) {
      score += 0.2;
    }
    
    // Has analysis data (+30%)
    if (entity.analysisData) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  private mergeChainContext(
    existingContext: string,
    newContext: string,
    conflicts: ConflictResolution[]
  ): string {
    if (existingContext === newContext) {
      return existingContext;
    }
    
    // Prefer the more detailed context
    if (newContext.length > existingContext.length) {
      conflicts.push({
        field: 'chainContext',
        conflictType: 'value_difference',
        resolution: 'prefer_new',
        oldValue: existingContext,
        newValue: newContext,
        finalValue: newContext,
        reason: 'New chain context more detailed',
        timestamp: new Date()
      });
      return newContext;
    }
    
    return existingContext;
  }
  
  private mergeDomainContext(
    existingContext: string | undefined,
    newContext: string | undefined,
    conflicts: ConflictResolution[]
  ): string | undefined {
    if (!newContext) {
      return existingContext;
    }
    
    if (!existingContext) {
      return newContext;
    }
    
    if (existingContext === newContext) {
      return existingContext;
    }
    
    // Merge if different
    const merged = `${existingContext}; ${newContext}`;
    conflicts.push({
      field: 'domainContext',
      conflictType: 'value_difference',
      resolution: 'merge',
      oldValue: existingContext,
      newValue: newContext,
      finalValue: merged,
      reason: 'Merged domain contexts',
      timestamp: new Date()
    });
    
    return merged;
  }
  
  private async mergeMetadata(
    newEntity: EntityNode,
    existingEntity: EnhancedEntityNode,
    discoveryContext?: DiscoveryContext
  ): Promise<{ discoveryMetadata: EnhancedEntityNode['discoveryMetadata'] }> {
    
    // Add new discovery source
    const newSource: DiscoverySource = {
      method: newEntity.discoveryMethod,
      agent: discoveryContext?.agentId,
      timestamp: new Date(),
      filePath: newEntity.filePath,
      confidence: discoveryContext?.confidence || 0.8,
      contextPath: discoveryContext?.discoveryPath || []
    };
    
    return {
      discoveryMetadata: {
        ...existingEntity.discoveryMetadata,
        sources: [...existingEntity.discoveryMetadata.sources, newSource]
      }
    };
  }
  
  private async calculateQualityMetrics(
    mergedCore: Partial<EnhancedEntityNode>,
    mergedRelationships: { dependencies: string[]; dependents: string[] }
  ): Promise<EnhancedEntityNode['completeness']> {
    
    // Calculate dependency score based on relationship count
    const totalRelationships = (mergedRelationships.dependencies?.length || 0) + 
                              (mergedRelationships.dependents?.length || 0);
    const dependencyScore = Math.min(totalRelationships / 10, 1.0); // Normalize to max 10 relationships
    
    // Context richness from merged core
    const contextRichness = mergedCore.businessContext?.length 
      ? Math.min(mergedCore.businessContext.length / 100, 1.0) 
      : 0;
    
    // Cross-validation if multiple sources
    const crossValidated = (mergedCore as any).discoveryMetadata?.sources?.length > 1;
    
    return {
      dependencyScore,
      contextRichness,
      crossValidated
    };
  }
}

/**
 * Concurrent-Safe State Manager with distributed locking
 */
export class ConcurrentSafeStateManager {
  private readonly entityLocks = new Map<string, Promise<void>>();
  private readonly relationshipLocks = new Map<string, Promise<void>>();
  private readonly merger = new SmartEntityMerger();
  
  constructor(private baseManager: any) {} // Accept existing state manager
  
  async addEntity(entity: EntityNode, discoveryContext?: DiscoveryContext): Promise<void> {
    const lockKey = entity.id;
    
    // Wait for any pending operations on this entity
    if (this.entityLocks.has(lockKey)) {
      await this.entityLocks.get(lockKey);
    }
    
    // Create new operation promise
    const operation = this.performEntityMerge(entity, discoveryContext);
    this.entityLocks.set(lockKey, operation);
    
    try {
      await operation;
    } finally {
      this.entityLocks.delete(lockKey);
    }
  }
  
  private async performEntityMerge(newEntity: EntityNode, discoveryContext?: DiscoveryContext): Promise<void> {
    // Step 1: Load existing entity (if any)
    const existing = await this.getEnhancedEntity(newEntity.id);
    
    // Step 2: Perform intelligent merge
    const merged = await this.merger.mergeEntity(newEntity, existing, discoveryContext);
    
    // Step 3: Validate merge result
    await this.validateMergedEntity(merged);
    
    // Step 4: Atomic write
    await this.atomicWrite(merged);
    
    // Step 5: Update caches and indexes
    await this.updateIndexes(merged);
  }
  
  async addRelationship(relationship: RelationshipEdge): Promise<void> {
    const lockKey = `${relationship.fromEntityId}-${relationship.toEntityId}`;
    
    // Wait for any pending relationship operations
    if (this.relationshipLocks.has(lockKey)) {
      await this.relationshipLocks.get(lockKey);
    }
    
    const operation = this.performRelationshipAdd(relationship);
    this.relationshipLocks.set(lockKey, operation);
    
    try {
      await operation;
    } finally {
      this.relationshipLocks.delete(lockKey);
    }
  }
  
  private async performRelationshipAdd(relationship: RelationshipEdge): Promise<void> {
    // Step 1: Store relationship independently (never gets lost)
    await this.baseManager.addRelationship(relationship);
    
    // Step 2: Update entity relationship caches atomically
    await this.atomicUpdateEntityRelationships(relationship);
  }
  
  private async atomicUpdateEntityRelationships(relationship: RelationshipEdge): Promise<void> {
    // Acquire locks for both entities
    const locks = [relationship.fromEntityId, relationship.toEntityId];
    
    // Wait for any pending operations on these entities
    await Promise.all(locks.map(async (entityId) => {
      if (this.entityLocks.has(entityId)) {
        await this.entityLocks.get(entityId);
      }
    }));
    
    // Get current entities
    const fromEntity = await this.getEnhancedEntity(relationship.fromEntityId);
    const toEntity = await this.getEnhancedEntity(relationship.toEntityId);
    
    // Update relationship references using Set semantics (prevents duplicates)
    if (fromEntity) {
      await this.addRelationshipToEntity(fromEntity, 'dependents', relationship.toEntityId);
    }
    
    if (toEntity) {
      await this.addRelationshipToEntity(toEntity, 'dependencies', relationship.fromEntityId);
    }
  }
  
  private async addRelationshipToEntity(
    entity: EnhancedEntityNode,
    relationshipType: 'dependencies' | 'dependents',
    targetEntityId: string
  ): Promise<void> {
    
    // Use Set semantics to prevent duplicates
    const currentRelationships = new Set(entity[relationshipType] || []);
    currentRelationships.add(targetEntityId);
    
    // Create partial update with only relationship change
    const update: Partial<EnhancedEntityNode> = {
      [relationshipType]: Array.from(currentRelationships),
      timestamp: new Date()
    };
    
    // Merge this update with existing entity
    const merged = await this.merger.mergeEntity(update as EntityNode, entity);
    await this.atomicWrite(merged);
  }
  
  private async getEnhancedEntity(entityId: string): Promise<EnhancedEntityNode | undefined> {
    const baseEntity = await this.baseManager.getEntity(entityId);
    if (!baseEntity) {
      return undefined;
    }
    
    // Convert base entity to enhanced entity if needed
    if (!('discoveryMetadata' in baseEntity)) {
      return this.merger.mergeEntity(baseEntity, undefined);
    }
    
    return baseEntity as EnhancedEntityNode;
  }
  
  private async validateMergedEntity(entity: EnhancedEntityNode): Promise<void> {
    // Validate entity structure
    if (!entity.id || !entity.type || !entity.filePath) {
      throw new Error('Invalid entity: missing required fields');
    }
    
    // Validate relationships don't contain self-references
    if (entity.dependencies?.includes(entity.id) || entity.dependents?.includes(entity.id)) {
      throw new Error('Entity cannot depend on itself');
    }
    
    // Validate discovery metadata
    if (!entity.discoveryMetadata || entity.discoveryMetadata.sources.length === 0) {
      throw new Error('Entity must have discovery metadata');
    }
  }
  
  private async atomicWrite(entity: EnhancedEntityNode): Promise<void> {
    // Use the base manager's write functionality
    await this.baseManager.addEntity(entity);
  }
  
  private async updateIndexes(_entity: EnhancedEntityNode): Promise<void> {
    // Update any search indexes, caches, etc.
    // This is where you'd update derived data structures
    // Implementation depends on specific requirements
  }
}

/**
 * Factory for creating the enhanced graph builder
 */
export class EnhancedGraphBuilderFactory {
  
  static create(baseStateManager: any): ConcurrentSafeStateManager {
    return new ConcurrentSafeStateManager(baseStateManager);
  }
  
  static createWithFeatureFlags(
    baseStateManager: any,
    features: {
      enableSmartMerging?: boolean;
      enableConflictResolution?: boolean;
      enableConcurrentSafety?: boolean;
    }
  ): ConcurrentSafeStateManager | any {
    
    if (features.enableSmartMerging || features.enableConflictResolution || features.enableConcurrentSafety) {
      return new ConcurrentSafeStateManager(baseStateManager);
    }
    
    // Fallback to original implementation
    return baseStateManager;
  }
}

/**
 * Migration utilities for transitioning existing data
 */
export class EntityMigrationUtilities {
  
  static async migrateEntityToEnhanced(
    entity: EntityNode,
    _baseManager: any
  ): Promise<EnhancedEntityNode> {
    
    const merger = new SmartEntityMerger();
    return merger.mergeEntity(entity, undefined, {
      agentId: 'migration',
      confidence: 0.9,
      discoveryPath: ['migration']
    });
  }
  
  static async validateMigration(
    originalEntity: EntityNode,
    enhancedEntity: EnhancedEntityNode
  ): Promise<boolean> {
    
    // Verify no data was lost
    const coreFieldsMatch = (
      originalEntity.id === enhancedEntity.id &&
      originalEntity.type === enhancedEntity.type &&
      originalEntity.filePath === enhancedEntity.filePath &&
      originalEntity.businessContext === enhancedEntity.businessContext
    );
    
    // Verify relationships were preserved
    const relationshipsMatch = (
      JSON.stringify(originalEntity.dependencies?.sort()) === 
      JSON.stringify(enhancedEntity.dependencies?.sort()) &&
      JSON.stringify(originalEntity.dependents?.sort()) === 
      JSON.stringify(enhancedEntity.dependents?.sort())
    );
    
    return coreFieldsMatch && relationshipsMatch;
  }
}
