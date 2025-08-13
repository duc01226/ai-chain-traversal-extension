# AI Chain Traversal Tools

[![VS Code Version](https://img.shields.io/badge/VS%20Code-1.101.0+-blue.svg)](https://code.visualstudio.com/)
[![Extension Version](https://img.shields.io/badge/version-1.0.0-green.svg)]()
[![Language Model Tools](https://img.shields.io/badge/Language%20Model%20Tools-11-orange.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

> **Advanced external state management and chain-aware analysis for AI agents**

AI Chain Traversal Tools is a sophisticated VS Code extension that provides **external state management** and **chain-aware analysis** capabilities for AI agents, preventing context loss during code discovery. The extension implements 11 specialized Language Model Tools that enable persistent discovery sessions with entity graphs and multi-agent coordination.

## 🚀 Key Features

### 🧠 **External State Management**
- **Persistent Discovery Sessions**: Maintains analysis state across AI interactions
- **Entity Graph Storage**: JSON-based entity graphs in `.vscode/chain-traversal/`
- **Context Recovery**: Strategic context restoration after token summarization
- **Chain Completion Tracking**: Validates analysis completeness and integrity

### 🤖 **Multi-Agent Coordination**
- **Parallel Processing**: Distribute work across multiple AI agents
- **Agent Specializations**: Frontend, backend, database, API, configuration, testing
- **Load Balancing**: Capability-based, priority-weighted, round-robin strategies
- **Performance Monitoring**: Real-time metrics and optimization recommendations

### 📊 **Advanced Analytics**
- **Real-time Status Panel**: Comprehensive system monitoring via webview
- **Performance Metrics**: Memory usage, processing speed, agent coordination
- **Token Management**: Intelligent summarization and context preservation
- **Export Capabilities**: YAML, JSON, and Markdown report formats

### 🔄 **Workflow Automation**
- **Work Queue Management**: Priority-based task distribution
- **Dependency Chain Analysis**: Systematic entity relationship mapping
- **Progress Tracking**: Visual indicators and completion percentages
- **Error Recovery**: Robust handling of interruptions and failures

## 📋 Requirements

- **VS Code**: Version 1.101.0 or higher
- **Language Model Tools API**: Core functionality dependency
- **Node.js**: Compatible with VS Code extension host
- **Operating System**: Windows, macOS, Linux

## 🛠️ Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
3. Search for "AI Chain Traversal Tools"
4. Click **Install**

### Manual Installation
1. Download the `.vsix` file from releases
2. Open VS Code
3. Press `Ctrl+Shift+P` and type "Extensions: Install from VSIX"
4. Select the downloaded file

### From Source
```bash
git clone https://github.com/duc01226/ai-chain-traversal-extension.git
cd ai-chain-traversal-extension
npm install
npm run compile
```

## 🎯 Quick Start

### 1. Initialize a Discovery Session
```typescript
// Language Model Tools API call
ai-chain-traversal_initializeSession({
  taskDescription: "Analyze user management system",
  workspaceRoot: "/path/to/project"
})
```

### 2. Add Entities to Discovery Graph
```typescript
// Add discovered code entities
ai-chain-traversal_addEntity({
  entity: {
    id: "userController",
    type: "Controller",
    filePath: "src/controllers/userController.ts",
    businessContext: "User management and authentication",
    chainContext: "Main entry point for user operations"
  }
})
```

### 3. Map Entity Relationships
```typescript
// Create dependency relationships
ai-chain-traversal_addRelationship({
  relationship: {
    fromEntityId: "userController",
    toEntityId: "userService",
    relationshipType: "DEPENDS_ON",
    strength: 0.9
  }
})
```

### 4. Coordinate Multiple Agents
```typescript
// Multi-agent parallel processing
ai-chain-traversal_coordinateAgents({
  sessionId: "session-12345",
  agents: [
    {
      id: "frontend-agent",
      name: "Frontend Component Analyzer",
      capabilities: ["entity_discovery", "semantic_analysis"],
      maxConcurrentTasks: 3
    },
    {
      id: "backend-agent", 
      name: "Backend Service Analyzer",
      capabilities: ["dependency_tracing", "relationship_mapping"],
      maxConcurrentTasks: 2
    }
  ],
  distributionStrategy: "capability",
  enablePerformanceOptimization: true
})
```

## 🧰 Available Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| **initializeSession** | Start new discovery session | First step in any analysis |
| **addEntity** | Register discovered entities | Core discovery building block |
| **addRelationship** | Map entity dependencies | Relationship building |
| **getNextWorkItem** | Get priority work items | Systematic processing |
| **markProcessed** | Track completion status | Progress management |
| **validateChains** | Check analysis completeness | Quality assurance |
| **generateReport** | Export discovery results | Documentation |
| **coordinateAgents** | Multi-agent orchestration | Parallel processing |
| **recoverContext** | Restore analysis state | Context management |
| **analyzeBackups** | Review backup metadata | Recovery planning |
| **outputResults** | Format analysis output | Results presentation |

## 📖 Documentation

### Workflow Guides
- **[AI Workflow Analysis](./AI-WORKFLOW-ANALYSIS.md)** - Complete 50+ page guide explaining how AI agents detect, use, and orchestrate the tools from simple prompts to complex multi-phase operations
- **[Workflow Quick Reference](./WORKFLOW-QUICK-REFERENCE.md)** - Summary guide for fast understanding of AI decision making and tool usage patterns

### Additional Resources
- **[Test Documentation](./src/test/README.md)** - Comprehensive testing guide and scenarios
- **[Contributing Guide](./CONTRIBUTING.md)** - Development guidelines and contribution process
- **[GitHub Wiki](https://github.com/duc01226/ai-chain-traversal-extension/wiki)** - Extended documentation and examples

## ⚙️ Configuration

### Extension Settings

```json
{
  "aiChainTraversal.autoSaveInterval": 30,
  "aiChainTraversal.maxEntityCacheSize": 10000,
  "aiChainTraversal.enableDebugLogging": false,
  "aiChainTraversal.stateFileLocation": ".vscode/chain-traversal",
  "aiChainTraversal.showProgressNotifications": true,
  
  "aiChainTraversal.tokenManagement.maxTokens": 128000,
  "aiChainTraversal.tokenManagement.warningThreshold": 90,
  "aiChainTraversal.tokenManagement.criticalThreshold": 95,
  
  "aiChainTraversal.performance.memoryWarningThreshold": 75,
  "aiChainTraversal.performance.maxMemoryUsageMB": 2048,
  "aiChainTraversal.performance.responseTimeWarningMs": 10000
}
```

### Token Management Configuration

```json
{
  "aiChainTraversal.tokenManagement": {
    "maxTokens": 128000,
    "charactersPerToken": 4,
    "reductionTarget": 70,
    "preserveEntityTypes": ["controller", "service", "interface", "component"]
  }
}
```

### Performance Optimization

```json
{
  "aiChainTraversal.performance": {
    "maxRelationshipCacheSize": 50000,
    "cacheCleanupPercentage": 20,
    "metricsHistoryLimit": 100
  }
}
```

## 📊 Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| **Chain Traversal: Show Status** | Display tool statistics and status | `Ctrl+Shift+P` → `Chain Traversal: Show Status` |
| **Chain Traversal: Test Tools** | Validate tool registration | `Ctrl+Shift+P` → `Chain Traversal: Test Tools` |
| **Chain Traversal: Show Logs** | Open extension output channel | `Ctrl+Shift+P` → `Chain Traversal: Show Logs` |
| **Chain Traversal: Open Documentation** | View GitHub documentation | `Ctrl+Shift+P` → `Chain Traversal: Open Documentation` |
| **Chain Traversal: Show Status Panel** | Open comprehensive status panel | `Ctrl+Shift+P` → `Chain Traversal: Show Status Panel` |

## 🎨 Status Panel

The extension provides a comprehensive status panel accessible via the status bar or command palette:

### System Overview
- **Extension Status**: Active/inactive state and current activity
- **Session Information**: Current session details and progress
- **Performance Metrics**: Real-time memory and processing statistics

### Entity Graph Visualization
- **Entity Distribution**: Breakdown by type (Controllers, Services, Components)
- **Relationship Mapping**: Dependency visualization and completeness
- **Chain Analysis**: Progress tracking and quality metrics

### Multi-Agent Coordination
- **Agent Status**: Active agents and their current tasks
- **Task Distribution**: Queue status and completion rates
- **Performance Insights**: Throughput and optimization recommendations

## 🏗️ Architecture

### Core Components

```
src/
├── extension.ts                    # Extension entry point
├── providers/
│   └── aiToolsProvider.ts         # Tool registration and management
├── base/
│   └── baseTool.ts               # Abstract base class for all tools
├── tools/                        # 11 Language Model Tool implementations
│   ├── initializeSessionTool.ts  # Session management
│   ├── addEntityTool.ts          # Entity discovery
│   ├── addRelationshipTool.ts    # Relationship mapping
│   ├── coordinateAgentsTool.ts   # Multi-agent coordination
│   └── ...                       # Other specialized tools
├── shared/
│   ├── types.ts                  # TypeScript interfaces and types
│   ├── constants.ts              # Configuration and constants
│   └── services/                 # Core business services
│       ├── performanceMonitorService.ts
│       ├── statusPanelService.ts
│       ├── multiAgentCoordinatorService.ts
│       └── ...
└── test/                         # Comprehensive test suite
```

### State Management

```
.vscode/chain-traversal/
├── sessions/                     # Discovery session metadata
├── entities/                     # Entity node storage
├── relationships/                # Relationship mappings
├── checkpoints/                  # Recovery checkpoints
├── context-backups/             # Token management backups
└── performance-logs/            # Performance monitoring data
```

## 🚦 Workflow Phases

### Phase 1: Session Initialization
1. **Initialize Session**: Create persistent storage
2. **Configure Token Management**: Set limits and thresholds
3. **Setup Performance Monitoring**: Enable metrics collection

### Phase 2: Entity Discovery
1. **Add Entities**: Register discovered code elements
2. **Build Relationships**: Map dependencies and references
3. **Track Progress**: Monitor completion percentage

### Phase 3: Multi-Agent Coordination
1. **Register Agents**: Configure capabilities and specializations
2. **Distribute Tasks**: Apply distribution strategies
3. **Monitor Performance**: Track throughput and bottlenecks

### Phase 4: Analysis and Reporting
1. **Validate Chains**: Check completeness and integrity
2. **Generate Reports**: Export in multiple formats
3. **Optimize Performance**: Apply recommendations

## 🔧 Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/duc01226/ai-chain-traversal-extension.git
cd ai-chain-traversal-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Run tests
npm run test

# Package extension
npm run package
```

### Testing

```bash
# Run all tests
npm run test:all

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# End-to-end tests
npm run test:e2e
```

### Debugging

1. **Enable Debug Logging**:
   ```json
   {
     "aiChainTraversal.enableDebugLogging": true
   }
   ```

2. **View Output Channel**: 
   - `Ctrl+Shift+P` → `Chain Traversal: Show Logs`

3. **Monitor Status Panel**:
   - Click status bar item or run `Chain Traversal: Show Status Panel`

## 📈 Performance Optimization

### Memory Management
- **Entity Cache**: Default 10,000 entities (configurable)
- **Relationship Cache**: 50,000 relationships with LRU eviction
- **Automatic Cleanup**: Triggered at 75% memory threshold

### Token Management  
- **Smart Summarization**: Preserves high-priority entities
- **Progressive Loading**: Selective context recovery
- **Model-Specific Optimization**: Adapts to different AI models

### Multi-Agent Efficiency
- **Load Balancing**: Distributes work based on agent capabilities
- **Heartbeat Monitoring**: Detects and handles agent disconnections
- **Performance Metrics**: Real-time throughput and optimization

## 🌍 Cross-Language Support

The extension supports analysis across multiple programming languages:

### Supported Languages
- **TypeScript/JavaScript**: Full semantic analysis
- **Python**: Class and function discovery
- **Java**: Enterprise pattern recognition
- **C#**: .NET architecture analysis
- **Go**: Package and interface mapping
- **Rust**: Module and trait analysis

### Cross-Language Features
- **API Boundary Detection**: REST, GraphQL, gRPC interfaces
- **Service Communication**: Microservice dependency mapping
- **Data Flow Analysis**: Cross-service data movement
- **Integration Point Discovery**: External system connections

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Make changes and add tests
5. Run tests: `npm run test:all`
6. Submit a pull request

### Code Style
- **TypeScript**: Strict mode with comprehensive typing
- **ESLint**: Enforced code quality standards  
- **Testing**: Unit, integration, and performance tests required
- **Documentation**: Update README and JSDoc comments

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues and Support

- **Bug Reports**: [GitHub Issues](https://github.com/duc01226/ai-chain-traversal-extension/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/duc01226/ai-chain-traversal-extension/discussions)
- **Documentation**: [GitHub Wiki](https://github.com/duc01226/ai-chain-traversal-extension/wiki)

## 🔄 Release Notes

### Version 1.0.0
- ✨ Initial release with 11 Language Model Tools
- 🤖 Multi-agent coordination with 6 specialization types
- 📊 Comprehensive status panel and performance monitoring
- 🔄 External state management with persistent storage
- 🧠 Token management with intelligent summarization
- 📈 Performance optimization and bottleneck detection

## 🎯 Roadmap

### Upcoming Features
- **Visual Graph Explorer**: Interactive entity relationship visualization
- **AI Model Integration**: Direct integration with popular AI models
- **Template Library**: Pre-configured analysis templates
- **Team Collaboration**: Shared discovery sessions
- **Plugin Ecosystem**: Extensible tool architecture

### Performance Enhancements
- **Streaming Analysis**: Real-time entity discovery
- **Distributed Processing**: Cloud-based agent coordination
- **Smart Caching**: Predictive context loading
- **Memory Optimization**: Advanced garbage collection

---

<div align="center">

**Made with ❤️ for the AI developer community**

[📖 Documentation](https://github.com/duc01226/ai-chain-traversal-extension#readme) | [🐛 Report Bug](https://github.com/duc01226/ai-chain-traversal-extension/issues) | [💡 Request Feature](https://github.com/duc01226/ai-chain-traversal-extension/discussions)

</div>
