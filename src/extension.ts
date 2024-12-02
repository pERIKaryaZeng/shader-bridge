import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 用于存储 WebviewPanel 的全局变量
let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('shader-bridge.runGLSL', (uri: vscode.Uri) => {
        if (uri) {
            showGLSLPreview(context, uri);
        } else {
            vscode.window.showErrorMessage('No GLSL file selected!');
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

// 文件内容和路径的结构
interface FileInfo {
    filePath: string; // 文件路径 (Base64)
    fileContent: string; // 文件内容 (Base64)
}

// 行映射的结构
interface LineMapping {
    fileIndex: number; // 对应 fileList 的索引
    localLine: number; // 文件中的本地行号
}

interface ShaderData {
    fileInfos: FileInfo[]; 
    lineMappings: LineMapping[];
}

// Base64 编解码工具
function encodeBase64(content: string): string {
    return Buffer.from(content).toString('base64');
}

function decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}

// 移除单行和多行注释的辅助函数
function removeComments(content: string): string {
    // 去除单行注释和多行注释
    return content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
}

function parseGLSL(
    filePath: string,
    shaderData: ShaderData,
    startLine = 1
): number {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileIndex = shaderData.fileInfos.length;

    // 添加当前文件到文件列表
    shaderData.fileInfos.push({
        filePath: encodeBase64(filePath),
        fileContent: encodeBase64(content),
    });

    let currentGlobalLine = startLine;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanLine = removeComments(line); // 移除注释

        const includeMatch = cleanLine.match(/#include\s+["'](.+?)["']/);

        if (includeMatch) {
            // 如果是 #include 指令，解析包含的文件
            const includePath = path.resolve(path.dirname(filePath), includeMatch[1]);

            // 递归解析 #include 文件
            currentGlobalLine = parseGLSL(includePath, shaderData, currentGlobalLine);
        } else {
            // 普通行，添加到行映射
            shaderData.lineMappings.push({
                fileIndex,
                localLine: i + 1, // 当前文件中的行号，从 1 开始
            });

            currentGlobalLine++;
        }
    }

    return currentGlobalLine - 1;
}

function updateWebviewContent(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, uri: vscode.Uri) {
    const filePath = uri.fsPath;
    const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "src", "html", " ")));

    try {
        let shaderData: ShaderData = {fileInfos: [], lineMappings: []};
        parseGLSL(filePath, shaderData);

        const htmlPath = path.join(context.extensionPath, 'src', 'html', 'glsl_viewer.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

        // 将文件列表和行映射数据传递给 Webview
        htmlContent = htmlContent
            .replace('{{BASE_URI}}', baseUri.toString())
            .replace('{{SHADER_DATA}}', JSON.stringify(shaderData));

        panel.webview.html = htmlContent;
    } catch (err) {
        vscode.window.showErrorMessage(`Error processing GLSL file: ${(err as Error).message}`);
    }
}

function showGLSLPreview(context: vscode.ExtensionContext, uri: vscode.Uri) {
    // 如果 Webview 已经存在，直接更新内容
    if (panel) {
        updateWebviewContent(panel, context, uri);
        panel.reveal(vscode.ViewColumn.One); // 让 Webview 再次显示
    } else {
        // 创建新的 WebviewPanel
        panel = vscode.window.createWebviewPanel(
            'glslPreview',
            'GLSL Preview',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "src"))]
            }
        );

        // 设置关闭时的清理逻辑
        panel.onDidDispose(() => {
            panel = undefined; // Webview 被关闭时清空引用
        });

        panel.webview.onDidReceiveMessage((message) => {

            console.log("dddddddddddddddddddddddd");

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

        // 初始化 Webview 内容
        updateWebviewContent(panel, context, uri);
    }
}

