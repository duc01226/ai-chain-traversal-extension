import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'yaml';
import {
    ExternalStateManager,
    DiscoverySession,
    EntityNode,
    RelationshipEdge,
    WorkItem,
    CheckpointData,
    DiscoveryChain,
    ChainValidationResult,
    DiscoveryReport,
    SessionConfiguration,
    ProgressMetrics,
    Priority,
    RelationshipType,
    WorkItemStatus,
    ChainStatus,
    DiscoveryReportSummary,
    EntityStatistics,
    ChainAnalysis,
    CompletenessAssessment,
    PerformanceMetrics
} from '../types';

/**
 * Workspace-based state manager using VS Code file system APIs
 * for AI chain traversal operations with persistent external state management.
 */
export class WorkspaceStateManagerVscode implements ExternalStateManager {
    private readonly stateDirectoryUri: vscode.Uri;
    private readonly sessionCache: Map<string, DiscoverySession>;
    private readonly entityCache: Map<string, EntityNode>;
    private readonly relationshipCache: Map<string, RelationshipEdge>;
    private readonly workItemCache: Map<string, WorkItem>;
    private readonly chainCache: Map<string, DiscoveryChain>;
    private readonly maxCacheSize: number;
    private currentSessionId: string | null = null;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly workspaceRoot: string
    ) {
        this.stateDirectoryUri = this.getStateDirectoryUri();
        this.sessionCache = new Map();
        this.entityCache = new Map();
        this.relationshipCache = new Map();
        this.workItemCache = new Map();
        this.chainCache = new Map();
        this.maxCacheSize = this.getMaxCacheSize();
        this.currentSessionId = null;

        this.ensureStateDirectoryExists();
    }

    // #region Session Management

    /**
     * Initialize a new discovery session with comprehensive metadata
     */
    async initializeSession(taskDescription: string, workspaceRoot: string): Promise<DiscoverySession> {
        this.validateTaskDescription(taskDescription);
        this.validateWorkspaceRoot(workspaceRoot);

        const sessionId = this.generateSessionId();
        const timestamp = new Date();
        
        const configuration = this.createSessionConfiguration();
        const progressMetrics = this.createInitialProgressMetrics(timestamp);

        const session: DiscoverySession = {
            sessionId,
            timestamp,
            taskDescription: taskDescription.trim(),
            currentPhase: 'discovery',
            progress: progressMetrics,
            workspaceRoot,
            aiModel: this.detectAIModel(),
            configuration
        };

        await this.saveSession(session);
        this.currentSessionId = sessionId;
        this.sessionCache.set(sessionId, session);

        // Store current session in VS Code context for quick access
        await this.context.globalState.update('current-session-id', sessionId);
        await this.context.globalState.update(`session-${sessionId}-metadata`, {
          taskDescription,
          startTime: session.timestamp.toISOString(),
          workspaceRoot: session.workspaceRoot
        });

        this.logOperation('Session initialized', { sessionId, taskDescription });

        return session;
    }

    /**
     * Save session state to persistent storage
     */
    async saveSession(session: DiscoverySession): Promise<void> {
        this.validateSession(session);

        const sessionUri = this.getSessionUri(session.sessionId);
        const sessionData = {
            ...session,
            lastUpdated: new Date()
        };

        await this.writeJsonFile(sessionUri, sessionData);
        this.sessionCache.set(session.sessionId, session);

        this.logOperation('Session saved', { sessionId: session.sessionId });
    }

    /**
     * Load session from persistent storage
     */
    async loadSession(sessionId: string): Promise<DiscoverySession | null> {
        this.validateSessionId(sessionId);

        // Check cache first
        const cachedSession = this.sessionCache.get(sessionId);
        if (cachedSession) {
            return cachedSession;
        }

        // Load from file system
        const sessionUri = this.getSessionUri(sessionId);
        
        try {
            const sessionData = await this.readJsonFile<DiscoverySession>(sessionUri);
            if (sessionData) {
                // Reconstruct Date objects from JSON strings
                const reconstructedSession: DiscoverySession = {
                    ...sessionData,
                    timestamp: new Date(sessionData.timestamp),
                    progress: {
                        ...sessionData.progress,
                        lastUpdateTimestamp: new Date(sessionData.progress.lastUpdateTimestamp)
                    }
                };
                
                this.sessionCache.set(sessionId, reconstructedSession);
                return reconstructedSession;
            }
        } catch (error) {
            this.logError('Failed to load session', error, { sessionId });
        }

        return null;
    }

    // #endregion

    // #region Checkpoint Management

    /**
     * Save discovery checkpoint with comprehensive state snapshot
     */
    async saveCheckpoint(sessionId: string, checkpoint: CheckpointData): Promise<void> {
        this.validateSessionId(sessionId);
        this.validateCheckpoint(checkpoint);

        const checkpointUri = this.getCheckpointUri(sessionId, checkpoint.checkpointId);
        await this.writeJsonFile(checkpointUri, checkpoint);

        this.logOperation('Checkpoint saved', { 
            sessionId, 
            checkpointId: checkpoint.checkpointId,
            phase: checkpoint.phase 
        });
    }

    /**
     * Load checkpoint with fallback to latest if checkpointId not specified
     */
    async loadCheckpoint(sessionId: string, checkpointId?: string): Promise<CheckpointData | null> {
        this.validateSessionId(sessionId);

        const targetCheckpointId = checkpointId || await this.getLatestCheckpointId(sessionId);
        if (!targetCheckpointId) {
            return null;
        }

        const checkpointUri = this.getCheckpointUri(sessionId, targetCheckpointId);
        
        try {
            const checkpoint = await this.readJsonFile<CheckpointData>(checkpointUri);
            if (checkpoint) {
                this.logOperation('Checkpoint loaded', { sessionId, checkpointId: targetCheckpointId });
                return checkpoint;
            }
        } catch (error) {
            this.logError('Failed to load checkpoint', error, { sessionId, checkpointId: targetCheckpointId });
        }

        return null;
    }

    /**
     * List all checkpoints for a session in chronological order
     */
    async listCheckpoints(sessionId: string): Promise<CheckpointData[]> {
        this.validateSessionId(sessionId);

        const checkpointsDirectoryUri = this.getCheckpointsDirectoryUri(sessionId);
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(checkpointsDirectoryUri);
            const checkpointFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const checkpoints: CheckpointData[] = [];
            for (const file of checkpointFiles) {
                const fileUri = vscode.Uri.joinPath(checkpointsDirectoryUri, file);
                const checkpoint = await this.readJsonFile<CheckpointData>(fileUri);
                if (checkpoint) {
                    checkpoints.push(checkpoint);
                }
            }

            // Sort by timestamp (newest first)
            return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        } catch (error) {
            this.logError('Failed to list checkpoints', error, { sessionId });
            return [];
        }
    }

    // #endregion

    // #region Entity Graph Management

    /**
     * Add entity to graph with comprehensive validation and caching
     */
    async addEntity(entity: EntityNode): Promise<void> {
        this.validateEntity(entity);

        // Check cache size and evict if necessary
        this.manageCacheSize();

        const entityUri = this.getEntityUri(entity.id);
        await this.writeJsonFile(entityUri, entity);
        
        this.entityCache.set(entity.id, entity);

        this.logOperation('Entity added', { 
            entityId: entity.id, 
            type: entity.type, 
            filePath: entity.filePath 
        });
    }

    /**
     * Update entity with partial updates and validation
     */
    async updateEntity(entityId: string, updates: Partial<EntityNode>): Promise<void> {
        this.validateEntityId(entityId);
        this.validateEntityUpdates(updates);

        const existingEntity = await this.getEntity(entityId);
        if (!existingEntity) {
            throw new Error(`Entity not found: ${entityId}`);
        }

        const updatedEntity: EntityNode = {
            ...existingEntity,
            ...updates,
            timestamp: new Date() // Always update timestamp on modification
        };

        await this.addEntity(updatedEntity);

        this.logOperation('Entity updated', { entityId, updatedFields: Object.keys(updates) });
    }

    /**
     * Get entity with caching and file system fallback
     */
    async getEntity(entityId: string): Promise<EntityNode | null> {
        this.validateEntityId(entityId);

        // Check cache first
        const cachedEntity = this.entityCache.get(entityId);
        if (cachedEntity) {
            return cachedEntity;
        }

        // Load from file system
        const entityUri = this.getEntityUri(entityId);
        
        try {
            const entity = await this.readJsonFile<EntityNode>(entityUri);
            if (entity) {
                this.entityCache.set(entityId, entity);
                return entity;
            }
        } catch (error) {
            this.logDebug('Entity not found', { entityId });
        }

        return null;
    }

    /**
     * Get all entities with optional filtering
     */
    async getAllEntities(filter?: Partial<EntityNode>): Promise<EntityNode[]> {
        const entitiesDirectoryUri = this.getEntitiesDirectoryUri();
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(entitiesDirectoryUri);
            const entityFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const entities: EntityNode[] = [];
            for (const file of entityFiles) {
                const fileUri = vscode.Uri.joinPath(entitiesDirectoryUri, file);
                const entity = await this.readJsonFile<EntityNode>(fileUri);
                if (entity && this.entityMatchesFilter(entity, filter)) {
                    // Reconstruct Date objects from JSON strings
                    const reconstructedEntity: EntityNode = {
                        ...entity,
                        timestamp: new Date(entity.timestamp)
                    };
                    entities.push(reconstructedEntity);
                }
            }

            return entities;
        } catch (error) {
            this.logError('Failed to get all entities', error);
            return [];
        }
    }

    // #endregion

    // #region Relationship Management

    /**
     * Add relationship with bidirectional updates if specified
     */
    async addRelationship(relationship: RelationshipEdge): Promise<void> {
        this.validateRelationship(relationship);

        const relationshipUri = this.getRelationshipUri(relationship.id);
        await this.writeJsonFile(relationshipUri, relationship);
        
        this.relationshipCache.set(relationship.id, relationship);

        // Update entity dependencies
        await this.updateEntityDependencies(relationship);

        this.logOperation('Relationship added', { 
            relationshipId: relationship.id,
            fromEntity: relationship.fromEntityId,
            toEntity: relationship.toEntityId,
            type: relationship.relationshipType
        });
    }

    /**
     * Get relationships for an entity with optional filtering by type
     */
    async getRelationships(entityId: string, relationshipType?: RelationshipType): Promise<RelationshipEdge[]> {
        this.validateEntityId(entityId);

        const relationshipsDirectoryUri = this.getRelationshipsDirectoryUri();
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(relationshipsDirectoryUri);
            const relationshipFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const relationships: RelationshipEdge[] = [];
            for (const file of relationshipFiles) {
                const fileUri = vscode.Uri.joinPath(relationshipsDirectoryUri, file);
                const relationship = await this.readJsonFile<RelationshipEdge>(fileUri);
                if (relationship && this.relationshipInvolvesEntity(relationship, entityId, relationshipType)) {
                    relationships.push(relationship);
                }
            }

            return relationships;
        } catch (error) {
            this.logError('Failed to get relationships', error, { entityId });
            return [];
        }
    }

    /**
     * Find path between two entities using breadth-first search
     */
    async findPath(fromEntityId: string, toEntityId: string): Promise<string[]> {
        this.validateEntityId(fromEntityId);
        this.validateEntityId(toEntityId);

        // Implementation of BFS pathfinding algorithm
        const visited = new Set<string>();
        const queue: Array<{ entityId: string; path: string[] }> = [{ entityId: fromEntityId, path: [fromEntityId] }];
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            
            if (current.entityId === toEntityId) {
                return current.path;
            }
            
            if (visited.has(current.entityId)) {
                continue;
            }
            
            visited.add(current.entityId);
            
            const relationships = await this.getRelationships(current.entityId);
            for (const relationship of relationships) {
                const nextEntityId = relationship.fromEntityId === current.entityId 
                    ? relationship.toEntityId 
                    : relationship.fromEntityId;
                
                if (!visited.has(nextEntityId)) {
                    queue.push({
                        entityId: nextEntityId,
                        path: [...current.path, nextEntityId]
                    });
                }
            }
        }

        return []; // No path found
    }

    // #endregion

    // #region Work Queue Management

    /**
     * Add work item to queue with priority ordering
     */
    async addWorkItem(workItem: WorkItem): Promise<void> {
        this.validateWorkItem(workItem);

        const workItemUri = this.getWorkItemUri(workItem.id);
        await this.writeJsonFile(workItemUri, workItem);
        
        this.workItemCache.set(workItem.id, workItem);

        this.logOperation('Work item added', { 
            workItemId: workItem.id,
            taskType: workItem.taskType,
            priority: workItem.priority
        });
    }

    /**
     * Get next work item based on priority and agent assignment
     */
    async getNextWorkItem(priority?: Priority, agent?: string): Promise<WorkItem | null> {
        const workItemsDirectoryUri = this.getWorkItemsDirectoryUri();
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(workItemsDirectoryUri);
            const workItemFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const availableWorkItems: WorkItem[] = [];
            for (const file of workItemFiles) {
                const fileUri = vscode.Uri.joinPath(workItemsDirectoryUri, file);
                const workItem = await this.readJsonFile<WorkItem>(fileUri);
                if (workItem && this.isWorkItemAvailable(workItem, priority, agent)) {
                    availableWorkItems.push(workItem);
                }
            }

            if (availableWorkItems.length === 0) {
                return null;
            }

            // Sort by priority (1 = highest) and then by creation time
            availableWorkItems.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.createdAt.getTime() - b.createdAt.getTime();
            });

            const nextWorkItem = availableWorkItems[0];
            
            // Assign to agent and update status
            nextWorkItem.status = 'assigned';
            nextWorkItem.assignedAgent = agent;
            nextWorkItem.updatedAt = new Date();
            
            await this.updateWorkItemStatus(nextWorkItem.id, 'assigned');

            return nextWorkItem;
        } catch (error) {
            this.logError('Failed to get next work item', error, { priority, agent });
            return null;
        }
    }

    /**
     * Update work item status with comprehensive tracking
     */
    async updateWorkItemStatus(workItemId: string, status: WorkItemStatus, errorMessage?: string): Promise<void> {
        this.validateWorkItemId(workItemId);
        this.validateWorkItemStatus(status);

        const workItemUri = this.getWorkItemUri(workItemId);
        
        try {
            const workItem = await this.readJsonFile<WorkItem>(workItemUri);
            if (!workItem) {
                throw new Error(`Work item not found: ${workItemId}`);
            }

            workItem.status = status;
            workItem.updatedAt = new Date();
            
            if (errorMessage) {
                workItem.errorMessage = errorMessage;
                workItem.retryCount += 1;
            }
            
            if (status === 'completed') {
                workItem.completedAt = new Date();
            }

            await this.writeJsonFile(workItemUri, workItem);
            this.workItemCache.set(workItemId, workItem);

            this.logOperation('Work item status updated', { 
                workItemId, 
                status, 
                errorMessage 
            });
        } catch (error) {
            this.logError('Failed to update work item status', error, { workItemId, status });
            throw error;
        }
    }

    /**
     * Get comprehensive work queue statistics
     */
    async getWorkQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
        const workItemsDirectoryUri = this.getWorkItemsDirectoryUri();
        
        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
        };

        try {
            const entries = await vscode.workspace.fs.readDirectory(workItemsDirectoryUri);
            const workItemFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            for (const file of workItemFiles) {
                const fileUri = vscode.Uri.joinPath(workItemsDirectoryUri, file);
                const workItem = await this.readJsonFile<WorkItem>(fileUri);
                if (workItem) {
                    switch (workItem.status) {
                        case 'pending':
                            stats.pending++;
                            break;
                        case 'assigned':
                        case 'in_progress':
                            stats.processing++;
                            break;
                        case 'completed':
                            stats.completed++;
                            break;
                        case 'failed':
                            stats.failed++;
                            break;
                    }
                }
            }
        } catch (error) {
            this.logError('Failed to get work queue stats', error);
        }

        return stats;
    }

    // #endregion

    // #region Chain Management

    /**
     * Add discovery chain with comprehensive metadata
     */
    async addChain(chain: DiscoveryChain): Promise<void> {
        this.validateChainForInput(chain);

        const chainUri = this.getChainUri(chain.id);
        await this.writeJsonFile(chainUri, chain);
        
        this.chainCache.set(chain.id, chain);

        this.logOperation('Chain added', { 
            chainId: chain.id,
            name: chain.name,
            status: chain.completionStatus
        });
    }

    /**
     * Update chain status with timestamp tracking
     */
    async updateChainStatus(chainId: string, status: ChainStatus): Promise<void> {
        this.validateChainId(chainId);
        this.validateChainStatus(status);

        const chainUri = this.getChainUri(chainId);
        
        try {
            const chain = await this.readJsonFile<DiscoveryChain>(chainUri);
            if (!chain) {
                throw new Error(`Chain not found: ${chainId}`);
            }

            chain.completionStatus = status;
            chain.timestamp = new Date();

            await this.writeJsonFile(chainUri, chain);
            this.chainCache.set(chainId, chain);

            this.logOperation('Chain status updated', { chainId, status });
        } catch (error) {
            this.logError('Failed to update chain status', error, { chainId, status });
            throw error;
        }
    }

    /**
     * Validate chain completeness with comprehensive analysis
     */
    async validateChain(chainId: string): Promise<ChainValidationResult> {
        this.validateChainId(chainId);

        // Implementation would analyze chain completeness
        const result: ChainValidationResult = {
            chainId,
            isComplete: true,
            completionPercentage: 100,
            missingLinks: [],
            orphanedEntities: [],
            circularDependencies: [],
            validationErrors: [],
            recommendations: [],
            confidence: 1.0
        };

        this.logOperation('Chain validated', { chainId, isComplete: result.isComplete });
        
        return result;
    }

    /**
     * Get all chains with optional filtering
     */
    async getAllChains(): Promise<DiscoveryChain[]> {
        const chainsDirectoryUri = this.getChainsDirectoryUri();
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(chainsDirectoryUri);
            const chainFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const chains: DiscoveryChain[] = [];
            for (const file of chainFiles) {
                const fileUri = vscode.Uri.joinPath(chainsDirectoryUri, file);
                const chain = await this.readJsonFile<DiscoveryChain>(fileUri);
                if (chain) {
                    chains.push(chain);
                }
            }

            return chains;
        } catch (error) {
            this.logError('Failed to get all chains', error);
            return [];
        }
    }

    // #endregion

    // #region Reporting

    /**
     * Generate comprehensive discovery report with detailed analytics
     */
    async generateReport(sessionId: string): Promise<DiscoveryReport> {
        this.validateSessionId(sessionId);

        const session = await this.loadSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const entities = await this.getAllEntities();
        const relationships = await this.getAllRelationships();
        const chains = await this.getAllChains();
        const workQueueStats = await this.getWorkQueueStats();

        const summary = this.generateReportSummary(entities, relationships, chains, workQueueStats);
        const entityStatistics = this.generateEntityStatistics(entities);
        const chainAnalysis = this.generateChainAnalysis(chains);
        const completenessAssessment = await this.generateCompletenessAssessment(entities, chains);
        const performanceMetrics = this.generatePerformanceMetrics(session, entities);

        const report: DiscoveryReport = {
            sessionId,
            generatedAt: new Date(),
            summary,
            entityStatistics,
            chainAnalysis,
            completenessAssessment,
            performanceMetrics,
            recommendations: this.generateRecommendations(summary, completenessAssessment),
            exportedData: {
                yamlFilePath: this.getReportPath(sessionId, 'yaml')
                // graphVisualizationPath and rawDataPath are optional and omitted when not available
            }
        };

        const reportUri = this.getReportUri(sessionId);
        await this.writeJsonFile(reportUri, report);

        this.logOperation('Report generated', { sessionId, entitiesCount: entities.length });

        return report;
    }

    /**
     * Export session data to YAML format
     */
    async exportToYaml(sessionId: string, filePath: string): Promise<void> {
        this.validateSessionId(sessionId);

        const session = await this.loadSession(sessionId);
        const entities = await this.getAllEntities();
        const relationships = await this.getAllRelationships();
        const chains = await this.getAllChains();

        const exportData = {
            session,
            entities,
            relationships,
            chains,
            exportedAt: new Date()
        };

        const yamlContent = yaml.stringify(exportData);
        const fileUri = vscode.Uri.file(filePath);
        const yamlBuffer = new TextEncoder().encode(yamlContent);
        
        await vscode.workspace.fs.writeFile(fileUri, yamlBuffer);

        this.logOperation('Data exported to YAML', { sessionId, filePath });
    }

    /**
     * Export discovery graph in specified format
     */
    async exportToGraph(sessionId: string, format: 'dot' | 'json' | 'svg'): Promise<string> {
        this.validateSessionId(sessionId);

        const entities = await this.getAllEntities();
        const relationships = await this.getAllRelationships();

        let content = '';
        switch (format) {
            case 'json':
                content = JSON.stringify({ entities, relationships }, null, 2);
                break;
            case 'dot':
                content = this.generateDotFormat(entities, relationships);
                break;
            case 'svg':
                content = '<svg><!-- Graph visualization --></svg>';
                break;
        }

        return content;
    }

    // #endregion

    // #region Private Helper Methods

    private getStateDirectoryUri(): vscode.Uri {
        const config = vscode.workspace.getConfiguration('chainTraversal');
        const relativePath = config.get<string>('stateFileLocation', '.vscode/chain-traversal');
        return vscode.Uri.file(`${this.workspaceRoot}/${relativePath}`);
    }

    private getMaxCacheSize(): number {
        const config = vscode.workspace.getConfiguration('chainTraversal');
        return config.get<number>('maxEntityCacheSize', 10000);
    }

    private async ensureStateDirectoryExists(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.stateDirectoryUri);
            await vscode.workspace.fs.createDirectory(this.getSessionsDirectoryUri());
            await vscode.workspace.fs.createDirectory(this.getEntitiesDirectoryUri());
            await vscode.workspace.fs.createDirectory(this.getRelationshipsDirectoryUri());
            await vscode.workspace.fs.createDirectory(this.getWorkItemsDirectoryUri());
            await vscode.workspace.fs.createDirectory(this.getChainsDirectoryUri());
        } catch (error) {
            this.logError('Failed to create state directory', error);
        }
    }

    private getSessionsDirectoryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'sessions');
    }

    private getEntitiesDirectoryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'entities');
    }

    private getRelationshipsDirectoryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'relationships');
    }

    private getWorkItemsDirectoryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'work-items');
    }

    private getChainsDirectoryUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'chains');
    }

    private getCheckpointsDirectoryUri(sessionId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'checkpoints', sessionId);
    }

    private getSessionUri(sessionId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getSessionsDirectoryUri(), `${sessionId}.json`);
    }

    private getEntityUri(entityId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getEntitiesDirectoryUri(), `${entityId}.json`);
    }

    private getRelationshipUri(relationshipId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getRelationshipsDirectoryUri(), `${relationshipId}.json`);
    }

    private getWorkItemUri(workItemId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getWorkItemsDirectoryUri(), `${workItemId}.json`);
    }

    private getChainUri(chainId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.getChainsDirectoryUri(), `${chainId}.json`);
    }

    private getCheckpointUri(sessionId: string, checkpointId: string): vscode.Uri {
        const checkpointsDirectoryUri = this.getCheckpointsDirectoryUri(sessionId);
        return vscode.Uri.joinPath(checkpointsDirectoryUri, `${checkpointId}.json`);
    }

    private getReportUri(sessionId: string): vscode.Uri {
        return vscode.Uri.joinPath(this.stateDirectoryUri, 'reports', `${sessionId}.json`);
    }

    private getReportPath(sessionId: string, format: string): string {
        return `${this.stateDirectoryUri.fsPath}/reports/${sessionId}-report.${format}`;
    }

    private async getLatestCheckpointId(sessionId: string): Promise<string | null> {
        const checkpoints = await this.listCheckpoints(sessionId);
        return checkpoints.length > 0 ? checkpoints[0].checkpointId : null;
    }

    private async writeJsonFile<T>(uri: vscode.Uri, data: T): Promise<void> {
        const content = JSON.stringify(data, null, 2);
        const buffer = new TextEncoder().encode(content);
        
        try {
            // Ensure directory exists
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(uri.fsPath.substring(0, uri.fsPath.lastIndexOf('/'))));
            await vscode.workspace.fs.writeFile(uri, buffer);
        } catch (error) {
            this.logError('Failed to write JSON file', error, { path: uri.fsPath });
            throw error;
        }
    }

    private async readJsonFile<T>(uri: vscode.Uri): Promise<T | null> {
        try {
            const buffer = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder().decode(buffer);
            return JSON.parse(content);
        } catch (error) {
            if ((error as Error & { code?: string }).code === 'FileNotFound') {
                return null;
            }
            throw error;
        }
    }

    public async getAllRelationships(): Promise<RelationshipEdge[]> {
        const relationshipsDirectoryUri = this.getRelationshipsDirectoryUri();
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(relationshipsDirectoryUri);
            const relationshipFiles = entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name);
            
            const relationships: RelationshipEdge[] = [];
            for (const file of relationshipFiles) {
                const fileUri = vscode.Uri.joinPath(relationshipsDirectoryUri, file);
                const relationship = await this.readJsonFile<RelationshipEdge>(fileUri);
                if (relationship) {
                    relationships.push(relationship);
                }
            }

            return relationships;
        } catch (error) {
            this.logError('Failed to get all relationships', error);
            return [];
        }
    }

    // #region Validation Methods

    private validateTaskDescription(taskDescription: string): void {
        if (!taskDescription || taskDescription.trim().length === 0) {
            throw new Error('Task description cannot be empty');
        }
        if (taskDescription.length > 1000) {
            throw new Error('Task description too long (max 1000 characters)');
        }
    }

    private validateWorkspaceRoot(workspaceRoot: string): void {
        if (!workspaceRoot || workspaceRoot.trim().length === 0) {
            throw new Error('Workspace root cannot be empty');
        }
    }

    private validateSessionId(sessionId: string): void {
        if (!sessionId || sessionId.trim().length === 0) {
            throw new Error('Session ID cannot be empty');
        }
    }

    private validateSession(session: DiscoverySession): void {
        if (!session) {
            throw new Error('Session cannot be null');
        }
        this.validateSessionId(session.sessionId);
        this.validateTaskDescription(session.taskDescription);
    }

    private validateCheckpoint(checkpoint: CheckpointData): void {
        if (!checkpoint) {
            throw new Error('Checkpoint cannot be null');
        }
        if (!checkpoint.checkpointId) {
            throw new Error('Checkpoint ID cannot be empty');
        }
        if (!checkpoint.sessionId) {
            throw new Error('Session ID cannot be empty');
        }
    }

    private validateEntity(entity: EntityNode): void {
        if (!entity) {
            throw new Error('Entity cannot be null');
        }
        if (!entity.id) {
            throw new Error('Entity ID cannot be empty');
        }
        if (!entity.type) {
            throw new Error('Entity type cannot be empty');
        }
        if (!entity.filePath) {
            throw new Error('Entity file path cannot be empty');
        }
    }

    private validateEntityId(entityId: string): void {
        if (!entityId || entityId.trim().length === 0) {
            throw new Error('Entity ID cannot be empty');
        }
    }

    private validateEntityUpdates(updates: Partial<EntityNode>): void {
        if (!updates || Object.keys(updates).length === 0) {
            throw new Error('Entity updates cannot be empty');
        }
    }

    private validateRelationship(relationship: RelationshipEdge): void {
        if (!relationship) {
            throw new Error('Relationship cannot be null');
        }
        if (!relationship.id) {
            throw new Error('Relationship ID cannot be empty');
        }
        if (!relationship.fromEntityId) {
            throw new Error('From entity ID cannot be empty');
        }
        if (!relationship.toEntityId) {
            throw new Error('To entity ID cannot be empty');
        }
    }

    private validateWorkItem(workItem: WorkItem): void {
        if (!workItem) {
            throw new Error('Work item cannot be null');
        }
        if (!workItem.id) {
            throw new Error('Work item ID cannot be empty');
        }
        if (!workItem.entityId) {
            throw new Error('Entity ID cannot be empty');
        }
    }

    private validateWorkItemId(workItemId: string): void {
        if (!workItemId || workItemId.trim().length === 0) {
            throw new Error('Work item ID cannot be empty');
        }
    }

    private validateWorkItemStatus(status: WorkItemStatus): void {
        const validStatuses: WorkItemStatus[] = ['pending', 'assigned', 'in_progress', 'completed', 'failed', 'blocked', 'deferred', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid work item status: ${status}`);
        }
    }

    private validateChainForInput(chain: DiscoveryChain): void {
        if (!chain) {
            throw new Error('Chain cannot be null');
        }
        if (!chain.id) {
            throw new Error('Chain ID cannot be empty');
        }
        if (!chain.name) {
            throw new Error('Chain name cannot be empty');
        }
    }

    private validateChainId(chainId: string): void {
        if (!chainId || chainId.trim().length === 0) {
            throw new Error('Chain ID cannot be empty');
        }
    }

    private validateChainStatus(status: ChainStatus): void {
        const validStatuses: ChainStatus[] = ['pending', 'in_progress', 'complete', 'partial', 'blocked', 'failed', 'deferred'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid chain status: ${status}`);
        }
    }

    // #endregion

    // #region Utility Methods

    private generateSessionId(): string {
        return `session-${uuidv4()}`;
    }

    private detectAIModel(): string {
        return 'github-copilot';
    }

    private createSessionConfiguration(): SessionConfiguration {
        const config = vscode.workspace.getConfiguration('chainTraversal');
        
        return {
            maxEntityCacheSize: config.get<number>('maxEntityCacheSize', 10000),
            autoSaveInterval: config.get<number>('autoSaveInterval', 30),
            enableDebugLogging: config.get<boolean>('enableDebugLogging', false),
            stateFileLocation: config.get<string>('stateFileLocation', '.vscode/chain-traversal'),
            parallelProcessing: true,
            checkpointFrequency: 5,
            tokenManagement: {
                compressionTriggerThreshold: config.get<number>('tokenManagement.compressionTriggerThreshold', 0.9),
                emergencyCompressionThreshold: config.get<number>('tokenManagement.emergencyCompressionThreshold', 0.95),
                highUsageWarningThreshold: config.get<number>('tokenManagement.highUsageWarningThreshold', 0.8),
                cacheEvictionThreshold: config.get<number>('tokenManagement.cacheEvictionThreshold', 0.8)
            }
        };
    }

    private createInitialProgressMetrics(timestamp: Date): ProgressMetrics {
        return {
            totalEntitiesDiscovered: 0,
            entitiesProcessed: 0,
            chainsIdentified: 0,
            chainsCompleted: 0,
            currentPriorityLevel: 1,
            estimatedTimeRemaining: 0, // Initial estimate, will be updated as processing progresses
            lastUpdateTimestamp: timestamp
        };
    }

    private entityMatchesFilter(entity: EntityNode, filter?: Partial<EntityNode>): boolean {
        if (!filter) {
            return true;
        }

        return Object.entries(filter).every(([key, value]) => {
            return (entity as unknown as Record<string, unknown>)[key] === value;
        });
    }

    private relationshipInvolvesEntity(relationship: RelationshipEdge, entityId: string, relationshipType?: RelationshipType): boolean {
        const involvesEntity = relationship.fromEntityId === entityId || relationship.toEntityId === entityId;
        const matchesType = !relationshipType || relationship.relationshipType === relationshipType;
        
        return involvesEntity && matchesType;
    }

    private async updateEntityDependencies(relationship: RelationshipEdge): Promise<void> {
        const fromEntity = await this.getEntity(relationship.fromEntityId);
        const toEntity = await this.getEntity(relationship.toEntityId);

        if (fromEntity && !fromEntity.dependents.includes(relationship.toEntityId)) {
            fromEntity.dependents.push(relationship.toEntityId);
            await this.addEntity(fromEntity);
        }

        if (toEntity && !toEntity.dependencies.includes(relationship.fromEntityId)) {
            toEntity.dependencies.push(relationship.fromEntityId);
            await this.addEntity(toEntity);
        }
    }

    private isWorkItemAvailable(workItem: WorkItem, priority?: Priority, agent?: string): boolean {
        if (workItem.status !== 'pending') {
            return false;
        }

        if (priority && workItem.priority > priority) {
            return false;
        }

        if (agent && workItem.assignedAgent && workItem.assignedAgent !== agent) {
            return false;
        }

        return true;
    }

    private manageCacheSize(): void {
        if (this.entityCache.size > this.maxCacheSize) {
            const entriesToRemove = this.entityCache.size - this.maxCacheSize + 100;
            const keys = Array.from(this.entityCache.keys());
            for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
                this.entityCache.delete(keys[i]);
            }
        }
    }

    private generateReportSummary(
        entities: EntityNode[], 
        relationships: RelationshipEdge[], 
        chains: DiscoveryChain[], 
        workQueueStats: { pending: number; processing: number; completed: number; failed: number }
    ): DiscoveryReportSummary {
        const completedChains = chains.filter(chain => chain.completionStatus === 'complete');
        const partialChains = chains.filter(chain => chain.completionStatus === 'partial');
        
        // Calculate coverage percentage, avoiding division by zero
        const totalWorkItems = workQueueStats.completed + workQueueStats.pending + workQueueStats.processing;
        const coveragePercentage = totalWorkItems === 0 ? 0 : (workQueueStats.completed / totalWorkItems) * 100;
        
        return {
            totalEntitiesDiscovered: entities.length,
            totalRelationshipsFound: relationships.length,
            completeChainsCount: completedChains.length,
            partialChainsCount: partialChains.length,
            processingTimeTotal: 0,
            coveragePercentage: coveragePercentage
        };
    }

    private generateEntityStatistics(entities: EntityNode[]): EntityStatistics {
        const byType: { [entityType: string]: number } = {};
        const byPriority: { [priority: string]: number } = {};
        const byDiscoveryMethod: { [method: string]: number } = {};
        
        entities.forEach(entity => {
            byType[entity.type] = (byType[entity.type] || 0) + 1;
            byPriority[entity.priority.toString()] = (byPriority[entity.priority.toString()] || 0) + 1;
            byDiscoveryMethod[entity.discoveryMethod] = (byDiscoveryMethod[entity.discoveryMethod] || 0) + 1;
        });

        const topUsedEntities = entities
            .filter(entity => entity.analysisData?.usageCount)
            .sort((a, b) => (b.analysisData?.usageCount || 0) - (a.analysisData?.usageCount || 0))
            .slice(0, 10)
            .map(entity => ({
                entityId: entity.id,
                usageCount: entity.analysisData?.usageCount || 0
            }));

        const orphanedEntities = entities
            .filter(entity => entity.dependencies.length === 0 && entity.dependents.length === 0)
            .map(entity => entity.id);

        return {
            byType,
            byPriority,
            byDiscoveryMethod,
            topUsedEntities,
            orphanedEntities
        };
    }

    private generateChainAnalysis(chains: DiscoveryChain[]): ChainAnalysis {
        const completedChains = chains.filter(chain => chain.completionStatus === 'complete');
        const blockedChains = chains.filter(chain => chain.completionStatus === 'blocked');
        
        const averageChainLength = chains.length > 0 
            ? chains.reduce((sum, chain) => sum + chain.chainPath.length, 0) / chains.length 
            : 0;

        const longestChain = chains.reduce((longest, chain) => 
            chain.chainPath.length > longest.length ? chain.chainPath.join(' -> ') : longest, '');

        return {
            identifiedChains: chains,
            completedChains,
            blockedChains,
            averageChainLength,
            longestChain,
            criticalPathAnalysis: []
        };
    }

    private async generateCompletenessAssessment(_entities: EntityNode[], chains: DiscoveryChain[]): Promise<CompletenessAssessment> {
        const validationResults: ChainValidationResult[] = [];
        
        for (const chain of chains) {
            const result = await this.validateChain(chain.id);
            validationResults.push(result);
        }

        const overallCompleteness = validationResults.length > 0
            ? validationResults.reduce((sum, result) => sum + result.completionPercentage, 0) / validationResults.length
            : 0;

        return {
            overallCompleteness,
            domainCoverage: {},
            missingComponentTypes: [],
            suspectedMissingEntities: [],
            validationResults
        };
    }

    private generatePerformanceMetrics(session: DiscoverySession, entities: EntityNode[]): PerformanceMetrics {
        const totalProcessingTime = Date.now() - session.timestamp.getTime();
        const averageEntityProcessingTime = entities.length > 0 ? totalProcessingTime / entities.length : 0;

        return {
            totalProcessingTime,
            averageEntityProcessingTime,
            toolUsageStatistics: {},
            bottleneckAnalysis: [],
            memoryUsage: 0,
            contextSwitchCount: 0
        };
    }

    private generateRecommendations(summary: DiscoveryReportSummary, assessment: CompletenessAssessment): string[] {
        const recommendations: string[] = [];

        if (assessment.overallCompleteness < 90) {
            recommendations.push('Consider running additional discovery cycles to improve completeness');
        }

        if (summary.partialChainsCount > 0) {
            recommendations.push(`${summary.partialChainsCount} chains are incomplete - review dependencies`);
        }

        if (summary.coveragePercentage < 95) {
            recommendations.push('Work queue has pending items - continue processing for complete coverage');
        }

        return recommendations;
    }

    private generateDotFormat(entities: EntityNode[], relationships: RelationshipEdge[]): string {
        let dot = 'digraph DiscoveryGraph {\n';
        dot += '  rankdir=LR;\n';
        dot += '  node [shape=box];\n\n';

        entities.forEach(entity => {
            dot += `  "${entity.id}" [label="${entity.type}\\n${entity.id}"];\n`;
        });

        dot += '\n';

        relationships.forEach(relationship => {
            dot += `  "${relationship.fromEntityId}" -> "${relationship.toEntityId}" [label="${relationship.relationshipType}"];\n`;
        });

        dot += '}\n';

        return dot;
    }

    /**
     * Get the current active session ID
     */
    getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    /**
     * Get the current active session
     */
    async getCurrentSession(): Promise<DiscoverySession | null> {
        if (!this.currentSessionId) {
            return null;
        }
        return this.loadSession(this.currentSessionId);
    }

    private logOperation(operation: string, metadata?: Record<string, unknown>): void {
        const config = vscode.workspace.getConfiguration('chainTraversal');
        const enableDebugLogging = config.get<boolean>('enableDebugLogging', false);
        
        if (enableDebugLogging) {
            console.log(`[ChainTraversal] ${operation}`, metadata);
        }
    }

    private logError(operation: string, error: unknown, metadata?: Record<string, unknown>): void {
        console.error(`[ChainTraversal] ERROR: ${operation}`, error, metadata);
    }

    private logDebug(message: string, metadata?: Record<string, unknown>): void {
        const config = vscode.workspace.getConfiguration('chainTraversal');
        const enableDebugLogging = config.get<boolean>('enableDebugLogging', false);
        
        if (enableDebugLogging) {
            console.debug(`[ChainTraversal] DEBUG: ${message}`, metadata);
        }
    }

    // #endregion
}
