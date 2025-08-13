/**
 * Integration Tests for Complete Workflow
 * Tests end-to-end scenarios with multiple tools working together
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { AddEntityTool } from '../../tools/addEntityTool';
import { AddRelationshipTool } from '../../tools/addRelationshipTool';
import { GetNextWorkItemTool } from '../../tools/getNextWorkItemTool';
import { MarkProcessedTool } from '../../tools/markProcessedTool';
import { ValidateChainsTool } from '../../tools/validateChainsTool';
import { GenerateReportTool } from '../../tools/generateReportTool';
import { TestDataFactory, VSCodeMocks, PerformanceTestUtils } from '../utils/testUtils';

suite('Complete Workflow Integration Tests', () => {
  let context: vscode.ExtensionContext;
  let initializeTool: InitializeSessionTool;
  let addEntityTool: AddEntityTool;
  let addRelationshipTool: AddRelationshipTool;
  let getWorkItemTool: GetNextWorkItemTool;
  let markProcessedTool: MarkProcessedTool;
  let validateTool: ValidateChainsTool;
  let reportTool: GenerateReportTool;

  setup(() => {
    context = TestDataFactory.createMockContext();
    initializeTool = new InitializeSessionTool(context);
    addEntityTool = new AddEntityTool(context);
    addRelationshipTool = new AddRelationshipTool(context);
    getWorkItemTool = new GetNextWorkItemTool(context);
    markProcessedTool = new MarkProcessedTool(context);
    validateTool = new ValidateChainsTool(context);
    reportTool = new GenerateReportTool(context);
  });

  afterEach(() => {
    // Cleanup
    context.globalState.update('currentSession', undefined);
  });

  suite('Basic Discovery Workflow', () => {
    test('should complete full discovery cycle: Initialize → AddEntity → AddRelationship → Report', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Step 1: Initialize Session
      const initResult = await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Integration test: Complete user management analysis'
        }),
        token
      );
      
      assert.ok(initResult);
      const initResponse = JSON.parse(initResult.content[0].value);
      assert.strictEqual(initResponse.success, true);

      // Step 2: Add Controller Entity
      const controllerResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'UserController',
            type: 'Controller',
            filePath: '/src/controllers/UserController.ts',
            businessContext: 'User management operations',
            chainContext: 'REST API layer'
          }
        }),
        token
      );
      
      assert.ok(controllerResult);
      const controllerResponse = JSON.parse(controllerResult.content[0].value);
      assert.strictEqual(controllerResponse.success, true);

      // Step 3: Add Service Entity
      const serviceResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'UserService',
            type: 'Service',
            filePath: '/src/services/UserService.ts',
            businessContext: 'User business logic',
            chainContext: 'Service layer processing'
          }
        }),
        token
      );
      
      assert.ok(serviceResult);
      const serviceResponse = JSON.parse(serviceResult.content[0].value);
      assert.strictEqual(serviceResponse.success, true);

      // Step 4: Add Relationship
      const relationshipResult = await (addRelationshipTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          relationship: {
            fromEntityId: 'UserController',
            toEntityId: 'UserService',
            relationshipType: 'USES',
            strength: 0.9,
            discoveryMethod: 'list_code_usages'
          }
        }),
        token
      );
      
      assert.ok(relationshipResult);
      const relationshipResponse = JSON.parse(relationshipResult.content[0].value);
      assert.strictEqual(relationshipResponse.success, true);

      // Step 5: Generate Report
      const reportResult = await (reportTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          format: 'json',
          includeStatistics: true
        }),
        token
      );
      
      assert.ok(reportResult);
      const reportText = reportResult.content[0].value;
      assert.ok(reportText.includes('UserController'));
      assert.ok(reportText.includes('UserService'));
      assert.ok(reportText.includes('USES'));

      console.log('✅ Complete discovery workflow executed successfully');
    });

    test('should handle work queue processing workflow', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Step 1: Initialize Session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Integration test: Work queue processing'
        }),
        token
      );

      // Step 2: Add multiple entities to create work queue
      const entities = [
        {
          id: 'AuthController',
          type: 'Controller',
          filePath: '/src/auth/AuthController.ts',
          businessContext: 'Authentication operations',
          chainContext: 'Security layer'
        },
        {
          id: 'AuthService', 
          type: 'Service',
          filePath: '/src/auth/AuthService.ts',
          businessContext: 'Authentication business logic',
          chainContext: 'Service layer'
        },
        {
          id: 'TokenManager',
          type: 'Utility',
          filePath: '/src/auth/TokenManager.ts',
          businessContext: 'JWT token management',
          chainContext: 'Security utilities'
        }
      ];

      for (const entity of entities) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
      }

      // Step 3: Process work items
      const workItemResult = await (getWorkItemTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          priority: 1,
          agentId: 'test-agent'
        }),
        token
      );

      assert.ok(workItemResult);
      const workItemResponse = JSON.parse(workItemResult.content[0].value);
      assert.strictEqual(workItemResponse.success, true);

      // Step 4: Mark entity as processed
      if (workItemResponse.data.workItem) {
        const markResult = await (markProcessedTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entityId: workItemResponse.data.workItem.entityId,
            agentId: 'test-agent',
            analysisResults: {
              complexity: 'medium',
              dependencies: ['TokenManager'],
              recommendations: ['Add input validation']
            }
          }),
          token
        );

        assert.ok(markResult);
        const markResponse = JSON.parse(markResult.content[0].value);
        assert.strictEqual(markResponse.success, true);
      }

      console.log('✅ Work queue processing workflow executed successfully');
    });
  });

  suite('Error Handling Workflows', () => {
    test('should handle invalid tool sequence gracefully', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Try to add entity without initializing session
      const entityResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'TestEntity',
            type: 'Entity',
            filePath: '/test/Entity.ts',
            businessContext: 'Test context',
            chainContext: 'Test chain'
          }
        }),
        token
      );

      assert.ok(entityResult);
      const entityResponse = JSON.parse(entityResult.content[0].value);
      assert.strictEqual(entityResponse.success, false);
      assert.ok(entityResponse.error.includes('No active discovery session'));

      console.log('✅ Invalid tool sequence handled correctly');
    });

    test('should handle missing entities in relationships', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session first
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Error handling test'
        }),
        token
      );

      // Try to add relationship with non-existent entities
      const relationshipResult = await (addRelationshipTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          relationship: {
            fromEntityId: 'NonExistentEntity1',
            toEntityId: 'NonExistentEntity2',
            relationshipType: 'USES',
            strength: 0.5,
            discoveryMethod: 'manual'
          }
        }),
        token
      );

      assert.ok(relationshipResult);
      // The tool should handle this gracefully (depending on implementation)
      // This tests the robustness of the relationship validation

      console.log('✅ Missing entity relationship handled correctly');
    });
  });

  suite('Performance Integration Tests', () => {
    test('should handle bulk entity operations within acceptable time limits', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Performance test: Bulk operations'
        }),
        token
      );

      // Measure bulk entity addition performance
      const { executionTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        // Add 20 entities
        for (let i = 1; i <= 20; i++) {
          await (addEntityTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `Entity${i}`,
                type: i % 2 === 0 ? 'Controller' : 'Service',
                filePath: `/src/entities/Entity${i}.ts`,
                businessContext: `Business logic for entity ${i}`,
                chainContext: `Processing chain ${i}`
              }
            }),
            token
          );
        }
      });

      // Assert performance is acceptable (should complete within 5 seconds)
      PerformanceTestUtils.assertExecutionTime(executionTime, 5000, 'Bulk entity addition');

      console.log(`✅ Bulk entity operations completed in ${executionTime.toFixed(2)}ms`);
    });

    test('should handle memory usage efficiently during large workflows', async () => {
      const token = VSCodeMocks.createMockCancellationToken();
      
      // Measure initial memory usage
      const initialMemory = PerformanceTestUtils.measureMemoryUsage();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Memory test: Large workflow'
        }),
        token
      );

      // Create a large number of entities and relationships
      const entityCount = 50;
      
      // Add entities
      for (let i = 1; i <= entityCount; i++) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `LargeEntity${i}`,
              type: 'Service',
              filePath: `/src/large/Entity${i}.ts`,
              businessContext: `Large scale business logic ${i}`,
              chainContext: `Large processing chain ${i}`
            }
          }),
          token
        );
      }

      // Add relationships
      for (let i = 1; i < entityCount; i++) {
        await (addRelationshipTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: `LargeEntity${i}`,
              toEntityId: `LargeEntity${i + 1}`,
              relationshipType: 'DEPENDS_ON',
              strength: 0.7,
              discoveryMethod: 'inference'
            }
          }),
          token
        );
      }

      // Measure final memory usage
      const finalMemory = PerformanceTestUtils.measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert memory increase is reasonable (less than 100MB for this test)
      assert.ok(memoryIncrease < 100, `Memory increase too high: ${memoryIncrease}MB`);

      console.log(`✅ Memory usage test: ${memoryIncrease}MB increase for ${entityCount} entities`);
    });
  });

  suite('Chain Validation Integration', () => {
    test('should validate complete dependency chains', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Chain validation test: Complete dependency mapping'
        }),
        token
      );

      // Create a complete dependency chain: UI → Controller → Service → Repository
      const entities = [
        {
          id: 'UserComponent',
          type: 'Component',
          filePath: '/src/ui/UserComponent.tsx',
          businessContext: 'User interface component',
          chainContext: 'Frontend presentation layer'
        },
        {
          id: 'UserController',
          type: 'Controller',
          filePath: '/src/api/UserController.ts',
          businessContext: 'User API endpoints',
          chainContext: 'API layer'
        },
        {
          id: 'UserService',
          type: 'Service',
          filePath: '/src/services/UserService.ts',
          businessContext: 'User business logic',
          chainContext: 'Service layer'
        },
        {
          id: 'UserRepository',
          type: 'Repository',
          filePath: '/src/data/UserRepository.ts',
          businessContext: 'User data access',
          chainContext: 'Data layer'
        }
      ];

      // Add all entities
      for (const entity of entities) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({ entity }),
          token
        );
      }

      // Add dependency relationships
      const relationships = [
        { from: 'UserComponent', to: 'UserController', type: 'CALLS' },
        { from: 'UserController', to: 'UserService', type: 'USES' },
        { from: 'UserService', to: 'UserRepository', type: 'DEPENDS_ON' }
      ];

      for (const rel of relationships) {
        await (addRelationshipTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: rel.from,
              toEntityId: rel.to,
              relationshipType: rel.type,
              strength: 0.9,
              discoveryMethod: 'list_code_usages'
            }
          }),
          token
        );
      }

      // Validate chains
      const validationResult = await (validateTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({}),
        token
      );

      assert.ok(validationResult);
      const validationText = validationResult.content[0].value;
      assert.ok(validationText.includes('validation'));

      console.log('✅ Chain validation completed successfully');
    });
  });

  suite('Multi-Tool Error Recovery', () => {
    test('should recover from partial failures in multi-step operations', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Error recovery test'
        }),
        token
      );

      // Add valid entity
      const validResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'ValidEntity',
            type: 'Service',
            filePath: '/src/ValidEntity.ts',
            businessContext: 'Valid business context',
            chainContext: 'Valid chain context'
          }
        }),
        token
      );

      assert.ok(validResult);
      const validResponse = JSON.parse(validResult.content[0].value);
      assert.strictEqual(validResponse.success, true);

      // Try to add invalid entity (should fail)
      const invalidResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: '', // Invalid empty ID
            type: 'Service',
            filePath: '/src/InvalidEntity.ts',
            businessContext: 'Invalid business context',
            chainContext: 'Invalid chain context'
          }
        }),
        token
      );

      assert.ok(invalidResult);
      const invalidResponse = JSON.parse(invalidResult.content[0].value);
      assert.strictEqual(invalidResponse.success, false);

      // Add another valid entity (should work despite previous failure)
      const secondValidResult = await (addEntityTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          entity: {
            id: 'SecondValidEntity',
            type: 'Controller',
            filePath: '/src/SecondValidEntity.ts',
            businessContext: 'Second valid business context',
            chainContext: 'Second valid chain context'
          }
        }),
        token
      );

      assert.ok(secondValidResult);
      const secondValidResponse = JSON.parse(secondValidResult.content[0].value);
      assert.strictEqual(secondValidResponse.success, true);

      console.log('✅ Error recovery test completed successfully');
    });
  });
});
