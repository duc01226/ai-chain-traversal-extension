/**
 * Test runner for AI Chain Traversal Tools extension
 * Configures and runs all test suites with proper environment setup
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Test workspace path
    const testWorkspace = path.resolve(__dirname, './fixtures/test-workspace');

    console.log('🧪 Starting AI Chain Traversal Tools test suite...');
    console.log(`📁 Extension path: ${extensionDevelopmentPath}`);
    console.log(`📁 Test path: ${extensionTestsPath}`);
    console.log(`📁 Workspace path: ${testWorkspace}`);

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions', // Disable other extensions during testing
        '--disable-workspace-trust', // Disable workspace trust prompt
        '--no-sandbox' // Required for some CI environments
      ],
      version: '1.101.0' // Match extension requirement
    });

    console.log('✅ All tests completed successfully!');
  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }
}

main();
