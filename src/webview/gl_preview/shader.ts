import { generateRandomId } from '../../vs_code/string_tools';

export default class Shader {
    private gl: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private glShader: WebGLShader;
    private fileList: string[];

    constructor(
        gl: WebGL2RenderingContext, // 假设 WebGLContext 是一个类型，包含 `gl` 和其他辅助方法
        type: number,
        source: string,
        fileList: string[] = ["no file path"]
    ) {
        this.gl =gl;
        this.fileList = fileList;
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
            const errorLineMatches = [...errorLog.matchAll(/ERROR:\s*(\d+):(-?\d+)/g)];

            // 替换错误日志中的全局行号为源文件的行号和文件路径
            errorLineMatches.forEach((match) => {
                const fileNumber = parseInt(match[1], 10);
                const lineNumber = parseInt(match[2], 10);
                const filePath = this.fileList[fileNumber-1];
                let lineInfo: string;
                if (lineNumber < 0){
                    switch (lineNumber) {
                        case -1:
                            lineInfo = `system defined line`
                            break;  
                        case -2:
                            lineInfo = `main() function line`
                            break;
                        default:
                            lineInfo = `unknown line`
                            break;
                    }
                }else{
                    lineInfo = `${lineNumber}`;
                }

                // 构造替换字符串
                const originalLine = match[0]; // 原始错误信息中包含 "ERROR: ...:line"

                // const treeNode = this.renderPassInfo.includeFileTree[fileInfo.treeIndex];

                // let treeIndex = treeNode.parentTreeIndex;
                // let parentIncludeLine = treeNode.parentIncludeLine;
                let pathString = ``;
                // while (treeIndex >= 0) {
                //     const currentTreeNode = this.renderPassInfo.includeFileTree[treeIndex];
                //     const currentfileInfo =
                //         this.webglContext.shaderData.fileInfos[currentTreeNode.fileIndex];

                //     pathString =
                //         `<a href="#" class="file-link" style="text-decoration: none;" data-file-path="${currentfileInfo.filePath}" data-line-number="${parentIncludeLine}">` +
                //         `<span style="color: white;"> include </span>` +
                //         `<span style="color: yellow; font-family: monospace;">${currentfileInfo.filePath}</span>` +
                //         `<span style="color: white;"> : </span>` +
                //         `<span style="color: #00ccff; font-weight: bold;">${parentIncludeLine}\n</span>` +
                //         `</a>` +
                //         pathString;

                //     treeIndex = currentTreeNode.parentTreeIndex;
                //     parentIncludeLine = treeNode.parentIncludeLine;
                // }

                const uniqueWebId = generateRandomId();

                const replacement =
                    `<a href="#" onclick="toggleDetails(event, '${uniqueWebId}', ${lineNumber})" style="text-decoration: none;">` +
                    `<span id="triangle-${uniqueWebId}-${lineNumber}" style="color: white; display: inline-block; transform: rotate(0deg); transition: transform 0.2s; margin-right: 5px;">▶</span>` +
                    `<span style="color: red; font-weight: bold;">ERROR</span>` +
                    `</a>` +
                    `<div id="details-${uniqueWebId}-${lineNumber}" style="display: none; margin-left: 20px; color: #ccc; font-family: monospace;">` +
                    pathString +
                    `</div>` +
                    `<span style="color: white;"> in </span>` +
                    `<a href="#" class="file-link" style="text-decoration: none;" data-file-path="${filePath}" data-line-number="${lineNumber}">` +
                    `<span style="color: yellow; font-family: monospace;">${filePath}</span>` +
                    `<span style="color: white;"> : </span>` +
                    `<span style="color: #00ccff; font-weight: bold;">${lineInfo} </span>` +
                    `</a>`;

                // 替换错误日志中的全局行号为文件路径+本地行号
                errorLog = errorLog.replace(originalLine, replacement);
            
            });

            throw new Error(
                `<span style="color: white; font-size: 1.5rem; font-weight: bold;">Shader compilation error:\n</span>${errorLog}`
            );
        }

        return shader;
    }

    public get(): WebGLShader {
        return this.glShader;
    }
}
