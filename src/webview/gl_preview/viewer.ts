import WebGLContext from './web_gl_context';
import ShaderProgram from './shader_program';
import Shader from './shader';
import RenderPass from './render_pass';
import Pipeline from './pipeline';

export default class Viewer {
    private pipeline!: Pipeline;
    private webglContext!: WebGLContext;
    private gl!: WebGLRenderingContext;
    private currentTime: number = 0;
    private startTime: number | null = null;
    private initializationPromise: Promise<void>;

    constructor(canvasId: string) {
        this.initializationPromise = this.initialize(canvasId);
    }

    private async initialize(canvasId: string): Promise<void> {
        // 初始化 WebGL 上下文
        try {
            this.webglContext = await WebGLContext.create(canvasId);
            this.gl = this.webglContext.get();
            console.log("WebGL context initialized:", this.gl);
        } catch (error) {
            throw new Error("Failed to initialize WebGLContext: " + (error as Error).message);
        }

        // 初始化着色器
        const vertexShaderSource = `
            attribute vec4 a_position;
            void main() {
                gl_Position = a_position;
            }
        `;
        const vertexShader = new Shader(this.webglContext, vertexShaderSource, this.gl.VERTEX_SHADER);

        const fragmentShaderSource = this.webglContext.fragmentShaderSource;
        const fragmentShader = new Shader(this.webglContext, fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);

        // 初始化渲染器
        const mainRendererPass = new RenderPass(this.gl, shaderProgram);

        // 初始化渲染管线
        this.pipeline = new Pipeline(this.gl, [mainRendererPass]);

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