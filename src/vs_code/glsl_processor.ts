import * as fs from 'fs';
import * as path from 'path';
import { removeComments } from './string_tools';
import {
    checkingRegex,
    getDefaultCheckingStrings,
    RenderPassInfo,
    ShaderData,
    LineMapping,
    getDefaultRenderPassInfo
} from './shader_data';

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
        shaderData.renderPassInfos[passIndex].isDoubleBuffering = true;
        return passIndex;
    }

    passIndex = passMap.size;
    passMap.set(filePath, passIndex);
        
    console.log(`Process channels with file path: ${filePath}`);
    const channelFiles = new Map<string, {path: string, lineMapping: LineMapping}>();
    let renderPassInfo: RenderPassInfo = getDefaultRenderPassInfo();
    shaderData.renderPassInfos.push(renderPassInfo);

    // 处理该文件 (全部相关的#include 会被整合为一个文件，而全部的 #ichannel 会被找出进行额外计算）
    const processedFiles = new Set<string>();
    parseGLSL(
        filePath,
        fileMap,
        renderPassInfo,
        processedFiles,
        channelFiles
    );

    const insertLineMappings: LineMapping[] = [];

    // 如果未找到版本号， 默认版本号为 300 es
    if (renderPassInfo.glslVersionMapping == null){
        renderPassInfo.glslVersionMapping = {
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `#version 300 es`
        };
    }
    insertLineMappings.push(renderPassInfo.glslVersionMapping);

    // 如果未找到 int 精度， 默认为 highp
    if (renderPassInfo.precisionIntMapping == null){
        renderPassInfo.precisionIntMapping = {
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `precision highp int;`
        };
    }
    insertLineMappings.push(renderPassInfo.precisionIntMapping);

    // 如果未找到 float 精度， 默认为 highp
    if (renderPassInfo.precisionFloatMapping == null){
        renderPassInfo.precisionFloatMapping = {
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `precision highp float;`
        };
    }
    insertLineMappings.push(renderPassInfo.precisionFloatMapping);

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

    if (!renderPassInfo.definedOutput){
        insertLineMappings.push({
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `out vec4 FragColor;`,
        });
    }
    
    // 处理从上面获取的每一个 #ichannel
    const reversedChannelFiles = [...channelFiles.entries()].reverse();
    for (const [uniformName, channelInfo] of reversedChannelFiles) {
        console.log(`Process channel: ${uniformName}`);

        const isLocalPath = !/^https?:\/\/\S+/.test(channelInfo.path);
        if (isLocalPath){
            // 使用 replace 方法替换"file://"
            channelInfo.path = channelInfo.path.replace( /^\s*file\s*:\s*\/\s*\//i, '');
            if (channelInfo.path.trim() === "self"){
                channelInfo.path = filePath;
            }else{
                channelInfo.path = path.resolve(path.dirname(filePath), channelInfo.path);
            }
        }

        // 获取文件的扩展名
        const fileExtension = path.extname(channelInfo.path).toLowerCase();
        //console.log(`File extension: ${fileExtension}`);
            
        // 根据文件类型处理
        switch (fileExtension) {
            case '.png':
            case '.jpg':
            case '.jpeg':
                console.log(`Processing image file: ${channelInfo.path}`);
                // 获取该文件在全局文件列表中的index
                let fileIndex = fileMap.get(channelInfo.path);
                // 如果文件在全局中未被添加过， 添加到全局
                if (fileIndex == undefined){
                    fileIndex = fileMap.size;
                    fileMap.set(channelInfo.path, fileIndex);
                }
                renderPassInfo.requiredTextures[uniformName] = fileIndex;
                insertLineMappings.push(channelInfo.lineMapping);
                break;
            case '.glsl':
                let currentPassIndex = processChannel(channelInfo.path, fileMap, passMap, shaderData);
                renderPassInfo.requiredRenderPasses[uniformName] = currentPassIndex;
                insertLineMappings.push(channelInfo.lineMapping);
                break;
            default:
                console.log(`Unsupported file type: ${fileExtension}`);
                break;
        }
    }

    renderPassInfo.lineMappings.unshift(...insertLineMappings);

    if (!renderPassInfo.definedOutput && !renderPassInfo.hasMain && renderPassInfo.hasMainImage){
        renderPassInfo.lineMappings.push({
            treeIndex: 0,
            localLine: -1,
            type: "replace",
            replaceContent: `void main() {mainImage(FragColor, gl_FragCoord.xy);}`,
        });
    }
    return passIndex;

}


function parseGLSL(
    filePath: string,
    fileMap: Map<string, number>,
    renderPassInfo: RenderPassInfo,
    processedFiles: Set<string>, // 用于跟踪已解析的文件路径
    iChannelFiles: Map<string, {path: string, lineMapping: LineMapping}>, // 用于跟踪 #ichannel 文件路径
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
    // 如果文件在全局中未被添加过， 添加到全局
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
            if (!renderPassInfo.glslVersionMapping){
                const versionNumber = versionMatch[1]; // 提取版本号
                const isES = !!versionMatch[2]; // 检查是否是 ES 版本
    
                const versionString = `${versionNumber}${isES ? ' es' : ''}`;
    
                console.log(
                    `Found #version directive in file: ${filePath}, Line: ${i + 1}, Version: ${versionString}`
                );
    
                renderPassInfo.glslVersionMapping = {
                    treeIndex: treeIndex,
                    localLine: i + 1,
                    type: "replace",
                    replaceContent: `#version ${versionString}`
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
                if (!renderPassInfo.precisionIntMapping){
                    console.log(
                        `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: int`
                    );

                    renderPassInfo.precisionIntMapping = {
                        treeIndex: treeIndex,
                        localLine: i + 1,
                        type: "replace",
                        replaceContent: `precision ${precisionLevel} int;`
                    };
                }
            }else if (dataType == "float"){
                if (!renderPassInfo.precisionFloatMapping){
                    console.log(
                        `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: float`
                    );

                    renderPassInfo.precisionFloatMapping = {
                        treeIndex: treeIndex,
                        localLine: i + 1,
                        type: "replace",
                        replaceContent: `precision ${precisionLevel} float;`
                    };
                }
            }

            continue;
        }

        // 检查是否设置out输出
        if (!renderPassInfo.definedOutput) {
            const outMatch = line.match(/^(layout\s*\(.*?\)\s*)?out\s+\w+/);
            if (outMatch) {
                console.log(`Found "out" declaration in file: ${filePath}, Line: ${i + 1}`);
                renderPassInfo.definedOutput = true;
            }
        }

        // 检查是否有main()
        if (!renderPassInfo.hasMain) {
            const mainMatch = line.match(/void\s+main\s*\(\s*\)/);
            if (mainMatch) {
                console.log(`Found "main" function declaration in file: ${filePath}, Line: ${i + 1}`);
                renderPassInfo.hasMain = true;
            }
        }

        // 检查是否有mainImage()
        if (!renderPassInfo.hasMainImage) {
            const mainImageMatch = line.match(/void\s+mainImage\s*\(\s*out\s+vec4\s+\w+,\s*in\s+vec2\s+\w+\s*\)/);
            if (mainImageMatch) {
                console.log(`Found "mainImage" function declaration in file: ${filePath}, Line: ${i + 1}`);
                renderPassInfo.hasMainImage = true;
            }
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
            const ichannelPath = ichannelMatch[3]; // 获取文件路径
            iChannelFiles.set(
                uniformName, 
                {
                    path: ichannelPath,
                    lineMapping: {
                        treeIndex: 0,
                        localLine: i + 1,
                        type: "replace",
                        replaceContent: `uniform sampler2D ${uniformName};`
                    }
                }
            ); // 添加到 iChannelFiles Map

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

