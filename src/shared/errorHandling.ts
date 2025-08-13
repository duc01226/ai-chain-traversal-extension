/**
 * Centralized error handling utilities for AI Chain Traversal Tools
 * Provides standardized error types and handling mechanisms
 */

import * as vscode from 'vscode';
import { ERROR_MESSAGES, LOG_LEVELS } from './constants';

/**
 * Custom error types for the AI Chain Traversal extension
 */
export class ChainTraversalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ChainTraversalError';
  }
}

export class SessionError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'SESSION_ERROR', details);
    this.name = 'SessionError';
  }
}

export class EntityError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'ENTITY_ERROR', details);
    this.name = 'EntityError';
  }
}

export class RelationshipError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'RELATIONSHIP_ERROR', details);
    this.name = 'RelationshipError';
  }
}

export class StateError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'STATE_ERROR', details);
    this.name = 'StateError';
  }
}

export class ValidationError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends ChainTraversalError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Logger class for standardized logging across the extension
 */
export class Logger {
  private static outputChannel: vscode.OutputChannel | undefined;
  private static debugEnabled = false;

  public static initialize(debugEnabled: boolean = false): void {
    this.outputChannel = vscode.window.createOutputChannel('AI Chain Traversal Tools');
    this.debugEnabled = debugEnabled;
  }

  public static debug(message: string, data?: unknown): void {
    if (this.debugEnabled) {
      this.log(LOG_LEVELS.DEBUG, message, data);
    }
  }

  public static info(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  public static warn(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  public static error(message: string, error?: unknown): void {
    this.log(LOG_LEVELS.ERROR, message, error);
  }

  public static showOutputChannel(): void {
    this.outputChannel?.show();
  }

  private static log(level: string, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (this.outputChannel) {
      this.outputChannel.appendLine(logMessage);
      if (data) {
        this.outputChannel.appendLine(`Data: ${JSON.stringify(data, null, 2)}`);
      }
    }

    // Also log to console for development
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(logMessage, data);
        break;
      case LOG_LEVELS.INFO:
        console.info(logMessage, data);
        break;
      case LOG_LEVELS.WARN:
        console.warn(logMessage, data);
        break;
      case LOG_LEVELS.ERROR:
        console.error(logMessage, data);
        break;
    }
  }

  public static dispose(): void {
    this.outputChannel?.dispose();
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  
  /**
   * Handle errors with user notification and logging
   */
  public static async handleError(
    error: unknown,
    context: string,
    showUserNotification: boolean = true
  ): Promise<void> {
    let errorMessage: string;
    let errorDetails: unknown;

    if (error instanceof ChainTraversalError) {
      errorMessage = `${context}: ${error.message}`;
      errorDetails = { code: error.code, details: error.details };
    } else if (error instanceof Error) {
      errorMessage = `${context}: ${error.message}`;
      errorDetails = { stack: error.stack };
    } else {
      errorMessage = `${context}: Unknown error occurred`;
      errorDetails = error;
    }

    Logger.error(errorMessage, errorDetails);

    if (showUserNotification) {
      const action = await vscode.window.showErrorMessage(
        errorMessage,
        'Show Details',
        'Dismiss'
      );

      if (action === 'Show Details') {
        Logger.showOutputChannel();
      }
    }
  }

  /**
   * Wrap async operations with error handling
   */
  public static async safeExecute<T>(
    operation: () => Promise<T>,
    context: string,
    fallbackValue?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      await this.handleError(error, context);
      return fallbackValue;
    }
  }

  /**
   * Validate entity data and throw appropriate errors
   */
  public static validateEntity(entity: unknown): void {
    if (!entity || typeof entity !== 'object') {
      throw new EntityError(ERROR_MESSAGES.INVALID_ENTITY);
    }

    const entityObj = entity as Record<string, unknown>;
    
    if (!entityObj.id || typeof entityObj.id !== 'string') {
      throw new EntityError('Entity must have a valid id');
    }

    if (!entityObj.type || typeof entityObj.type !== 'string') {
      throw new EntityError('Entity must have a valid type');
    }

    if (!entityObj.filePath || typeof entityObj.filePath !== 'string') {
      throw new EntityError('Entity must have a valid filePath');
    }
  }

  /**
   * Validate relationship data and throw appropriate errors
   */
  public static validateRelationship(relationship: unknown): void {
    if (!relationship || typeof relationship !== 'object') {
      throw new RelationshipError(ERROR_MESSAGES.INVALID_RELATIONSHIP);
    }

    const relationshipObj = relationship as Record<string, unknown>;
    
    if (!relationshipObj.fromEntityId || typeof relationshipObj.fromEntityId !== 'string') {
      throw new RelationshipError('Relationship must have a valid fromEntityId');
    }

    if (!relationshipObj.toEntityId || typeof relationshipObj.toEntityId !== 'string') {
      throw new RelationshipError('Relationship must have a valid toEntityId');
    }

    if (!relationshipObj.relationshipType || typeof relationshipObj.relationshipType !== 'string') {
      throw new RelationshipError('Relationship must have a valid relationshipType');
    }
  }

  /**
   * Validate session initialization parameters
   */
  public static validateSessionParameters(taskDescription: unknown, workspaceRoot?: unknown): void {
    if (!taskDescription || typeof taskDescription !== 'string' || taskDescription.trim().length === 0) {
      throw new SessionError('Task description must be a non-empty string');
    }

    if (workspaceRoot !== undefined && typeof workspaceRoot !== 'string') {
      throw new SessionError('Workspace root must be a string if provided');
    }
  }

  /**
   * Create standardized error responses for Language Model Tools
   */
  public static createToolErrorResponse(error: unknown, context: string): string {
    let errorMessage: string;

    if (error instanceof ChainTraversalError) {
      errorMessage = `${context}: ${error.message} (Code: ${error.code})`;
    } else if (error instanceof Error) {
      errorMessage = `${context}: ${error.message}`;
    } else {
      errorMessage = `${context}: Unknown error occurred`;
    }

    return `Error: ${errorMessage}`;
  }

  /**
   * Check if error is retryable
   */
  public static isRetryableError(error: unknown): boolean {
    if (error instanceof ChainTraversalError) {
      // Don't retry validation errors or configuration errors
      return !(error instanceof ValidationError || error instanceof ConfigurationError);
    }
    
    if (error instanceof Error) {
      // Network or filesystem errors might be retryable
      return error.message.includes('ENOENT') || 
             error.message.includes('EACCES') || 
             error.message.includes('timeout');
    }
    
    return false;
  }

  /**
   * Format error for user display
   */
  public static formatErrorForUser(error: unknown): string {
    if (error instanceof ChainTraversalError) {
      return error.message;
    } else if (error instanceof Error) {
      return error.message;
    } else {
      return 'An unexpected error occurred';
    }
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static operations = new Map<string, number>();

  public static startOperation(operationName: string): void {
    this.operations.set(operationName, Date.now());
  }

  public static endOperation(operationName: string): number {
    const startTime = this.operations.get(operationName);
    if (!startTime) {
      Logger.warn(`No start time found for operation: ${operationName}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.operations.delete(operationName);
    
    Logger.debug(`Operation ${operationName} completed in ${duration}ms`);
    return duration;
  }

  public static async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    this.startOperation(operationName);
    try {
      const result = await operation();
      this.endOperation(operationName);
      return result;
    } catch (error) {
      this.endOperation(operationName);
      throw error;
    }
  }
}
