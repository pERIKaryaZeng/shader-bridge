import * as fs from 'fs';
import * as path from 'path';
import { removeComments, jsonDeepCopy } from './string_tools';
import { checkingRegex, checkingStrings, RenderPassInfo, ShaderData, LineMapping } from './shader_data';

export function processChannel(
    filePath: string,
    fileMap: Map<string, number>,
    passMap: Map<string, number>,
    shaderData: ShaderData,
): number {  
    // 获取该pass在全局文件列表中的index
    let passIndex = passMap.get(filePath);
    // 如果pass在全局中被添加过， 则跳过
    if (passIndex != undefined){
        return passIndex;
    }

        
    console.log(`Process channels with file path: ${filePath}`);
    const iChannelFiles = new Map<string, string>();
    let renderPassInfo: RenderPassInfo = {
        includeFileTree: [],
        lineMappings: [],
        stringsToCheck: jsonDeepCopy(checkingStrings), // 使用json进行深拷贝
        requiredRenderPasses: {},
        glslVersionInfo: null,
        precisionFloatInfo: null,
        precisionIntInfo: null
    };

    // 处理该文件 (全部相关的#include 会被整合为一个文件，而全部的 #ichannel 会被找出进行额外计算）
    const processedFiles = new Set<string>();
    parseGLSL(
        filePath,
        fileMap,
        renderPassInfo,
        processedFiles,
        iChannelFiles
    );

    const insertLineMappings: LineMapping[] = [];

    // 如果未找到版本号， 默认版本号为 300 es
    if (renderPassInfo.glslVersionInfo == null){
        renderPassInfo.glslVersionInfo = {
            version: "300 es",
            lingMapping: {
                treeIndex: 0,
                localLine: -1
            }
        };
    }
    insertLineMappings.push({
        treeIndex: renderPassInfo.glslVersionInfo.lingMapping.treeIndex,
        localLine: renderPassInfo.glslVersionInfo.lingMapping.localLine,
        type: "replace",
        replaceContent: `#version ${renderPassInfo.glslVersionInfo.version}`,
    });

    // 如果未找到 int 精度， 默认为 highp
    if (renderPassInfo.precisionIntInfo == null){
        renderPassInfo.precisionIntInfo = {
            precision: "highp",
            lingMapping: {
                treeIndex: 0,
                localLine: -1
            }
        };
    }
    insertLineMappings.push({
        treeIndex: renderPassInfo.precisionIntInfo.lingMapping.treeIndex,
        localLine: renderPassInfo.precisionIntInfo.lingMapping.localLine,
        type: "replace",
        replaceContent: `precision ${renderPassInfo.precisionIntInfo.precision} int;`,
    });

    // 如果未找到 float 精度， 默认为 highp
    if (renderPassInfo.precisionFloatInfo == null){
        renderPassInfo.precisionFloatInfo = {
            precision: "highp",
            lingMapping: {
                treeIndex: 0,
                localLine: -1
            }
        };
    }
    insertLineMappings.push({
        treeIndex: renderPassInfo.precisionFloatInfo.lingMapping.treeIndex,
        localLine: renderPassInfo.precisionFloatInfo.lingMapping.localLine,
        type: "replace",
        replaceContent: `precision ${renderPassInfo.precisionFloatInfo.precision} float;`,
    });

    // 如果找到 string， 启用 uniform
    Object.entries(renderPassInfo.stringsToCheck).forEach(([string, stringInfo]) => {
        if (!stringInfo.active) return;

        insertLineMappings.push({
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `uniform ${stringInfo.type} ${string};`,
        });
    });

    renderPassInfo.lineMappings.unshift(...insertLineMappings);

    // 处理从上面获取的每一个 #ichannel
    for (const [uniformName, channelFilePath] of iChannelFiles.entries()) {
        console.log(`Process channel: ${uniformName}`);
        // 如果文件存在
        if (fs.existsSync(channelFilePath)){
            let currentPassIndex = processChannel(channelFilePath, fileMap, passMap, shaderData);
            renderPassInfo.requiredRenderPasses[uniformName] = currentPassIndex;
        } else {
            console.log(`Channel file not found: ${channelFilePath}`);
        }
    }

    passIndex = passMap.size;
    passMap.set(filePath, passIndex);
    shaderData.renderPassInfos.push(renderPassInfo);
    return passIndex;

}

function parseGLSL(
    filePath: string,
    fileMap: Map<string, number>,
    renderPassInfo: RenderPassInfo,
    processedFiles: Set<string>, // 用于跟踪已解析的文件路径
    iChannelFiles: Map<string, string>, // 用于跟踪 #ichannel 文件路径
    startLine = 1,
    parentTreeIndex: number = -1,
    parentIncludeLine: number = -1
): number {
    // 如果文件已经被解析过，直接返回当前行号
    if (processedFiles.has(filePath)) {
        return startLine;
    }

    // 标记当前文件为已处理
    processedFiles.add(filePath);

    // 获取该文件在全局文件列表中的index
    let fileIndex = fileMap.get(filePath);
    // 如果文件在全局中被添加过， 添加到全局再获取index
    if (fileIndex == undefined){
        fileIndex = fileMap.size;
        fileMap.set(filePath, fileIndex);
    }

    const treeIndex = renderPassInfo.includeFileTree.length;

    renderPassInfo.includeFileTree.push({
        fileIndex: fileIndex,
        parentTreeIndex: parentTreeIndex,
        parentIncludeLine: parentIncludeLine
    });

    const content = removeComments(fs.readFileSync(filePath, 'utf-8'));
    
    const lines = content.split('\n');

    // 遍历每一行，处理该文件
    let currentGlobalLine = startLine;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        //const cleanLine = removeComments(line); // 移除注释

        // 检查 #version 指令
        const versionMatch = line.match(/^#version\s+(\d+)(\s+es)?/);
        if (versionMatch) {
            if (!renderPassInfo.glslVersionInfo){
                const versionNumber = versionMatch[1]; // 提取版本号
                const isES = !!versionMatch[2]; // 检查是否是 ES 版本
    
                const versionString = `${versionNumber}${isES ? ' es' : ''}`;
    
                console.log(
                    `Found #version directive in file: ${filePath}, Line: ${i + 1}, Version: ${versionString}`
                );
    
                renderPassInfo.glslVersionInfo = {
                    version: versionString,
                    lingMapping: {
                        treeIndex: treeIndex,
                        localLine: i + 1
                    }
                };
            }
            continue;
        }

        // 匹配 precision 指令
        const precisionMatch = line.match(/precision\s+(lowp|mediump|highp)\s+(float|int)\s*;/);
        if (precisionMatch) {
            const precisionLevel = precisionMatch[1]; // lowp, mediump, or highp
            const dataType = precisionMatch[2]; // float or int

            if (dataType == "int"){
                if (!renderPassInfo.precisionIntInfo){
                    console.log(
                        `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: int`
                    );

                    renderPassInfo.precisionIntInfo = {
                        precision: precisionLevel,
                        lingMapping: {
                            treeIndex: treeIndex,
                            localLine: i + 1
                        }
                    };
                }
            }else if (dataType == "float"){
                if (!renderPassInfo.precisionFloatInfo){
                    console.log(
                        `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: float`
                    );

                    renderPassInfo.precisionFloatInfo = {
                        precision: precisionLevel,
                        lingMapping: {
                            treeIndex: treeIndex,
                            localLine: i + 1
                        }
                    };
                }
            }

            continue;
        }

        // 优先匹配 #include 指令
        const includeMatch = line.match(/#include\s+["'](.+?)["']/);
        if (includeMatch) {
            const includePath = path.resolve(path.dirname(filePath), includeMatch[1]);

            // 递归解析 #include 文件，传递已处理文件集合
            currentGlobalLine = parseGLSL(
                includePath,
                fileMap,
                renderPassInfo,
                processedFiles,
                iChannelFiles,
                currentGlobalLine,
                treeIndex,
                i + 1
            );
            continue; // 如果是 #include 指令，处理完后继续下一行
        }

        // 匹配 #iChannel:uniformName "文件地址" 或 #iChannel{数字} "文件地址" (兼容shader toy)
        const ichannelMatch = line.match(/#iChannel(?:(\d+)|:(\w+))\s+["'](.+?)["']/);
        if (ichannelMatch) {
            const channelNumber = ichannelMatch[1];
            const customName = ichannelMatch[2];
            const uniformName = customName || `iChannel${channelNumber}`;
            const ichannelPath = path.resolve(path.dirname(filePath), ichannelMatch[3]); // 获取文件路径
            iChannelFiles.set(uniformName, ichannelPath); // 添加到 iChannelFiles Map

            renderPassInfo.lineMappings.push({
                treeIndex: 0,
                localLine: i + 1,
                type: "replace",
                replaceContent: `uniform sampler2D ${uniformName};`,
            });
            continue; // 处理完后直接跳到下一行
        }

        // 对存在变量的查询
        const matches = line.match(checkingRegex);
        if (matches) {
            for (const match of matches) {
                renderPassInfo.stringsToCheck[match].active = true;
            }
        }

        // 如果是普通行，添加到行映射
        renderPassInfo.lineMappings.push({
            treeIndex: treeIndex,
            localLine: i + 1, // 当前文件中的行号，从 1 开始
        });

        currentGlobalLine++;
    }

    return currentGlobalLine - 1;
}

