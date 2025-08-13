/**
 * Central constants for AI Chain Traversal Tools extension
 * Provides configuration values, tool names, and shared settings
 */

// Extension Metadata
export const EXTENSION_NAME = 'ai-chain-traversal-tools';
export const EXTENSION_DISPLAY_NAME = 'AI Chain Traversal Tools';
export const EXTENSION_VERSION = '1.0.0';

// Language Model Tool Names
export const TOOL_NAMES = {
  INITIALIZE_SESSION: 'ai-chain-traversal_initializeSession',
  ADD_ENTITY: 'ai-chain-traversal_addEntity',
  ADD_RELATIONSHIP: 'ai-chain-traversal_addRelationship',
  GET_NEXT_WORK_ITEM: 'ai-chain-traversal_getNextWorkItem',
  MARK_PROCESSED: 'ai-chain-traversal_markProcessed',
  VALIDATE_CHAINS: 'ai-chain-traversal_validateChains',
  GENERATE_REPORT: 'ai-chain-traversal_generateReport',
  COORDINATE_AGENTS: 'ai-chain-traversal_coordinateAgents',
  RECOVER_CONTEXT: 'ai-chain-traversal_recoverContext',
  ANALYZE_BACKUPS: 'ai-chain-traversal_analyzeBackups',
  OUTPUT_RESULTS: 'ai-chain-traversal_outputResults'
} as const;

// Configuration Keys
export const CONFIG_KEYS = {
  AUTO_SAVE_INTERVAL: 'aiChainTraversal.autoSaveInterval',
  MAX_ENTITY_CACHE_SIZE: 'aiChainTraversal.maxEntityCacheSize',
  ENABLE_DEBUG_LOGGING: 'aiChainTraversal.enableDebugLogging',
  STATE_FILE_LOCATION: 'aiChainTraversal.stateFileLocation',
  SHOW_PROGRESS_NOTIFICATIONS: 'aiChainTraversal.showProgressNotifications',
  
  // Token Management
  TOKEN_MAX_TOKENS: 'aiChainTraversal.tokenManagement.maxTokens',
  TOKEN_CHARACTERS_PER_TOKEN: 'aiChainTraversal.tokenManagement.charactersPerToken',
  TOKEN_WARNING_THRESHOLD: 'aiChainTraversal.tokenManagement.warningThreshold',
  TOKEN_CRITICAL_THRESHOLD: 'aiChainTraversal.tokenManagement.criticalThreshold',
  TOKEN_REDUCTION_TARGET: 'aiChainTraversal.tokenManagement.reductionTarget',
  TOKEN_MAX_ENTITIES_PER_TYPE: 'aiChainTraversal.tokenManagement.maxEntitiesPerType',
  TOKEN_PRESERVE_ENTITY_TYPES: 'aiChainTraversal.tokenManagement.preserveEntityTypes',
  
  // Performance
  PERF_MEMORY_WARNING_THRESHOLD: 'aiChainTraversal.performance.memoryWarningThreshold',
  PERF_MEMORY_ERROR_THRESHOLD: 'aiChainTraversal.performance.memoryErrorThreshold',
  PERF_MAX_MEMORY_USAGE_MB: 'aiChainTraversal.performance.maxMemoryUsageMB',
  PERF_RESPONSE_TIME_WARNING_MS: 'aiChainTraversal.performance.responseTimeWarningMs',
  PERF_MAX_RELATIONSHIP_CACHE_SIZE: 'aiChainTraversal.performance.maxRelationshipCacheSize',
  PERF_CACHE_CLEANUP_PERCENTAGE: 'aiChainTraversal.performance.cacheCleanupPercentage',
  PERF_METRICS_HISTORY_LIMIT: 'aiChainTraversal.performance.metricsHistoryLimit',
  
  // Multi-Agent
  AGENT_TIMEOUT_MS: 'aiChainTraversal.multiAgent.agentTimeoutMs',
  
  // Validation
  VALIDATION_COMPLETENESS_THRESHOLD: 'aiChainTraversal.validation.completenessThreshold',
  VALIDATION_COVERAGE_THRESHOLD: 'aiChainTraversal.validation.coverageThreshold',
  
  // General
  GENERAL_MAX_TASK_DESCRIPTION_LENGTH: 'aiChainTraversal.general.maxTaskDescriptionLength',
  GENERAL_CACHE_CLEANUP_BUFFER: 'aiChainTraversal.general.cacheCleanupBuffer'
} as const;

// Default Configuration Values
export const DEFAULT_CONFIG = {
  AUTO_SAVE_INTERVAL: 30,
  MAX_ENTITY_CACHE_SIZE: 10000,
  ENABLE_DEBUG_LOGGING: true,
  STATE_FILE_LOCATION: '.vscode/chain-traversal',
  SHOW_PROGRESS_NOTIFICATIONS: true,
  
  // Token Management Defaults
  TOKEN_MAX_TOKENS: 128000,
  TOKEN_CHARACTERS_PER_TOKEN: 4,
  TOKEN_WARNING_THRESHOLD: 90,
  TOKEN_CRITICAL_THRESHOLD: 95,
  TOKEN_REDUCTION_TARGET: 70,
  TOKEN_MAX_ENTITIES_PER_TYPE: 20,
  TOKEN_PRESERVE_ENTITY_TYPES: ['controller', 'service', 'interface', 'component'],
  
  // Performance Defaults
  PERF_MEMORY_WARNING_THRESHOLD: 75,
  PERF_MEMORY_ERROR_THRESHOLD: 90,
  PERF_MAX_MEMORY_USAGE_MB: 2048,
  PERF_RESPONSE_TIME_WARNING_MS: 10000,
  PERF_MAX_RELATIONSHIP_CACHE_SIZE: 50000,
  PERF_CACHE_CLEANUP_PERCENTAGE: 20,
  PERF_METRICS_HISTORY_LIMIT: 100,
  
  // Multi-Agent Defaults
  AGENT_TIMEOUT_MS: 300000, // 5 minutes
  
  // Validation Defaults
  VALIDATION_COMPLETENESS_THRESHOLD: 90,
  VALIDATION_COVERAGE_THRESHOLD: 95,
  
  // General Defaults
  GENERAL_MAX_TASK_DESCRIPTION_LENGTH: 1000,
  GENERAL_CACHE_CLEANUP_BUFFER: 100
} as const;

// Token Management Threshold Defaults
export const DEFAULT_TOKEN_THRESHOLDS = {
  COMPRESSION_TRIGGER_THRESHOLD: 0.9,    // Trigger compression at 90% of maxTokens
  EMERGENCY_COMPRESSION_THRESHOLD: 0.95, // Emergency compression at 95% of maxTokens  
  HIGH_USAGE_WARNING_THRESHOLD: 0.8,     // Warning at 80% of maxTokens
  CACHE_EVICTION_THRESHOLD: 0.8          // Cache eviction at 80% of maxSize
} as const;

// Entity Types
export const ENTITY_TYPES = {
  CLASS: 'Class',
  INTERFACE: 'Interface',
  FUNCTION: 'Function',
  METHOD: 'Method',
  PROPERTY: 'Property',
  VARIABLE: 'Variable',
  COMPONENT: 'Component',
  SERVICE: 'Service',
  CONTROLLER: 'Controller',
  MODEL: 'Model',
  ENUM: 'Enum',
  TYPE_ALIAS: 'TypeAlias',
  MODULE: 'Module',
  NAMESPACE: 'Namespace'
} as const;

// Relationship Types
export const RELATIONSHIP_TYPES = {
  USES: 'USES',
  DEPENDS_ON: 'DEPENDS_ON',
  CALLS: 'CALLS',
  IMPLEMENTS: 'IMPLEMENTS',
  EXTENDS: 'EXTENDS',
  CONTAINS: 'CONTAINS',
  REFERENCES: 'REFERENCES',
  IMPORTS: 'IMPORTS',
  EXPORTS: 'EXPORTS',
  INHERITS_FROM: 'INHERITS_FROM',
  COMPOSED_OF: 'COMPOSED_OF',
  AGGREGATES: 'AGGREGATES',
  ASSOCIATED_WITH: 'ASSOCIATED_WITH'
} as const;

// Discovery Methods
export const DISCOVERY_METHODS = {
  SEMANTIC_SEARCH: 'SemanticSearch',
  FILE_SEARCH: 'FileSearch',
  GREP_SEARCH: 'GrepSearch',
  CODE_USAGE_ANALYSIS: 'CodeUsageAnalysis',
  MANUAL_ENTRY: 'ManualEntry',
  DEPENDENCY_CHAIN: 'DependencyChain',
  RELATIONSHIP_TRAVERSAL: 'RelationshipTraversal'
} as const;

// Processing States
export const PROCESSING_STATES = {
  NOT_STARTED: 'NotStarted',
  IN_PROGRESS: 'InProgress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped'
} as const;

// Priority Levels
export const PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  DEFERRED: 5
} as const;

// File Extensions
export const FILE_EXTENSIONS = {
  STATE_FILE: '.chain-state.json',
  CHECKPOINT_FILE: '.checkpoint.json',
  REPORT_YAML: '.report.yaml',
  REPORT_JSON: '.report.json',
  REPORT_MARKDOWN: '.report.md'
} as const;

// Status Messages
export const STATUS_MESSAGES = {
  INITIALIZING: '🚀 Initializing discovery session...',
  PROCESSING: '⚙️ Processing entities...',
  VALIDATING: '🔍 Validating chains...',
  GENERATING_REPORT: '📊 Generating discovery report...',
  COMPLETED: '✅ Chain traversal completed',
  ERROR: '❌ Error in chain traversal operation',
  SAVING: '💾 Saving discovery state...',
  LOADING: '📂 Loading discovery state...'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  SESSION_NOT_INITIALIZED: 'Discovery session not initialized. Please initialize a session first.',
  INVALID_ENTITY: 'Invalid entity data provided.',
  INVALID_RELATIONSHIP: 'Invalid relationship data provided.',
  ENTITY_NOT_FOUND: 'Entity not found in discovery graph.',
  RELATIONSHIP_NOT_FOUND: 'Relationship not found in discovery graph.',
  SAVE_FAILED: 'Failed to save discovery state.',
  LOAD_FAILED: 'Failed to load discovery state.',
  VALIDATION_FAILED: 'Chain validation failed.',
  REPORT_GENERATION_FAILED: 'Failed to generate discovery report.'
} as const;

// Log Levels
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
} as const;

// Tag Categories for Language Model Tools
export const TOOL_TAGS = {
  DISCOVERY: 'discovery',
  SESSION_MANAGEMENT: 'session-management',
  STATE_MANAGEMENT: 'state-management',
  CHAIN_TRAVERSAL: 'chain-traversal',
  ENTITY_MANAGEMENT: 'entity-management',
  GRAPH_BUILDING: 'graph-building',
  RELATIONSHIP_MANAGEMENT: 'relationship-management',
  DEPENDENCY_MAPPING: 'dependency-mapping',
  WORK_MANAGEMENT: 'work-management',
  PRIORITY_PROCESSING: 'priority-processing',
  COORDINATION: 'coordination',
  COMPLETION_TRACKING: 'completion-tracking',
  PROGRESS_MANAGEMENT: 'progress-management',
  STATE_UPDATES: 'state-updates',
  VALIDATION: 'validation',
  COMPLETENESS_ANALYSIS: 'completeness-analysis',
  QUALITY_ASSURANCE: 'quality-assurance',
  REPORTING: 'reporting',
  ANALYSIS_SUMMARY: 'analysis-summary',
  EXPORT: 'export'
} as const;

// Export format types
export const EXPORT_FORMATS = {
  YAML: 'yaml',
  JSON: 'json',
  MARKDOWN: 'markdown'
} as const;

// Common regex patterns
export const REGEX_PATTERNS = {
  ENTITY_ID: /^[a-zA-Z0-9_-]+$/,
  FILE_PATH: /^[a-zA-Z]:[\\\/].*|^\/.*|^\.\.?\/.*$/,
  SESSION_ID: /^session_[a-zA-Z0-9_-]+$/
} as const;

// Default timeouts (in milliseconds)
export const TIMEOUTS = {
  OPERATION_TIMEOUT: 30000,
  SAVE_TIMEOUT: 10000,
  LOAD_TIMEOUT: 10000,
  VALIDATION_TIMEOUT: 60000
} as const;

// Memory limits
export const MEMORY_LIMITS = {
  MAX_ENTITIES_IN_MEMORY: 10000,
  MAX_RELATIONSHIPS_IN_MEMORY: 50000,
  MAX_WORK_QUEUE_SIZE: 1000
} as const;
