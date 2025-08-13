// Core data structures for Chain Traversal state management

export interface DiscoverySession {
  sessionId: string;
  timestamp: Date;
  taskDescription: string;
  currentPhase: 'discovery' | 'analysis' | 'planning' | 'execution';
  progress: ProgressMetrics;
  workspaceRoot: string;
  aiModel?: string;
  configuration: SessionConfiguration;
}

export interface SessionConfiguration {
  maxEntityCacheSize: number;
  autoSaveInterval: number;
  enableDebugLogging: boolean;
  stateFileLocation: string;
  parallelProcessing: boolean;
  checkpointFrequency: number;
  tokenManagement: TokenManagementThresholds;
}

export interface TokenManagementThresholds {
  compressionTriggerThreshold: number;  // Default: 0.9 (90% of maxTokens)
  emergencyCompressionThreshold: number; // Default: 0.95 (95% of maxTokens)
  highUsageWarningThreshold: number; // Default: 0.8 (80% of maxTokens)
  cacheEvictionThreshold: number; // Default: 0.8 (80% of maxSize)
}

export interface ProgressMetrics {
  totalEntitiesDiscovered: number;
  entitiesProcessed: number;
  chainsIdentified: number;
  chainsCompleted: number;
  currentPriorityLevel: number;
  estimatedTimeRemaining?: number | undefined;
  lastUpdateTimestamp: Date;
}

export interface EntityNode {
  id: string;
  type: EntityType;
  filePath: string;
  discoveryMethod: DiscoveryMethod;
  priority: Priority;
  processed: boolean;
  chainContext: string;
  businessContext: string;
  domainContext?: string;
  dependencies: string[];
  dependents: string[];
  analysisData?: EntityAnalysisData;
  timestamp: Date;
  processingAgent?: string | undefined;
}

export type EntityType = 
  // Core Architecture Patterns
  | 'Entity' 
  | 'Repository' 
  | 'Command' 
  | 'Query' 
  | 'Handler'
  | 'Controller' 
  | 'Service' 
  | 'Component'
  | 'Store'
  | 'Event'
  | 'Job'
  | 'API'
  | 'DTO'
  | 'Interface'
  | 'Configuration'
  
  // Frontend Architecture
  | 'Page'
  | 'Layout'
  | 'Hook'
  | 'Context'
  | 'Provider'
  | 'Reducer'
  | 'Action'
  | 'Selector'
  | 'Saga'
  | 'Thunk'
  | 'Effect'
  | 'Guard'
  | 'Resolver'
  | 'Interceptor'
  | 'Directive'
  | 'Pipe'
  | 'Filter'
  | 'Mixin'
  | 'Composable'
  | 'Vue'
  | 'React'
  | 'Angular'
  | 'Svelte'
  
  // Backend Architecture
  | 'Model'
  | 'Schema'
  | 'Migration'
  | 'Seeder'
  | 'Factory'
  | 'Gateway'
  | 'Adapter'
  | 'Mapper'
  | 'Transformer'
  | 'Serializer'
  | 'Validator'
  | 'Middleware'
  | 'Module'
  | 'Plugin'
  | 'Extension'
  | 'Package'
  | 'Library'
  | 'Framework'
  
  // Database & Data Layer
  | 'Table'
  | 'View'
  | 'Index'
  | 'Trigger'
  | 'Procedure'
  | 'Function'
  | 'Constraint'
  | 'Collection'
  | 'Document'
  | 'Cache'
  | 'Queue'
  | 'Topic'
  | 'Stream'
  
  // API & Communication
  | 'Endpoint'
  | 'Route'
  | 'GraphQL'
  | 'REST'
  | 'RPC'
  | 'WebSocket'
  | 'EventBus'
  | 'MessageQueue'
  | 'PubSub'
  | 'Gateway'
  | 'Proxy'
  | 'LoadBalancer'
  
  // Authentication & Security
  | 'Authentication'
  | 'Authorization'
  | 'Permission'
  | 'Role'
  | 'Policy'
  | 'JWT'
  | 'OAuth'
  | 'SAML'
  | 'Session'
  | 'Token'
  | 'Certificate'
  | 'Secret'
  
  // Infrastructure & DevOps
  | 'Container'
  | 'Docker'
  | 'Kubernetes'
  | 'Helm'
  | 'Terraform'
  | 'Ansible'
  | 'Pipeline'
  | 'Workflow'
  | 'Action'
  | 'Job'
  | 'Task'
  | 'Cron'
  | 'Lambda'
  | 'Function'
  | 'Serverless'
  | 'CDN'
  | 'DNS'
  | 'SSL'
  
  // Testing & Quality
  | 'Test'
  | 'Spec'
  | 'Mock'
  | 'Stub'
  | 'Fixture'
  | 'TestCase'
  | 'TestSuite'
  | 'E2E'
  | 'Integration'
  | 'Unit'
  | 'Performance'
  | 'Load'
  | 'Benchmark'
  
  // Build & Tooling
  | 'Webpack'
  | 'Vite'
  | 'Rollup'
  | 'Babel'
  | 'TypeScript'
  | 'ESLint'
  | 'Prettier'
  | 'Husky'
  | 'Script'
  | 'Makefile'
  | 'Dockerfile'
  | 'Docker-compose'
  | 'Package.json'
  | 'Yarn'
  | 'NPM'
  | 'Composer'
  | 'Cargo'
  | 'POM'
  | 'Gradle'
  | 'Maven'
  
  // Monitoring & Observability
  | 'Logger'
  | 'Metric'
  | 'Tracer'
  | 'Monitor'
  | 'Alert'
  | 'Dashboard'
  | 'Health'
  | 'Probe'
  | 'Instrument'
  
  // Project Structure
  | 'Workspace'
  | 'Project'
  | 'Monorepo'
  | 'Submodule'
  | 'Namespace'
  | 'Domain'
  | 'Boundary'
  | 'Context'
  | 'Aggregate'
  | 'Root'
  
  // Documentation & Metadata
  | 'README'
  | 'Changelog'
  | 'License'
  | 'Contributing'
  | 'Documentation'
  | 'API-Doc'
  | 'Schema-Doc'
  | 'Comment'
  | 'Annotation'
  | 'Decorator'
  | 'Attribute'
  | 'Tag'
  | 'Label'
  | 'Metadata'
  
  // Generic Utilities
  | 'Utility'
  | 'Helper'
  | 'Tool'
  | 'Script'
  | 'Template'
  | 'Generator'
  | 'Builder'
  | 'Parser'
  | 'Lexer'
  | 'Compiler'
  | 'Transpiler'
  | 'Bundler'
  | 'Minifier'
  | 'Optimizer'
  | 'Linter'
  | 'Formatter'
  | 'Validator'
  | 'Sanitizer'
  | 'Encoder'
  | 'Decoder'
  | 'Serializer'
  | 'Deserializer'
  | 'Converter'
  | 'Translator'
  
  // Cloud & Platform
  | 'AWS'
  | 'Azure'
  | 'GCP'
  | 'Firebase'
  | 'Supabase'
  | 'Vercel'
  | 'Netlify'
  | 'Heroku'
  | 'Railway'
  | 'DigitalOcean'
  
  // Protocols & Standards
  | 'HTTP'
  | 'HTTPS'
  | 'WebRTC'
  | 'gRPC'
  | 'MQTT'
  | 'AMQP'
  | 'STOMP'
  | 'WebHook'
  | 'SSE'
  | 'Socket.io'
  
  // Fallback
  | 'Unknown'
  | 'Custom'
  | 'Other';

/**
 * Array of all valid entity types for runtime validation
 * This array must be kept in sync with the EntityType union type above
 */
export const ENTITY_TYPES: readonly EntityType[] = [
  // Core Architecture Patterns
  'Entity', 'Repository', 'Command', 'Query', 'Handler',
  'Controller', 'Service', 'Component', 'Store', 'Event',
  'Job', 'API', 'DTO', 'Interface', 'Configuration',
  
  // Frontend Architecture
  'Page', 'Layout', 'Hook', 'Context', 'Provider', 'Reducer', 'Action', 'Selector',
  'Saga', 'Thunk', 'Effect', 'Guard', 'Resolver', 'Interceptor', 'Directive', 'Pipe',
  'Filter', 'Mixin', 'Composable', 'Vue', 'React', 'Angular', 'Svelte',
  
  // Backend Architecture
  'Model', 'Schema', 'Migration', 'Seeder', 'Factory', 'Gateway', 'Adapter', 'Mapper',
  'Transformer', 'Serializer', 'Validator', 'Middleware', 'Module', 'Plugin', 'Extension',
  'Package', 'Library', 'Framework',
  
  // Database & Data Layer
  'Table', 'View', 'Index', 'Trigger', 'Procedure', 'Function', 'Constraint',
  'Collection', 'Document', 'Cache', 'Queue', 'Topic', 'Stream',
  
  // API & Communication
  'Endpoint', 'Route', 'GraphQL', 'REST', 'RPC', 'WebSocket', 'EventBus',
  'MessageQueue', 'PubSub', 'Gateway', 'Proxy', 'LoadBalancer',
  
  // Authentication & Security
  'Authentication', 'Authorization', 'Permission', 'Role', 'Policy', 'JWT',
  'OAuth', 'SAML', 'Session', 'Token', 'Certificate', 'Secret',
  
  // Infrastructure & DevOps
  'Container', 'Docker', 'Kubernetes', 'Helm', 'Terraform', 'Ansible',
  'Pipeline', 'Workflow', 'Action', 'Job', 'Task', 'Cron', 'Lambda',
  'Function', 'Serverless', 'CDN', 'DNS', 'SSL',
  
  // Testing & Quality
  'Test', 'Spec', 'Mock', 'Stub', 'Fixture', 'TestCase', 'TestSuite',
  'E2E', 'Integration', 'Unit', 'Performance', 'Load', 'Benchmark',
  
  // Build & Tooling
  'Webpack', 'Vite', 'Rollup', 'Babel', 'TypeScript', 'ESLint', 'Prettier',
  'Husky', 'Script', 'Makefile', 'Dockerfile', 'Docker-compose', 'Package.json',
  'Yarn', 'NPM', 'Composer', 'Cargo', 'POM', 'Gradle', 'Maven',
  
  // Monitoring & Observability
  'Logger', 'Metric', 'Tracer', 'Monitor', 'Alert', 'Dashboard',
  'Health', 'Probe', 'Instrument',
  
  // Project Structure
  'Workspace', 'Project', 'Monorepo', 'Submodule', 'Namespace', 'Domain',
  'Boundary', 'Context', 'Aggregate', 'Root',
  
  // Documentation & Metadata
  'README', 'Changelog', 'License', 'Contributing', 'Documentation', 'API-Doc',
  'Schema-Doc', 'Comment', 'Annotation', 'Decorator', 'Attribute', 'Tag',
  'Label', 'Metadata',
  
  // Generic Utilities
  'Utility', 'Helper', 'Tool', 'Script', 'Template', 'Generator', 'Builder', 'Parser',
  'Lexer', 'Compiler', 'Transpiler', 'Bundler', 'Minifier', 'Optimizer',
  'Linter', 'Formatter', 'Validator', 'Sanitizer', 'Encoder', 'Decoder',
  'Serializer', 'Deserializer', 'Converter', 'Translator',
  
  // Cloud & Platform
  'AWS', 'Azure', 'GCP', 'Firebase', 'Supabase', 'Vercel', 'Netlify',
  'Heroku', 'Railway', 'DigitalOcean',
  
  // Protocols & Standards
  'HTTP', 'HTTPS', 'WebRTC', 'gRPC', 'MQTT', 'AMQP', 'STOMP',
  'WebHook', 'SSE', 'Socket.io',
  
  // Fallback
  'Unknown', 'Custom', 'Other'
] as const;

export type DiscoveryMethod = 
  | 'semantic_search' 
  | 'list_code_usages' 
  | 'grep_search'
  | 'file_search'
  | 'manual'
  | 'inference';

export type Priority = 1 | 2 | 3 | 4 | 5;

export interface EntityAnalysisData {
  usageCount: number;
  inheritanceChain: string[];
  architecturalPattern: string;
  relevanceScore: number;
  members: string[];
  isSummarized: boolean;
  summaryConfidence?: 'high' | 'medium' | 'low';
  businessRules: string[];
  integrationPoints: string[];
  testableUnits: string[];
}

export interface RelationshipEdge {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: RelationshipType;
  strength: number; // 0.0 to 1.0
  discoveryMethod: DiscoveryMethod;
  bidirectional: boolean;
  metadata?: { [key: string]: any };
  timestamp: Date;
}

export type RelationshipType = 
  | 'USES'
  | 'IMPLEMENTS'
  | 'EXTENDS'
  | 'CALLS'
  | 'REFERENCES'
  | 'CONTAINS'
  | 'DEPENDS_ON'
  | 'CONFIGURES'
  | 'HANDLES'
  | 'PUBLISHES'
  | 'SUBSCRIBES'
  | 'VALIDATES'
  | 'TRANSFORMS';

export interface DiscoveryChain {
  id: string;
  name: string;
  description: string;
  startEntityId: string;
  endEntityIds: string[];
  chainPath: string[];
  completionStatus: ChainStatus;
  missingLinks: string[];
  priority: Priority;
  estimatedComplexity: number;
  actualProcessingTime?: number;
  blockedBy: string[];
  metadata: { [key: string]: any };
  timestamp: Date;
}

export type ChainStatus = 
  | 'pending'
  | 'in_progress' 
  | 'complete' 
  | 'partial' 
  | 'blocked' 
  | 'failed'
  | 'deferred';

export interface WorkItem {
  id: string;
  entityId: string;
  taskType: WorkItemType;
  priority: Priority;
  status: WorkItemStatus;
  dependencies: string[];
  chainContext: string;
  estimatedEffort: number;
  actualEffort?: number | undefined;
  assignedAgent?: string | undefined;
  errorMessage?: string | undefined;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type WorkItemType = 
  | 'discover_entity'
  | 'analyze_entity'
  | 'find_usages'
  | 'map_relationships'
  | 'validate_chain'
  | 'generate_summary'
  | 'cross_reference';

export type WorkItemStatus = 
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'deferred'
  | 'cancelled';

export interface CheckpointData {
  checkpointId: string;
  sessionId: string;
  phase: string;
  timestamp: Date;
  progressSnapshot: ProgressMetrics;
  entityGraphSnapshot: {
    nodeCount: number;
    edgeCount: number;
    lastProcessedEntity?: string;
  };
  workQueueSnapshot: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  chainStatusSnapshot: {
    [chainId: string]: ChainStatus;
  };
  contextSummary: string;
  nextActions: string[];
  criticalDependencies: string[];
  knownIssues: string[];
  recoveryInstructions: string;
}

export interface ChainValidationResult {
  chainId: string;
  isComplete: boolean;
  completionPercentage: number;
  missingLinks: EntityLink[];
  orphanedEntities: string[];
  circularDependencies: string[][];
  validationErrors: ValidationError[];
  recommendations: string[];
  confidence: number;
}

export interface EntityLink {
  fromEntity: string;
  toEntity: string;
  expectedRelationshipType: RelationshipType;
  reason: string;
}

export interface ValidationError {
  type: 'missing_entity' | 'missing_relationship' | 'circular_dependency' | 'orphaned_entity' | 'inconsistent_data';
  message: string;
  severity: 'error' | 'warning' | 'info';
  entities: string[];
  suggestedFix?: string;
}

export interface DiscoveryReport {
  sessionId: string;
  generatedAt: Date;
  summary: DiscoveryReportSummary;
  entityStatistics: EntityStatistics;
  chainAnalysis: ChainAnalysis;
  completenessAssessment: CompletenessAssessment;
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
  exportedData: {
    yamlFilePath: string;
    graphVisualizationPath?: string | undefined;
    rawDataPath?: string | undefined;
  };
}

export interface DiscoveryReportSummary {
  totalEntitiesDiscovered: number;
  totalRelationshipsFound: number;
  completeChainsCount: number;
  partialChainsCount: number;
  processingTimeTotal: number;
  coveragePercentage: number;
}

export interface EntityStatistics {
  byType: { [entityType: string]: number };
  byPriority: { [priority: string]: number };
  byDiscoveryMethod: { [method: string]: number };
  topUsedEntities: Array<{ entityId: string; usageCount: number }>;
  orphanedEntities: string[];
}

export interface ChainAnalysis {
  identifiedChains: DiscoveryChain[];
  completedChains: DiscoveryChain[];
  blockedChains: DiscoveryChain[];
  averageChainLength: number;
  longestChain: string;
  criticalPathAnalysis: string[];
}

export interface CompletenessAssessment {
  overallCompleteness: number;
  domainCoverage: { [domain: string]: number };
  missingComponentTypes: EntityType[];
  suspectedMissingEntities: string[];
  validationResults: ChainValidationResult[];
}

export interface PerformanceMetrics {
  totalProcessingTime: number;
  averageEntityProcessingTime: number;
  toolUsageStatistics: { [tool: string]: number };
  bottleneckAnalysis: string[];
  memoryUsage: number;
  contextSwitchCount: number;
}

// External Storage Recovery Types
export interface BackupMetadata {
  filePath: string;
  sessionId: string;
  timestamp: Date;
  totalEntities: number;
  totalRelationships: number;
  entityTypes: Record<string, number>;
  estimatedTokens: number;
  fileSize: number;
}

export interface EntityFilter {
  types?: string[];
  ids?: string[];
  relatedTo?: string[];
  relationshipTypes?: string[];
  timeRange?: {
    from: Date;
    to: Date;
  };
}

export interface RecoveryStrategy {
  type: 'selective' | 'progressive' | 'priority_based' | 'full' | 'metadata_only';
  maxTokens: number;
  filter?: EntityFilter;
  continueFrom?: number;
}

export interface RecoveredContext {
  entities: EntityNode[];
  relationships: RelationshipEdge[];
  tokenCost: number;
  recoveryTime: number;
  sourceBackups: string[];
  summary: string;
  hasMore: boolean;
  nextOffset?: number;
}

export interface BackupAnalysis {
  availableBackups: BackupMetadata[];
  totalFiles: number;
  totalEntities: number;
  totalRelationships: number;
  entityDistribution: Record<string, number>;
  timeRange: {
    earliest: Date;
    latest: Date;
  };
  estimatedTotalTokens: number;
  recommendations: string[];
}

export interface OutputResult {
  content: string;
  format: 'markdown' | 'json' | 'yaml' | 'structured';
  tokenCount: number;
  pageInfo?: {
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  aiSummary?: string;
  retrievalInstructions?: string;
  storageLocation?: string;
}

// External State Management Interface
export interface ExternalStateManager {
  // Session Management
  initializeSession(taskDescription: string, workspaceRoot: string): Promise<DiscoverySession>;
  saveSession(session: DiscoverySession): Promise<void>;
  loadSession(sessionId: string): Promise<DiscoverySession | null>;
  
  // Checkpoint Management
  saveCheckpoint(sessionId: string, checkpoint: CheckpointData): Promise<void>;
  loadCheckpoint(sessionId: string, checkpointId?: string): Promise<CheckpointData | null>;
  listCheckpoints(sessionId: string): Promise<CheckpointData[]>;
  
  // Entity Graph Management
  addEntity(entity: EntityNode): Promise<void>;
  updateEntity(entityId: string, updates: Partial<EntityNode>): Promise<void>;
  getEntity(entityId: string): Promise<EntityNode | null>;
  getAllEntities(filter?: Partial<EntityNode>): Promise<EntityNode[]>;
  
  // Relationship Management
  addRelationship(relationship: RelationshipEdge): Promise<void>;
  getRelationships(entityId: string, relationshipType?: RelationshipType): Promise<RelationshipEdge[]>;
  findPath(fromEntityId: string, toEntityId: string): Promise<string[]>;
  
  // Work Queue Management
  addWorkItem(workItem: WorkItem): Promise<void>;
  getNextWorkItem(priority?: Priority, agent?: string): Promise<WorkItem | null>;
  updateWorkItemStatus(workItemId: string, status: WorkItemStatus, errorMessage?: string): Promise<void>;
  getWorkQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }>;
  
  // Chain Management
  addChain(chain: DiscoveryChain): Promise<void>;
  updateChainStatus(chainId: string, status: ChainStatus): Promise<void>;
  validateChain(chainId: string): Promise<ChainValidationResult>;
  getAllChains(): Promise<DiscoveryChain[]>;
  
  // Reporting
  generateReport(sessionId: string): Promise<DiscoveryReport>;
  exportToYaml(sessionId: string, filePath: string): Promise<void>;
  exportToGraph(sessionId: string, format: 'dot' | 'json' | 'svg'): Promise<string>;
}
