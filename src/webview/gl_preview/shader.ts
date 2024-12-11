import WebGLContext from './web_gl_context';
import { RenderPassInfo, getDefaultRenderPassInfo } from '../../vs_code/shader_data';
import { generateRandomId } from '../../vs_code/string_tools';

interface FileAndLineInfo {
    filePath: string;
    localLine: number;
    treeIndex: number;
}

export default class Shader {
    private gl: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private webglContext: WebGLContext;
    private glShader: WebGLShader;
    private renderPassInfo!: RenderPassInfo;

    constructor(
        private webGlContext: WebGLContext, // 假设 WebGLContext 是一个类型，包含 `gl` 和其他辅助方法
        type: number,
        source: string | null,
        renderPassInfo: RenderPassInfo = getDefaultRenderPassInfo()
    ) {
        this.webglContext = webGlContext;
        this.gl = webGlContext.get() as WebGL2RenderingContext; // 确保是 WebGL2 上下文

        if (!source) {
            this.renderPassInfo = renderPassInfo; // 将 RenderPassInfo 传递到每个着色器
            source = this.generateMergedGLSL();
            console.log("Generated Fragment Shader Source:\n", source);
        }

        this.glShader = this.compileShader(source, type);
    }

    private compileShader(source: string, type: number): WebGLShader {
        const shader = this.gl.createShader(type);
        if (!shader) {
            throw new Error("Failed to create shader.");
        }

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            let errorLog = this.gl.getShaderInfoLog(shader) || "Unknown error.";
            console.error("Original Shader compilation error:", errorLog);

            // 提取所有错误行号
            const errorLineMatches = [...errorLog.matchAll(/ERROR:\s*\d+:(\d+)/g)];

            // 替换错误日志中的全局行号为源文件的行号和文件路径
            errorLineMatches.forEach((match) => {
                const globalLine = parseInt(match[1], 10);
                const fileInfo = this.findFileAndLine(globalLine);

                if (fileInfo) {
                    // 构造替换字符串
                    const originalLine = match[0]; // 原始错误信息中包含 "ERROR: ...:line"

                    const treeNode = this.renderPassInfo.includeFileTree[fileInfo.treeIndex];

                    let treeIndex = treeNode.parentTreeIndex;
                    let parentIncludeLine = treeNode.parentIncludeLine;
                    let pathString = ``;
                    while (treeIndex >= 0) {
                        const currentTreeNode = this.renderPassInfo.includeFileTree[treeIndex];
                        const currentfileInfo =
                            this.webglContext.shaderData.fileInfos[currentTreeNode.fileIndex];

                        pathString =
                            `<a href="#" class="file-link" style="text-decoration: none;" data-file-path="${currentfileInfo.filePath}" data-line-number="${parentIncludeLine}">` +
                            `<span style="color: white;"> include </span>` +
                            `<span style="color: yellow; font-family: monospace;">${currentfileInfo.filePath}</span>` +
                            `<span style="color: white;"> : </span>` +
                            `<span style="color: #00ccff; font-weight: bold;">${parentIncludeLine}\n</span>` +
                            `</a>` +
                            pathString;

                        treeIndex = currentTreeNode.parentTreeIndex;
                        parentIncludeLine = treeNode.parentIncludeLine;
                    }

                    const uniqueWebId = generateRandomId();

                    const replacement =
                        `<a href="#" onclick="toggleDetails(event, '${uniqueWebId}', ${fileInfo.localLine})" style="text-decoration: none;">` +
                        `<span id="triangle-${uniqueWebId}-${fileInfo.localLine}" style="color: white; display: inline-block; transform: rotate(0deg); transition: transform 0.2s; margin-right: 5px;">▶</span>` +
                        `<span style="color: red; font-weight: bold;">ERROR</span>` +
                        `</a>` +
                        `<div id="details-${uniqueWebId}-${fileInfo.localLine}" style="display: none; margin-left: 20px; color: #ccc; font-family: monospace;">` +
                        pathString +
                        `</div>` +
                        `<span style="color: white;"> in </span>` +
                        `<a href="#" class="file-link" style="text-decoration: none;" data-file-path="${fileInfo.filePath}" data-line-number="${fileInfo.localLine}">` +
                        `<span style="color: yellow; font-family: monospace;">${fileInfo.filePath}</span>` +
                        `<span style="color: white;"> : </span>` +
                        `<span style="color: #00ccff; font-weight: bold;">${fileInfo.localLine} </span>` +
                        `</a>`;

                    // 替换错误日志中的全局行号为文件路径+本地行号
                    errorLog = errorLog.replace(originalLine, replacement);
                }
            });

            throw new Error(
                `<span style="color: white; font-size: 1.5rem; font-weight: bold;">Shader compilation error:\n</span>${errorLog}`
            );
        }

        return shader;
    }

    // 合并 GLSL 文件内容
    private generateMergedGLSL(): string {
        return this.renderPassInfo.lineMappings
            .map((mapping) => {
                // 如果不是特殊类型，则从文件内容中获取行内容
                if (mapping.type == undefined) {
                    const treeNode = this.renderPassInfo.includeFileTree[mapping.treeIndex];
                    const file = this.webglContext.shaderData.fileInfos[treeNode.fileIndex];
                    const content = file.fileContent!;
                    if (typeof content === "string"){
                        const lines = content.split('\n');
                        return lines[mapping.localLine - 1];
                    }
                    return '';
                } else if (mapping.type == 'replace') {
                    return mapping.replaceContent;
                }
            })
            .join('\n');
    }

    // 根据全局行号查找文件路径和本地行号
    public findFileAndLine(globalLine: number): FileAndLineInfo | null {
        if (globalLine > 0 && globalLine <= this.renderPassInfo.lineMappings.length) {
            const mapping = this.renderPassInfo.lineMappings[globalLine - 1];
            const treeNode = this.renderPassInfo.includeFileTree[mapping.treeIndex];
            const fileInfo = this.webglContext.shaderData.fileInfos[treeNode.fileIndex];
            return {
                filePath: fileInfo.filePath,
                localLine: mapping.localLine,
                treeIndex: mapping.treeIndex,
            };
        }
        return null;
    }

    public get(): WebGLShader {
        return this.glShader;
    }
}
