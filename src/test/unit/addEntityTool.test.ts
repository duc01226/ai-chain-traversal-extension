/**
 * Unit Tests for AddEntityTool
 * Tests entity addition functionality with various scenarios
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { AddEntityTool } from '../../tools/addEntityTool';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { TOOL_NAMES } from '../../shared/constants';
import { TestDataFactory, VSCodeMocks, TestAssertions } from '../utils/testUtils';

suite('AddEntityTool Tests', () => {
  let context: vscode.ExtensionContext;
  let tool: AddEntityTool;
  let initializeTool: InitializeSessionTool;
  let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

  setup(() => {
    // Mock the VS Code workspace before creating the tool
    originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    const mockWorkspace = VSCodeMocks.mockWorkspace();
    
    // Override the workspace.workspaceFolders property
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: mockWorkspace.workspaceFolders,
      configurable: true
    });

    context = TestDataFactory.createMockContext();
    tool = new AddEntityTool(context);
    initializeTool = new InitializeSessionTool(context);
  });

  teardown(() => {
    // Cleanup any global state
    context.globalState.update('currentSession', undefined);
    context.globalState.update('discoveredEntities', undefined);
    
    // Restore original workspace folders
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: originalWorkspaceFolders,
      configurable: true
    });
  });

  test('should have correct tool name', () => {
    const expectedName = TOOL_NAMES.ADD_ENTITY;
    assert.strictEqual(tool.name, expectedName, `Tool name should be ${expectedName}`);
  });

  test('should add valid entity successfully', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - Using new simplified array interface
    const input = {
      entities: [{
        id: 'TestController',
        type: 'Controller',
        filePath: '/src/controllers/TestController.ts',
        businessContext: 'User management functionality',
        chainContext: 'HTTP request handling chain'
      }]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, token);

    // Assert
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('✅') || resultContent.includes('Successfully'), 'Result should indicate success');
    assert.ok(resultContent.includes('entities') || resultContent.includes('entity'), 'Result should mention entity processing');
    assert.ok(resultContent.includes('Controller'), 'Result should contain entity type');
  });

  test('should handle missing entity data', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - missing entities array (invalid input)
    const options = VSCodeMocks.createMockToolInvocationOptions({
      description: 'Some description without entities'
    });

    // Act
    const result = await tool.invoke(options, token);

    // Assert - Should return error result
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌') || resultContent.includes('error'), 'Result should contain error indicator');
    assert.ok(resultContent.includes('entities') || resultContent.includes('filePathsToExpand') || resultContent.includes('required'), 'Error should mention missing input parameters');
  });

  test('should handle invalid entity structure', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - invalid entity structure (missing required fields)
    const input = {
      entities: [{
        // Missing required fields like id, type, businessContext, chainContext
        filePath: '/some/path.ts'
      }]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, token);

    // Assert - Should return error result
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌') || resultContent.includes('error'), 'Result should contain error indicator');
  });

  test('should handle adding entity without active session', async () => {
    // Don't initialize session - test without active session
    
    // Arrange - Using new simplified array interface
    const input = {
      entities: [{
        id: 'TestController',
        type: 'Controller',
        filePath: '/src/controllers/TestController.ts',
        businessContext: 'User management',
        chainContext: 'HTTP request handling'
      }]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);
    const token = VSCodeMocks.createMockCancellationToken();

    // Act
    const result = await tool.invoke(options, token);

    // Assert - Should return error result about no active session
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌') || resultContent.includes('error'), 'Result should contain error indicator');
    assert.ok(resultContent.includes('session'), 'Error should mention session requirement');
  });

  test('should handle cancellation token', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const normalToken = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, normalToken);

    // Arrange - Using new simplified array interface
    const input = {
      entities: [{
        id: 'TestController',
        type: 'Controller',
        filePath: '/src/controllers/TestController.ts',
        businessContext: 'User management',
        chainContext: 'HTTP request handling'
      }]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);
    const cancelledToken = VSCodeMocks.createMockCancellationToken(true);

    // Act
    const result = await tool.invoke(options, cancelledToken);

    // Assert - Should return error result for cancellation
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌') || resultContent.includes('error'), 'Result should contain error indicator');
    assert.ok(resultContent.includes('cancel'), 'Error should mention cancellation');
  });

  test('should handle duplicate entity addition', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - Add entity using new simplified array interface
    const input = {
      entities: [{
        id: 'TestController',
        type: 'Controller',
        filePath: '/src/controllers/TestController.ts',
        businessContext: 'User management functionality',
        chainContext: 'HTTP request handling chain'
      }]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act - Add entity twice
    const result1 = await tool.invoke(options, token);
    const result2 = await tool.invoke(options, token);

    // Assert
    TestAssertions.assertValidToolResult(result1);
    TestAssertions.assertValidToolResult(result2);
    
    const content1 = (result1.content[0] as vscode.LanguageModelTextPart).value;
    const content2 = (result2.content[0] as vscode.LanguageModelTextPart).value;
    
    // Both results should handle the entity (either succeed or handle duplicate appropriately)
    assert.ok(content1.includes('✅') || content1.includes('Successfully'), 'First result should indicate processing success');
    assert.ok(content2.includes('✅') || content2.includes('Successfully') || content2.includes('duplicate'), 'Second result should handle entity processing');
  });

  test('should handle batch entity addition', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for batch entity addition'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - Add multiple entities at once
    const input = {
      entities: [
        {
          id: 'UserController',
          type: 'Controller',
          filePath: '/src/controllers/UserController.ts',
          businessContext: 'User management',
          chainContext: 'User API endpoints'
        },
        {
          id: 'UserService',
          type: 'Service',
          filePath: '/src/services/UserService.ts',
          businessContext: 'User management',
          chainContext: 'User business logic'
        },
        {
          id: 'UserModel',
          type: 'Model',
          filePath: '/src/models/User.ts',
          businessContext: 'User management',
          chainContext: 'User data structure'
        }
      ]
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, token);

    // Assert
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('3') || resultContent.includes('entities'), 'Result should mention processing multiple entities');
    assert.ok(resultContent.includes('✅') || resultContent.includes('Successfully'), 'Result should indicate success');
  });

  test('should handle file expansion mode', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for file expansion'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - File expansion input
    const input = {
      filePathsToExpand: [
        '/src/controllers/UserController.ts',
        '/src/services/UserService.ts',
        '/src/models/User.ts'
      ],
      expansionContext: {
        businessDomain: 'user management system',
        analysisGoal: 'map user authentication flow',
        entityTypeFocus: ['Controller', 'Service', 'Model']
      }
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, token);

    // Assert
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('✅') || resultContent.includes('Successfully'), 'Result should indicate success');
    // Should have processed the files and created entities
    assert.ok(resultContent.includes('entities') || resultContent.includes('entity') || resultContent.includes('added'), 'Result should mention entity processing');
  });

  test('should handle empty entities array', async () => {
    // First initialize a session
    const sessionInput = {
      taskDescription: 'Test session for empty entities'
    };
    const sessionOptions = VSCodeMocks.createMockToolInvocationOptions(sessionInput);
    const token = VSCodeMocks.createMockCancellationToken();
    await initializeTool.invoke(sessionOptions, token);

    // Arrange - Empty entities array
    const input = {
      entities: []
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, token);

    // Assert - Should return error result
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌') || resultContent.includes('error'), 'Result should contain error indicator');
    assert.ok(resultContent.includes('empty') || resultContent.includes('non-empty') || resultContent.includes('array'), 'Error should mention empty array issue');
  });
});
