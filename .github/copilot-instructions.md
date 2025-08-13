# AI Chain Traversal Tools - Copilot Instructions

## Overview
This VS Code extension provides **external state management** and **chain-aware analysis** capabilities for AI agents, preventing context loss during code discovery. The extension implements 11 specialized Language Model Tools that enable persistent discovery sessions with entity graphs and multi-agent coordination.

## Architecture Essentials

### Core Design Pattern: Language Model Tools + External State
- **Extension Entry**: `src/extension.ts` → `AIToolsProvider` → 11 Language Model Tools
- **State Management**: Persistent `.vscode/chain-traversal/` directory with JSON-based entity graphs
- **Tool Inheritance**: All tools extend `BaseTool` class with standardized error handling and logging
- **Tool Registration**: Automatic via `src/providers/aiToolsProvider.ts` with `package.json` tool definitions

### Critical File Structure
```
src/
├── base/baseTool.ts           # Abstract base class - ALL tools inherit from this
├── tools/                     # 11 Language Model Tool implementations
│   ├── initializeSessionTool.ts        # Session management
│   ├── addEntityTool.ts                # Entity discovery
│   ├── addRelationshipTool.ts          # Relationship mapping
│   ├── getNextWorkItemTool.ts          # Work queue management
│   ├── markProcessedTool.ts            # Progress tracking
│   ├── validateChainsTool.ts           # Quality assurance
│   ├── generateReportTool.ts           # Report generation
│   ├── coordinateAgentsTool.ts         # Multi-agent coordination
│   ├── recoverContextTool.ts           # Context recovery
│   ├── analyzeBackupsTool.ts           # Backup analysis
│   └── outputResultsTool.ts            # Results output
├── shared/
│   ├── types.ts              # 404 lines of TypeScript interfaces - THE source of truth
│   └── constants.ts          # TOOL_NAMES export - required for tool registration
├── providers/aiToolsProvider.ts  # Tool orchestration and VS Code registration
└── extension.ts              # Entry point with activation/deactivation lifecycle
```

## IMPORTANT UNIVERSAL CLEAN CODE RULES

- Do not repeat code logic or patterns. Reuse code.
- Follow SOLID principles and Clean Architecture patterns
- Method Design: Single Responsibility; Consistent abstraction level: Don't mix high-level and low-level operations; Dont mix infrastructure or technical logic into application, domain layer like QueryHandler/CommandHandler.
- Use meaningful, descriptive names that explain intent
- Classes/Interfaces: PascalCase (UserService, IRepository)
- Methods/Functions: PascalCase (C#), camelCase (TypeScript) (GetUserById, getUserById)
- Variables/Fields: camelCase (userName, isActive)
- Constants: UPPER_SNAKE_CASE (MAX_RETRY_COUNT)
- Boolean variables: Use is, has, can, should prefixes (isVisible, hasPermission)
- Code Organization: Group related functionality together; Separate concerns (business logic, data access, presentation); Use meaningful file/folder structure; Keep dependencies flowing inward (Dependency Inversion)
- Code Flow (Step-by-Step Pattern): Clear step-by-step flow with spacing; Group parallel operations (no dependencies) together; Follow Input → Process → Output pattern; Use early validation and guard clauses;
- Responsibility Placement: Business logic belongs to domain entities. Use static expressions for queries in entities. Instance validation methods in entities. DTO creation belongs to DTO classes.
- Validation Patterns: Use PlatformValidationResult fluent API. Chain validation with .And(), .AndAsync(), .AndNot() methods. Return validation results with meaningful error messages. Validation Methods: Validate[Context]Valid, Has[Property], Is[State], Not[Condition]. Ensure Methods: Ensure[Context]Valid (returns object or throws).
- Collections: Always use plural names (users, orders, items)

## Essential Development Patterns

### 1. Adding New Language Model Tools
**ALWAYS follow this exact pattern:**
```typescript
// 1. Add to src/shared/constants.ts
export const TOOL_NAMES = {
  MY_NEW_TOOL: 'ai-chain-traversal_myNewTool'
};

// 2. Extend BaseTool in src/tools/myNewTool.ts
export class MyNewTool extends BaseTool {
  public readonly name = TOOL_NAMES.MY_NEW_TOOL;
  
  protected async executeToolLogic(
    params: MyToolParameters,
    token: vscode.CancellationToken
  ): Promise<string> {
    // Tool implementation
  }
}

// 3. Register in aiToolsProvider.ts initializeTools()
this.tools.set(TOOL_NAMES.MY_NEW_TOOL, new MyNewTool(this.context));

// 4. Add schema to package.json languageModelTools array
```

### 2. Entity Management Pattern
**All entity operations MUST follow session dependency chain:**
```typescript
// Session → Entity → Relationship → Validation → Reporting
1. initializeSession (creates .vscode/chain-traversal/sessions/)
2. addEntity (requires active session, creates entity with required fields)
3. addRelationship (requires existing entities)
4. validateChains (checks completeness)
5. generateReport (exports results)
```

**Required Entity Fields** (from `src/shared/types.ts`):
- `id`, `type`, `filePath` - Core identification
- `businessContext`, `chainContext` - REQUIRED for validation
- Must use EntityType enum values: 'Controller', 'Service', 'Component', etc.

### 3. Error Handling Pattern
**BaseTool enforces this pattern - DO NOT bypass:**
```typescript
// Tools return structured responses, never throw to Language Model
try {
  const result = await this.someOperation();
  return this.createSuccessResult(this.formatSuccessResponse(message, data));
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Operation failed';
  return this.createErrorResult(this.formatErrorResponse(errorMessage, error));
}
```

## Build & Test Workflow

### Development Commands
```bash
# Primary development cycle
npm run compile                     # TypeScript compilation via webpack
npm run watch                       # Development with hot reload
npm run lint                        # ESLint validation (MUST pass)

# Testing (comprehensive test infrastructure)
npm run compile-tests               # Compile tests using tsconfig.test.json
npm test                           # Full VS Code test runner
npm run test:unit                  # Unit tests for individual tools
npm run test:integration           # Multi-tool workflow tests
npm run test:performance           # Performance benchmarks
npm run test:e2e                   # End-to-end user scenarios

# Package for distribution
npm run package                    # Production webpack build
npm run publish                    # Package and publish
```

### Test Architecture (Professional Testing Standards)
- **Test Structure**: `src/test/` with unit/integration/performance/e2e categories
- **VS Code Mocking**: Comprehensive `src/test/mocks/vscode.ts` for API simulation
- **Test Compilation**: Uses separate `tsconfig.test.json` (required - main config excludes tests)
- **Test Runner**: Custom runner + VS Code test framework for extension testing

**CRITICAL TEST FRAMEWORK REQUIREMENTS:**
- **NEVER use Mocha functions**: `describe`, `it`, `beforeEach`, `afterEach` are NOT supported
- **ALWAYS use custom framework functions**: `suite`, `test`, `setup`, `teardown`
- **Test File Pattern**: Follow existing test files in `src/test/unit/addEntityTool.test.ts`
- **Required Structure**:
  ```typescript
  suite('Test Suite Name', () => {
    let context: vscode.ExtensionContext;
    
    setup(() => {
      // Setup before each test
    });
    
    teardown(() => {
      // Cleanup after each test
    });
    
    test('should do something', async () => {
      // Test implementation
    });
  });
  ```
- **Framework Functions Available**: `suite()`, `test()`, `setup()`, `teardown()` (defined in `src/test/suite/index.ts`)
- **NO Mocha/Jest**: This project uses a CUSTOM test framework, not standard testing libraries

### Tool Workflow Phases
**Phase 0:** Session Management (`initializeSession`)
**Phase 1:** Entity Discovery (`addEntity`, `addRelationship`) 
**Phase 2:** Work Queue Management (`getNextWorkItem`, `markProcessed`)
**Phase 3:** Quality Assurance (`validateChains`, `generateReport`)
**Phase 4:** Advanced Coordination (`coordinateAgents`)
**Phase 5:** Context Recovery (`recoverContext`, `analyzeBackups`, `outputResults`)

## Critical Configuration Files

### package.json Tool Definitions
**Language Model Tools MUST be defined in package.json with exact schema:**
```json
"languageModelTools": [{
  "name": "ai-chain-traversal_toolName",
  "inputSchema": { /* JSON schema for parameters */ },
  "modelDescription": "Description for AI model consumption",
  "tags": ["category", "functionality"]
}]
```

### State Persistence (.vscode/chain-traversal/)
```
sessions/          # DiscoverySession objects with metadata
entities/          # EntityNode arrays with full context
relationships/     # EntityRelationship objects with strength metrics
checkpoints/       # Recovery checkpoints every 5 entities
context-backups/   # Token management context preservation
performance-logs/  # Performance monitoring data
```

## Integration Points

### VS Code Extension API Dependencies
- **Language Model Tools API**: Core functionality - requires VS Code 1.101.0+
- **File System API**: State persistence and workspace management
- **Status Bar**: Progress indication and extension state
- **Output Channels**: Logging and debugging (ai-chain-traversal channel)

### External Dependencies (keep minimal)
- **uuid**: Entity ID generation (required for uniqueness)
- **yaml**: Report export format (user preference)
- **webpack**: Build system (production bundling)

## Performance Considerations

### Memory Management
- **Entity Cache**: Default 10,000 entities max (configurable)
- **Relationship Cache**: 50,000 relationships max (LRU eviction)
- **Token Management**: Automatic summarization at 90% token usage
- **Background Operations**: Non-blocking file I/O with batch operations

### Multi-Agent Coordination
- **Agent Specializations**: 6 types (frontend_components, backend_services, database_entities, api_endpoints, configuration, testing)
- **Task Distribution**: Capability-based, load-balanced, priority-weighted strategies
- **Performance Monitoring**: Real-time metrics with automatic optimization

## Common Development Patterns

### Adding Tool Parameters
1. **Define interface** in `src/shared/types.ts` (TypeScript-first approach)
2. **Add JSON schema** in `package.json` (VS Code validation)
3. **Implement validation** in tool's `validateParameters()` method
4. **Update tests** with new parameter scenarios

### State Manager Integration
```typescript
// Tools access state via this.stateManager (injected by BaseTool)
await this.stateManager.initializeSession(taskDescription, workspaceRoot);
await this.stateManager.addEntity(entityNode);
await this.stateManager.addRelationship(fromId, toId, type);
```

### Logging Pattern
```typescript
// Use structured logging with context
this.logOperation('Operation started', { entityId, sessionId });
this.logOperation('Operation completed', { processingTime: endTime - startTime });
```

## Project-Specific Conventions

### Entity Type Classification
- **Controllers**: API endpoints, route handlers
- **Services**: Business logic, application services
- **Components**: UI components, React/Vue components
- **Repositories**: Data access layer
- **Events**: Domain events, system events
- **Commands/Queries**: CQRS pattern implementations

### Testing Patterns
```typescript
// Test naming convention: should [action] [expected outcome]
describe('AddEntityTool Tests', () => {
  it('should add valid entity successfully', async () => {
    // Arrange: Setup tool and parameters
    // Act: Execute tool operation
    // Assert: Validate results and state changes
  });
});
```

### Cross-Language Analysis Support
- **Multi-language sessions**: TypeScript, Java, Python, etc.
- **Cross-language relationships**: API calls, service calls
- **Language-specific agent specializations**

## Debugging & Troubleshooting

### Enable Debug Mode
```json
// VS Code settings.json
"aiChainTraversal.enableDebugLogging": true
```

### Common Issues
1. **Tool Registration Failures**: Check TOOL_NAMES constants and package.json schema
2. **Session Dependencies**: Ensure session initialization before entity operations
3. **Entity Validation**: businessContext and chainContext are REQUIRED fields
4. **Test Compilation**: Use `npm run compile-tests` - separate from main compilation
5. **Performance**: Monitor memory usage - cache cleanup triggers at 75% threshold
6. **Test Framework**: NEVER use `describe`/`it` - use `suite`/`test` instead

## File Creation Guidelines

**CRITICAL: Only create files explicitly requested by the user**
- When user asks for "test suites" → create only `.test.ts` files
- When user asks for "documentation" → create only requested documentation
- **NEVER create summary/documentation files unless explicitly requested**
- **ALWAYS ask before creating additional files beyond the specific request**
- Examples of what NOT to create without permission:
  - `TEST_COVERAGE_SUMMARY.md`
  - `IMPLEMENTATION_NOTES.md` 
  - `CHANGELOG.md`
  - Any `.md` files when user only asked for code
  - Configuration files not specifically mentioned

### Debug Commands
```bash
# Test specific tool registration
npm run test:unit -- --grep "should have correct tool name"

# Check tool availability
# Use VS Code Command Palette: "Test Chain Traversal Tools"

# Monitor extension activation
# Check "AI Chain Traversal" output channel in VS Code
```

This extension prioritizes **reliability over performance** and **structured state over convenience**. Follow the established patterns strictly - the Language Model Tools API and multi-agent coordination depend on consistent behavior across all tools.


## IMPORTANT UNIVERSAL CLEAN CODE RULES

- Do not repeat code logic or patterns. Reuse code.
- Follow SOLID principles and Clean Architecture patterns
- Method Design: Single Responsibility; Consistent abstraction level: Don't mix high-level and low-level operations; Dont mix infrastructure or technical logic into application, domain layer like QueryHandler/CommandHandler.
- Use meaningful, descriptive names that explain intent
- Classes/Interfaces: PascalCase (UserService, IRepository)
- Methods/Functions: PascalCase (C#), camelCase (TypeScript) (GetUserById, getUserById)
- Variables/Fields: camelCase (userName, isActive)
- Constants: UPPER_SNAKE_CASE (MAX_RETRY_COUNT)
- Boolean variables: Use is, has, can, should prefixes (isVisible, hasPermission)
- Code Organization: Group related functionality together; Separate concerns (business logic, data access, presentation); Use meaningful file/folder structure; Keep dependencies flowing inward (Dependency Inversion)
- Code Flow (Step-by-Step Pattern): Clear step-by-step flow with spacing; Group parallel operations (no dependencies) together; Follow Input → Process → Output pattern; Use early validation and guard clauses;
- Responsibility Placement: Business logic belongs to domain entities. Use static expressions for queries in entities. Instance validation methods in entities. DTO creation belongs to DTO classes.
- Validation Patterns: Use PlatformValidationResult fluent API. Chain validation with .And(), .AndAsync(), .AndNot() methods. Return validation results with meaningful error messages. Validation Methods: Validate[Context]Valid, Has[Property], Is[State], Not[Condition]. Ensure Methods: Ensure[Context]Valid (returns object or throws).
- Collections: Always use plural names (users, orders, items)
