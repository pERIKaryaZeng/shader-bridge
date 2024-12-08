import WebGLContext from './web_gl_context';
import ShaderProgram from './shader_program';
import Shader from './shader';
import RenderPass from './render_pass';
import Pipeline from './pipeline';
import FrameBuffer from './frame_buffer';
import { TextureSourceInfo } from './texture_source';

export default class Viewer {
    private pipeline!: Pipeline;
    private webglContext!: WebGLContext;
    private gl!: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private currentTime: number = 0;
    private startTime: number | null = null;
    private initializationPromise: Promise<void>;

    constructor(canvasId: string) {
        this.initializationPromise = this.initialize(canvasId);
    }

    private async initialize(canvasId: string): Promise<void> {
        // 初始化 WebGL 上下文
        try {
            this.webglContext = await WebGLContext.create(canvasId); // 明确要求 WebGL2
            this.gl = this.webglContext.get() as WebGL2RenderingContext; // 确保为 WebGL2 上下文
            console.log("WebGL 2.0 context initialized:", this.gl);
        } catch (error) {
            throw new Error("Failed to initialize WebGLContext: " + (error as Error).message);
        }

        // 初始化着色器
        const vertexShaderSource = 
            `#version 300 es
            layout(location = 0) in vec4 a_position;

            void main() {
                gl_Position = a_position;
            }`;

        const passes: RenderPass[] = [];
        const frameBuffers: (FrameBuffer | null)[] = [];
        this.webglContext.shaderData.renderPassInfos.forEach((renderPassInfo, index, array) => {
            const vertexShader = new Shader(this.webglContext, this.gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = new Shader(this.webglContext, this.gl.FRAGMENT_SHADER, null, renderPassInfo);

            const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);

            // 初始化渲染器
            const isLast = index === array.length - 1;

            const textureSourceInfos: (TextureSourceInfo | null)[] = [];

            for (const [uniformName, passesIndex] of Object.entries(renderPassInfo.requiredRenderPasses)) {
                const currentFrameBuffer = frameBuffers[passesIndex];
                const textureSourceInfo = currentFrameBuffer ?
                    {
                        uniformName: uniformName,
                        textureSource: currentFrameBuffer.createTextureReference(0),
                    } : 
                    null;
                textureSourceInfos.push(textureSourceInfo);
            }

            const frameBuffer: FrameBuffer | null = isLast
                ? null
                : new FrameBuffer(this.gl, this.gl.canvas.width, this.gl.canvas.height, 1);

            frameBuffers.push(frameBuffer);

            passes.push(new RenderPass(this.gl, shaderProgram, textureSourceInfos, frameBuffer));
        });

        // 初始化渲染管线
        this.pipeline = new Pipeline(this.gl, passes);

        // 初始化时间控制
        this.currentTime = 0;
        this.startTime = null;

        console.log("Viewer initialized successfully.");
    }

    private loop(timestamp: number): void {
        if (!this.startTime) this.startTime = timestamp;
        const deltaTime = (timestamp - this.startTime) / 1000;
        this.startTime = timestamp;

        this.currentTime += deltaTime;
        this.pipeline.update(deltaTime);
        requestAnimationFrame((ts) => this.loop(ts));
    }

    public async start(): Promise<void> {
        // 等待初始化完成
        await this.initializationPromise;

        // 开始渲染
        this.pipeline.init();
        requestAnimationFrame((ts) => this.loop(ts));
    }
}