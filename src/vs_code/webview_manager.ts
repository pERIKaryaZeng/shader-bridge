import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { encodeBase64 } from './string_tools';
import { processChannel } from './glsl_processor';
import { ShaderData } from './shader_data';

// 用于存储 WebviewPanel 的全局变量
let panel: vscode.WebviewPanel | undefined;

export const showGLSLPreview = (context: vscode.ExtensionContext, uri: vscode.Uri) => {
    const mainfilePath = uri.fsPath;

    const fileMap = new Map<string, number>();
    const passMap = new Map<string, number>();
    let shaderData: ShaderData = { fileInfos: [], renderPassInfos: [] };
    processChannel(mainfilePath, fileMap, passMap, shaderData);
    console.log(fileMap);

    // 动态维护允许的资源路径列表
    const dynamicRoots = new Set(fileMap.keys());

    // 固定路径（用于各个源文件）
    dynamicRoots.add(path.join(context.extensionPath, 'dist'));

    console.log("Dynamic Roots: ", dynamicRoots);

    // 如果 Panel 已经存在，关闭旧的 Panel
    if (panel) {
        panel.dispose(); // 关闭旧的 Panel
    }

    // 创建新的 WebviewPanel
    const rootPath = path.dirname(uri.fsPath);
    dynamicRoots.add(rootPath);

    panel = vscode.window.createWebviewPanel(
        'glslPreview',
        'GLSL Preview',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: Array.from(dynamicRoots).map(root =>
                vscode.Uri.file(root)
            ),
        }
    );

    // 处理 Panel 被关闭的情况
    panel.onDidDispose(() => {
        panel = undefined; // Webview 被关闭时清空引用
    });

    // 处理消息事件
    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'openFile') {
            const fileUri = vscode.Uri.file(message.filePath);
            vscode.workspace.openTextDocument(fileUri).then((document) => {
                vscode.window.showTextDocument(document, {
                    selection: new vscode.Range(
                        new vscode.Position(message.lineNumber - 1, 0),
                        new vscode.Position(message.lineNumber - 1, 0)
                    ),
                });
            });
        }
    });

    // 更新 Webview 内容
    updateWebviewContent(panel, context, shaderData, fileMap);
}


function updateWebviewContent(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, shaderData: ShaderData, fileMap: Map<string, number>) {

    const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "dist", " ")));

    try {
        // fileMap 转换为 shaderData.fileInfos
        shaderData.fileInfos = Array.from(fileMap.keys(), (filePath, index) => {
            // 使用正则表达式来判断是否为网络路径
            const isLocalPath = !/^https?:\/\/\S+/.test(filePath);
            let webviewUri;
            if (isLocalPath) {
                // 本地文件，使用 VS Code 的 API 转换为 webview 可用的 URI
                webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString();
            } else {
                // 非本地文件，直接使用处理过的原始的 URL
                webviewUri = filePath;
            }

            console.log("Webview URI: ", webviewUri);
    
            return {
                filePath: encodeBase64(filePath), 
                webviewUri: encodeBase64(webviewUri.toString()), 
                fileContent: ""
            };
        });

        console.log(shaderData)

        const htmlPath = path.join(context.extensionPath, 'dist', 'gl_preview.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        const cspSource = panel.webview.cspSource;

        // 将文件列表和行映射数据传递给 Webview
        htmlContent = htmlContent
            .replace('{{BASE_URI}}', baseUri.toString())
            .replace('{{SHADER_DATA}}', JSON.stringify(shaderData));

        panel.webview.html = htmlContent;
    } catch (err) {
        vscode.window.showErrorMessage(`Error processing GLSL file: ${(err as Error).message}`);
    }
}





