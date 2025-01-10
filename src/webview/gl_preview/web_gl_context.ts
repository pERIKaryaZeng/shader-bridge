import Viewer from './viewer';


import { PipelineData } from '../../vs_code/pipeline_preprocessor';

// 获取 VS Code API 类型（可选）
declare function acquireVsCodeApi(): any;

export default class WebGLContext {
    public static canvasId = 'glCanvas';
    public static gl: WebGL2RenderingContext; // 使用 WebGL2RenderingContext
    public static canvas: HTMLCanvasElement; // 保存 Canvas 引用
    public static viewer: Viewer;
    public static vscode: any;
    private constructor() {}

    private static async initVSCodeListener(): Promise<void> {
        WebGLContext.vscode = acquireVsCodeApi();
        
        const chunks: string[] = [];
        let totalChunks = 0;
        window.addEventListener('message', async (event) => {

            
            const message = event.data;

            if (message.type === 'chunk') {
                // 收集分块数据
                chunks[message.index] = message.data;
                totalChunks = message.totalChunks;
                //document.getElementById('status').textContent = `Received chunk ${message.index + 1} ${totalChunks}`;
            } else if (message.type === 'transferComplete') {
                // 重组数据
                const fullData = chunks.join('');
                const parsedData = JSON.parse(fullData) as PipelineData;
                console.log('Received Data:', parsedData);
                //document.getElementById('status').textContent = 'Transfer Complete!';

                try {
                    WebGLContext.viewer = await Viewer.create(WebGLContext.gl, parsedData);
                } catch (error) {
                    console.log("errorOutput----------------------------------------------------------")
                    const errorOutput = document.getElementById('errorOutput') as HTMLElement;
            
                    if (errorOutput) {
                        errorOutput.style.display = 'block';
                        errorOutput.textContent = (error as Error).message || 'Unknown error occurred';
            
                        // 使用 HTML 渲染错误日志
                        errorOutput.innerHTML = `${errorOutput.textContent}`;
                    }
            
                    console.error(error);
                }
            }
        });

        

        WebGLContext.vscode.postMessage({ command: 'startTransfer' });
        console.log('Sent startTransfer command to VS Code');
    }

    public static async init(): Promise<void> {
        // 初始化 Canvas 和 WebGL2 上下文
        WebGLContext.canvas = document.getElementById(WebGLContext.canvasId) as HTMLCanvasElement;
        if (!WebGLContext.canvas) {
            throw new Error(`Canvas with ID "${WebGLContext.canvasId}" not found`);
        }

        WebGLContext.gl = WebGLContext.canvas.getContext('webgl2') as WebGL2RenderingContext; // 确保使用 WebGL2
        if (!WebGLContext.gl) {
            throw new Error('WebGL 2.0 is not supported');
        }

        //         // 添加点击事件监听器
//         document.addEventListener('click', (event: MouseEvent) => {
//             const target = (event.target as HTMLElement)?.closest('.file-link') as HTMLElement | null;
//             if (target) {
//                 event.preventDefault();
                
//                 const filePath = target.getAttribute('data-file-path');
//                 const lineNumber = parseInt(target.getAttribute('data-line-number') || '', 10);

//                 if (filePath) {
//                     console.log(filePath, lineNumber);

//                     vscode.postMessage({
//                         command: 'openFile',
//                         filePath,
//                         lineNumber
//                     });
//                 }
//             }
//         });

        await WebGLContext.initVSCodeListener();
        
/*
        // 启用y轴翻转
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

        // 自动调整 Canvas 大小
        this.resizeCanvasToDisplaySize();


        const rect = this.canvas.getBoundingClientRect();
        this.canvas.addEventListener('mousemove', (event) => {
            // 获取鼠标在 canvas 内的坐标
            const mouseX = event.clientX - rect.left;
            const mouseY = this.canvas.height-(event.clientY - rect.top);

            this.viewer.setMouse(mouseX, mouseY);
        });

        this.initButtons();

        // 监听窗口大小变化
        window.addEventListener('resize', () => this.resizeCanvasToDisplaySize());
        
        // 加载所有文件内容，并等待完成
        try {
            await this.loadAllFileContents();
        } catch (error) {
            console.error("Error loading files:", error);
            return; // 终止后续逻辑
        }


        */
    }

    /*
    private initButtons(): void {
        const playButton = document.getElementById('playButton');
        if(playButton){
            playButton.addEventListener('click', () => {
                if (this.viewer.isPaused()) {
                    this.viewer.resume();
                }else{
                    this.viewer.pause();
                }
            });
        }

        const resetButton = document.getElementById('resetButton');
        if(resetButton){
            resetButton.addEventListener('click', () => {
                this.viewer.reset();
            });
        }
    }


    // 调整 Canvas 大小并更新 WebGL 视口
    private resizeCanvasToDisplaySize(): void {

        // 获取 CSS 尺寸
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;

        // 如果 Canvas 的实际分辨率与显示尺寸不匹配，则调整
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;

            //更新 WebGL 视口
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            console.log(
                `Canvas resized to ${this.canvas.width}x${this.canvas.height}`
            );
            

            this.viewer.viewportResize(this.canvas.width, this.canvas.height);

        }
                    
    }

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
                const fileExtension = fileInfo.filePath.split('.').pop()?.toLowerCase();
    
                if (!fileExtension) {
                    throw new Error(`File extension not found for ${fileInfo.filePath}`);
                }
    
                if (['png', 'jpg', 'jpeg', 'gif'].includes(fileExtension)) {
                    // 处理图像文件
                    const image = await this.loadImage(webviewUri);
                    fileInfo.fileContent = new Texture(this.gl, image); // 保存为 HTMLImageElement
                    console.log(`Image loaded: ${webviewUri} with resolution: ${image.naturalWidth}x${image.naturalHeight}`);
                } else {
                    // 处理其他文件类型
                    const response = await fetch(webviewUri);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${webviewUri}: ${response.statusText}`);
                    }
                    fileInfo.fileContent = await response.text(); // 保存为文本内容
                    console.log(`File loaded: ${webviewUri}`);
                }
            } catch (error) {
                console.error(`Error loading file: ${webviewUri}`, error);
                throw error; // 抛出错误以便外部捕获
            }
        });
    
        // 等待所有文件加载完成
        await Promise.all(promises);
        console.log("All files loaded.");
    }
    
    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous"; // 处理跨域问题
            image.src = url;
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(new Error(`Failed to load image: ${url}`));
        });
    }

    // Base64 解码工具
    private decodeBase64(encoded: string): string {
        return atob(encoded);
    }

    public get(): WebGL2RenderingContext {
        return this.gl;
    }

    */
}
