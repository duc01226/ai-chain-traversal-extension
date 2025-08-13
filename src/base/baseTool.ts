/**
 * Base tool class for AI Chain Traversal Language Model Tools
 * Provides common functionality and standardized patterns for all tools
 */

import * as vscode from "vscode";
import { Logger, PerformanceMonitor } from "../shared/errorHandling";
import { CONFIG_KEYS, DEFAULT_CONFIG } from "../shared/constants";

/**
 * Configuration manager for accessing VS Code settings
 */
export class ConfigurationManager {
  public static getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration();
    return config.get<T>(key, defaultValue);
  }

  public static async updateConfig(key: string, value: unknown): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  public static getAutoSaveInterval(): number {
    return this.getConfig(
      CONFIG_KEYS.AUTO_SAVE_INTERVAL,
      DEFAULT_CONFIG.AUTO_SAVE_INTERVAL
    );
  }

  public static getMaxEntityCacheSize(): number {
    return this.getConfig(
      CONFIG_KEYS.MAX_ENTITY_CACHE_SIZE,
      DEFAULT_CONFIG.MAX_ENTITY_CACHE_SIZE
    );
  }

  public static isDebugLoggingEnabled(): boolean {
    return this.getConfig(
      CONFIG_KEYS.ENABLE_DEBUG_LOGGING,
      DEFAULT_CONFIG.ENABLE_DEBUG_LOGGING
    );
  }

  public static getStateFileLocation(): string {
    return this.getConfig(
      CONFIG_KEYS.STATE_FILE_LOCATION,
      DEFAULT_CONFIG.STATE_FILE_LOCATION
    );
  }

  public static shouldShowProgressNotifications(): boolean {
    return this.getConfig(
      CONFIG_KEYS.SHOW_PROGRESS_NOTIFICATIONS,
      DEFAULT_CONFIG.SHOW_PROGRESS_NOTIFICATIONS
    );
  }
}

/**
 * Status bar manager for displaying extension status
 */
export class StatusBarManager {
  private static statusBarItem: vscode.StatusBarItem | undefined;
  private static statusPanelService: any; // Will be dynamically imported to avoid circular deps
  private static context: vscode.ExtensionContext | undefined;

  public static initialize(context?: vscode.ExtensionContext): void {
    if (context) {
      StatusBarManager.context = context;
    }

    if (!StatusBarManager.statusBarItem) {
      StatusBarManager.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      StatusBarManager.statusBarItem.text = "$(graph) Chain Traversal";
      StatusBarManager.statusBarItem.tooltip =
        "AI Chain Traversal Tools - Click to view status panel";
      StatusBarManager.statusBarItem.command =
        "aiChainTraversal.showStatusPanel";
      StatusBarManager.statusBarItem.show();
    }
  }

  public static updateStatus(text: string, tooltip?: string): void {
    if (StatusBarManager.statusBarItem) {
      StatusBarManager.statusBarItem.text = `$(graph) ${text}`;
      if (tooltip) {
        StatusBarManager.statusBarItem.tooltip = tooltip;
      }
    }
  }

  public static showProgress(message: string): void {
    StatusBarManager.updateStatus(
      `${message}...`,
      `AI Chain Traversal Tools: ${message}`
    );
  }

  public static showComplete(message: string): void {
    StatusBarManager.updateStatus(
      message,
      "AI Chain Traversal Tools: Operation completed"
    );

    // Reset to default after 3 seconds
    setTimeout(() => {
      StatusBarManager.updateStatus(
        "Ready",
        "AI Chain Traversal Tools ready for use"
      );
    }, 3000);
  }

  public static showError(message: string): void {
    StatusBarManager.updateStatus(
      `❌ ${message}`,
      "AI Chain Traversal Tools: Error occurred"
    );

    // Reset to default after 5 seconds
    setTimeout(() => {
      StatusBarManager.updateStatus(
        "Ready",
        "AI Chain Traversal Tools ready for use"
      );
    }, 5000);
  }

  public static showIdle(): void {
    StatusBarManager.updateStatus(
      "Idle",
      "AI Chain Traversal Tools - Click to view status panel"
    );
  }

  public static async showStatusPanel(): Promise<void> {
    if (!StatusBarManager.context) {
      vscode.window.showErrorMessage(
        "Status panel unavailable: Extension context not initialized"
      );
      return;
    }

    try {
      if (!StatusBarManager.statusPanelService) {
        // Dynamically import to avoid circular dependencies
        const { StatusPanelService } = await import(
          "../shared/services/statusPanelService"
        );
        StatusBarManager.statusPanelService = StatusPanelService.getInstance(
          StatusBarManager.context
        );
      }

      await StatusBarManager.statusPanelService.showStatusPanel();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show status panel: ${error}`);
    }
  }

  public static dispose(): void {
    StatusBarManager.statusBarItem?.dispose();
    StatusBarManager.statusBarItem = undefined;
  }
}

/**
 * Progress notification manager
 */
export class ProgressManager {
  public static async withProgress<T>(
    title: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task
    );
  }

  public static async withProgressCancellable<T>(
    title: string,
    task: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true,
      },
      task
    );
  }
}

/**
 * Base class for all Language Model Tools in the AI Chain Traversal extension
 */
export abstract class BaseTool implements vscode.LanguageModelTool<object> {
  public abstract readonly name: string;

  constructor(protected readonly context: vscode.ExtensionContext) {}

  /**
   * Invoke the tool with the provided parameters
   */
  public async invoke(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      return await this.executeWithCancellation(options, token);
    } catch (error) {
      // Language Model Tools should return error results, not throw errors
      const errorMessage = this.formatToolError(error);
      return this.createErrorResult(errorMessage);
    }
  }

  /**
   * Format tool errors for user display
   */
  private formatToolError(error: unknown): string {
    // Handle null, undefined, or falsy errors
    if (!error) {
      return `❌ **Error in ${this.name}**: An unknown error occurred.\n\nPlease try again or check the extension logs for more details.`;
    }

    // Extract error message safely
    let message: string;
    try {
      if (typeof error === "string") {
        message = error;
      } else if (error instanceof Error) {
        message = error.message;
      } else if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
      ) {
        message = (error as { message: string }).message;
      } else if (error && typeof error.toString === "function") {
        message = error.toString();
      } else {
        message = "An unknown error occurred";
      }
    } catch (toStringError) {
      message = "An unknown error occurred";
    }

    return `❌ **Error in ${this.name}**: ${message}\n\nPlease try again or check the extension logs for more details.`;
  }

  /**
   * Execute tool with cancellation support
   */
  private async executeWithCancellation(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    // Check for cancellation before starting
    this.checkCancellation(token);

    const operationName = `${this.name}_invoke`;
    Logger.debug(`Invoking tool: ${this.name}`, options);

    PerformanceMonitor.startOperation(operationName);

    // Show progress notification if enabled
    if (ConfigurationManager.shouldShowProgressNotifications()) {
      StatusBarManager.showProgress(`${this.getDisplayName()}`);
    }

    // Notify user that tool has been selected and is starting
    this.notifyToolStart();

    try {
      // Execute the specific tool logic
      const result = await this.executeToolLogic(options, token);

      const duration = PerformanceMonitor.endOperation(operationName);
      Logger.info(`Tool ${this.name} completed successfully in ${duration}ms`);

      if (ConfigurationManager.shouldShowProgressNotifications()) {
        StatusBarManager.showComplete(`${this.getDisplayName()} completed`);
      }

      // Notify user of successful completion
      this.notifyToolComplete(duration);

      return result;
    } catch (error) {
      PerformanceMonitor.endOperation(operationName);

      Logger.error(`Tool ${this.name} failed`, error);

      if (ConfigurationManager.shouldShowProgressNotifications()) {
        StatusBarManager.showError(`${this.getDisplayName()} failed`);
      }

      // Notify user of error
      this.notifyToolError(error);

      throw error; // Re-throw to be handled by formatToolError
    }
  }

  /**
   * Abstract method for tool-specific logic implementation
   */
  protected abstract executeToolLogic(
    options: vscode.LanguageModelToolInvocationOptions<object>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult>;

  /**
   * Get the display name for this tool (used in notifications)
   */
  protected abstract getDisplayName(): string;

  /**
   * Check if operation was cancelled
   */
  protected checkCancellation(token: vscode.CancellationToken): void {
    if (token.isCancellationRequested) {
      throw new Error("Operation was cancelled");
    }
  }

  /**
   * Create a success result
   */
  protected createSuccessResult(
    content: string
  ): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(content),
    ]);
  }

  /**
   * Create an error result
   */
  protected createErrorResult(error: string): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(error),
    ]);
  }

  /**
   * Log operation details
   */
  protected logOperation(operation: string, details?: unknown): void {
    Logger.debug(`🔧 [${this.name}] ${operation}`, details || "");
  }

  /**
   * Helper method to safely get workspace root
   */
  protected getWorkspaceRoot(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // In test environment, return a default test workspace path
      if (process.env.NODE_ENV === "test" || process.env.VSCODE_TEST_DATA_DIR) {
        return "/test/workspace";
      }
      throw new Error("No workspace folder found");
    }
    return workspaceFolders[0].uri.fsPath;
  }

  /**
   * Helper method to show user notifications
   */
  protected async showNotification(
    message: string,
    type: "info" | "warning" | "error" = "info"
  ): Promise<void> {
    switch (type) {
      case "info":
        await vscode.window.showInformationMessage(message);
        break;
      case "warning":
        await vscode.window.showWarningMessage(message);
        break;
      case "error":
        await vscode.window.showErrorMessage(message);
        break;
    }
  }

  /**
   * Helper method to format success response
   */
  protected formatSuccessResponse(message: string, data?: unknown): string {
    const response = { success: true, message };
    if (data) {
      Object.assign(response, { data });
    }
    return JSON.stringify(response, null, 2);
  }

  /**
   * Helper method to format error response
   */
  protected formatErrorResponse(message: string, error?: unknown): string {
    const response = { success: false, error: message };
    if (error && ConfigurationManager.isDebugLoggingEnabled()) {
      const errorObj =
        error instanceof Error
          ? { message: error.message, stack: error.stack, cause: error.cause }
          : error;

      Object.assign(response, { debug: errorObj });
    }
    return JSON.stringify(response, null, 2);
  }

  /**
   * Notify user that tool has been selected and is starting
   */
  private notifyToolStart(): void {
    // Use output channel to communicate tool selection
    Logger.info(`🔧 Tool Selected: ${this.getDisplayName()}`);

    // Update status bar to show tool is running
    StatusBarManager.updateStatus(
      `Running: ${this.getDisplayName()}`,
      `AI Chain Traversal: ${this.getDisplayName()} is processing...`
    );
  }

  /**
   * Notify user of successful tool completion
   */
  private notifyToolComplete(duration: number): void {
    Logger.info(`✅ Tool Completed: ${this.getDisplayName()} (${duration}ms)`);

    // Brief success indication
    StatusBarManager.showComplete(`${this.getDisplayName()} completed`);
  }

  /**
   * Notify user of tool error
   */
  private notifyToolError(error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    Logger.error(`❌ Tool Failed: ${this.getDisplayName()} - ${errorMsg}`);

    StatusBarManager.showError(`${this.getDisplayName()} failed`);
  }

  /**
   * Helper method to validate required string parameter
   */
  protected validateRequiredString(
    params: Record<string, unknown>,
    key: string
  ): string {
    const value = params[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Parameter '${key}' must be a non-empty string`);
    }
    return value.trim();
  }

  /**
   * Helper method to validate optional string parameter
   */
  protected validateOptionalString(
    params: Record<string, unknown>,
    key: string
  ): string | undefined {
    const value = params[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new Error(`Parameter '${key}' must be a string if provided`);
    }
    return value;
  }

  /**
   * Helper method to validate required object parameter
   */
  protected validateRequiredObject(
    params: Record<string, unknown>,
    key: string
  ): Record<string, unknown> {
    const value = params[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Parameter '${key}' must be an object`);
    }
    return value as Record<string, unknown>;
  }

  /**
   * Helper method to validate optional object parameter
   */
  protected validateOptionalObject(
    params: Record<string, unknown>,
    key: string
  ): Record<string, unknown> | undefined {
    const value = params[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Parameter '${key}' must be an object if provided`);
    }
    return value as Record<string, unknown>;
  }

  /**
   * Helper method to validate required number parameter
   */
  protected validateRequiredNumber(
    params: Record<string, unknown>,
    key: string
  ): number {
    const value = params[key];
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error(`Parameter '${key}' must be a valid number`);
    }
    return value;
  }

  /**
   * Helper method to validate optional number parameter
   */
  protected validateOptionalNumber(
    params: Record<string, unknown>,
    key: string
  ): number | undefined {
    const value = params[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error(`Parameter '${key}' must be a valid number if provided`);
    }
    return value;
  }

  /**
   * Helper method to validate required boolean parameter
   */
  protected validateRequiredBoolean(
    params: Record<string, unknown>,
    key: string
  ): boolean {
    const value = params[key];
    if (typeof value !== "boolean") {
      throw new Error(`Parameter '${key}' must be a boolean`);
    }
    return value;
  }

  /**
   * Helper method to validate optional boolean parameter
   */
  protected validateOptionalBoolean(
    params: Record<string, unknown>,
    key: string
  ): boolean | undefined {
    const value = params[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== "boolean") {
      throw new Error(`Parameter '${key}' must be a boolean if provided`);
    }
    return value;
  }

  /**
   * Extract maximum token budget from LanguageModelToolInvocationOptions
   * Uses model-specific tokenBudget if available, otherwise falls back to configuration
   */
  protected getMaxTokens(
    options: vscode.LanguageModelToolInvocationOptions<object>
  ): number {
    // Check for model-specific token budget first
    if (options.tokenizationOptions?.tokenBudget) {
      Logger.debug(
        `Using model-specific token budget: ${options.tokenizationOptions.tokenBudget}`
      );
      return options.tokenizationOptions.tokenBudget;
    }

    // Fall back to configuration
    const configuredMaxTokens = ConfigurationManager.getConfig(
      "aiChainTraversal.tokenManagement.maxTokens",
      128000
    );
    Logger.debug(`Using configured max tokens: ${configuredMaxTokens}`);
    return configuredMaxTokens;
  }

  /**
   * Get tokenization options for accurate token counting
   */
  protected getTokenizationOptions(
    options: vscode.LanguageModelToolInvocationOptions<object>
  ): vscode.LanguageModelToolTokenizationOptions | undefined {
    return options.tokenizationOptions;
  }
}
