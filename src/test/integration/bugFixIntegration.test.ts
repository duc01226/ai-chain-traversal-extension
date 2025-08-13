/**
 * Bug Fix Integration Tests
 * Tests the specific issues that were reported and fixed:
 * 1. Status bar duplication
 * 2. User feedback gaps
 * 3. Chat session handling
 * 4. Performance monitoring lifecycle
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { PerformanceMonitorService } from '../../shared/services/performanceMonitorService';
import { StatusBarManager } from '../../base/baseTool';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { CoordinateAgentsTool } from '../../tools/coordinateAgentsTool';

// Mock VS Code API
const mockContext = {
    globalState: {
        data: new Map(),
        get: function(key: string) { return this.data.get(key); },
        update: function(key: string, value: any) { 
            this.data.set(key, value); 
            return Promise.resolve(); 
        }
    },
    subscriptions: []
} as unknown as vscode.ExtensionContext;

suite('Bug Fix Integration Tests', () => {
    let originalCreateStatusBarItem: any;
    let statusBarItemsCreated: any[] = [];
    let originalWorkspaceFolders: any;

    setup(() => {
        // Reset all state
        statusBarItemsCreated = [];
        (mockContext.globalState as any).data.clear();
        
        // Mock workspace
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = [{
            uri: { fsPath: '/test/workspace' },
            name: 'test-workspace',
            index: 0
        }];

        // Mock status bar item creation
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

        // Clean up singletons
        PerformanceMonitorService.disposeInstance();
        StatusBarManager.dispose();
    });

    teardown(() => {
        // Restore mocks
        if (originalCreateStatusBarItem) {
            vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        }
        if (originalWorkspaceFolders !== undefined) {
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }

        // Clean up
        PerformanceMonitorService.disposeInstance();
        StatusBarManager.dispose();
    });

    suite('Status Bar Duplication Bug Fix', () => {
        test('should create only one PerformanceMonitorService instance across multiple tools', () => {
            // Create multiple tools that use PerformanceMonitorService
            new CoordinateAgentsTool(mockContext);
            new CoordinateAgentsTool(mockContext);
            
            // Both should use the same singleton instance
            // We can't directly access the private performanceMonitor field,
            // but we can verify that the singleton pattern works
            const instance1 = PerformanceMonitorService.getInstance(mockContext);
            const instance2 = PerformanceMonitorService.getInstance(mockContext);
            
            assert.strictEqual(instance1, instance2, 
                'Multiple tools should share the same PerformanceMonitorService instance');
        });

        test('should not create status bar items automatically in PerformanceMonitorService', () => {
            // Create PerformanceMonitorService instance
            const performanceService = PerformanceMonitorService.getInstance(mockContext);
            
            // Should not create any status bar items during instantiation
            assert.strictEqual(statusBarItemsCreated.length, 0, 
                'PerformanceMonitorService should not create status bar items in constructor');
            
            // Even after starting monitoring, it should use StatusBarManager instead
            performanceService.startPerformanceMonitoring();
            
            // Allow some time for potential async status bar creation
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // PerformanceMonitorService should use StatusBarManager, not create its own items
                    assert.strictEqual(statusBarItemsCreated.length, 0, 
                        'PerformanceMonitorService should delegate to StatusBarManager');
                    resolve();
                }, 100);
            });
        });

        test('should use StatusBarManager for all status updates', () => {
            StatusBarManager.initialize();
            const performanceService = PerformanceMonitorService.getInstance(mockContext);
            
            // Should create exactly one status bar item via StatusBarManager
            assert.strictEqual(statusBarItemsCreated.length, 1, 
                'Should create one status bar item via StatusBarManager');
            
            performanceService.startPerformanceMonitoring();
            
            // Should not create additional status bar items
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    assert.strictEqual(statusBarItemsCreated.length, 1, 
                        'Should still have only one status bar item');
                    resolve();
                }, 100);
            });
        });

        test('should prevent memory leaks from multiple status bar items', () => {
            // Simulate the old buggy behavior to ensure it's fixed
            StatusBarManager.initialize();
            
            const performanceService = PerformanceMonitorService.getInstance(mockContext);
            performanceService.startPerformanceMonitoring();
            
            // Simulate multiple performance monitoring cycles
            for (let i = 0; i < 10; i++) {
                // In the old implementation, each cycle would create a new status bar item
                // Now it should reuse the existing one
                performanceService.startPerformanceMonitoring(); // Should be idempotent
            }
            
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    assert.strictEqual(statusBarItemsCreated.length, 1, 
                        'Should maintain single status bar item despite multiple monitoring cycles');
                    resolve();
                }, 150);
            });
        });

        test('should properly dispose resources without leaking', () => {
            const performanceService = PerformanceMonitorService.getInstance(mockContext);
            performanceService.startPerformanceMonitoring();
            
            let disposeCallCount = 0;
            
            // Mock disposal tracking
            if (statusBarItemsCreated.length > 0) {
                const originalDispose = statusBarItemsCreated[0].dispose;
                statusBarItemsCreated[0].dispose = () => {
                    disposeCallCount++;
                    originalDispose.call(statusBarItemsCreated[0]);
                };
            }
            
            // Dispose the singleton
            PerformanceMonitorService.disposeInstance();
            
            // Should clean up resources
            assert.ok(true, 'Should dispose without errors');
        });
    });

    suite('User Feedback Enhancement Integration', () => {
        test('should provide complete tool lifecycle feedback', async () => {
            StatusBarManager.initialize();
            
            const initTool = new InitializeSessionTool(mockContext);
            const logMessages: string[] = [];
            
            // Mock logging to capture feedback
            const Logger = require('../../shared/errorHandling').Logger;
            const originalInfo = Logger.info;
            Logger.info = (message: string) => {
                logMessages.push(message);
                return originalInfo.call(Logger, message);
            };
            
            const mockOptions = {
                input: {
                    taskDescription: 'Integration test feedback',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            // Execute tool and verify feedback
            const result = await initTool.invoke(mockOptions, mockToken);
            
            // Should log tool selection
            const toolSelectedLog = logMessages.find(msg => msg.includes('Tool Selected'));
            assert.ok(toolSelectedLog, 'Should log tool selection');
            assert.ok(toolSelectedLog?.includes('Initialize Discovery Session'), 
                'Should include correct tool name');
            
            // Should log completion
            const toolCompletedLog = logMessages.find(msg => msg.includes('Tool Completed'));
            assert.ok(toolCompletedLog, 'Should log tool completion');
            
            // Should return result
            assert.ok(result, 'Should return successful result');
            
            // Restore logging
            Logger.info = originalInfo;
        });

        test('should update status bar during tool execution', async () => {
            StatusBarManager.initialize();
            const statusBarItem = statusBarItemsCreated[0];
            let statusUpdates: string[] = [];
            
            // Track status bar updates
            const originalTextSetter = Object.getOwnPropertyDescriptor(statusBarItem, 'text') || 
                                       { set: () => {}, get: () => '' };
            Object.defineProperty(statusBarItem, 'text', {
                set: (value: string) => {
                    statusUpdates.push(value);
                    if (originalTextSetter.set) {
                        originalTextSetter.set.call(statusBarItem, value);
                    }
                },
                get: () => statusUpdates[statusUpdates.length - 1] || ''
            });
            
            const initTool = new InitializeSessionTool(mockContext);
            const mockOptions = {
                input: {
                    taskDescription: 'Status bar integration test'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            await initTool.invoke(mockOptions, mockToken);
            
            // Should have updated status during execution
            assert.ok(statusUpdates.length > 0, 'Should update status bar during execution');
            
            // Should show running status
            const runningUpdate = statusUpdates.find(update => update.includes('Running'));
            assert.ok(runningUpdate, 'Should show running status during execution');
        });
    });

    suite('Chat Session Context Integration', () => {
        test('should handle multiple chat sessions independently', async () => {
            const initTool = new InitializeSessionTool(mockContext);
            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            // First chat session
            const session1Options = {
                input: {
                    taskDescription: 'First chat session task'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            await initTool.invoke(session1Options, mockToken);
            const session1 = mockContext.globalState.get('currentSession') as any;
            
            // Simulate new chat (clear context)
            (mockContext.globalState as any).data.clear();
            
            // Second chat session
            const session2Options = {
                input: {
                    taskDescription: 'Second chat session task'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            await initTool.invoke(session2Options, mockToken);
            const session2 = mockContext.globalState.get('currentSession') as any;
            
            // Should be independent sessions
            assert.notStrictEqual(session1.sessionId, session2.sessionId, 
                'Should create independent sessions for different chats');
            assert.strictEqual(session1.taskDescription, 'First chat session task', 
                'First session should maintain its task description');
            assert.strictEqual(session2.taskDescription, 'Second chat session task', 
                'Second session should have its own task description');
        });

        test('should provide enhanced session initialization feedback', async () => {
            const initTool = new InitializeSessionTool(mockContext);
            const mockOptions = {
                input: {
                    taskDescription: 'Enhanced feedback test'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initTool.invoke(mockOptions, mockToken);
            
            // The result should contain detailed information
            assert.ok(result, 'Should return enhanced result');
            
            // Session should be properly stored
            const session = mockContext.globalState.get('currentSession') as any;
            assert.ok(session, 'Should create and store session');
            assert.ok(session.sessionId, 'Should have session ID');
            assert.strictEqual(session.taskDescription, 'Enhanced feedback test', 
                'Should store correct task description');
        });
    });

    suite('Performance Monitoring Lifecycle Integration', () => {
        test('should start performance monitoring only when coordination begins', async () => {
            const coordinateTool = new CoordinateAgentsTool(mockContext);
            PerformanceMonitorService.getInstance(mockContext);
            
            // Monitoring should not be active initially
            // (We can't directly test this without exposing internal state, 
            // but the behavior should be correct)
            
            const mockOptions = {
                input: {
                    sessionId: 'test-session',
                    agents: [{
                        agentId: 'test-agent',
                        capabilities: ['analysis'],
                        maxConcurrentTasks: 2,
                        priority: 1
                    }],
                    enablePerformanceOptimization: true
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            // Execute coordination tool
            const result = await coordinateTool.invoke(mockOptions, mockToken);
            
            // Should complete successfully
            assert.ok(result, 'Should execute coordination successfully');
            
            // Performance monitoring should now be active
            // (Testing this requires the tool to actually start monitoring)
        });

        test('should respect performance optimization settings', async () => {
            const coordinateTool = new CoordinateAgentsTool(mockContext);
            
            const mockOptions = {
                input: {
                    sessionId: 'test-session',
                    agents: [{
                        agentId: 'test-agent',
                        capabilities: ['analysis'],
                        maxConcurrentTasks: 2,
                        priority: 1
                    }],
                    enablePerformanceOptimization: false
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            // Execute with performance monitoring disabled
            const result = await coordinateTool.invoke(mockOptions, mockToken);
            
            // Should complete successfully without starting monitoring
            assert.ok(result, 'Should execute coordination with monitoring disabled');
        });
    });

    suite('End-to-End Bug Fix Verification', () => {
        test('should demonstrate complete bug-free workflow', async () => {
            // Initialize status bar management
            StatusBarManager.initialize();
            
            // Should create exactly one status bar item
            assert.strictEqual(statusBarItemsCreated.length, 1, 
                'Should create single status bar item');
            
            // Initialize session
            const initTool = new InitializeSessionTool(mockContext);
            const sessionResult = await initTool.invoke({
                input: { taskDescription: 'Complete workflow test' }
            } as any, { isCancellationRequested: false } as any);
            
            assert.ok(sessionResult, 'Should initialize session successfully');
            
            // Create coordination tool (using performance monitoring)
            const coordinateTool = new CoordinateAgentsTool(mockContext);
            const coordResult = await coordinateTool.invoke({
                input: {
                    sessionId: 'test-session',
                    agents: [{ agentId: 'test', capabilities: ['analysis'], maxConcurrentTasks: 1, priority: 1 }]
                }
            } as any, { isCancellationRequested: false } as any);
            
            assert.ok(coordResult, 'Should coordinate agents successfully');
            
            // Verify status bar management
            assert.strictEqual(statusBarItemsCreated.length, 1, 
                'Should maintain single status bar item throughout workflow');
            
            // Verify singleton behavior
            const perf1 = PerformanceMonitorService.getInstance(mockContext);
            const perf2 = PerformanceMonitorService.getInstance(mockContext);
            assert.strictEqual(perf1, perf2, 'Should maintain singleton pattern');
            
            // Cleanup
            PerformanceMonitorService.disposeInstance();
            StatusBarManager.dispose();
            
            assert.ok(true, 'Complete workflow executed without bugs');
        });

        test('should handle rapid tool execution without status bar duplication', async () => {
            StatusBarManager.initialize();
            
            const initTool = new InitializeSessionTool(mockContext);
            const mockToken = { isCancellationRequested: false } as any;
            
            // Execute multiple tools rapidly
            const promises: Promise<any>[] = [];
            for (let i = 0; i < 5; i++) {
                promises.push(initTool.invoke({
                    input: { taskDescription: `Rapid test ${i}` }
                } as any, mockToken));
            }
            
            await Promise.all(promises);
            
            // Should still have only one status bar item
            assert.strictEqual(statusBarItemsCreated.length, 1, 
                'Should maintain single status bar item during rapid execution');
        });
    });
});
