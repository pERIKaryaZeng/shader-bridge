import * as vscode from 'vscode';
import { registerRunGLSLCommand, registerSaveAndRunGLSLCommand } from './vs_code/command';

export function activate(context: vscode.ExtensionContext) {
    registerRunGLSLCommand(context);
    registerSaveAndRunGLSLCommand(context);
}

export function deactivate() {}
