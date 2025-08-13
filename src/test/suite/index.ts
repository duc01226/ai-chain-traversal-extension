/**
 * Test Suite Index for AI Chain Traversal Tools
 * Mocha test runner that loads and executes all test files
 */

import * as path from 'path';
import { promises as fs } from 'fs';

// Setup VS Code API mocking BEFORE any other imports
const vscodeMock = require('../mocks/vscode');

// Override the require for 'vscode' module
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'vscode') {
    return vscodeMock.vscode;
  }
  return originalRequire.apply(this, arguments);
};

// Mock the global test functions for our simple test runner
(global as any).suite = function(name: string, fn: () => void) {
  console.log(`\n📦 Running suite: ${name}`);
  try {
    fn();
    console.log(`✅ Suite ${name} completed`);
  } catch (error) {
    console.error(`❌ Suite ${name} failed:`, error);
    throw error;
  }
};

(global as any).test = async function(name: string, fn: () => void | Promise<void>) {
  console.log(`  🧪 Running test: ${name}`);
  try {
    await fn();
    console.log(`    ✅ Test ${name} passed`);
  } catch (error) {
    console.error(`    ❌ Test ${name} failed:`, error);
    throw error;
  }
};

(global as any).setup = function(fn: () => void) {
  console.log(`  🔧 Running setup`);
  fn();
};

(global as any).teardown = function(fn: () => void) {
  console.log(`  🧹 Running teardown`);
  fn();
};

// Alias for compatibility
(global as any).beforeEach = (global as any).setup;
(global as any).afterEach = (global as any).teardown;

export async function run(): Promise<void> {
  console.log('🧪 Starting AI Chain Traversal Tools Test Suite');
  
  // Simple test discovery and execution
  const testsRoot = path.resolve(__dirname, '..');
  
  try {
    // Load unit tests
    await loadTestsFromDirectory(path.join(testsRoot, 'unit'));
    
    // Load integration tests  
    await loadTestsFromDirectory(path.join(testsRoot, 'integration'));
    
    console.log('✅ All test files loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load test files:', error);
    throw error;
  }
}

async function loadTestsFromDirectory(directory: string): Promise<void> {
  try {
    const exists = await fs.access(directory).then(() => true).catch(() => false);
    if (!exists) {
      console.log(`� Directory ${directory} does not exist, skipping`);
      return;
    }

    const files = await fs.readdir(directory);
    const testFiles = files.filter(file => file.endsWith('.test.js'));
    
    console.log(`� Loading ${testFiles.length} test files from ${path.basename(directory)}`);
    
    for (const file of testFiles) {
      const testFile = path.join(directory, file);
      console.log(`  📄 Loading ${file}`);
      require(testFile);
    }
  } catch (error) {
    console.error(`❌ Error loading tests from ${directory}:`, error);
    throw error;
  }
}
