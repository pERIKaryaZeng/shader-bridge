import WebGLContext from './web_gl_context';
import ShaderProgram from './shader_program';
import Shader from './shader';
import RenderPass from './render_pass';
import Pipeline from './pipeline';
import { FrameBuffer, IFrameBuffer } from './frame_buffer';
import DoubleFrameBuffer from './double_frame_buffer';
import { TextureSourceInfo } from './texture_source';
import Texture from './texture';
import { getDefaultRenderPassInfo } from '../../vs_code/shader_data';
import Stats from 'stats.js';

export default class Viewer {
    private pipeline!: Pipeline;
    private webglContext!: WebGLContext;
    private gl!: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private currentTime: number = 0;
    private startTime: number | null = null;
    private initializationPromise: Promise<void>;
    private frameBuffers: IFrameBuffer[] = [];
    private paused: boolean = false; // 控制暂停状态
    private mouse: {x: number, y: number} = {x: 0, y: 0}; // 鼠标位置帧计数器
    private stats: Stats = new Stats();
    private compilePanel!: Stats.Panel;

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
        
        this.initStats();
        const startCompileTime = performance.now();
        this.initContent();
        const compileTime = performance.now() - startCompileTime;
        this.compilePanel.update(compileTime, compileTime);
    }

    private initStats(): void {
        this.compilePanel = this.stats.addPanel(new Stats.Panel('CT', '#ff8', '#221')); // compile time
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);
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

        const fragmentShaderSource = 
            `#version 300 es
            precision highp float;
            layout(location = 0) out vec4 fragColor;
            uniform vec4 fragCoord;
            uniform sampler2D mainColor;

            void main() {
                fragColor = texelFetch(mainColor,ivec2(gl_FragCoord.xy),0);
            }`;


        const passes: RenderPass[] = [];
        const renderPassInfos = this.webglContext.shaderData.renderPassInfos;
        //this.webglContext.shaderData.renderPassInfos.forEach((renderPassInfo, index, array) => {

        for (let index = 0; index < renderPassInfos.length; index++) {
            const renderPassInfo = renderPassInfos[index];

            let width: number, height: number;
            if (renderPassInfo.configurableSettings.hasOwnProperty("resolution")){
                const resolution = renderPassInfo.configurableSettings["resolution"];
                width = Number(resolution[0]);
                height = Number(resolution[1]);
            }else{
                width = this.gl.canvas.width;
                height = this.gl.canvas.height;
            }

            let frameBuffer: IFrameBuffer;
            if (renderPassInfo.isDoubleBuffering){
                frameBuffer = new DoubleFrameBuffer(this.gl, width, height, 1);
            }else{
                frameBuffer = new FrameBuffer(this.gl, width, height, 1);
            }

            this.frameBuffers.push(frameBuffer);
        };

        for (let index = renderPassInfos.length - 1; index >= 0; index--) {
            const renderPassInfo = renderPassInfos[index];

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

            passes.push(new RenderPass(this.gl, shaderProgram, textureSourceInfos, this.frameBuffers[index], renderPassInfo));
        };




        // 最后一个pass用于渲染到屏幕上
        const vertexShader = new Shader(this.webglContext, this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = new Shader(this.webglContext, this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);
        const renderPassInfo = getDefaultRenderPassInfo();
        renderPassInfo.stringsToCheck["iResolution"].active = true;
        passes.push(new RenderPass(this.gl, shaderProgram, [{uniformName: "mainColor", textureSource:this.frameBuffers[0].createTextureReference(0)}], null, renderPassInfo));

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

        this.pipeline.endFrame();
        this.stats.update();
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
        for (const frameBuffer of this.frameBuffers) {
            if (frameBuffer == null) continue;
            frameBuffer.clearTextures([0.0,0.0,0.0,0.0]);
        }
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