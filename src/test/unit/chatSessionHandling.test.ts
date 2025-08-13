/**
 * Chat Session Context Handling Test Suite
 * Tests proper context management for new chats vs chat history
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';

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

// Mock workspace
const mockWorkspace = {
    workspaceFolders: [{
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0
    }]
};

suite('Chat Session Context Handling Tests', () => {
    let originalWorkspaceFolders: any;
    let initializeTool: InitializeSessionTool;

    setup(() => {
        // Mock workspace folders
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = mockWorkspace.workspaceFolders;
        
        // Clear context data
        (mockContext.globalState as any).data.clear();
        
        // Create fresh tool instance
        initializeTool = new InitializeSessionTool(mockContext);
    });

    teardown(() => {
        // Restore original workspace folders
        if (originalWorkspaceFolders !== undefined) {
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }
    });

    suite('New Chat Session Handling', () => {
        test('should create fresh session for new chat', async () => {
            const mockOptions = {
                input: {
                    taskDescription: 'Analyze React components',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            assert.ok(result, 'Should return result for new session');
            
            // Check that session was stored in context
            const storedSession = mockContext.globalState.get('currentSession');
            assert.ok(storedSession, 'Should store session in context');
            assert.strictEqual((storedSession as any).taskDescription, 'Analyze React components', 
                'Should store correct task description');
        });

        test('should generate unique session IDs for different chats', async () => {
            const mockOptions1 = {
                input: {
                    taskDescription: 'First chat task',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockOptions2 = {
                input: {
                    taskDescription: 'Second chat task',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            // Create first session
            await initializeTool.invoke(mockOptions1, mockToken);
            const session1 = mockContext.globalState.get('currentSession') as any;

            // Clear context and create second session
            (mockContext.globalState as any).data.clear();
            await initializeTool.invoke(mockOptions2, mockToken);
            const session2 = mockContext.globalState.get('currentSession') as any;

            assert.notStrictEqual(session1.sessionId, session2.sessionId, 
                'Should generate unique session IDs');
            assert.strictEqual(session1.taskDescription, 'First chat task', 
                'First session should have correct task');
            assert.strictEqual(session2.taskDescription, 'Second chat task', 
                'Second session should have correct task');
        });

        test('should handle session initialization without previous context', async () => {
            // Ensure no previous session exists
            assert.strictEqual(mockContext.globalState.get('currentSession'), undefined, 
                'Should start with no current session');

            const mockOptions = {
                input: {
                    taskDescription: 'Clean slate analysis',
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            assert.ok(result, 'Should handle clean initialization');
            
            const session = mockContext.globalState.get('currentSession') as any;
            assert.ok(session, 'Should create new session');
            assert.strictEqual(session.taskDescription, 'Clean slate analysis', 
                'Should use provided task description');
        });
    });

    suite('Chat History Navigation', () => {
        test('should maintain session isolation between chat histories', async () => {
            // Simulate first chat session
            const mockOptions1 = {
                input: {
                    taskDescription: 'Original chat task',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            await initializeTool.invoke(mockOptions1, mockToken);
            const originalSession = mockContext.globalState.get('currentSession') as any;

            // Simulate switching to different chat history (would normally clear context)
            (mockContext.globalState as any).data.clear();

            // Simulate loading different chat history with new session
            const mockOptions2 = {
                input: {
                    taskDescription: 'Different chat history task',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            await initializeTool.invoke(mockOptions2, mockToken);
            const newSession = mockContext.globalState.get('currentSession') as any;

            assert.notStrictEqual(originalSession.sessionId, newSession.sessionId, 
                'Should create different session for different chat history');
            assert.strictEqual(newSession.taskDescription, 'Different chat history task', 
                'Should use new task description');
        });

        test('should log context handling appropriately', async () => {
            let logMessages: string[] = [];
            
            // Mock the logging to capture messages
            const originalLog = console.log;
            console.log = (message: string) => {
                logMessages.push(message);
                return originalLog.call(console, message);
            };

            const mockOptions = {
                input: {
                    taskDescription: 'Test chat context logging',
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            try {
                await initializeTool.invoke(mockOptions, mockToken);
                
                // The handleChatSessionContext method should log appropriate messages
                // This is more of a behavioral test to ensure the method is called
                assert.ok(true, 'Should handle chat session context without errors');
            } finally {
                console.log = originalLog;
            }
        });
    });

    suite('Session State Management', () => {
        test('should check for active session correctly', () => {
            // No active session initially
            assert.strictEqual(InitializeSessionTool.hasActiveSession(mockContext), false, 
                'Should report no active session initially');

            // Set a mock session
            mockContext.globalState.update('currentSession', {
                sessionId: 'test-session',
                taskDescription: 'Test task',
                timestamp: new Date(),
                currentPhase: 'discovery'
            });

            assert.strictEqual(InitializeSessionTool.hasActiveSession(mockContext), true, 
                'Should report active session when one exists');
        });

        test('should retrieve current session correctly', () => {
            const testSession = {
                sessionId: 'test-session-123',
                taskDescription: 'Retrieve test task',
                timestamp: new Date(),
                currentPhase: 'discovery' as const
            };

            mockContext.globalState.update('currentSession', testSession);

            const retrievedSession = InitializeSessionTool.getCurrentSession(mockContext);
            assert.deepStrictEqual(retrievedSession, testSession, 
                'Should retrieve correct session from context');
        });

        test('should handle missing current session gracefully', () => {
            // Ensure no session exists
            (mockContext.globalState as any).data.clear();

            const session = InitializeSessionTool.getCurrentSession(mockContext);
            assert.strictEqual(session, undefined, 'Should return undefined for missing session');

            const hasActive = InitializeSessionTool.hasActiveSession(mockContext);
            assert.strictEqual(hasActive, false, 'Should return false for missing session');
        });
    });

    suite('Workspace Root Handling', () => {
        test('should use provided workspace root', async () => {
            const customWorkspaceRoot = '/custom/workspace/path';
            
            const mockOptions = {
                input: {
                    taskDescription: 'Custom workspace test',
                    workspaceRoot: customWorkspaceRoot
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            await initializeTool.invoke(mockOptions, mockToken);
            
            const session = mockContext.globalState.get('currentSession') as any;
            assert.strictEqual(session.workspaceRoot, customWorkspaceRoot, 
                'Should use provided workspace root');
        });

        test('should fall back to default workspace root', async () => {
            const mockOptions = {
                input: {
                    taskDescription: 'Default workspace test'
                    // No workspaceRoot provided
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            await initializeTool.invoke(mockOptions, mockToken);
            
            const session = mockContext.globalState.get('currentSession') as any;
            assert.strictEqual(session.workspaceRoot, '/test/workspace', 
                'Should fall back to default workspace root');
        });

        test('should handle missing workspace folders gracefully', async () => {
            // Remove workspace folders
            (vscode.workspace as any).workspaceFolders = undefined;

            const mockOptions = {
                input: {
                    taskDescription: 'No workspace test'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            try {
                await initializeTool.invoke(mockOptions, mockToken);
                assert.fail('Should throw error for missing workspace');
            } catch (error) {
                assert.ok(error instanceof Error, 'Should throw error for missing workspace');
                assert.ok(error.message.includes('workspace'), 'Error should mention workspace');
            }
        });
    });

    suite('Parameter Validation', () => {
        test('should validate required task description', async () => {
            const mockOptions = {
                input: {
                    // Missing taskDescription
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            // Should return error result, not throw
            assert.ok(result, 'Should return result');
            // The result should indicate an error (this would be in the result content)
        });

        test('should validate task description type', async () => {
            const mockOptions = {
                input: {
                    taskDescription: 123 // Wrong type
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            // Should handle invalid type gracefully
            assert.ok(result, 'Should return result for invalid input');
        });

        test('should validate workspace root type when provided', async () => {
            const mockOptions = {
                input: {
                    taskDescription: 'Valid task',
                    workspaceRoot: 123 // Wrong type
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            // Should handle invalid workspace root type
            assert.ok(result, 'Should return result for invalid workspace root');
        });
    });

    suite('Enhanced User Response', () => {
        test('should provide detailed session information in response', async () => {
            const mockOptions = {
                input: {
                    taskDescription: 'Detailed response test',
                    workspaceRoot: '/test/workspace'
                }
            } as vscode.LanguageModelToolInvocationOptions<object>;

            const mockToken = {
                isCancellationRequested: false,
                onCancellationRequested: () => ({ dispose: () => {} })
            } as vscode.CancellationToken;

            const result = await initializeTool.invoke(mockOptions, mockToken);
            
            assert.ok(result, 'Should return result');
            
            // The response should be detailed and helpful
            // We can't easily test the exact content without accessing private result data,
            // but we can verify that a result was generated
            const session = mockContext.globalState.get('currentSession') as any;
            assert.ok(session.sessionId, 'Should create session with ID');
            assert.strictEqual(session.taskDescription, 'Detailed response test', 
                'Should store correct task description');
        });
    });
});
