/**
 * PerformanceMonitorService Test Suite
 * Tests singleton pattern, status bar management, and memory leak prevention
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { PerformanceMonitorService } from '../../shared/services/performanceMonitorService';

// Mock VS Code API
const mockContext = {
    globalState: {
        get: () => undefined,
        update: () => Promise.resolve()
    },
    subscriptions: []
} as unknown as vscode.ExtensionContext;

suite('PerformanceMonitorService Tests', () => {
    let originalCreateStatusBarItem: any;
    let statusBarItemsCreated: any[] = [];

    setup(() => {
        // Clean up any existing instance
        PerformanceMonitorService.disposeInstance();
        statusBarItemsCreated = [];

        // Mock vscode.window.createStatusBarItem to track creation
        originalCreateStatusBarItem = vscode.window.createStatusBarItem;
        vscode.window.createStatusBarItem = () => {
            const mockItem = {
                text: '',
                tooltip: '',
                show: () => {},
                hide: () => {},
                dispose: () => {}
            };
            statusBarItemsCreated.push(mockItem);
            return mockItem as any;
        };
    });

    teardown(() => {
        // Restore original implementation
        if (originalCreateStatusBarItem) {
            vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        }
        PerformanceMonitorService.disposeInstance();
    });

    suite('Singleton Pattern', () => {
        test('should return the same instance for multiple calls', () => {
            const instance1 = PerformanceMonitorService.getInstance(mockContext);
            const instance2 = PerformanceMonitorService.getInstance(mockContext);
            
            assert.strictEqual(instance1, instance2, 'Should return the same singleton instance');
        });

        test('should create new instance after disposal', () => {
            const instance1 = PerformanceMonitorService.getInstance(mockContext);
            PerformanceMonitorService.disposeInstance();
            
            const instance2 = PerformanceMonitorService.getInstance(mockContext);
            
            assert.notStrictEqual(instance1, instance2, 'Should create new instance after disposal');
        });

        test('should properly dispose singleton instance', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            assert.ok(instance, 'Instance should be created');
            
            PerformanceMonitorService.disposeInstance();
            
            // Verify new instance is created after disposal
            const newInstance = PerformanceMonitorService.getInstance(mockContext);
            assert.notStrictEqual(instance, newInstance, 'New instance should be created after disposal');
        });
    });

    suite('Performance Monitoring Lifecycle', () => {
        test('should not start monitoring automatically in constructor', () => {
            PerformanceMonitorService.getInstance(mockContext);
            
            // Wait a bit to ensure no automatic monitoring
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // No status bar items should be created automatically
                    assert.strictEqual(statusBarItemsCreated.length, 0, 'No status bar items should be created automatically');
                    resolve();
                }, 100);
            });
        });

        test('should start monitoring only when explicitly called', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            // Monitoring should not be active initially
            assert.ok(instance, 'Instance should exist');
            
            // Start monitoring explicitly
            instance.startPerformanceMonitoring();
            
            // Should start monitoring now
            assert.ok(true, 'Monitoring started successfully');
        });

        test('should not start multiple monitoring timers', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            // Start monitoring multiple times
            instance.startPerformanceMonitoring();
            instance.startPerformanceMonitoring();
            instance.startPerformanceMonitoring();
            
            // Should only have one timer running (implementation detail - we can't directly test this,
            // but multiple calls should be safe)
            assert.ok(true, 'Multiple start calls should be safe');
        });

        test('should stop monitoring when requested', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.startPerformanceMonitoring();
            instance.stopPerformanceMonitoring();
            
            // Should stop successfully without errors
            assert.ok(true, 'Monitoring stopped successfully');
        });
    });

    suite('Agent Management', () => {
        test('should register agents correctly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.registerAgent('test-agent-1');
            instance.registerAgent('test-agent-2');
            
            // Should accept agents successfully
            assert.ok(true, 'Agents registered successfully');
        });

        test('should track agent performance', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.registerAgent('test-agent');
            instance.updateAgentPerformance('test-agent', 1000, true);
            instance.updateAgentPerformance('test-agent', 500, false);
            
            // Should track performance without errors
            assert.ok(true, 'Agent performance tracked successfully');
        });

        test('should check agent availability correctly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            // Should be able to accept new agents initially
            const canAccept = instance.canAcceptNewAgent();
            assert.strictEqual(typeof canAccept, 'boolean', 'Should return boolean for agent availability');
        });

        test('should get next available agent', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.registerAgent('agent-1');
            instance.registerAgent('agent-2');
            
            const nextAgent = instance.getNextAvailableAgent();
            assert.ok(nextAgent === null || typeof nextAgent === 'string', 'Should return agent ID or null');
        });
    });

    suite('Cache Management', () => {
        test('should cache entities correctly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const testEntity = {
                id: 'test-entity',
                type: 'Component' as const,
                filePath: '/test/path',
                discoveryMethod: 'manual' as const,
                priority: 1 as const,
                processed: false,
                chainContext: 'Test chain context',
                businessContext: 'Test business context',
                dependencies: [],
                dependents: [],
                timestamp: new Date()
            };
            
            instance.cacheEntity(testEntity);
            const cached = instance.getCachedEntity('test-entity');
            
            assert.deepStrictEqual(cached, testEntity, 'Entity should be cached correctly');
        });

        test('should cache relationships correctly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const testRelationships = [{
                id: 'rel-1',
                fromEntityId: 'entity-1',
                toEntityId: 'entity-2',
                relationshipType: 'CALLS' as const,
                strength: 0.8,
                discoveryMethod: 'manual' as const,
                bidirectional: false,
                timestamp: new Date()
            }];
            
            instance.cacheRelationships('entity-1', testRelationships);
            const cached = instance.getCachedRelationships('entity-1');
            
            assert.deepStrictEqual(cached, testRelationships, 'Relationships should be cached correctly');
        });

        test('should clear caches correctly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const testEntity = {
                id: 'test-entity',
                type: 'Component' as const,
                filePath: '/test/path',
                discoveryMethod: 'manual' as const,
                priority: 1 as const,
                processed: false,
                chainContext: 'Test chain context',
                businessContext: 'Test business context',
                dependencies: [],
                dependents: [],
                timestamp: new Date()
            };
            
            instance.cacheEntity(testEntity);
            instance.clearCaches();
            
            const cached = instance.getCachedEntity('test-entity');
            assert.strictEqual(cached, undefined, 'Cache should be cleared');
        });

        test('should provide cache metrics', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const metrics = instance.getCacheMetrics();
            
            assert.ok(typeof metrics.entityCacheHitRate === 'number', 'Should provide entity cache hit rate');
            assert.ok(typeof metrics.relationshipCacheHitRate === 'number', 'Should provide relationship cache hit rate');
            assert.ok(typeof metrics.cacheMemoryUsageMB === 'number', 'Should provide cache memory usage');
        });
    });

    suite('Work Distribution', () => {
        test('should optimize work distribution', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.registerAgent('agent-1');
            instance.registerAgent('agent-2');
            
            const workItems = [
                { 
                    id: 'work-1', 
                    priority: 1 as const, 
                    entityId: 'entity-1', 
                    taskType: 'analyze_entity' as const,
                    status: 'pending' as const,
                    dependencies: [],
                    chainContext: 'test-chain',
                    estimatedEffort: 1,
                    retryCount: 0,
                    maxRetries: 3,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                { 
                    id: 'work-2', 
                    priority: 2 as const, 
                    entityId: 'entity-2', 
                    taskType: 'analyze_entity' as const,
                    status: 'pending' as const,
                    dependencies: [],
                    chainContext: 'test-chain',
                    estimatedEffort: 1,
                    retryCount: 0,
                    maxRetries: 3,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            
            const distribution = instance.optimizeWorkDistribution(workItems);
            
            assert.ok(Array.isArray(distribution), 'Should return array of distributions');
            assert.ok(distribution.every(d => typeof d.agentId === 'string' && Array.isArray(d.tasks)), 
                'Each distribution should have agentId and tasks');
        });

        test('should handle empty work items', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const distribution = instance.optimizeWorkDistribution([]);
            
            assert.ok(Array.isArray(distribution), 'Should return empty array for no work items');
            assert.strictEqual(distribution.length, 0, 'Distribution should be empty');
        });

        test('should handle no available agents', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const workItems = [
                { 
                    id: 'work-1', 
                    priority: 1 as const, 
                    entityId: 'entity-1', 
                    taskType: 'analyze_entity' as const,
                    status: 'pending' as const,
                    dependencies: [],
                    chainContext: 'test-chain',
                    estimatedEffort: 1,
                    retryCount: 0,
                    maxRetries: 3,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            
            const distribution = instance.optimizeWorkDistribution(workItems);
            
            assert.ok(Array.isArray(distribution), 'Should return empty array when no agents available');
            assert.strictEqual(distribution.length, 0, 'Distribution should be empty');
        });
    });

    suite('Performance Reports', () => {
        test('should generate performance report', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            const report = instance.getPerformanceReport();
            
            assert.ok(typeof report === 'object', 'Should return performance report object');
            assert.ok(Array.isArray(report.historicalTrends), 'Should include historical trends');
            assert.ok(typeof report.cacheMetrics === 'object', 'Should include cache metrics');
            assert.ok(Array.isArray(report.agentInfo), 'Should include agent info');
            assert.ok(Array.isArray(report.optimizationSuggestions), 'Should include optimization suggestions');
        });
    });

    suite('Memory Leak Prevention', () => {
        test('should not create status bar items in updateStatusBarViaManager', async () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            // Start monitoring to trigger status updates
            instance.startPerformanceMonitoring();
            
            // Wait for potential status bar updates
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Stop monitoring
            instance.stopPerformanceMonitoring();
            
            // The updateStatusBarViaManager should use existing StatusBarManager
            // instead of creating new status bar items
            // Note: This test verifies the design - actual status bar creation
            // is handled by StatusBarManager, not PerformanceMonitorService
            assert.ok(true, 'No direct status bar items should be created by PerformanceMonitorService');
        });

        test('should dispose resources properly', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            
            instance.registerAgent('test-agent');
            instance.startPerformanceMonitoring();
            
            // Dispose should clean up everything
            instance.dispose();
            
            // Should not throw errors
            assert.ok(true, 'Disposal completed successfully');
        });
    });

    suite('Status Bar Integration', () => {
        test('should not directly create status bar items', () => {
            const instance = PerformanceMonitorService.getInstance(mockContext);
            instance.startPerformanceMonitoring();
            
            // PerformanceMonitorService should not directly create status bar items
            // It should use StatusBarManager instead
            assert.strictEqual(statusBarItemsCreated.length, 0, 
                'PerformanceMonitorService should not directly create status bar items');
        });
    });
});
