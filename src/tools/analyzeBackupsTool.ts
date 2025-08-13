/**
 * Analyze Backups Tool - Backup Analysis and Cost Estimation
 * Provides intelligent analysis of backup files without loading full content
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { TokenManagementService } from '../shared/services/tokenManagementService';
import { BackupMetadata, BackupAnalysis, EntityFilter } from '../shared/types';
import { Logger } from '../shared/errorHandling';

interface AnalyzeBackupsInput {
  sessionId: string;
  analysisType?: 'metadata_only' | 'size_estimation' | 'entity_distribution' | 'time_analysis' | 'comprehensive';
  entityFilter?: EntityFilter;
}

interface AnalyzeBackupsResult {
  success: boolean;
  analysis: BackupAnalysis;
  message: string;
  recommendations: string[];
}

export class AnalyzeBackupsTool extends BaseTool {
  public readonly name = TOOL_NAMES.ANALYZE_BACKUPS;
  private tokenManager: TokenManagementService;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    this.tokenManager = new TokenManagementService(context);
  }

  protected getDisplayName(): string {
    return 'Analyze External Backups';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting backup analysis', options);
    
    const params = options.input as AnalyzeBackupsInput;
    
    try {
      this.checkCancellation(token);
      
      const analysisType = params.analysisType || 'metadata_only';
      
      // Find all backup files for the session
      const backups = await this.findBackupFiles(params.sessionId);
      
      if (backups.length === 0) {
        return this.createResult({
          success: true,
          analysis: this.createEmptyAnalysis(),
          message: 'No backup files found for this session',
          recommendations: [
            'No backup files available for analysis',
            'Run analysis operations to generate backup files',
            'Check if token summarization has been triggered'
          ]
        });
      }

      // Perform analysis based on type
      const analysis = await this.performAnalysis(backups, analysisType, params.entityFilter);
      
      // Generate recommendations
      const recommendations = this.generateAnalysisRecommendations(analysis);

      const result: AnalyzeBackupsResult = {
        success: true,
        analysis,
        message: `Analyzed ${backups.length} backup files containing ${analysis.totalEntities} entities and ${analysis.totalRelationships} relationships`,
        recommendations
      };

      this.logOperation('Backup analysis completed', result);
      return this.createResult(result);

    } catch (error) {
      Logger.error('Backup analysis failed', { error });
      throw error;
    }
  }

  /**
   * Find backup files for a session
   */
  private async findBackupFiles(sessionId: string): Promise<BackupMetadata[]> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return [];
    }

    const backupDir = vscode.Uri.joinPath(
      workspaceFolder.uri, 
      '.vscode', 
      'chain-traversal', 
      'context-backups'
    );

    try {
      const entries = await vscode.workspace.fs.readDirectory(backupDir);
      const backupFiles = entries
        .filter(([name, type]) => 
          type === vscode.FileType.File && 
          name.includes(sessionId) && 
          name.endsWith('.json')
        )
        .map(([name]) => name);

      const backups: BackupMetadata[] = [];
      
      for (const fileName of backupFiles) {
        const filePath = vscode.Uri.joinPath(backupDir, fileName);
        const metadata = await this.extractBackupMetadata(filePath, sessionId);
        if (metadata) {
          backups.push(metadata);
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    } catch (error) {
      Logger.error('findBackupFiles failed', error);
      return [];
    }
  }

  /**
   * Extract metadata from backup file
   */
  private async extractBackupMetadata(filePath: vscode.Uri, sessionId: string): Promise<BackupMetadata | null> {
    try {
      const stat = await vscode.workspace.fs.stat(filePath);
      const buffer = await vscode.workspace.fs.readFile(filePath);
      const content = new TextDecoder().decode(buffer);
      
      // Parse only the metadata portion to avoid loading full content
      const lines = content.split('\n');
      let metadataEndIndex = -1;
      
      // Find the end of metadata section (basic JSON parsing)
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        if (lines[i].includes('"entities"') || lines[i].includes('"relationships"')) {
          metadataEndIndex = i;
          break;
        }
      }

      let parsedData: any;
      if (metadataEndIndex > 0) {
        // Try to parse just metadata + beginning of entities array
        const partialContent = lines.slice(0, metadataEndIndex + 10).join('\n') + ']}';
        try {
          parsedData = JSON.parse(partialContent);
        } catch {
          // Fallback to full parsing
          parsedData = JSON.parse(content);
        }
      } else {
        parsedData = JSON.parse(content);
      }

      // Extract timestamp from filename or use file modification time
      const timestampMatch = filePath.path.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
      const timestamp = timestampMatch 
        ? new Date(timestampMatch[1].replace(/-/g, ':').replace(/T(\d{2}):(\d{2}):(\d{2})/, 'T$1:$2:$3'))
        : new Date(stat.mtime);

      const totalEntities = parsedData.entities?.length || parsedData.metadata?.totalEntities || 0;
      const totalRelationships = parsedData.relationships?.length || parsedData.metadata?.totalRelationships || 0;
      const entityTypes = parsedData.metadata?.entityTypes || this.analyzeEntityTypes(parsedData.entities || []);
      const estimatedTokens = this.tokenManager.estimateTokenCountSync(content);

      return {
        filePath: filePath.fsPath,
        sessionId,
        timestamp,
        totalEntities,
        totalRelationships,
        entityTypes,
        estimatedTokens,
        fileSize: stat.size
      };

    } catch (error) {
      Logger.error('extractBackupMetadata failed' ,error);
      return null;
    }
  }

  /**
   * Analyze entity types from entities array
   */
  private analyzeEntityTypes(entities: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    for (const entity of entities.slice(0, 100)) { // Sample first 100 for performance
      if (entity && entity.type) {
        types[entity.type] = (types[entity.type] || 0) + 1;
      }
    }

    // Extrapolate to full dataset if we sampled
    if (entities.length > 100) {
      const multiplier = entities.length / 100;
      Object.keys(types).forEach(key => {
        types[key] = Math.round(types[key] * multiplier);
      });
    }

    return types;
  }

  /**
   * Perform analysis based on type
   */
  private async performAnalysis(
    backups: BackupMetadata[], 
    analysisType: string, 
    filter?: EntityFilter
  ): Promise<BackupAnalysis> {
    const filteredBackups = filter ? this.filterBackups(backups, filter) : backups;
    
    const totalEntities = filteredBackups.reduce((sum, b) => sum + b.totalEntities, 0);
    const totalRelationships = filteredBackups.reduce((sum, b) => sum + b.totalRelationships, 0);
    const estimatedTotalTokens = filteredBackups.reduce((sum, b) => sum + b.estimatedTokens, 0);

    // Aggregate entity distribution
    const entityDistribution: Record<string, number> = {};
    filteredBackups.forEach(backup => {
      Object.entries(backup.entityTypes).forEach(([type, count]) => {
        entityDistribution[type] = (entityDistribution[type] || 0) + count;
      });
    });

    // Calculate time range
    const timestamps = filteredBackups.map(b => b.timestamp);
    const timeRange = {
      earliest: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date(),
      latest: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date()
    };

    // Generate recommendations based on analysis type
    const recommendations = this.generateRecommendationsForAnalysis(
      filteredBackups, 
      analysisType, 
      { totalEntities, totalRelationships, estimatedTotalTokens }
    );

    return {
      availableBackups: filteredBackups,
      totalFiles: filteredBackups.length,
      totalEntities,
      totalRelationships,
      entityDistribution,
      timeRange,
      estimatedTotalTokens,
      recommendations
    };
  }

  /**
   * Filter backups based on criteria
   */
  private filterBackups(backups: BackupMetadata[], filter: EntityFilter): BackupMetadata[] {
    return backups.filter(backup => {
      // Filter by time range
      if (filter.timeRange) {
        const backupTime = backup.timestamp;
        if (backupTime < filter.timeRange.from || backupTime > filter.timeRange.to) {
          return false;
        }
      }

      // Filter by entity types (check if backup contains any of the specified types)
      if (filter.types && filter.types.length > 0) {
        const hasMatchingTypes = filter.types.some(type => 
          Object.keys(backup.entityTypes).some(backupType => 
            backupType.toLowerCase().includes(type.toLowerCase())
          )
        );
        if (!hasMatchingTypes) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Generate recommendations for analysis
   */
  private generateRecommendationsForAnalysis(
    backups: BackupMetadata[], 
    analysisType: string, 
    totals: { totalEntities: number; totalRelationships: number; estimatedTotalTokens: number }
  ): string[] {
    const recommendations: string[] = [];

    if (backups.length === 0) {
      recommendations.push('No backup files match the specified criteria');
      return recommendations;
    }

    // Token-based recommendations
    if (totals.estimatedTotalTokens > 100000) {
      recommendations.push('Large token count detected. Consider selective recovery strategies.');
      recommendations.push('Use progressive loading to manage memory usage.');
    } else if (totals.estimatedTotalTokens < 10000) {
      recommendations.push('Small token count. Full recovery is feasible.');
    }

    // Entity distribution recommendations
    const entityTypes = Object.keys(backups[0].entityTypes || {});
    if (entityTypes.length > 10) {
      recommendations.push('High entity type diversity. Consider type-specific filtering.');
    }

    // Time-based recommendations
    if (backups.length > 5) {
      recommendations.push('Multiple backup files available. Consider time-based filtering for recent data.');
    }

    // Analysis type specific recommendations
    switch (analysisType) {
      case 'size_estimation':
        recommendations.push(`Estimated token cost for full recovery: ${totals.estimatedTotalTokens}`);
        recommendations.push('Use recoverContext tool with appropriate maxTokens parameter');
        break;

      case 'entity_distribution':
        const topTypes = Object.entries(backups[0].entityTypes || {})
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type]) => type);
        recommendations.push(`Most common entity types: ${topTypes.join(', ')}`);
        break;

      case 'time_analysis':
        const latestBackup = backups[0];
        const oldestBackup = backups[backups.length - 1];
        const timeDiff = latestBackup.timestamp.getTime() - oldestBackup.timestamp.getTime();
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        recommendations.push(`Backup span: ${daysDiff} days`);
        recommendations.push('Consider loading most recent backup for current state');
        break;

      case 'comprehensive':
        recommendations.push('Full analysis complete. Review all metrics for optimal recovery strategy.');
        break;
    }

    return recommendations;
  }

  /**
   * Generate analysis recommendations
   */
  private generateAnalysisRecommendations(analysis: BackupAnalysis): string[] {
    const recommendations: string[] = [];

    // General recommendations
    if (analysis.totalFiles === 0) {
      recommendations.push('No backup files found. Run analysis to generate backups.');
      return recommendations;
    }

    // Token management recommendations
    if (analysis.estimatedTotalTokens > 50000) {
      recommendations.push(`High token count (${analysis.estimatedTotalTokens}). Use selective recovery.`);
      recommendations.push('Consider priority_based recovery strategy for critical entities.');
    }

    // Entity recommendations
    const entityTypeCount = Object.keys(analysis.entityDistribution).length;
    if (entityTypeCount > 5) {
      recommendations.push(`${entityTypeCount} entity types found. Consider type filtering.`);
    }

    // Time-based recommendations
    const timeSpan = analysis.timeRange.latest.getTime() - analysis.timeRange.earliest.getTime();
    const hours = timeSpan / (1000 * 60 * 60);
    
    if (hours > 24) {
      recommendations.push('Backups span multiple days. Consider time-range filtering.');
    }

    // Next steps
    recommendations.push('Use recoverContext tool with appropriate strategy and filters.');
    recommendations.push('Consider outputResults tool for formatted display after recovery.');

    return recommendations;
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(): BackupAnalysis {
    return {
      availableBackups: [],
      totalFiles: 0,
      totalEntities: 0,
      totalRelationships: 0,
      entityDistribution: {},
      timeRange: {
        earliest: new Date(),
        latest: new Date()
      },
      estimatedTotalTokens: 0,
      recommendations: []
    };
  }

  private createResult(result: AnalyzeBackupsResult): vscode.LanguageModelToolResult {
    const content = this.generateAnalysisOutput(result);
    
    return {
      content: [
        new vscode.LanguageModelTextPart(content)
      ]
    };
  }

  private generateAnalysisOutput(result: AnalyzeBackupsResult): string {
    const analysis = result.analysis;
    
    return `# Backup Analysis Results

## Summary
${result.message}

## Backup Overview
- **Total Files**: ${analysis.totalFiles}
- **Total Entities**: ${analysis.totalEntities}
- **Total Relationships**: ${analysis.totalRelationships}
- **Estimated Token Cost**: ${analysis.estimatedTotalTokens}

## Entity Distribution
${Object.entries(analysis.entityDistribution)
  .sort(([,a], [,b]) => b - a)
  .map(([type, count]) => `- **${type}**: ${count}`)
  .join('\n')}

## Time Range
- **Earliest**: ${analysis.timeRange.earliest.toISOString()}
- **Latest**: ${analysis.timeRange.latest.toISOString()}

## Available Backup Files
${analysis.availableBackups.map(backup => 
  `- ${backup.filePath.split('/').pop()} (${backup.totalEntities} entities, ${backup.estimatedTokens} tokens)`
).join('\n')}

## Recommendations
${result.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps for AI
1. Use this analysis to plan recovery strategy
2. Apply appropriate filters based on entity distribution
3. Use recoverContext tool with optimal token budget
4. Consider progressive loading for large datasets
`;
  }
}
