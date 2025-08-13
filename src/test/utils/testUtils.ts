/**
 * Test Utilities for AI Chain Traversal Tools
 * Provides common testing utilities, factories, and helper functions
 */

import * as vscode from 'vscode';
import { EntityNode, RelationshipEdge, DiscoverySession, SessionConfiguration, ProgressMetrics } from '../../shared/types';

/**
 * Test Data Factory for creating mock objects
 */
export class TestDataFactory {
  
  /**
   * Create a mock VS Code extension context
   */
  static createMockContext(): vscode.ExtensionContext {
    const globalState = new Map<string, any>();
    const workspaceState = new Map<string, any>();
    
    return {
      subscriptions: [],
      workspaceState: {
        get: <T>(key: string, defaultValue?: T): T => workspaceState.get(key) ?? defaultValue!,
        update: async (key: string, value: any): Promise<void> => {
          workspaceState.set(key, value);
        },
        keys: (): readonly string[] => Array.from(workspaceState.keys())
      },
      globalState: {
        get: <T>(key: string, defaultValue?: T): T => globalState.get(key) ?? defaultValue!,
        update: async (key: string, value: any): Promise<void> => {
          globalState.set(key, value);
        },
        keys: (): readonly string[] => Array.from(globalState.keys()),
        setKeysForSync: (_keys: readonly string[]): void => { /* mock */ }
      },
      extensionUri: vscode.Uri.file('/mock/extension/path'),
      extensionPath: '/mock/extension/path',
      environmentVariableCollection: {} as any,
      asAbsolutePath: (relativePath: string): string => `/mock/extension/path/${relativePath}`,
      storageUri: vscode.Uri.file('/mock/storage'),
      storagePath: '/mock/storage',
      globalStorageUri: vscode.Uri.file('/mock/global-storage'),
      globalStoragePath: '/mock/global-storage',
      logUri: vscode.Uri.file('/mock/logs'),
      logPath: '/mock/logs',
      extensionMode: vscode.ExtensionMode.Test,
      extension: {} as any,
      secrets: {} as any,
      languageModelAccessInformation: {} as any
    };
  }

  /**
   * Create a mock discovery session
   */
  static createMockSession(overrides: Partial<DiscoverySession> = {}): DiscoverySession {
    const defaultSession: DiscoverySession = {
      sessionId: 'test-session-123',
      timestamp: new Date(),
      taskDescription: 'Test analysis task',
      currentPhase: 'discovery',
      progress: this.createMockProgressMetrics(),
      workspaceRoot: '/test/workspace',
      aiModel: 'gpt-4',
      configuration: this.createMockSessionConfiguration()
    };

    return { ...defaultSession, ...overrides };
  }

  /**
   * Create mock progress metrics
   */
  static createMockProgressMetrics(overrides: Partial<ProgressMetrics> = {}): ProgressMetrics {
    const defaultMetrics: ProgressMetrics = {
      totalEntitiesDiscovered: 10,
      entitiesProcessed: 5,
      chainsIdentified: 3,
      chainsCompleted: 1,
      currentPriorityLevel: 2,
      estimatedTimeRemaining: 300,
      lastUpdateTimestamp: new Date()
    };

    return { ...defaultMetrics, ...overrides };
  }

  /**
   * Create mock session configuration
   */
  static createMockSessionConfiguration(overrides: Partial<SessionConfiguration> = {}): SessionConfiguration {
    const defaultConfig: SessionConfiguration = {
      maxEntityCacheSize: 1000,
      autoSaveInterval: 30,
      enableDebugLogging: true,
      stateFileLocation: '.vscode/chain-traversal-test',
      parallelProcessing: false,
      checkpointFrequency: 5,
      tokenManagement: {
        compressionTriggerThreshold: 0.9,
        emergencyCompressionThreshold: 0.95,
        highUsageWarningThreshold: 0.8,
        cacheEvictionThreshold: 0.8
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Create a mock entity node
   */
  static createMockEntity(overrides: Partial<EntityNode> = {}): EntityNode {
    const defaultEntity: EntityNode = {
      id: 'TestEntity',
      type: 'Entity',
      filePath: '/test/TestEntity.ts',
      discoveryMethod: 'semantic_search',
      priority: 2,
      processed: false,
      chainContext: 'Test chain context',
      businessContext: 'Test business context',
      domainContext: 'Test domain',
      dependencies: ['TestService'],
      dependents: ['TestController'],
      analysisData: {
        usageCount: 5,
        inheritanceChain: ['BaseEntity'],
        architecturalPattern: 'MVC',
        relevanceScore: 0.8,
        members: ['testMethod', 'testField'],
        isSummarized: false,
        summaryConfidence: 'high',
        businessRules: ['validation-required'],
        integrationPoints: ['database'],
        testableUnits: ['testMethod']
      },
      timestamp: new Date(),
      processingAgent: 'test-agent'
    };

    return { ...defaultEntity, ...overrides };
  }

  /**
   * Create a mock relationship edge
   */
  static createMockRelationship(overrides: Partial<RelationshipEdge> = {}): RelationshipEdge {
    const defaultRelationship: RelationshipEdge = {
      id: 'rel-123',
      fromEntityId: 'TestController',
      toEntityId: 'TestService',
      relationshipType: 'USES',
      strength: 0.9,
      discoveryMethod: 'list_code_usages',
      bidirectional: false,
      metadata: {
        callCount: 5,
        importance: 'high',
        coupling: 'loose'
      },
      timestamp: new Date()
    };

    return { ...defaultRelationship, ...overrides };
  }

  /**
   * Create multiple mock entities for testing
   */
  static createMockEntities(count: number): EntityNode[] {
    return Array.from({ length: count }, (_, i) => 
      this.createMockEntity({
        id: `Entity${i + 1}`,
        type: i % 2 === 0 ? 'Entity' : 'Service',
        filePath: `/test/Entity${i + 1}.ts`,
        priority: (i % 5 + 1) as any
      })
    );
  }

  /**
   * Create multiple mock relationships for testing
   */
  static createMockRelationships(count: number): RelationshipEdge[] {
    return Array.from({ length: count }, (_, i) => 
      this.createMockRelationship({
        id: `rel-${i + 1}`,
        fromEntityId: `Entity${i + 1}`,
        toEntityId: `Entity${i + 2}`,
        relationshipType: i % 2 === 0 ? 'USES' : 'DEPENDS_ON'
      })
    );
  }
}

/**
 * VS Code API Mocks
 */
export class VSCodeMocks {
  
  /**
   * Mock VS Code workspace
   */
  static mockWorkspace() {
    const workspaceFolders = [
      {
        uri: vscode.Uri.file('/test/workspace'),
        name: 'test-workspace',
        index: 0
      }
    ];

    return {
      workspaceFolders,
      getConfiguration: (_section?: string) => ({
        get: <T>(_key: string, defaultValue?: T): T => defaultValue!,
        update: async (_key: string, _value: any): Promise<void> => { /* mock */ },
        has: (_section: string): boolean => true,
        inspect: () => ({ key: 'test', defaultValue: 'test' })
      }),
      fs: {
        readFile: async (_uri: vscode.Uri): Promise<Uint8Array> => {
          return new TextEncoder().encode('{"test": "data"}');
        },
        writeFile: async (_uri: vscode.Uri, _content: Uint8Array): Promise<void> => {
          // Mock file write
        },
        readDirectory: async (_uri: vscode.Uri): Promise<[string, vscode.FileType][]> => {
          return [['test.json', vscode.FileType.File]];
        },
        createDirectory: async (_uri: vscode.Uri): Promise<void> => {
          // Mock directory creation
        },
        stat: async (_uri: vscode.Uri): Promise<vscode.FileStat> => {
          return {
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 100
          };
        }
      }
    };
  }

  /**
   * Mock Language Model Tool invocation options
   */
  static createMockToolInvocationOptions<T>(input: T): vscode.LanguageModelToolInvocationOptions<T> {
    return {
      input
    } as vscode.LanguageModelToolInvocationOptions<T>;
  }

  /**
   * Mock cancellation token
   */
  static createMockCancellationToken(cancelled = false): vscode.CancellationToken {
    return {
      isCancellationRequested: cancelled,
      onCancellationRequested: () => ({ dispose: () => {} })
    };
  }
}

/**
 * Test Assertion Helpers
 */
export class TestAssertions {
  
  /**
   * Assert that an entity has required properties
   */
  static assertValidEntity(entity: EntityNode): void {
    if (!entity.id || typeof entity.id !== 'string') {
      throw new Error('Entity must have a valid id');
    }
    if (!entity.type || typeof entity.type !== 'string') {
      throw new Error('Entity must have a valid type');
    }
    if (!entity.filePath || typeof entity.filePath !== 'string') {
      throw new Error('Entity must have a valid filePath');
    }
    if (!entity.businessContext || typeof entity.businessContext !== 'string') {
      throw new Error('Entity must have a valid businessContext');
    }
  }

  /**
   * Assert that a relationship has required properties
   */
  static assertValidRelationship(relationship: RelationshipEdge): void {
    if (!relationship.id || typeof relationship.id !== 'string') {
      throw new Error('Relationship must have a valid id');
    }
    if (!relationship.fromEntityId || typeof relationship.fromEntityId !== 'string') {
      throw new Error('Relationship must have a valid fromEntityId');
    }
    if (!relationship.toEntityId || typeof relationship.toEntityId !== 'string') {
      throw new Error('Relationship must have a valid toEntityId');
    }
    if (!relationship.relationshipType || typeof relationship.relationshipType !== 'string') {
      throw new Error('Relationship must have a valid relationshipType');
    }
  }

  /**
   * Assert that a session has required properties
   */
  static assertValidSession(session: DiscoverySession): void {
    if (!session.sessionId || typeof session.sessionId !== 'string') {
      throw new Error('Session must have a valid sessionId');
    }
    if (!session.taskDescription || typeof session.taskDescription !== 'string') {
      throw new Error('Session must have a valid taskDescription');
    }
    if (!session.workspaceRoot || typeof session.workspaceRoot !== 'string') {
      throw new Error('Session must have a valid workspaceRoot');
    }
  }

  /**
   * Assert that a tool result has the expected structure
   */
  static assertValidToolResult(result: vscode.LanguageModelToolResult): void {
    if (!result) {
      throw new Error('Tool result must not be null or undefined');
    }
    if (!result.content || !Array.isArray(result.content)) {
      throw new Error('Tool result must have content array');
    }
    if (result.content.length === 0) {
      throw new Error('Tool result content array must not be empty');
    }
    
    const firstContent = result.content[0] as any;
    if (!firstContent || typeof firstContent.value !== 'string') {
      throw new Error('Tool result content must have string value');
    }
  }
}

/**
 * Performance Testing Utilities
 */
export class PerformanceTestUtils {
  
  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const executionTime = Number(end - start) / 1000000; // Convert to milliseconds
    
    return { result, executionTime };
  }

  /**
   * Assert that execution time is within acceptable limits
   */
  static assertExecutionTime(executionTime: number, maxTime: number, operation: string): void {
    if (executionTime > maxTime) {
      throw new Error(`${operation} took ${executionTime}ms, which exceeds the maximum allowed time of ${maxTime}ms`);
    }
  }

  /**
   * Measure memory usage during test execution
   */
  static measureMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };
  }
}
