/**
 * Enhanced State Manager - Solves relationship loss in graph building
 * This addresses the critical issue where parallel entity discovery loses relationships
 */

import { EntityNode, RelationshipEdge, Priority } from '../types';

/**
 * Enhanced entity tracking metadata
 */
export interface EntityMergeMetadata {
  version: number;
  lastMerged: Date;
  discoveryCount: number;
  sources: string[];
}

/**
 * Smart Entity Merger that prevents relationship loss
 */
export class SmartEntityMerger {
  
  /**
   * Merge entities intelligently, combining all relationships
   */
  mergeEntities(newEntity: EntityNode, existingEntity?: EntityNode): EntityNode {
    if (!existingEntity) {
      return { ...newEntity };
    }
    
    // Merge dependencies using Set union (no duplicates, no loss)
    const allDependencies = new Set([
      ...(existingEntity.dependencies || []),
      ...(newEntity.dependencies || [])
    ]);
    
    // Merge dependents using Set union
    const allDependents = new Set([
      ...(existingEntity.dependents || []),
      ...(newEntity.dependents || [])
    ]);
    
    // Merge business context intelligently
    const mergedBusinessContext = this.mergeBusinessContext(
      existingEntity.businessContext,
      newEntity.businessContext
    );
    
    // Use higher priority (lower number = higher priority)
    const mergedPriority = Math.min(existingEntity.priority, newEntity.priority) as Priority;
    
    return {
      ...existingEntity,
      ...newEntity,
      // Preserve merged relationships
      dependencies: Array.from(allDependencies),
      dependents: Array.from(allDependents),
      // Intelligent field merging
      businessContext: mergedBusinessContext,
      priority: mergedPriority,
      // Update timestamp
      timestamp: new Date()
    };
  }
  
  /**
   * Merge business context by combining insights
   */
  private mergeBusinessContext(existing: string, newContext: string): string {
    if (!existing) return newContext;
    if (!newContext) return existing;
    if (existing === newContext) return existing;
    
    // If new context is significantly longer, prefer it
    if (newContext.length > existing.length * 1.5) {
      return newContext;
    }
    
    // If existing is significantly longer, keep it
    if (existing.length > newContext.length * 1.5) {
      return existing;
    }
    
    // Combine complementary information
    return this.combineContexts(existing, newContext);
  }
  
  /**
   * Combine contexts by merging unique sentences
   */
  private combineContexts(context1: string, context2: string): string {
    const sentences1 = context1.split('.').map(s => s.trim()).filter(s => s.length > 0);
    const sentences2 = context2.split('.').map(s => s.trim()).filter(s => s.length > 0);
    
    const uniqueSentences = new Set([...sentences1, ...sentences2]);
    return Array.from(uniqueSentences).join('. ');
  }
}

/**
 * Enhanced Workspace State Manager that prevents relationship loss
 */
export class EnhancedWorkspaceStateManager {
  private readonly entityMerger = new SmartEntityMerger();
  private readonly operationLocks = new Map<string, Promise<void>>();
  
  constructor(private baseManager: any) {}
  
  /**
   * Add entity with smart merging - prevents relationship loss
   */
  async addEntity(entity: EntityNode): Promise<void> {
    // Acquire lock for this entity to prevent race conditions
    const lockKey = entity.id;
    
    // Wait for any pending operations on this entity
    if (this.operationLocks.has(lockKey)) {
      await this.operationLocks.get(lockKey);
    }
    
    // Create operation promise
    const operation = this.performSmartEntityAdd(entity);
    this.operationLocks.set(lockKey, operation);
    
    try {
      await operation;
    } finally {
      this.operationLocks.delete(lockKey);
    }
  }
  
  /**
   * Perform the smart entity merge operation
   */
  private async performSmartEntityAdd(newEntity: EntityNode): Promise<void> {
    // Step 1: Get existing entity (if any)
    const existingEntity = await this.baseManager.getEntity(newEntity.id);
    
    // Step 2: Merge intelligently
    const mergedEntity = this.entityMerger.mergeEntities(newEntity, existingEntity);
    
    // Step 3: Validate the merge
    this.validateMergedEntity(mergedEntity);
    
    // Step 4: Write merged entity back
    await this.baseManager.addEntity(mergedEntity);
    
    // Step 5: Log the merge for debugging
    this.logMergeOperation(newEntity, existingEntity, mergedEntity);
  }
  
  /**
   * Add relationship with atomic entity updates
   */
  async addRelationship(relationship: RelationshipEdge): Promise<void> {
    // Step 1: Store relationship first (never lost)
    await this.baseManager.addRelationship(relationship);
    
    // Step 2: Update entity dependencies atomically
    await this.updateEntityRelationshipsAtomically(relationship);
  }
  
  /**
   * Update entity relationships atomically to prevent race conditions
   */
  private async updateEntityRelationshipsAtomically(relationship: RelationshipEdge): Promise<void> {
    const entityIds = [relationship.fromEntityId, relationship.toEntityId];
    
    // Process both entities, but wait for any pending operations first
    await Promise.all(entityIds.map(async (entityId) => {
      if (this.operationLocks.has(entityId)) {
        await this.operationLocks.get(entityId);
      }
    }));
    
    // Update from entity (add to dependents)
    const fromEntity = await this.baseManager.getEntity(relationship.fromEntityId);
    if (fromEntity) {
      const updatedFromEntity = {
        ...fromEntity,
        dependents: this.addUniqueRelationship(fromEntity.dependents || [], relationship.toEntityId),
        timestamp: new Date()
      };
      await this.baseManager.addEntity(updatedFromEntity);
    }
    
    // Update to entity (add to dependencies)
    const toEntity = await this.baseManager.getEntity(relationship.toEntityId);
    if (toEntity) {
      const updatedToEntity = {
        ...toEntity,
        dependencies: this.addUniqueRelationship(toEntity.dependencies || [], relationship.fromEntityId),
        timestamp: new Date()
      };
      await this.baseManager.addEntity(updatedToEntity);
    }
  }
  
  /**
   * Add relationship ID to array if not already present
   */
  private addUniqueRelationship(existingRelationships: string[], newRelationshipId: string): string[] {
    const relationshipSet = new Set(existingRelationships);
    relationshipSet.add(newRelationshipId);
    return Array.from(relationshipSet);
  }
  
  /**
   * Validate merged entity for consistency
   */
  private validateMergedEntity(entity: EntityNode): void {
    if (!entity.id || !entity.type || !entity.filePath) {
      throw new Error('Merged entity missing required fields');
    }
    
    // Check for self-references
    if (entity.dependencies?.includes(entity.id)) {
      throw new Error('Entity cannot depend on itself');
    }
    
    if (entity.dependents?.includes(entity.id)) {
      throw new Error('Entity cannot be dependent on itself');
    }
  }
  
  /**
   * Log merge operations for debugging and analysis
   */
  private logMergeOperation(newEntity: EntityNode, existing: EntityNode | null, merged: EntityNode): void {
    if (!existing) {
      console.log(`[EntityMerge] New entity created: ${newEntity.id}`);
      return;
    }
    
    const oldDepCount = (existing.dependencies || []).length;
    const oldDepentCount = (existing.dependents || []).length;
    const newDepCount = (merged.dependencies || []).length;
    const newDependentCount = (merged.dependents || []).length;
    
    console.log(`[EntityMerge] Entity ${merged.id} merged: ` +
      `deps ${oldDepCount}->${newDepCount}, ` +
      `dependents ${oldDepentCount}->${newDependentCount}`);
    
    // Warn if relationships were lost (shouldn't happen with this algorithm)
    if (newDepCount < oldDepCount || newDependentCount < oldDepentCount) {
      console.warn(`[EntityMerge] WARNING: Relationship loss detected for ${merged.id}!`);
    }
  }
  
  // Delegate other operations to base manager
  async getEntity(entityId: string): Promise<EntityNode | null> {
    return this.baseManager.getEntity(entityId);
  }
  
  async getAllEntities(filter?: Partial<EntityNode>): Promise<EntityNode[]> {
    return this.baseManager.getAllEntities(filter);
  }
  
  async getRelationships(entityId: string, relationshipType?: any): Promise<RelationshipEdge[]> {
    return this.baseManager.getRelationships(entityId, relationshipType);
  }
}

/**
 * Factory for creating enhanced state manager with feature flags
 */
export class EnhancedStateManagerFactory {
  
  /**
   * Create enhanced state manager with the original as fallback
   */
  static create(
    baseStateManager: any,
    options: {
      enableSmartMerging?: boolean;
      enableAtomicOperations?: boolean;
      enableConflictResolution?: boolean;
    } = {}
  ): any {
    
    // Default to enabling all enhancements
    const {
      enableSmartMerging = true,
      enableAtomicOperations = true,
      enableConflictResolution = true
    } = options;
    
    if (enableSmartMerging || enableAtomicOperations || enableConflictResolution) {
      return new EnhancedWorkspaceStateManager(baseStateManager);
    }
    
    // Fallback to original implementation
    return baseStateManager;
  }
}

/**
 * Migration utilities for existing installations
 */
export class MigrationUtilities {
  
  /**
   * Analyze existing entities for potential relationship loss
   */
  static async analyzeExistingEntities(stateManager: any): Promise<{
    totalEntities: number;
    entitiesWithRelationships: number;
    potentialOrphans: string[];
    suspiciousPatterns: string[];
  }> {
    
    const allEntities = await stateManager.getAllEntities();
    const totalEntities = allEntities.length;
    
    let entitiesWithRelationships = 0;
    const potentialOrphans: string[] = [];
    const suspiciousPatterns: string[] = [];
    
    for (const entity of allEntities) {
      const hasRelationships = (entity.dependencies?.length || 0) > 0 || (entity.dependents?.length || 0) > 0;
      
      if (hasRelationships) {
        entitiesWithRelationships++;
      } else {
        // Entities with no relationships might be orphaned
        potentialOrphans.push(entity.id);
      }
      
      // Check for suspicious patterns
      if (entity.type === 'Service' && (!entity.dependencies || entity.dependencies.length === 0)) {
        suspiciousPatterns.push(`Service ${entity.id} has no dependencies (unusual)`);
      }
      
      if (entity.type === 'Controller' && (!entity.dependents || entity.dependents.length === 0)) {
        suspiciousPatterns.push(`Controller ${entity.id} has no dependents (unusual)`);
      }
    }
    
    return {
      totalEntities,
      entitiesWithRelationships,
      potentialOrphans,
      suspiciousPatterns
    };
  }
  
  /**
   * Validate relationship consistency across the graph
   */
  static async validateRelationshipConsistency(stateManager: any): Promise<{
    consistent: boolean;
    inconsistencies: string[];
  }> {
    
    const allEntities = await stateManager.getAllEntities();
    const inconsistencies: string[] = [];
    
    for (const entity of allEntities) {
      // Check that all dependencies exist
      for (const depId of entity.dependencies || []) {
        const depEntity = await stateManager.getEntity(depId);
        if (!depEntity) {
          inconsistencies.push(`Entity ${entity.id} depends on non-existent entity ${depId}`);
        } else {
          // Check reverse relationship
          if (!depEntity.dependents?.includes(entity.id)) {
            inconsistencies.push(`Dependency relationship not bidirectional: ${entity.id} -> ${depId}`);
          }
        }
      }
      
      // Check that all dependents exist
      for (const depId of entity.dependents || []) {
        const depEntity = await stateManager.getEntity(depId);
        if (!depEntity) {
          inconsistencies.push(`Entity ${entity.id} has non-existent dependent ${depId}`);
        } else {
          // Check reverse relationship
          if (!depEntity.dependencies?.includes(entity.id)) {
            inconsistencies.push(`Dependent relationship not bidirectional: ${entity.id} <- ${depId}`);
          }
        }
      }
    }
    
    return {
      consistent: inconsistencies.length === 0,
      inconsistencies
    };
  }
}
