/**
 * Performance Tests for AI Chain Traversal Tools
 * Tests system performance under various load conditions
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { AddEntityTool } from '../../tools/addEntityTool';
import { AddRelationshipTool } from '../../tools/addRelationshipTool';
import { GenerateReportTool } from '../../tools/generateReportTool';
import { TestDataFactory, VSCodeMocks, PerformanceTestUtils } from '../utils/testUtils';

describe('Performance Tests', () => {
  let context: vscode.ExtensionContext;
  let initializeTool: InitializeSessionTool;
  let addEntityTool: AddEntityTool;
  let addRelationshipTool: AddRelationshipTool;
  let reportTool: GenerateReportTool;

  beforeEach(() => {
    context = TestDataFactory.createMockContext();
    initializeTool = new InitializeSessionTool(context);
    addEntityTool = new AddEntityTool(context);
    addRelationshipTool = new AddRelationshipTool(context);
    reportTool = new GenerateReportTool(context);
  });

  afterEach(() => {
    // Cleanup and force garbage collection
    context.globalState.update('currentSession', undefined);
    if (global.gc) {
      global.gc();
    }
  });

  describe('Single Tool Performance', () => {
    it('should initialize sessions within acceptable time limits', async () => {
      const token = VSCodeMocks.createMockCancellationToken();
      const iterations = 10;
      const timeLimit = 100; // 100ms per initialization

      for (let i = 0; i < iterations; i++) {
        const { executionTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
          await (initializeTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              taskDescription: `Performance test iteration ${i}`
            }),
            token
          );
        });

        PerformanceTestUtils.assertExecutionTime(
          executionTime, 
          timeLimit, 
          `Session initialization iteration ${i}`
        );

        // Reset for next iteration
        context.globalState.update('currentSession', undefined);
      }

      console.log(`✅ Session initialization performance: ${iterations} iterations completed`);
    });

    it('should add entities efficiently under load', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session once
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Entity addition performance test'
        }),
        token
      );

      const entityCount = 100;
      const timeLimit = 50; // 50ms per entity addition

      const { executionTime: totalTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        for (let i = 1; i <= entityCount; i++) {
          await (addEntityTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `PerformanceEntity${i}`,
                type: i % 3 === 0 ? 'Controller' : i % 3 === 1 ? 'Service' : 'Repository',
                filePath: `/src/performance/Entity${i}.ts`,
                businessContext: `Performance test entity ${i}`,
                chainContext: `Performance chain ${i}`
              }
            }),
            token
          );
        }
      });

      const averageTime = totalTime / entityCount;
      PerformanceTestUtils.assertExecutionTime(
        averageTime, 
        timeLimit, 
        `Average entity addition time (${entityCount} entities)`
      );

      console.log(`✅ Entity addition performance: ${entityCount} entities in ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms/entity)`);
    });

    it('should handle relationship creation efficiently', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session and add entities
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Relationship performance test'
        }),
        token
      );

      // Add entities first
      const entityCount = 20;
      for (let i = 1; i <= entityCount; i++) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `RelEntity${i}`,
              type: 'Service',
              filePath: `/src/rel/Entity${i}.ts`,
              businessContext: `Relationship test entity ${i}`,
              chainContext: `Relationship chain ${i}`
            }
          }),
          token
        );
      }

      // Test relationship creation performance
      const relationshipCount = entityCount - 1; // Chain relationships
      const timeLimit = 30; // 30ms per relationship

      const { executionTime: totalTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        for (let i = 1; i < entityCount; i++) {
          await (addRelationshipTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              relationship: {
                fromEntityId: `RelEntity${i}`,
                toEntityId: `RelEntity${i + 1}`,
                relationshipType: 'DEPENDS_ON',
                strength: 0.8,
                discoveryMethod: 'list_code_usages'
              }
            }),
            token
          );
        }
      });

      const averageTime = totalTime / relationshipCount;
      PerformanceTestUtils.assertExecutionTime(
        averageTime, 
        timeLimit, 
        `Average relationship creation time (${relationshipCount} relationships)`
      );

      console.log(`✅ Relationship creation performance: ${relationshipCount} relationships in ${totalTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms/relationship)`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should maintain reasonable memory usage during large session processing', async () => {
      const token = VSCodeMocks.createMockCancellationToken();
      
      // Measure baseline memory
      const baselineMemory = PerformanceTestUtils.measureMemoryUsage();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Large session memory test'
        }),
        token
      );

      // Add a significant number of entities
      const entityCount = 200;
      for (let i = 1; i <= entityCount; i++) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `MemoryEntity${i}`,
              type: 'Service',
              filePath: `/src/memory/Entity${i}.ts`,
              businessContext: `Memory test entity ${i} with longer description to test memory usage patterns`,
              chainContext: `Memory test chain ${i} with additional context data for realistic memory footprint`
            }
          }),
          token
        );

        // Measure memory every 50 entities
        if (i % 50 === 0) {
          const currentMemory = PerformanceTestUtils.measureMemoryUsage();
          const memoryIncrease = (currentMemory.heapUsed - baselineMemory.heapUsed) / (1024 * 1024);
          console.log(`Memory usage after ${i} entities: ${memoryIncrease.toFixed(2)}MB increase`);
        }
      }

      // Add relationships
      const relationshipCount = entityCount / 2;
      for (let i = 1; i <= relationshipCount; i++) {
        const fromId = `MemoryEntity${i}`;
        const toId = `MemoryEntity${i + relationshipCount}`;
        
        await (addRelationshipTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: fromId,
              toEntityId: toId,
              relationshipType: 'USES',
              strength: 0.7,
              discoveryMethod: 'semantic_search'
            }
          }),
          token
        );
      }

      // Measure final memory usage
      const finalMemory = PerformanceTestUtils.measureMemoryUsage();
      const totalMemoryIncrease = (finalMemory.heapUsed - baselineMemory.heapUsed) / (1024 * 1024);

      // Assert memory usage is reasonable (less than 200MB for this test size)
      assert.ok(totalMemoryIncrease < 200, `Memory usage too high: ${totalMemoryIncrease.toFixed(2)}MB`);

      console.log(`✅ Memory test completed: ${totalMemoryIncrease.toFixed(2)}MB total increase for ${entityCount} entities and ${relationshipCount} relationships`);
    });

    it('should handle memory cleanup after session completion', async () => {
      const token = VSCodeMocks.createMockCancellationToken();
      
      // Measure initial memory
      const initialMemory = PerformanceTestUtils.measureMemoryUsage();

      // Create and complete multiple sessions
      const sessionCount = 5;
      for (let sessionIndex = 1; sessionIndex <= sessionCount; sessionIndex++) {
        // Initialize session
        await (initializeTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            taskDescription: `Memory cleanup test session ${sessionIndex}`
          }),
          token
        );

        // Add entities to session
        for (let i = 1; i <= 20; i++) {
          await (addEntityTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `CleanupEntity${sessionIndex}_${i}`,
                type: 'Service',
                filePath: `/src/cleanup/Session${sessionIndex}/Entity${i}.ts`,
                businessContext: `Cleanup test entity ${i} in session ${sessionIndex}`,
                chainContext: `Cleanup chain session ${sessionIndex} entity ${i}`
              }
            }),
            token
          );
        }

        // Generate report to complete session
        await (reportTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            format: 'text'
          }),
          token
        );

        // Clear session
        context.globalState.update('currentSession', undefined);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Measure memory after cleanup
        const currentMemory = PerformanceTestUtils.measureMemoryUsage();
        const memoryIncrease = (currentMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);
        
        console.log(`Session ${sessionIndex} completed - Memory increase: ${memoryIncrease.toFixed(2)}MB`);
      }

      // Final memory check
      const finalMemory = PerformanceTestUtils.measureMemoryUsage();
      const totalMemoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      // Memory should not continuously grow (should be less than 50MB after cleanup)
      assert.ok(totalMemoryIncrease < 50, `Memory not properly cleaned up: ${totalMemoryIncrease.toFixed(2)}MB residual`);

      console.log(`✅ Memory cleanup test completed: ${totalMemoryIncrease.toFixed(2)}MB residual after ${sessionCount} sessions`);
    });
  });

  describe('Concurrent Operation Tests', () => {
    it('should handle multiple entity additions concurrently', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Concurrent operations test'
        }),
        token
      );

      const concurrentOperations = 10;
      const { executionTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        // Create concurrent entity addition promises
        const entityPromises = Array.from({ length: concurrentOperations }, (_, i) => 
          (addEntityTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `ConcurrentEntity${i + 1}`,
                type: 'Service',
                filePath: `/src/concurrent/Entity${i + 1}.ts`,
                businessContext: `Concurrent test entity ${i + 1}`,
                chainContext: `Concurrent chain ${i + 1}`
              }
            }),
            token
          )
        );

        // Wait for all operations to complete
        const results = await Promise.all(entityPromises);
        
        // Verify all operations succeeded
        for (const result of results) {
          assert.ok(result);
          const response = JSON.parse(result.content[0].value);
          assert.strictEqual(response.success, true);
        }
      });

      // Concurrent operations should be faster than sequential
      const sequentialEstimate = concurrentOperations * 20; // Estimate 20ms per operation
      assert.ok(executionTime < sequentialEstimate, 
        `Concurrent operations not efficient: ${executionTime}ms vs estimated sequential ${sequentialEstimate}ms`);

      console.log(`✅ Concurrent operations test: ${concurrentOperations} operations in ${executionTime.toFixed(2)}ms`);
    });

    it('should maintain data consistency during concurrent operations', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Data consistency test'
        }),
        token
      );

      // Add entities concurrently, then relationships sequentially
      const entityCount = 20;
      
      // Concurrent entity addition
      const entityPromises = Array.from({ length: entityCount }, (_, i) => 
        (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `ConsistencyEntity${i + 1}`,
              type: 'Service',
              filePath: `/src/consistency/Entity${i + 1}.ts`,
              businessContext: `Consistency test entity ${i + 1}`,
              chainContext: `Consistency chain ${i + 1}`
            }
          }),
          token
        )
      );

      await Promise.all(entityPromises);

      // Sequential relationship addition to test consistency
      for (let i = 1; i < entityCount; i++) {
        const relationshipResult = await (addRelationshipTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: `ConsistencyEntity${i}`,
              toEntityId: `ConsistencyEntity${i + 1}`,
              relationshipType: 'DEPENDS_ON',
              strength: 0.8,
              discoveryMethod: 'list_code_usages'
            }
          }),
          token
        );

        assert.ok(relationshipResult);
        const response = JSON.parse(relationshipResult.content[0].value);
        assert.strictEqual(response.success, true, `Relationship ${i} failed - data consistency issue`);
      }

      console.log(`✅ Data consistency test: ${entityCount} entities and ${entityCount - 1} relationships maintained consistency`);
    });
  });

  describe('Load Testing', () => {
    it('should handle enterprise-scale entity volumes', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Enterprise scale load test - large codebase simulation'
        }),
        token
      );

      const entityCount = 500; // Simulate enterprise codebase
      const timeLimit = 25; // Should be efficient even at scale

      console.log(`Starting enterprise scale test with ${entityCount} entities...`);

      const { executionTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        // Add entities in batches for better performance tracking
        const batchSize = 50;
        for (let batch = 0; batch < entityCount / batchSize; batch++) {
          const batchStart = batch * batchSize;
          const batchEnd = Math.min(batchStart + batchSize, entityCount);
          
          const batchPromises: Promise<any>[] = [];
          for (let i = batchStart; i < batchEnd; i++) {
            const entityType = i % 5 === 0 ? 'Controller' : 
                             i % 5 === 1 ? 'Service' : 
                             i % 5 === 2 ? 'Repository' : 
                             i % 5 === 3 ? 'Entity' : 'Utility';
            
            const entityPromise = (addEntityTool as any).executeToolLogic(
              VSCodeMocks.createMockToolInvocationOptions({
                entity: {
                  id: `EnterpriseEntity${i + 1}`,
                  type: entityType,
                  filePath: `/src/enterprise/layer${Math.floor(i / 100)}/Entity${i + 1}.ts`,
                  businessContext: `Enterprise entity ${i + 1} - ${entityType} layer component`,
                  chainContext: `Enterprise processing chain layer ${Math.floor(i / 100)} position ${i % 100}`
                }
              }),
              token
            );
            batchPromises.push(entityPromise);
          }

          await Promise.all(batchPromises);
          console.log(`Completed batch ${batch + 1}/${Math.ceil(entityCount / batchSize)}`);
        }
      });

      const averageTime = executionTime / entityCount;
      PerformanceTestUtils.assertExecutionTime(
        averageTime, 
        timeLimit, 
        `Enterprise scale average entity processing time (${entityCount} entities)`
      );

      console.log(`✅ Enterprise scale test completed: ${entityCount} entities in ${executionTime.toFixed(2)}ms (avg: ${averageTime.toFixed(2)}ms/entity)`);
    });

    it('should generate reports efficiently for large datasets', async () => {
      const token = VSCodeMocks.createMockCancellationToken();

      // Initialize session with large dataset
      await (initializeTool as any).executeToolLogic(
        VSCodeMocks.createMockToolInvocationOptions({
          taskDescription: 'Large dataset report generation test'
        }),
        token
      );

      // Add substantial number of entities and relationships
      const entityCount = 100;
      
      // Add entities
      for (let i = 1; i <= entityCount; i++) {
        await (addEntityTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            entity: {
              id: `ReportEntity${i}`,
              type: i % 4 === 0 ? 'Controller' : i % 4 === 1 ? 'Service' : i % 4 === 2 ? 'Repository' : 'Entity',
              filePath: `/src/report/module${Math.floor(i / 10)}/Entity${i}.ts`,
              businessContext: `Report test entity ${i}`,
              chainContext: `Report chain module ${Math.floor(i / 10)}`
            }
          }),
          token
        );
      }

      // Add relationships (create network structure)
      const relationshipCount = entityCount * 2; // Multiple relationships per entity
      for (let i = 1; i <= relationshipCount; i++) {
        const fromId = `ReportEntity${((i - 1) % entityCount) + 1}`;
        const toId = `ReportEntity${(i % entityCount) + 1}`;
        
        await (addRelationshipTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            relationship: {
              fromEntityId: fromId,
              toEntityId: toId,
              relationshipType: i % 3 === 0 ? 'USES' : i % 3 === 1 ? 'DEPENDS_ON' : 'CALLS',
              strength: 0.5 + (i % 5) * 0.1,
              discoveryMethod: 'list_code_usages'
            }
          }),
          token
        );
      }

      // Test report generation performance
      const reportTimeLimit = 1000; // 1 second for large dataset report

      const { executionTime } = await PerformanceTestUtils.measureExecutionTime(async () => {
        const reportResult = await (reportTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            format: 'json',
            includeStatistics: true,
            includeEntityDetails: true,
            includeRelationshipAnalysis: true
          }),
          token
        );

        assert.ok(reportResult);
        const reportText = reportResult.content[0].value;
        assert.ok(reportText.length > 1000, 'Report should contain substantial content');
      });

      PerformanceTestUtils.assertExecutionTime(
        executionTime, 
        reportTimeLimit, 
        `Large dataset report generation (${entityCount} entities, ${relationshipCount} relationships)`
      );

      console.log(`✅ Large dataset report test: Generated report for ${entityCount} entities and ${relationshipCount} relationships in ${executionTime.toFixed(2)}ms`);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain stability under continuous operation', async () => {
      const token = VSCodeMocks.createMockCancellationToken();
      const operationCycles = 20;
      const entitiesPerCycle = 25;

      console.log(`Starting stress test: ${operationCycles} cycles of ${entitiesPerCycle} entities each`);

      for (let cycle = 1; cycle <= operationCycles; cycle++) {
        // Initialize session for this cycle
        await (initializeTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            taskDescription: `Stress test cycle ${cycle}`
          }),
          token
        );

        // Add entities for this cycle
        for (let i = 1; i <= entitiesPerCycle; i++) {
          const result = await (addEntityTool as any).executeToolLogic(
            VSCodeMocks.createMockToolInvocationOptions({
              entity: {
                id: `StressEntity${cycle}_${i}`,
                type: 'Service',
                filePath: `/src/stress/cycle${cycle}/Entity${i}.ts`,
                businessContext: `Stress test entity ${i} in cycle ${cycle}`,
                chainContext: `Stress chain cycle ${cycle} entity ${i}`
              }
            }),
            token
          );

          assert.ok(result);
          const response = JSON.parse(result.content[0].value);
          assert.strictEqual(response.success, true, `Stress test failed at cycle ${cycle}, entity ${i}`);
        }

        // Generate report for this cycle
        const reportResult = await (reportTool as any).executeToolLogic(
          VSCodeMocks.createMockToolInvocationOptions({
            format: 'text'
          }),
          token
        );

        assert.ok(reportResult);
        
        // Clean up for next cycle
        context.globalState.update('currentSession', undefined);

        if (cycle % 5 === 0) {
          console.log(`Completed stress test cycle ${cycle}/${operationCycles}`);
        }
      }

      console.log(`✅ Stress test completed: ${operationCycles} cycles with ${entitiesPerCycle} entities each`);
    });
  });
});
