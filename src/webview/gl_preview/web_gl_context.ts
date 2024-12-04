interface FileInfo {
    webviewUri: string;
    filePath: string; // Base64 编码的文件路径
    fileContent?: string; // 可选，加载后存储文件内容（Base64 编码）
}

interface LineMapping {
    fileIndex: number;
    localLine: number;
}

interface ShaderData {
    fileInfos: FileInfo[];
    renderPassInfos: {
        lineMappings: LineMapping[];
    }[];
}

interface FileAndLineInfo {
    filePath: string;
    localLine: number;
}

export default class WebGLContext {
    private gl!: WebGLRenderingContext; // WebGL 上下文
    private fileList!: FileInfo[]; // 文件列表
    private lineMapping!: LineMapping[]; // 行映射数据
    public fragmentShaderSource!: string; // 生成的片段着色器源码

    private constructor() {}

    // 静态工厂方法
    public static async create(canvasId: string): Promise<WebGLContext> {
        const instance = new WebGLContext();
        await instance.initialize(canvasId); // 调用异步初始化逻辑
        return instance;
    }

    private async initialize(canvasId: string): Promise<void> {
        // 初始化 Canvas 和 WebGL 上下文
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            throw new Error(`Canvas with ID "${canvasId}" not found`);
        }
        this.gl = canvas.getContext('webgl')!;
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        // 从页面加载 Shader 数据
        const shaderDataElement = document.getElementById("shaderData");
        if (!shaderDataElement || !shaderDataElement.textContent) {
            throw new Error("Shader data not found or invalid.");
        }

        const shaderData: ShaderData = JSON.parse(shaderDataElement.textContent);
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
    public async loadAllFileContents(): Promise<void> {
        console.log("Starting to load all files...");
        const promises = this.fileList.map(async (fileInfo) => {
            fileInfo.webviewUri = this.decodeBase64(fileInfo.webviewUri);
            fileInfo.filePath = this.decodeBase64(fileInfo.filePath);
            const webviewUri = fileInfo.webviewUri;
            try {
                const response = await fetch(webviewUri);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${webviewUri}: ${response.statusText}`);
                }
                fileInfo.fileContent = await response.text(); // 将文件内容重新编码为 Base64
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
    private decodeBase64(encoded: string): string {
        return atob(encoded);
    }

    // Base64 编码工具
    private encodeBase64(content: string): string {
        return btoa(content);
    }

    // 合并 GLSL 文件内容
    private generateMergedGLSL(): string {
        return this.lineMapping
            .map(mapping => {
                const file = this.fileList[mapping.fileIndex];
                const content = file.fileContent!;
                const lines = content.split('\n');
                return lines[mapping.localLine - 1];
            })
            .join('\n');
    }

    // 根据全局行号查找文件路径和本地行号
    public findFileAndLine(globalLine: number): FileAndLineInfo | null {
        if (globalLine > 0 && globalLine <= this.lineMapping.length) {
            const mapping = this.lineMapping[globalLine - 1];
            const fileInfo = this.fileList[mapping.fileIndex];
            return {
                filePath: fileInfo.filePath,
                localLine: mapping.localLine,
            };
        }
        return null;
    }

    public get(): WebGLRenderingContext {
        return this.gl;
    }
}
