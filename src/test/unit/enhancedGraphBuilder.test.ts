/**
 * Enhanced Graph Builder Test Suite
 * 
 * Comprehensive test suite for validating the enhanced graph building algorithm
 * that fixes relationship loss and concurrent access issues.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { 
  SmartEntityMerger, 
  ConcurrentSafeStateManager,
  EnhancedEntityNode,
  DiscoveryContext,
  EnhancedGraphBuilderFactory
} from '../../shared/services/enhancedGraphBuilder';
import { 
  createStateManager} from '../../shared/services/enhancedStateManagerIntegration';
import { EntityNode, DiscoveryMethod, Priority, RelationshipEdge } from '../../shared/types';
import { WorkspaceStateManagerVscode } from '../../shared/services/workspaceStateManagerVscode';

// Use global test functions
declare const suite: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void | Promise<void>) => void;
declare const setup: (fn: () => void) => void;
declare const teardown: (fn: () => void) => void;

suite('Enhanced Graph Builder Test Suite', () => {
  let context: vscode.ExtensionContext;
  let workspaceRoot: string;
  let baseStateManager: WorkspaceStateManagerVscode;
  let enhancedStateManager: ConcurrentSafeStateManager;
  let entityMerger: SmartEntityMerger;
  let testSessionId: string;

  setup(async () => {
    // Mock VS Code context
    context = {
      subscriptions: [],
      extensionPath: '/test/path',
      storagePath: '/test/storage',
      globalStoragePath: '/test/global', 
      logPath: '/test/log',
      globalState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => []
      } as any,
      workspaceState: {
        get: () => undefined,
        update: () => Promise.resolve(),
        keys: () => []
      } as any,
      extensionUri: vscode.Uri.file('/test/path'),
      storageUri: vscode.Uri.file('/test/storage'),
      globalStorageUri: vscode.Uri.file('/test/global'),
      logUri: vscode.Uri.file('/test/log'),
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as any,
      environmentVariableCollection: {} as any,
      asAbsolutePath: (path: string) => path,
      extension: {} as any,
      languageModelAccessInformation: {} as any
    };

    workspaceRoot = '/test/workspace';
    
    // Initialize managers
    baseStateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
    enhancedStateManager = EnhancedGraphBuilderFactory.create(baseStateManager);
    entityMerger = new SmartEntityMerger();
    
    // Initialize test session
    const session = await baseStateManager.initializeSession(
      'Enhanced Graph Builder Test Session',
      workspaceRoot
    );
    testSessionId = session.sessionId;
  });

  teardown(async () => {
    // Cleanup test data
    if (testSessionId) {
      // Clean up test session data
    }
  });

  suite('SmartEntityMerger Tests', () => {
    
    test('should create initial entity with discovery metadata', async () => {
      const entity: EntityNode = createTestEntity('test-entity-1');
      const discoveryContext: DiscoveryContext = {
        agentId: 'test-agent',
        confidence: 0.9,
        discoveryPath: ['semantic_search', 'analysis']
      };

      const enhanced = await entityMerger.mergeEntity(entity, undefined, discoveryContext);

      assert.strictEqual(enhanced.id, entity.id);
      assert.strictEqual(enhanced.type, entity.type);
      assert.strictEqual(enhanced.discoveryMetadata.sources.length, 1);
      assert.strictEqual(enhanced.discoveryMetadata.sources[0].agent, 'test-agent');
      assert.strictEqual(enhanced.discoveryMetadata.sources[0].confidence, 0.9);
      assert.strictEqual(enhanced.discoveryMetadata.version, 1);
      assert.strictEqual(enhanced.completeness.crossValidated, false);
    });

    test('should preserve all relationships during merge', async () => {
      const existingEntity: EnhancedEntityNode = createTestEnhancedEntity('test-entity-2', {
        dependencies: ['dep1', 'dep2'],
        dependents: ['dependent1']
      });

      const newEntity: EntityNode = createTestEntity('test-entity-2', {
        dependencies: ['dep2', 'dep3'], // overlapping + new
        dependents: ['dependent2']      // new dependent
      });

      const merged = await entityMerger.mergeEntity(newEntity, existingEntity);

      // Verify all relationships preserved
      assert.deepStrictEqual(
        merged.dependencies.sort(),
        ['dep1', 'dep2', 'dep3'].sort()
      );
      assert.deepStrictEqual(
        merged.dependents.sort(),
        ['dependent1', 'dependent2'].sort()
      );
    });

    test('should merge business context intelligently', async () => {
      const existingEntity: EnhancedEntityNode = createTestEnhancedEntity('test-entity-3', {
        businessContext: 'User authentication service'
      });

      const newEntity: EntityNode = createTestEntity('test-entity-3', {
        businessContext: 'User authentication service handling login validation and JWT token generation'
      });

      const merged = await entityMerger.mergeEntity(newEntity, existingEntity);

      // Should prefer more detailed context
      assert.strictEqual(
        merged.businessContext,
        'User authentication service handling login validation and JWT token generation'
      );
      
      // Should record conflict resolution
      assert.strictEqual(merged.discoveryMetadata.conflictResolutions.length, 1);
      assert.strictEqual(merged.discoveryMetadata.conflictResolutions[0].field, 'businessContext');
      assert.strictEqual(merged.discoveryMetadata.conflictResolutions[0].resolution, 'prefer_new');
    });

    test('should track multiple discovery sources', async () => {
      let entity = await entityMerger.mergeEntity(
        createTestEntity('test-entity-4'),
        undefined,
        { agentId: 'agent1', confidence: 0.8, discoveryPath: ['semantic'] }
      );

      entity = await entityMerger.mergeEntity(
        createTestEntity('test-entity-4'),
        entity,
        { agentId: 'agent2', confidence: 0.9, discoveryPath: ['usage'] }
      );

      entity = await entityMerger.mergeEntity(
        createTestEntity('test-entity-4'),
        entity,
        { agentId: 'agent3', confidence: 0.7, discoveryPath: ['file'] }
      );

      assert.strictEqual(entity.discoveryMetadata.sources.length, 3);
      assert.strictEqual(entity.completeness.crossValidated, true);
      assert.strictEqual(entity.discoveryMetadata.version, 3);
    });
  });

  suite('ConcurrentSafeStateManager Tests', () => {
    
    test('should handle concurrent entity additions safely', async () => {
      const entity1 = createTestEntity('concurrent-test-1', {
        businessContext: 'Context from agent 1',
        dependencies: ['dep1', 'dep2']
      });

      const entity2 = createTestEntity('concurrent-test-1', {
        businessContext: 'More detailed context from agent 2 with additional information',
        dependencies: ['dep2', 'dep3'],
        dependents: ['dependent1']
      });

      const entity3 = createTestEntity('concurrent-test-1', {
        businessContext: 'Context from agent 3',
        dependencies: ['dep4'],
        dependents: ['dependent2']
      });

      // Simulate concurrent additions
      await Promise.all([
        enhancedStateManager.addEntity(entity1, { agentId: 'agent1', confidence: 0.8 }),
        enhancedStateManager.addEntity(entity2, { agentId: 'agent2', confidence: 0.9 }),
        enhancedStateManager.addEntity(entity3, { agentId: 'agent3', confidence: 0.7 })
      ]);

      // Verify final entity has merged all information
      const finalEntity = await baseStateManager.getEntity('concurrent-test-1');
      assert.ok(finalEntity);
      
      // Should have all dependencies
      const allDeps = ['dep1', 'dep2', 'dep3', 'dep4'];
      assert.deepStrictEqual(finalEntity.dependencies.sort(), allDeps.sort());
      
      // Should have all dependents
      const allDependents = ['dependent1', 'dependent2'];
      assert.deepStrictEqual(finalEntity.dependents.sort(), allDependents.sort());
      
      // Should prefer most detailed business context
      assert.strictEqual(
        finalEntity.businessContext,
        'More detailed context from agent 2 with additional information'
      );
    });

    test('should handle concurrent relationship additions safely', async () => {
      // Add base entities first
      await enhancedStateManager.addEntity(createTestEntity('entity-A'));
      await enhancedStateManager.addEntity(createTestEntity('entity-B'));
      await enhancedStateManager.addEntity(createTestEntity('entity-C'));

      const relationships: RelationshipEdge[] = [
        createTestRelationship('rel-1', 'entity-A', 'entity-B'),
        createTestRelationship('rel-2', 'entity-A', 'entity-C'),
        createTestRelationship('rel-3', 'entity-B', 'entity-C')
      ];

      // Add relationships concurrently
      await Promise.all(
        relationships.map(rel => enhancedStateManager.addRelationship(rel))
      );

      // Verify all relationships were preserved
      const entityA = await baseStateManager.getEntity('entity-A');
      const entityB = await baseStateManager.getEntity('entity-B');
      const entityC = await baseStateManager.getEntity('entity-C');

      assert.ok(entityA && entityB && entityC);
      
      // Check dependents
      assert.deepStrictEqual(entityA.dependents.sort(), ['entity-B', 'entity-C'].sort());
      assert.deepStrictEqual(entityB.dependents.sort(), ['entity-C']);
      
      // Check dependencies
      assert.deepStrictEqual(entityB.dependencies.sort(), ['entity-A']);
      assert.deepStrictEqual(entityC.dependencies.sort(), ['entity-A', 'entity-B'].sort());
    });

    test('should prevent relationship loss during high concurrency', async () => {
      const entityId = 'high-concurrency-test';
      await enhancedStateManager.addEntity(createTestEntity(entityId));

      // Simulate high concurrency scenario
      const numberOfConcurrentOperations = 50;
      const operations: Promise<void>[] = [];

      for (let i = 0; i < numberOfConcurrentOperations; i++) {
        operations.push(
          enhancedStateManager.addEntity(
            createTestEntity(entityId, {
              dependencies: [`dep-${i}`],
              dependents: [`dependent-${i}`]
            }),
            { agentId: `agent-${i}`, confidence: 0.8 }
          )
        );
      }

      await Promise.all(operations);

      // Verify all relationships were preserved
      const finalEntity = await baseStateManager.getEntity(entityId);
      assert.ok(finalEntity);
      
      // Should have all dependencies and dependents
      assert.strictEqual(finalEntity.dependencies.length, numberOfConcurrentOperations);
      assert.strictEqual(finalEntity.dependents.length, numberOfConcurrentOperations);
      
      // Verify no duplicates
      const uniqueDeps = new Set(finalEntity.dependencies);
      const uniqueDependents = new Set(finalEntity.dependents);
      assert.strictEqual(uniqueDeps.size, numberOfConcurrentOperations);
      assert.strictEqual(uniqueDependents.size, numberOfConcurrentOperations);
    });
  });

  suite('Integration Tests', () => {
    
    test('should work as drop-in replacement for existing tools', async () => {
      // Test the factory function approach
      const originalManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
      const enhancedWrapper = createStateManager(context, workspaceRoot);

      const testEntity = createTestEntity('integration-test-1');

      // Both should accept the same interface
      await originalManager.addEntity(testEntity);
      await enhancedWrapper.addEntity(testEntity);

      // Both should return entities
      const originalResult = await originalManager.getEntity('integration-test-1');
      const enhancedResult = await enhancedWrapper.getEntity('integration-test-1');

      assert.ok(originalResult);
      assert.ok(enhancedResult);
      assert.strictEqual(originalResult.id, enhancedResult.id);
    });

    test('should respect feature flags', async () => {
      // Test with enhanced features disabled
      const disabledManager = createStateManager(context, workspaceRoot, {
        enhanced: false
      });

      // Test with selective features
      const selectiveManager = createStateManager(context, workspaceRoot, {
        config: {
          enableSmartMerging: true,
          enableConflictResolution: false,
          enableConcurrentSafety: false,
          enablePerformanceLogging: false
        }
      });

      // Both should work without errors
      await disabledManager.addEntity(createTestEntity('feature-test-1'));
      await selectiveManager.addEntity(createTestEntity('feature-test-2'));

      const result1 = await disabledManager.getEntity('feature-test-1');
      const result2 = await selectiveManager.getEntity('feature-test-2');

      assert.ok(result1);
      assert.ok(result2);
    });
  });

  suite('Performance Tests', () => {
    
    test('should handle large number of entities efficiently', async () => {
      const numberOfEntities = 1000;
      const startTime = Date.now();

      const promises: Promise<void>[] = [];
      for (let i = 0; i < numberOfEntities; i++) {
        promises.push(
          enhancedStateManager.addEntity(
            createTestEntity(`perf-test-entity-${i}`, {
              dependencies: [`dep-${i}`, `dep-${i + 1}`],
              dependents: [`dependent-${i}`]
            })
          )
        );
      }

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      assert.ok(duration < 30000, `Performance test took too long: ${duration}ms`);
      
      // Verify all entities were added
      const entities = await baseStateManager.getAllEntities();
      const testEntities = entities.filter(e => e.id.startsWith('perf-test-entity-'));
      assert.strictEqual(testEntities.length, numberOfEntities);
    });
  });

  // Helper functions
  function createTestEntity(id: string, overrides: Partial<EntityNode> = {}): EntityNode {
    return {
      id,
      type: 'Service',
      filePath: `/test/path/${id}.ts`,
      discoveryMethod: 'semantic_search' as DiscoveryMethod,
      priority: 3 as Priority,
      processed: false,
      chainContext: 'test_chain',
      businessContext: 'Test business context',
      dependencies: [],
      dependents: [],
      timestamp: new Date(),
      ...overrides
    };
  }

  function createTestEnhancedEntity(id: string, overrides: Partial<EntityNode> = {}): EnhancedEntityNode {
    const baseEntity = createTestEntity(id, overrides);
    return {
      ...baseEntity,
      discoveryMetadata: {
        sources: [{
          method: baseEntity.discoveryMethod,
          agent: 'test-agent',
          timestamp: new Date(),
          filePath: baseEntity.filePath,
          confidence: 0.8,
          contextPath: ['test']
        }],
        lastMerged: new Date(),
        version: 1,
        conflictResolutions: []
      },
      completeness: {
        dependencyScore: 0.5,
        contextRichness: 0.7,
        crossValidated: false
      }
    };
  }

  function createTestRelationship(id: string, fromId: string, toId: string): RelationshipEdge {
    return {
      id,
      fromEntityId: fromId,
      toEntityId: toId,
      relationshipType: 'DEPENDS_ON',
      strength: 0.8,
      discoveryMethod: 'semantic_search' as DiscoveryMethod,
      bidirectional: false,
      timestamp: new Date()
    };
  }
});
