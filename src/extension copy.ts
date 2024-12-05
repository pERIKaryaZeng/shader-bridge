import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 用于存储 WebviewPanel 的全局变量
let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    // 运行 GLSL 命令
    const runGLSL = vscode.commands.registerCommand('shader-bridge.runGLSL', (uri: vscode.Uri) => {
        if (uri) {
            showGLSLPreview(context, uri); // 直接运行
        } else {
            vscode.window.showErrorMessage('No GLSL file selected!');
        }
    });

    // 保存并运行 GLSL 命令
    const saveAndRunGLSL = vscode.commands.registerCommand('shader-bridge.saveAndRunGLSL', async (uri: vscode.Uri) => {
        if (!uri) {
            vscode.window.showErrorMessage('No GLSL file selected!');
            return;
        }

        // 获取当前活动编辑器
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === uri.fsPath) {
            // 如果文件有未保存的更改，保存文件
            if (editor.document.isDirty) {
                await editor.document.save();
                vscode.window.showInformationMessage(`File ${editor.document.fileName} saved successfully!`);
            }
        }

        // 显示 GLSL 预览
        showGLSLPreview(context, uri);
    });

    // 注册命令到上下文
    context.subscriptions.push(runGLSL, saveAndRunGLSL);
}


export function deactivate() {}

// 文件内容和路径的结构
interface FileInfo {
    filePath: string; // 文件路径 (Base64)
    webviewUri: string; // web view 修改后路径 (Base64)
    fileContent: string;
}

// 行映射的结构
interface LineMapping {
    fileIndex: number; // 对应 fileList 的索引
    localLine: number; // 文件中的本地行号
}

interface RenderPassInfo {
    lineMappings: LineMapping[];
}

interface ShaderData {
    fileInfos: FileInfo[]; 
    renderPassInfos: RenderPassInfo[];
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
    fileMap: Map<string, number>,
    lineMappings: LineMapping[],
    processedFiles: Set<string>, // 用于跟踪已解析的文件路径
    iChannelFiles: Map<number, string>, // 用于跟踪 #ichannel 文件路径
    startLine = 1
): number {
    // 如果文件已经被解析过，直接返回当前行号
    if (processedFiles.has(filePath)) {
        return startLine;
    }

    // 标记当前文件为已处理
    processedFiles.add(filePath);

    // 如果文件在全局中被添加过， 直接获取index
    let fileIndex = fileMap.get(filePath);
    if (!fileIndex){
        fileIndex = fileMap.size;
        fileMap.set(filePath, fileIndex);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');


    // // 添加当前文件到文件列表
    // fileInfos.push({
    //     filePath: encodeBase64(filePath),
    //     fileContent: encodeBase64(content),
    // });

    let currentGlobalLine = startLine;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cleanLine = removeComments(line); // 移除注释

        // 优先匹配 #include 指令
        const includeMatch = cleanLine.match(/#include\s+["'](.+?)["']/);
        if (includeMatch) {
            const includePath = path.resolve(path.dirname(filePath), includeMatch[1]);

            // 递归解析 #include 文件，传递已处理文件集合
            currentGlobalLine = parseGLSL(includePath, fileMap, lineMappings, processedFiles, iChannelFiles, currentGlobalLine);
            continue; // 如果是 #include 指令，处理完后继续下一行
        }

        // 匹配 #iChannel 指令
        const ichannelMatch = cleanLine.match(/#iChannel(\d+)\s+["'](.+?)["']/);
        if (ichannelMatch) {
            const channelIndex = parseInt(ichannelMatch[1], 10); // 获取通道号
            const ichannelPath = path.resolve(path.dirname(filePath), ichannelMatch[2]); // 获取文件路径

            iChannelFiles.set(channelIndex, ichannelPath); // 添加到 iChannelFiles Map
            continue; // 处理完后直接跳到下一行
        }

        // 如果是普通行，添加到行映射
        lineMappings.push({
            fileIndex,
            localLine: i + 1, // 当前文件中的行号，从 1 开始
        });

        currentGlobalLine++;
    }

    return currentGlobalLine - 1;
}

function updateWebviewContent(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, shaderData: ShaderData, fileMap: Map<string, number>) {

    const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "dist", " ")));

    try {

        shaderData.fileInfos = Array.from(fileMap.keys(), (filePath, index) => {

            const content = fs.readFileSync(filePath, 'utf-8');
    
            const webviewUri = panel.webview.asWebviewUri(vscode.Uri.file(filePath));
    
            return {
                filePath: encodeBase64(filePath), 
                webviewUri: encodeBase64(webviewUri.toString()), 
                fileContent: ""//encodeBase64(content)
            };
        });

        console.log(shaderData)

        const htmlPath = path.join(context.extensionPath, 'dist', 'gl_preview.html');
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

function processChannel(
    filePath: string,
    fileMap: Map<string, number>,
    shaderData: ShaderData,
){
    console.log(`Process channels with file path: ${filePath}`);
    const iChannelFiles = new Map<number, string>();
    let renderPassInfo: RenderPassInfo = {lineMappings: []};


    const processedFiles = new Set<string>();
    parseGLSL(filePath, fileMap, renderPassInfo.lineMappings, processedFiles, iChannelFiles);
    shaderData.renderPassInfos.push(renderPassInfo);

    for (const [channelNumber, channelFilePath] of iChannelFiles.entries()) {
        console.log(`Process channel: ${channelNumber}`);

        if (fs.existsSync(channelFilePath)){
            processChannel(channelFilePath, fileMap, shaderData);
        } else {
            console.log(`Channel file not found: ${channelFilePath}`);
        }
    }

}

function showGLSLPreview(context: vscode.ExtensionContext, uri: vscode.Uri) {
    const mainfilePath = uri.fsPath;

    const fileMap = new Map<string, number>();
    let shaderData: ShaderData = { fileInfos: [], renderPassInfos: [] };
    processChannel(mainfilePath, fileMap, shaderData);

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