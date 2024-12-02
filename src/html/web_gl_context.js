export default class WebGLContext {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new Error(`Canvas with ID "${canvasId}" not found`);
        }
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        const shaderData = JSON.parse(document.getElementById("shaderData").textContent);

        this.fileList = shaderData.fileInfos;
        console.log(this.fileList);
        this.lineMapping = shaderData.lineMappings;
        console.log(this.lineMapping);

        this.fragmentShaderSource = this.generateMergedGLSL();
        console.log("Generated Fragment Shader Source:\n", this.fragmentShaderSource);


    }

    // Base64 解码工具
    decodeBase64(encoded) {
        return atob(encoded);
    }

    // 合并 GLSL 文件内容
    generateMergedGLSL() {
        return this.lineMapping
            .map(mapping => {
                const file = this.fileList[mapping.fileIndex];
                const content = this.decodeBase64(file.fileContent);
                const lines = content.split('\n');
                return lines[mapping.localLine - 1];
            })
            .join('\n');
    }

    // 根据全局行号查找文件路径和本地行号
    findFileAndLine(globalLine) {
        if (globalLine > 0 && globalLine <= this.lineMapping.length) {
            const mapping = this.lineMapping[globalLine - 1];
            const fileInfo = this.fileList[mapping.fileIndex];
            return {
                filePath: this.decodeBase64(fileInfo.filePath),
                localLine: mapping.localLine,
            };
        }
        return null;
    }

    getGL() {
        return this.gl;
    }
}
