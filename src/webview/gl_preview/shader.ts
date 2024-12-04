import {WebGLContext, LineMapping} from './web_gl_context';

interface FileAndLineInfo {
    filePath: string;
    localLine: number;
}

export default class Shader {
    private gl: WebGLRenderingContext;
    private webglContext: WebGLContext;
    private shader: WebGLShader;
    private lineMappings!: LineMapping[];

    constructor(
        private webGlContext: WebGLContext, // 假设 WebGLContext 是一个类型，包含 `gl` 和其他辅助方法
        type: number,
        source: string | null,
    ) {
        this.webglContext = webGlContext;
        this.gl = webGlContext.get();

        if (!source){
            this.lineMappings = webGlContext.shaderData.renderPassInfos[0].lineMappings; //这个要给到每一个着色器
            source = this.generateMergedGLSL();
            console.log("Generated Fragment Shader Source:\n", source);
        }

        this.shader = this.compileShader(source, type);
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
            errorLineMatches.forEach(match => {
                const globalLine = parseInt(match[1], 10);
                const fileInfo = this.findFileAndLine(globalLine);

                if (fileInfo) {
                    // 构造替换字符串
                    const originalLine = match[0]; // 原始错误信息中包含 "ERROR: ...:line"
                    const replacement = `<span style="color: red; font-weight: bold;">ERROR</span>` +
                        `<span style="color: white;"> in </span>` +
                        `<a href="#" class="file-link" data-file-path="${fileInfo.filePath}" data-line-number="${fileInfo.localLine}">` +
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
        return this.lineMappings
            .map(mapping => {
                const file = this.webglContext.shaderData.fileInfos[mapping.fileIndex];
                const content = file.fileContent!;
                const lines = content.split('\n');
                return lines[mapping.localLine - 1];
            })
            .join('\n');
    }

    // 根据全局行号查找文件路径和本地行号
    public findFileAndLine(globalLine: number): FileAndLineInfo | null {
        if (globalLine > 0 && globalLine <= this.lineMappings.length) {
            const mapping = this.lineMappings[globalLine - 1];
            const fileInfo = this.webglContext.shaderData.fileInfos[mapping.fileIndex];
            return {
                filePath: fileInfo.filePath,
                localLine: mapping.localLine,
            };
        }
        return null;
    }

    public get(): WebGLShader {
        return this.shader;
    }
}
