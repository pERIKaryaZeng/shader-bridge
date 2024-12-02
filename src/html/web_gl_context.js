export default class WebGLContext {
    constructor(canvasId) {
        this.initialize(canvasId);
    }

    async initialize(canvasId) {
        // 初始化 Canvas 和 WebGL 上下文
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            throw new Error(`Canvas with ID "${canvasId}" not found`);
        }
        this.gl = canvas.getContext('webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        // 从页面加载 Shader 数据
        const shaderData = JSON.parse(document.getElementById("shaderData").textContent);
        this.fileList = shaderData.fileInfos;

        // 加载所有文件内容，并等待完成
        try {
            await this.loadAllFileContents();
        } catch (error) {
            console.error("Error loading files:", error);
            return; // 终止后续逻辑
        }

        // 文件加载完成后，继续初始化逻辑
        this.lineMapping = shaderData.renderPassInfos[0].lineMappings;
        console.log(this.lineMapping);

        this.fragmentShaderSource = this.generateMergedGLSL();
        console.log("Generated Fragment Shader Source:\n", this.fragmentShaderSource);

        // 其他初始化逻辑
    }

    // 加载所有文件内容并更新到 fileInfo.fileContent
    async loadAllFileContents() {
        console.log("Starting to load all files...");
        const promises = this.fileList.map(async (fileInfo) => {
            const webviewUri = this.decodeBase64(fileInfo.webviewUri);

            try {
                const response = await fetch(webviewUri);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${webviewUri}: ${response.statusText}`);
                }
                const content = await response.text();
                fileInfo.fileContent = this.encodeBase64(content); // 将文件内容重新编码为 Base64
                console.log(`File loaded: ${webviewUri}`);
            } catch (error) {
                console.error(`Error loading file: ${webviewUri}`, error);
                throw error; // 抛出错误以便外部捕获
            }
        });

        // 等待所有文件加载完成
        await Promise.all(promises);
        console.log("All files loaded.");
    }
    
    // Base64 解码工具
    decodeBase64(encoded) {
        return atob(encoded);
    }

    // Base64 编码工具
    encodeBase64(content) {
        return btoa(content);
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
