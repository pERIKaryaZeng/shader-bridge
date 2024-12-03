export default class Shader {
    constructor(webglContext, source, type) {
        this.webglContext = webglContext;
        this.gl = webglContext.gl;
        this.Shader = this.compileShader(source, type);
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            let errorLog = this.gl.getShaderInfoLog(shader);
            console.error("Original Shader compilation error:", errorLog);

            // 提取所有错误行号
            const errorLineMatches = [...errorLog.matchAll(/ERROR:\s*\d+:(\d+)/g)];

            // 替换错误日志中的全局行号为源文件的行号和文件路径
            errorLineMatches.forEach(match => {
                const globalLine = parseInt(match[1], 10);
                const fileInfo = this.webglContext.findFileAndLine(globalLine);

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

            

            throw new Error(`<span style="color: white; font-size: 1.5rem; font-weight: bold;">Shader compilation error:\n</span>${errorLog}`);
        }
        
        return shader;
    }

    get(){
        return this.Shader;
    }
}
