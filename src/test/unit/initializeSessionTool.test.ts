import * as assert from 'assert';
import * as vscode from 'vscode';
import { InitializeSessionTool } from '../../tools/initializeSessionTool';
import { TOOL_NAMES } from '../../shared/constants';
import { TestDataFactory, VSCodeMocks, TestAssertions } from '../utils/testUtils';

suite('InitializeSessionTool Tests', () => {
  let tool: InitializeSessionTool;
  let mockContext: vscode.ExtensionContext;
  let mockCancellationToken: vscode.CancellationToken;
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

    mockContext = TestDataFactory.createMockContext();
    tool = new InitializeSessionTool(mockContext);
    mockCancellationToken = VSCodeMocks.createMockCancellationToken();
  });

  teardown(() => {
    // Restore original workspace folders
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: originalWorkspaceFolders,
      configurable: true
    });
  });

  test('should have correct tool name', () => {
    // Test display name matches expected constant
    const expectedName = TOOL_NAMES.INITIALIZE_SESSION;
    assert.strictEqual(tool.name, expectedName, `Tool name should be ${expectedName}`);
  });

  test('should initialize session with valid parameters', async () => {
    // Arrange
    const taskDescription = 'Test task description';
    const workspaceRoot = '/test/workspace';
    const input = {
      taskDescription,
      workspaceRoot
    };
    const options = VSCodeMocks.createMockToolInvocationOptions(input);

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert
    TestAssertions.assertValidToolResult(result);
    
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('sessionId'), 'Result should contain sessionId');
    assert.ok(resultContent.includes(taskDescription), 'Result should contain task description');
    assert.ok(resultContent.includes(workspaceRoot), 'Result should contain workspace root');
  });

  test('should handle missing required parameters', async () => {
    // Arrange - missing taskDescription
    const options = VSCodeMocks.createMockToolInvocationOptions({
      workspaceRoot: '/test/workspace'
    });

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert - Should return error result, not throw
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    const parsedResult = JSON.parse(resultContent);
    assert.strictEqual(parsedResult.success, false, 'Result should indicate failure');
    assert.ok(parsedResult.error.includes('taskDescription'), 'Error should mention missing taskDescription');
  });

  test('should handle invalid parameter types', async () => {
    // Arrange - invalid parameter types
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription: 123, // Invalid type
      workspaceRoot: '/test/workspace'
    });

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert - Should return error result, not throw
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    const parsedResult = JSON.parse(resultContent);
    assert.strictEqual(parsedResult.success, false, 'Result should indicate failure');
    assert.ok(parsedResult.error.includes('string'), 'Error should mention expected string type');
  });

  test('should handle empty task description', async () => {
    // Arrange
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription: '', // Empty string
      workspaceRoot: '/test/workspace'
    });

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert - Should return error result, not throw
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    const parsedResult = JSON.parse(resultContent);
    assert.strictEqual(parsedResult.success, false, 'Result should indicate failure');
    assert.ok(parsedResult.error.includes('non-empty'), 'Error should mention non-empty requirement');
  });

  test('should generate unique session IDs', async () => {
    // Arrange
    const taskDescription = 'Test task';
    const workspaceRoot = '/test/workspace';
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription,
      workspaceRoot
    });

    // Act - invoke tool multiple times
    const result1 = await tool.invoke(options, mockCancellationToken);
    const result2 = await tool.invoke(options, mockCancellationToken);

    // Assert
    const content1 = (result1.content[0] as vscode.LanguageModelTextPart).value;
    const content2 = (result2.content[0] as vscode.LanguageModelTextPart).value;
    
    // Extract session IDs from results (assuming they're in JSON format)
    const sessionIdMatch1 = content1.match(/"sessionId":\s*"([^"]+)"/);
    const sessionIdMatch2 = content2.match(/"sessionId":\s*"([^"]+)"/);
    
    assert.ok(sessionIdMatch1, 'Should find sessionId in first result');
    assert.ok(sessionIdMatch2, 'Should find sessionId in second result');
    assert.notStrictEqual(sessionIdMatch1[1], sessionIdMatch2[1], 'Session IDs should be unique');
  });

  test('should use default workspace root when not provided', async () => {
    // Arrange
    const taskDescription = 'Test task description';
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription
      // workspaceRoot not provided
    });

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert
    TestAssertions.assertValidToolResult(result);
    
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('workspaceRoot'), 'Result should contain default workspace root');
  });

  test('should handle cancellation token', async () => {
    // Arrange
    const cancelledToken = VSCodeMocks.createMockCancellationToken(true);
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription: 'Test task',
      workspaceRoot: '/test/workspace'
    });

    // Act
    const result = await tool.invoke(options, cancelledToken);

    // Assert - Should return error result for cancellation
    TestAssertions.assertValidToolResult(result);
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    assert.ok(resultContent.includes('❌'), 'Result should contain error indicator');
    assert.ok(resultContent.includes('cancel'), 'Error should mention cancellation');
  });

  test('should return properly formatted JSON response', async () => {
    // Arrange
    const taskDescription = 'Test task description';
    const workspaceRoot = '/test/workspace';
    const options = VSCodeMocks.createMockToolInvocationOptions({
      taskDescription,
      workspaceRoot
    });

    // Act
    const result = await tool.invoke(options, mockCancellationToken);

    // Assert
    TestAssertions.assertValidToolResult(result);
    
    const resultContent = (result.content[0] as vscode.LanguageModelTextPart).value;
    
    // Should contain JSON structure (though may not be pure JSON due to markdown formatting)
    assert.ok(resultContent.includes('sessionId'), 'Result should contain sessionId field');
    assert.ok(resultContent.includes('taskDescription'), 'Result should contain taskDescription field');
    assert.ok(resultContent.includes('workspaceRoot'), 'Result should contain workspaceRoot field');
    assert.ok(resultContent.includes('status'), 'Result should contain status field');
  });
});
