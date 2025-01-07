import * as vscode from 'vscode';
import { showGLSLPreview } from './webview_manager';

export const registerRunGLSLCommand = (context: vscode.ExtensionContext) => {
    const command = vscode.commands.registerCommand('shader-bridge.runGLSL', (uri: vscode.Uri) => {
        if (uri) {
            (async () => {
                await showGLSLPreview(context, uri);
            })();
        } else {
            vscode.window.showErrorMessage('No GLSL file selected!');
        }
    });

    context.subscriptions.push(command);
};

export const registerSaveAndRunGLSLCommand = (context: vscode.ExtensionContext) => {
    const command = vscode.commands.registerCommand('shader-bridge.saveAndRunGLSL', async (uri: vscode.Uri) => {
        if (!uri) {
            vscode.window.showErrorMessage('No GLSL file selected!');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === uri.fsPath) {
            if (editor.document.isDirty) {
                await editor.document.save();
                vscode.window.showInformationMessage(`File ${editor.document.fileName} saved successfully!`);
            }
        }

        (async () => {
            await showGLSLPreview(context, uri);
        })();
    });

    context.subscriptions.push(command);
};