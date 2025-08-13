/**
 * VS Code API Mocks for Testing
 * Provides m// Mock window
export const window = {
  showInformationMessage: (_message: string) => Promise.resolve(undefined),
  showWarningMessage: (_message: string) => Promise.resolve(undefined),
  showErrorMessage: (_message: string) => Promise.resolve(undefined),
  createStatusBarItem: () => ({
    text: '',
    show: () => {},
    hide: () => {},
    dispose: () => {}
  })
};tations of VS Code APIs used by the extension
 */

import { EventEmitter } from 'events';

// Mock LanguageModelTextPart
export class LanguageModelTextPart {
  constructor(public value: string) {}
}

// Mock LanguageModelToolResult
export class LanguageModelToolResult {
  constructor(public content: LanguageModelTextPart[]) {}
}

// Mock CancellationToken
export class CancellationToken extends EventEmitter {
  private _isCancellationRequested: boolean = false;

  get isCancellationRequested(): boolean {
    return this._isCancellationRequested;
  }

  cancel(): void {
    this._isCancellationRequested = true;
    this.emit('cancelled');
  }
}

// Mock workspace
export const workspace = {
  workspaceFolders: [
    {
      uri: { fsPath: 'c:\\test\\workspace' },
      name: 'test-workspace',
      index: 0
    }
  ],
  
  getWorkspaceFolder: () => ({
    uri: { fsPath: 'c:\\test\\workspace' },
    name: 'test-workspace',
    index: 0
  }),

  getConfiguration: () => ({
    get: (_key: string, defaultValue?: any) => defaultValue
  })
};

// Mock window
export const window = {
  showInformationMessage: (_message: string) => Promise.resolve(undefined),
  showWarningMessage: (_message: string) => Promise.resolve(undefined),
  showErrorMessage: (_message: string) => Promise.resolve(undefined),
  createStatusBarItem: () => ({
    text: '',
    show: () => {},
    hide: () => {},
    dispose: () => {}
  })
};

// Mock commands
export const commands = {
  registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({
    dispose: () => {}
  }),
  
  executeCommand: (_command: string, ..._args: any[]) => Promise.resolve(undefined)
};

// Mock Uri
export const Uri = {
  file: (path: string) => ({
    fsPath: path,
    scheme: 'file',
    path: path
  }),
  
  parse: (uri: string) => ({
    fsPath: uri,
    scheme: 'file',
    path: uri
  })
};

// Mock Disposable
export class Disposable {
  constructor(private callOnDispose: () => void) {}
  
  dispose(): void {
    this.callOnDispose();
  }
  
  static from(...disposables: { dispose(): any }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach(d => d.dispose());
    });
  }
}

// Mock ExtensionMode enum
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3
}

// Complete VS Code module mock
export const vscode = {
  LanguageModelTextPart,
  LanguageModelToolResult,
  CancellationToken,
  workspace,
  window,
  commands,
  Uri,
  Disposable,
  ExtensionMode
};

// Default export for require() usage
export default vscode;
