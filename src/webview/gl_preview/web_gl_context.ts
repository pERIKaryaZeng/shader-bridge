export interface FileInfo {
    webviewUri: string;
    filePath: string; // Base64 编码的文件路径
    fileContent?: string; // 可选，加载后存储文件内容（Base64 编码）
}

export interface LineMapping {
    fileIndex: number;
    localLine: number;
}

export interface ShaderData {
    fileInfos: FileInfo[];
    renderPassInfos: {
        lineMappings: LineMapping[];
    }[];
}

export class WebGLContext {
    private gl!: WebGLRenderingContext; // WebGL 上下文
    public shaderData!: ShaderData;
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

        // 加载所有文件内容，并等待完成
        try {
            await this.loadAllFileContents();
        } catch (error) {
            console.error("Error loading files:", error);
            return; // 终止后续逻辑
        }
    }

    // 加载所有文件内容并更新到 fileInfo.fileContent
    public async loadAllFileContents(): Promise<void> {
        // 从页面加载 Shader 数据
        const shaderDataElement = document.getElementById("shaderData");
        if (!shaderDataElement || !shaderDataElement.textContent) {
            throw new Error("Shader data not found or invalid.");
        }

        this.shaderData = JSON.parse(shaderDataElement.textContent);

        console.log("Starting to load all files...");
        const promises = this.shaderData.fileInfos.map(async (fileInfo) => {
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

    public get(): WebGLRenderingContext {
        return this.gl;
    }
}
