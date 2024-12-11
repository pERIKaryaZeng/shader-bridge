import WebGLContext from './web_gl_context';
import ShaderProgram from './shader_program';
import Shader from './shader';
import RenderPass from './render_pass';
import Pipeline from './pipeline';
import FrameBuffer from './frame_buffer';
import { TextureSourceInfo } from './texture_source';
import Texture from './texture';

export default class Viewer {
    private pipeline!: Pipeline;
    private webglContext!: WebGLContext;
    private gl!: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private currentTime: number = 0;
    private startTime: number | null = null;
    private initializationPromise: Promise<void>;
    private frameBuffers: (FrameBuffer | null)[] = [];
    private paused: boolean = false; // 控制暂停状态
    private mouse: {x: number, y: number} = {x: 0, y: 0}; // 鼠标位置帧计数器

    constructor(canvasId: string) {
        this.initializationPromise = this.initialize(canvasId);
    }

    private async initialize(canvasId: string): Promise<void> {
        // 初始化 WebGL 上下文
        try {
            this.webglContext = await WebGLContext.create(canvasId, this);
            this.gl = this.webglContext.get() as WebGL2RenderingContext; // 确保为 WebGL2 上下文
            console.log("WebGL 2.0 context initialized:", this.gl);
        } catch (error) {
            throw new Error("Failed to initialize WebGLContext: " + (error as Error).message);
        }

        this.initContent();
    }

    private initContent(): void {
        this.frameBuffers = [];
        // 初始化着色器
        const vertexShaderSource = 
            `#version 300 es
            layout(location = 0) in vec4 a_position;

            void main() {
                gl_Position = a_position;
            }`;

        const passes: RenderPass[] = [];
        this.webglContext.shaderData.renderPassInfos.forEach((renderPassInfo, index, array) => {
            const vertexShader = new Shader(this.webglContext, this.gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = new Shader(this.webglContext, this.gl.FRAGMENT_SHADER, null, renderPassInfo);

            const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);


            const textureSourceInfos: TextureSourceInfo[] = [];

            // 从render pass获取所有需要的渲染纹理
            for (const [uniformName, passesIndex] of Object.entries(renderPassInfo.requiredRenderPasses)) {
                const currentFrameBuffer = this.frameBuffers[passesIndex];
                if (currentFrameBuffer == null) continue;
                const textureSourceInfo = {
                    uniformName: uniformName,
                    textureSource: currentFrameBuffer.createTextureReference(0),
                };
                textureSourceInfos.push(textureSourceInfo);
            }

            // 从fileInfos中获取Texture
            for (const [uniformName, fileIndex] of Object.entries(renderPassInfo.requiredTextures)) {
                const fileInfo = this.webglContext.shaderData.fileInfos[fileIndex];
                if (fileInfo.fileContent == undefined || !(fileInfo.fileContent instanceof Texture)) continue;
   
                const textureSourceInfo = {
                    uniformName: uniformName,
                    textureSource: fileInfo.fileContent,
                };
                textureSourceInfos.push(textureSourceInfo);
            }

            // 初始化渲染器
            const isLast = index === array.length - 1;

            const frameBuffer: FrameBuffer | null = isLast ?
                null :
                new FrameBuffer(this.gl, this.gl.canvas.width, this.gl.canvas.height, 1);

            this.frameBuffers.push(frameBuffer);

            passes.push(new RenderPass(this.gl, shaderProgram, textureSourceInfos, frameBuffer, renderPassInfo));
        });

        // 初始化渲染管线
        this.pipeline = new Pipeline(this.gl, passes);

        this.pipeline.init();
        
        console.log("Viewer initialized successfully.");
    }

    private loop(timestamp: number): void {
        if (!this.startTime) this.startTime = timestamp;
        if (this.paused) {
            return; // 如果暂停，不继续渲染
        }
        const deltaTime = (timestamp - this.startTime) / 1000;
        this.startTime = timestamp;

        this.currentTime += deltaTime;
        this.pipeline.update({
            time: this.currentTime,
            timeDelta: deltaTime,
            mouse: this.mouse
        });
        requestAnimationFrame((ts) => this.loop(ts));
    }

    public async start(): Promise<void> {
        // 等待初始化完成
        await this.initializationPromise;

        // 开始渲染
        this.reset();
        requestAnimationFrame((ts) => this.loop(ts));
    }

    public reset(): void {
        // 初始化时间控制
        this.currentTime = 0;
        this.startTime = null;
        if (this.paused){
            this.paused = false;
            requestAnimationFrame((ts) => this.loop(ts));
        }
    }

    public isPaused(): boolean {
        return this.paused;
    }

    // 暂停功能
    public pause(): void {
        this.paused = true;
        console.log("Rendering paused.");
    }

    // 继续功能
    public resume(): void {
        if (!this.paused) return; // 如果未暂停，直接返回
        this.paused = false;
        this.startTime = null;
        console.log("Rendering resumed.");
        requestAnimationFrame((ts) => this.loop(ts));
    }

    public viewportResize(width: number, height: number): void {
        for (const frameBuffer of this.frameBuffers) {
            if (frameBuffer == null) continue;
            frameBuffer.resize(width, height);
        }
        this.reset();
    }

    public setMouse(x: number, y: number): void {
        this.mouse = {x, y};
    }
}