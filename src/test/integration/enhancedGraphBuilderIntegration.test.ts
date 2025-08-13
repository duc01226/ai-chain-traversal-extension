/**
 * Enhanced Graph Builder Integration Test
 * 
 * Tests the integration of enhanced graph builder with existing AI Chain Traversal tools
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { createStateManager } from '../../shared/services/enhancedStateManagerIntegration';
import { EntityNode, DiscoveryMethod, Priority } from '../../shared/types';
import { WorkspaceStateManagerVscode } from '../../shared/services/workspaceStateManagerVscode';

// Use global test functions  
declare const suite: (name: string, fn: () => void) => void;
declare const test: (name: string, fn: () => void | Promise<void>) => void;
declare const setup: (fn: () => void) => void;
declare const teardown: (fn: () => void) => void;

suite('Enhanced Graph Builder Integration Tests', () => {
  let context: vscode.ExtensionContext;
  let workspaceRoot: string;

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
  });

  suite('Tool Migration Tests', () => {
    
    test('should simulate AddEntityTool migration', async () => {
      // Simulate the old way (AddEntityTool pattern)
      const oldStateManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
      
      // Simulate the new way (enhanced)
      const newStateManager = createStateManager(context, workspaceRoot);

      // Create test entity data
      const entityData = {
        id: 'migration-test-entity',
        type: 'Service' as const,
        filePath: '/test/UserService.ts',
        businessContext: 'User management service handling authentication and profile operations',
        chainContext: 'user_management_flow',
        dependencies: ['UserRepository', 'EmailService'],
        dependents: []
      };

      // Create entity node (as AddEntityTool would)
      const entityNode: EntityNode = {
        id: entityData.id,
        type: entityData.type,
        filePath: entityData.filePath,
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        priority: 3 as Priority,
        processed: false,
        chainContext: entityData.chainContext,
        businessContext: entityData.businessContext,
        dependencies: entityData.dependencies,
        dependents: entityData.dependents,
        timestamp: new Date()
      };

      // Add entity using old method
      await oldStateManager.addEntity(entityNode);
      
      // Add entity using new method (enhanced features available but not required)
      await newStateManager.addEntity(entityNode);
      
      // If the manager supports enhanced features, we can optionally use them
      if ('addEntity' in newStateManager && typeof newStateManager.addEntity === 'function') {
        // The enhanced manager will handle discovery context internally if it supports it
      }

      // Both should work and return the entity
      const oldResult = await oldStateManager.getEntity(entityData.id);
      const newResult = await newStateManager.getEntity(entityData.id);

      assert.ok(oldResult);
      assert.ok(newResult);
      assert.strictEqual(oldResult.id, newResult.id);
      assert.strictEqual(oldResult.businessContext, newResult.businessContext);
    });

    test('should demonstrate relationship preservation improvement', async () => {
      // Test scenario: Multiple agents discovering the same service with different relationships
      const enhancedManager = createStateManager(context, workspaceRoot);

      const baseEntityId = 'UserService';
      
      // Agent 1: Discovers through semantic search
      const discovery1: EntityNode = {
        id: baseEntityId,
        type: 'Service',
        filePath: '/src/services/UserService.ts',
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        priority: 3 as Priority,
        processed: false,
        chainContext: 'authentication_flow',
        businessContext: 'Service handling user authentication',
        dependencies: ['UserRepository'],
        dependents: [],
        timestamp: new Date()
      };

      // Agent 2: Discovers through usage analysis  
      const discovery2: EntityNode = {
        id: baseEntityId,
        type: 'Service',
        filePath: '/src/services/UserService.ts',
        discoveryMethod: 'list_code_usages' as DiscoveryMethod,
        priority: 2 as Priority,
        processed: false,
        chainContext: 'user_management_flow',
        businessContext: 'Service handling user authentication and profile management',
        dependencies: ['UserRepository', 'EmailService'], // Additional dependency
        dependents: ['AuthController'], // New dependent
        timestamp: new Date()
      };

      // Agent 3: Discovers through file analysis
      const discovery3: EntityNode = {
        id: baseEntityId,
        type: 'Service', 
        filePath: '/src/services/UserService.ts',
        discoveryMethod: 'file_search' as DiscoveryMethod,
        priority: 3 as Priority,
        processed: false,
        chainContext: 'session_management_flow',
        businessContext: 'Core user service with session management capabilities',
        dependencies: ['SessionStore'], // Another dependency
        dependents: ['AuthController', 'ProfileController'], // Additional dependent
        timestamp: new Date()
      };

      // Execute discoveries in parallel (simulating concurrent agents)
      await Promise.all([
        enhancedManager.addEntity(discovery1),
        enhancedManager.addEntity(discovery2),
        enhancedManager.addEntity(discovery3)
      ]);

      // Verify enhanced manager preserved all relationships
      const finalEntity = await enhancedManager.getEntity(baseEntityId);
      assert.ok(finalEntity);

      // Should have union of all dependencies
      const expectedDependencies = ['UserRepository', 'EmailService', 'SessionStore'];
      assert.deepStrictEqual(finalEntity.dependencies.sort(), expectedDependencies.sort());

      // Should have union of all dependents  
      const expectedDependents = ['AuthController', 'ProfileController'];
      assert.deepStrictEqual(finalEntity.dependents.sort(), expectedDependents.sort());

      // Should have most detailed business context
      assert.strictEqual(
        finalEntity.businessContext,
        'Service handling user authentication and profile management'
      );

      // Verify no relationship loss (this was the original problem!)
      assert.strictEqual(finalEntity.dependencies.length, 3);
      assert.strictEqual(finalEntity.dependents.length, 2);
    });

    test('should simulate tool workflow with enhanced features', async () => {
      const enhancedManager = createStateManager(context, workspaceRoot);

      // Simulate InitializeSessionTool
      const session = await enhancedManager.initializeSession(
        'Enhanced Graph Builder Integration Test',
        workspaceRoot
      );
      assert.ok(session.sessionId);

      // Simulate AddEntityTool discovering multiple entities
      const entities: EntityNode[] = [
        {
          id: 'UserController',
          type: 'Controller',
          filePath: '/src/controllers/UserController.ts',
          discoveryMethod: 'semantic_search' as DiscoveryMethod,
          priority: 2 as Priority,
          processed: false,
          chainContext: 'web_api_layer',
          businessContext: 'REST API controller for user operations',
          dependencies: ['UserService'],
          dependents: [],
          timestamp: new Date()
        },
        {
          id: 'UserService',
          type: 'Service',
          filePath: '/src/services/UserService.ts',
          discoveryMethod: 'semantic_search' as DiscoveryMethod,
          priority: 3 as Priority,
          processed: false,
          chainContext: 'business_logic_layer',
          businessContext: 'Business logic for user management',
          dependencies: ['UserRepository'],
          dependents: ['UserController'],
          timestamp: new Date()
        },
        {
          id: 'UserRepository',
          type: 'Repository',
          filePath: '/src/repositories/UserRepository.ts',
          discoveryMethod: 'semantic_search' as DiscoveryMethod,
          priority: 4 as Priority,
          processed: false,
          chainContext: 'data_access_layer',
          businessContext: 'Data access for user entities',
          dependencies: [],
          dependents: ['UserService'],
          timestamp: new Date()
        }
      ];

      // Add entities with discovery context (enhanced features work internally)
      for (const entity of entities) {
        await enhancedManager.addEntity(entity);
      }

      // Simulate AddRelationshipTool
      await enhancedManager.addRelationship({
        id: 'controller-service-rel',
        fromEntityId: 'UserController',
        toEntityId: 'UserService',
        relationshipType: 'DEPENDS_ON',
        strength: 0.9,
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        bidirectional: false,
        timestamp: new Date()
      });

      await enhancedManager.addRelationship({
        id: 'service-repository-rel',
        fromEntityId: 'UserService',
        toEntityId: 'UserRepository',
        relationshipType: 'DEPENDS_ON',
        strength: 0.9,
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        bidirectional: false,
        timestamp: new Date()
      });

      // Verify the chain was built correctly
      const controller = await enhancedManager.getEntity('UserController');
      const service = await enhancedManager.getEntity('UserService');
      const repository = await enhancedManager.getEntity('UserRepository');

      assert.ok(controller && service && repository);

      // Verify relationships
      assert.deepStrictEqual(controller.dependencies, ['UserService']);
      assert.deepStrictEqual(service.dependencies, ['UserRepository']);
      assert.deepStrictEqual(service.dependents, ['UserController']);
      assert.deepStrictEqual(repository.dependents, ['UserService']);

      // Simulate GetNextWorkItemTool
      const workItem = await enhancedManager.getNextWorkItem(2);
      assert.ok(workItem); // Should get highest priority unprocessed item

      // Simulate MarkProcessedTool
      await enhancedManager.updateEntity('UserController', { processed: true });
      const updatedController = await enhancedManager.getEntity('UserController');
      assert.strictEqual(updatedController?.processed, true);
    });
  });

  suite('Performance Comparison Tests', () => {
    
    test('should benchmark enhanced vs original performance', async () => {
      const originalManager = new WorkspaceStateManagerVscode(context, workspaceRoot);
      const enhancedManager = createStateManager(context, workspaceRoot);

      const numberOfEntities = 100;
      const testEntities: EntityNode[] = [];

      // Generate test entities
      for (let i = 0; i < numberOfEntities; i++) {
        testEntities.push({
          id: `perf-test-${i}`,
          type: 'Service',
          filePath: `/test/Service${i}.ts`,
          discoveryMethod: 'semantic_search' as DiscoveryMethod,
          priority: 3 as Priority,
          processed: false,
          chainContext: 'test_chain',
          businessContext: `Test service ${i}`,
          dependencies: [`dep-${i}`],
          dependents: [],
          timestamp: new Date()
        });
      }

      // Benchmark original implementation
      const originalStart = Date.now();
      for (const entity of testEntities) {
        await originalManager.addEntity(entity);
      }
      const originalTime = Date.now() - originalStart;

      // Benchmark enhanced implementation
      const enhancedStart = Date.now();
      for (const entity of testEntities) {
        await enhancedManager.addEntity(entity);
      }
      const enhancedTime = Date.now() - enhancedStart;

      console.log(`Original implementation: ${originalTime}ms`);
      console.log(`Enhanced implementation: ${enhancedTime}ms`);
      console.log(`Performance ratio: ${(enhancedTime / originalTime).toFixed(2)}x`);

      // Enhanced should be reasonably close in performance
      // Allow for up to 3x slower due to additional features
      assert.ok(enhancedTime < originalTime * 3, 
        `Enhanced implementation too slow: ${enhancedTime}ms vs ${originalTime}ms`);
    });
  });

  suite('Feature Flag Tests', () => {
    
    test('should work with features disabled', async () => {
      const disabledManager = createStateManager(context, workspaceRoot, {
        enhanced: false
      });

      const entity: EntityNode = {
        id: 'disabled-test',
        type: 'Service',
        filePath: '/test/DisabledTest.ts',
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        priority: 3 as Priority,
        processed: false,
        chainContext: 'test',
        businessContext: 'Test with disabled features',
        dependencies: [],
        dependents: [],
        timestamp: new Date()
      };

      // Should work without enhanced features
      await disabledManager.addEntity(entity);
      const result = await disabledManager.getEntity('disabled-test');

      assert.ok(result);
      assert.strictEqual(result.id, 'disabled-test');
    });

    test('should work with selective features enabled', async () => {
      const selectiveManager = createStateManager(context, workspaceRoot, {
        config: {
          enableSmartMerging: true,
          enableConflictResolution: false,
          enableConcurrentSafety: false,
          enablePerformanceLogging: false
        }
      });

      const entity: EntityNode = {
        id: 'selective-test',
        type: 'Service',
        filePath: '/test/SelectiveTest.ts',
        discoveryMethod: 'semantic_search' as DiscoveryMethod,
        priority: 3 as Priority,
        processed: false,
        chainContext: 'test',
        businessContext: 'Test with selective features',
        dependencies: [],
        dependents: [],
        timestamp: new Date()
      };

      // Should work with only smart merging enabled
      await selectiveManager.addEntity(entity);
      const result = await selectiveManager.getEntity('selective-test');

      assert.ok(result);
      assert.strictEqual(result.id, 'selective-test');
    });
  });
});
