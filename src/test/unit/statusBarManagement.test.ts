/**
 * Status Bar Management and User Feedback Test Suite
 * Tests the singleton status bar management and user feedback improvements
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { StatusBarManager, BaseTool } from '../../base/baseTool';

// Mock VS Code API
const mockContext = {
    globalState: {
        get: () => undefined,
        update: () => Promise.resolve()
    },
    subscriptions: []
} as unknown as vscode.ExtensionContext;

// Mock tool for testing BaseTool feedback
class MockTool extends BaseTool {
    public readonly name = 'test-tool';
    
    protected getDisplayName(): string {
        return 'Mock Test Tool';
    }
    
    protected async executeToolLogic(
        _options: vscode.LanguageModelToolInvocationOptions<object>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return this.createSuccessResult('Test completed successfully');
    }
    
    // Make protected methods public for testing
    public testNotifyToolStart() {
        return (this as any).notifyToolStart();
    }
    
    public testNotifyToolComplete(duration: number) {
        return (this as any).notifyToolComplete(duration);
    }
    
    public testNotifyToolError(error: unknown) {
        return (this as any).notifyToolError(error);
    }
}

suite('Status Bar Management Tests', () => {
    let originalCreateStatusBarItem: any;
    let statusBarItemsCreated: any[] = [];
    let lastStatusBarItem: any;

    setup(() => {
        statusBarItemsCreated = [];
        lastStatusBarItem = undefined;

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
            lastStatusBarItem = mockItem;
            return mockItem as any;
        };

        // Dispose any existing status bar manager
        StatusBarManager.dispose();
    });

    teardown(() => {
        // Restore original implementation
        if (originalCreateStatusBarItem) {
            vscode.window.createStatusBarItem = originalCreateStatusBarItem;
        }
        StatusBarManager.dispose();
    });

    suite('StatusBarManager Singleton', () => {
        test('should create only one status bar item', () => {
            StatusBarManager.initialize();
            
            assert.strictEqual(statusBarItemsCreated.length, 1, 'Should create exactly one status bar item');
        });

        test('should not create additional items on multiple initialize calls', () => {
            StatusBarManager.initialize();
            StatusBarManager.initialize();
            StatusBarManager.initialize();
            
            assert.strictEqual(statusBarItemsCreated.length, 1, 'Should still have only one status bar item');
        });

        test('should update existing status bar item', () => {
            StatusBarManager.initialize();
            
            const initialItem = lastStatusBarItem;
            StatusBarManager.updateStatus('Test Status', 'Test Tooltip');
            
            assert.strictEqual(lastStatusBarItem, initialItem, 'Should reuse the same status bar item');
            assert.strictEqual(statusBarItemsCreated.length, 1, 'Should not create new status bar items');
        });

        test('should set correct initial status', () => {
            StatusBarManager.initialize();
            
            assert.ok(lastStatusBarItem, 'Status bar item should be created');
            assert.ok(lastStatusBarItem.text.includes('Chain Traversal'), 'Should have correct initial text');
        });

        test('should handle status updates correctly', () => {
            StatusBarManager.initialize();
            
            StatusBarManager.updateStatus('Running Tool', 'Tool is processing');
            assert.ok(lastStatusBarItem.text.includes('Running Tool'), 'Should update text correctly');
            
            StatusBarManager.showProgress('Processing...');
            assert.ok(lastStatusBarItem.text.includes('Processing'), 'Should show progress correctly');
        });

        test('should reset status after completion', (done) => {
            StatusBarManager.initialize();
            
            StatusBarManager.showComplete('Test Complete');
            
            // Check that it resets after timeout
            setTimeout(() => {
                assert.ok(lastStatusBarItem.text.includes('Ready'), 'Should reset to ready status');
                done();
            }, 3100); // Slightly more than the 3 second timeout
        });

        test('should reset status after error', (done) => {
            StatusBarManager.initialize();
            
            StatusBarManager.showError('Test Error');
            
            // Check that it resets after timeout
            setTimeout(() => {
                assert.ok(lastStatusBarItem.text.includes('Ready'), 'Should reset to ready status after error');
                done();
            }, 5100); // Slightly more than the 5 second timeout
        });

        test('should dispose status bar item correctly', () => {
            StatusBarManager.initialize();
            let disposeCalled = false;
            
            if (lastStatusBarItem) {
                const originalDispose = lastStatusBarItem.dispose;
                lastStatusBarItem.dispose = () => {
                    disposeCalled = true;
                    originalDispose.call(lastStatusBarItem);
                };
            }
            
            StatusBarManager.dispose();
            
            assert.ok(disposeCalled, 'Should call dispose on status bar item');
        });
    });

    suite('Tool User Feedback', () => {
        let mockTool: MockTool;
        let logMessages: string[] = [];

        setup(() => {
            mockTool = new MockTool(mockContext);
            logMessages = [];
            
            // Mock Logger to capture log messages
            const Logger = require('../../shared/errorHandling').Logger;
            const originalInfo = Logger.info;
            Logger.info = (message: string) => {
                logMessages.push(message);
                return originalInfo.call(Logger, message);
            };
        });

        test('should notify when tool starts', () => {
            StatusBarManager.initialize();
            
            mockTool.testNotifyToolStart();
            
            // Should log tool selection
            const startLog = logMessages.find(msg => msg.includes('Tool Selected'));
            assert.ok(startLog, 'Should log tool selection');
            assert.ok(startLog?.includes('Mock Test Tool'), 'Should include tool name in log');
            
            // Should update status bar
            assert.ok(lastStatusBarItem.text.includes('Running'), 'Should update status to running');
        });

        test('should notify when tool completes', () => {
            StatusBarManager.initialize();
            
            mockTool.testNotifyToolComplete(150);
            
            // Should log completion
            const completeLog = logMessages.find(msg => msg.includes('Tool Completed'));
            assert.ok(completeLog, 'Should log tool completion');
            assert.ok(completeLog?.includes('150ms'), 'Should include duration in log');
        });

        test('should notify when tool encounters error', () => {
            StatusBarManager.initialize();
            
            const testError = new Error('Test error message');
            mockTool.testNotifyToolError(testError);
            
            // Should log error
            const errorLog = logMessages.find(msg => msg.includes('Tool Failed'));
            assert.ok(errorLog, 'Should log tool failure');
            assert.ok(errorLog?.includes('Test error message'), 'Should include error message in log');
        });

        test('should provide feedback during tool execution', async () => {
            StatusBarManager.initialize();
            
            // Mock the tool invoke method to test full lifecycle
            const mockOptions = {
                input: { test: 'data' }
            } as vscode.LanguageModelToolInvocationOptions<object>;
            
            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;
            
            const result = await mockTool.invoke(mockOptions, mockToken);
            
            // Should have logged start and completion
            assert.ok(logMessages.some(msg => msg.includes('Tool Selected')), 'Should log tool start');
            assert.ok(logMessages.some(msg => msg.includes('Tool Completed')), 'Should log tool completion');
            
            // Should return successful result
            assert.ok(result, 'Should return result');
        });
    });

    suite('Status Bar Memory Leak Prevention', () => {
        test('should not create multiple status bar items over time', () => {
            StatusBarManager.initialize();
            
            // Simulate multiple status updates that could trigger item creation
            for (let i = 0; i < 10; i++) {
                StatusBarManager.updateStatus(`Status ${i}`, `Tooltip ${i}`);
                StatusBarManager.showProgress(`Progress ${i}`);
            }
            
            assert.strictEqual(statusBarItemsCreated.length, 1, 
                'Should never create more than one status bar item');
        });

        test('should reuse status bar item for all operations', () => {
            StatusBarManager.initialize();
            const originalItem = lastStatusBarItem;
            
            // Perform various operations
            StatusBarManager.updateStatus('Test 1', 'Tooltip 1');
            assert.strictEqual(lastStatusBarItem, originalItem, 'Should reuse item for update');
            
            StatusBarManager.showProgress('Progress');
            assert.strictEqual(lastStatusBarItem, originalItem, 'Should reuse item for progress');
            
            StatusBarManager.showComplete('Complete');
            assert.strictEqual(lastStatusBarItem, originalItem, 'Should reuse item for completion');
            
            StatusBarManager.showError('Error');
            assert.strictEqual(lastStatusBarItem, originalItem, 'Should reuse item for error');
        });

        test('should handle rapid status updates without creating new items', () => {
            StatusBarManager.initialize();
            
            // Simulate rapid updates that might happen during intensive operations
            const rapidUpdates = async () => {
                for (let i = 0; i < 100; i++) {
                    StatusBarManager.updateStatus(`Rapid ${i}`, `Processing ${i}`);
                    await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
                }
            };
            
            return rapidUpdates().then(() => {
                assert.strictEqual(statusBarItemsCreated.length, 1, 
                    'Should maintain single status bar item during rapid updates');
            });
        });
    });

    suite('Status Bar Initialization Behavior', () => {
        test('should show subtle initial status', () => {
            StatusBarManager.initialize();
            
            assert.ok(lastStatusBarItem, 'Should create status bar item');
            assert.ok(lastStatusBarItem.text.includes('Chain Traversal'), 'Should show extension name');
            assert.ok(!lastStatusBarItem.text.includes('Ready') || 
                     lastStatusBarItem.text === '$(graph) Chain Traversal', 
                     'Should not be overly verbose initially');
        });

        test('should provide helpful tooltip', () => {
            StatusBarManager.initialize();
            
            assert.ok(lastStatusBarItem.tooltip, 'Should have tooltip');
            assert.ok(lastStatusBarItem.tooltip.includes('Chain Traversal'), 'Tooltip should describe extension');
        });

        test('should be positioned correctly', () => {
            // The positioning is handled by VS Code, but we can verify our configuration
            StatusBarManager.initialize();
            
            assert.ok(statusBarItemsCreated.length > 0, 'Should create status bar item');
            // Actual positioning testing would require integration tests with real VS Code
        });
    });

    suite('Error Handling in Status Updates', () => {
        test('should handle missing status bar item gracefully', () => {
            // Don't initialize, so no status bar item exists
            
            // These should not throw errors
            assert.doesNotThrow(() => {
                StatusBarManager.updateStatus('Test', 'Test');
                StatusBarManager.showProgress('Test');
                StatusBarManager.showComplete('Test');
                StatusBarManager.showError('Test');
            }, 'Should handle missing status bar item gracefully');
        });

        test('should handle dispose when not initialized', () => {
            // Should not throw error when disposing uninitialized manager
            assert.doesNotThrow(() => {
                StatusBarManager.dispose();
            }, 'Should handle dispose when not initialized');
        });
    });
});
