/**
 * Add Relationship Tool
 * Adds a relationship between entities in the external state graph
 */

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { TOOL_NAMES } from '../shared/constants';
import { RelationshipEdge, RelationshipType } from '../shared/types';
import { WorkspaceStateManagerVscode } from '../shared/services/workspaceStateManagerVscode';
import { InitializeSessionTool } from './initializeSessionTool';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../shared/errorHandling';

interface AddRelationshipParameters {
  relationship: {
    fromEntityId: string;
    toEntityId: string;
    relationshipType: string;
    description?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

export class AddRelationshipTool extends BaseTool {
  public readonly name = TOOL_NAMES.ADD_RELATIONSHIP;
  private stateManager: WorkspaceStateManagerVscode;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    const tempWorkspaceRoot = this.getWorkspaceRoot();
    this.stateManager = new WorkspaceStateManagerVscode(context, tempWorkspaceRoot);
  }

  protected getDisplayName(): string {
    return 'Add Entity Relationship';
  }

  protected async executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    this.logOperation('Starting relationship addition', options);
    
    const params = options.input as AddRelationshipParameters;
    
    try {
      // Check if session is active
      if (!InitializeSessionTool.hasActiveSession(this.context)) {
        return this.createErrorResult(
          this.formatErrorResponse('No active discovery session. Please initialize a session first using the initializeSession tool.')
        );
      }

      // Validate parameters
      this.validateParameters(params);
      
      this.checkCancellation(token);
      
      // Create relationship from parameters
      const relationshipEdge: RelationshipEdge = this.createRelationshipEdge(params.relationship);
      
      this.checkCancellation(token);
      
      // Add relationship to the graph
      await this.stateManager.addRelationship(relationshipEdge);
      
      this.checkCancellation(token);
      
      this.logOperation('Relationship added successfully', { relationshipId: relationshipEdge.id });
      
      const response = this.formatSuccessResponse(
        `✅ Relationship "${relationshipEdge.relationshipType}" added between entities successfully!`,
        {
          relationshipId: relationshipEdge.id,
          fromEntityId: relationshipEdge.fromEntityId,
          toEntityId: relationshipEdge.toEntityId,
          relationshipType: relationshipEdge.relationshipType,
          confidence: relationshipEdge.strength,
          status: 'Relationship registered in discovery graph'
        }
      );
      
      return this.createSuccessResult(response);
      
    } catch (error) {
      Logger.error('Relationship addition failed', error);
      
      const errorResponse = this.formatErrorResponse(
        'Failed to add relationship to discovery graph',
        error
      );
      
      return this.createErrorResult(errorResponse);
    }
  }

  /**
   * Validate the input parameters
   */
  private validateParameters(params: AddRelationshipParameters): void {
    if (!params.relationship || typeof params.relationship !== 'object') {
      throw new Error('relationship parameter is required and must be an object');
    }

    const relationship = params.relationship;

    if (!relationship.fromEntityId || typeof relationship.fromEntityId !== 'string' || relationship.fromEntityId.trim().length === 0) {
      throw new Error('relationship.fromEntityId is required and must be a non-empty string');
    }

    if (!relationship.toEntityId || typeof relationship.toEntityId !== 'string' || relationship.toEntityId.trim().length === 0) {
      throw new Error('relationship.toEntityId is required and must be a non-empty string');
    }

    if (!relationship.relationshipType || typeof relationship.relationshipType !== 'string' || relationship.relationshipType.trim().length === 0) {
      throw new Error('relationship.relationshipType is required and must be a non-empty string');
    }

    if (relationship.confidence !== undefined && (typeof relationship.confidence !== 'number' || relationship.confidence < 0 || relationship.confidence > 1)) {
      throw new Error('relationship.confidence must be a number between 0 and 1 if provided');
    }
  }

  /**
   * Create a RelationshipEdge from the parameters
   */
  private createRelationshipEdge(relationshipData: AddRelationshipParameters['relationship']): RelationshipEdge {
    const relationshipEdge: RelationshipEdge = {
      id: `rel_${uuidv4()}`,
      fromEntityId: relationshipData.fromEntityId,
      toEntityId: relationshipData.toEntityId,
      relationshipType: relationshipData.relationshipType as RelationshipType,
      strength: relationshipData.confidence || 1.0,
      bidirectional: false,
      discoveryMethod: 'ManualEntry' as any,
      timestamp: new Date(),
      metadata: {
        description: relationshipData.description || ''
      }
    };

    // Add any additional metadata
    Object.keys(relationshipData).forEach(key => {
      if (!['fromEntityId', 'toEntityId', 'relationshipType', 'confidence', 'description'].includes(key)) {
        if (relationshipEdge.metadata) {
          relationshipEdge.metadata[key] = relationshipData[key];
        }
      }
    });

    return relationshipEdge;
  }
}
