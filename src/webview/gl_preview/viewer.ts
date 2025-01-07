// import WebGLContext from './web_gl_context';
import ShaderProgram from './shader_program';
import Shader from './shader';
import RenderPass from './render_pass';
import Pipeline from './pipeline';
import { FrameBuffer, IFrameBuffer } from './frame_buffer';
import DoubleFrameBuffer from './double_frame_buffer';
// import { TextureSourceInfo } from './texture_source';
// import Texture from './texture';
// import { getDefaultRenderPassInfo } from '../../vs_code/shader_data';
// import Expression from '../../vs_code/expression';
import Stats from 'stats.js';





export default class Viewer {
    private pipeline!: Pipeline;
    // private webglContext!: WebGLContext;
    // private gl!: WebGL2RenderingContext; // 改为 WebGL2RenderingContext
    private currentTime: number = 0;
    private startTime: number | null = null;
    // private initializationPromise: Promise<void>;
    private frameBuffers: IFrameBuffer[] = [];
    private paused: boolean = true; // 控制暂停状态
    private mouse: {x: number, y: number} = {x: 0, y: 0}; // 鼠标位置帧计数器
    private stats: Stats = new Stats();
    private compilePanel!: Stats.Panel;

    private gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext){
        this.gl = gl;
    }

    public static async create(gl: WebGL2RenderingContext, preprocessedData: any): Promise<Viewer> {
        const instance = new Viewer(gl);
        await instance.init(preprocessedData);
        instance.reset();
        return instance;
    }

    private async init(preprocessedData: any): Promise<void> {

        this.initContent(preprocessedData);
        // 初始化 WebGL 上下文
        // try {
        //     this.webglContext = await WebGLContext.create(canvasId, this);
        //     this.gl = this.webglContext.get() as WebGL2RenderingContext; // 确保为 WebGL2 上下文
        //     console.log("WebGL 2.0 context initialized:", this.gl);
        // } catch (error) {
        //     throw new Error("Failed to initialize WebGLContext: " + (error as Error).message);
        // }
        
        // this.initStats();
        // const startCompileTime = performance.now();
        // this.initContent();
        // const compileTime = performance.now() - startCompileTime;
        // this.compilePanel.update(compileTime, compileTime);
    }


    private initStats(): void {
        this.compilePanel = this.stats.addPanel(new Stats.Panel('CT', '#ff8', '#221')); // compile time
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);
    }

    private initContent(preprocessedData: any): void {
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

        const cubeMapFragmentShaderSource = 
            `#version 300 es
            precision highp float;
            layout(location = 0) out vec4 fragColor;
            uniform vec4 fragCoord;
            uniform vec4 iResolution;
            uniform samplerCube mainColor;

            void main() {
                vec2 uv = gl_FragCoord.xy / iResolution.xy;

                // 计算当前像素所在的列和行
                int col = int(uv.x * 3.0); // 乘以列数 3
                int row = int(uv.y * 2.0); // 乘以行数 2
                int faceIndex = col * 2 + row % 2;

                // 修改UV映射到每个区域的1/3宽度和1/2高度
                uv.x = fract(uv.x * 3.0);
                uv.y = fract(uv.y * 2.0);

                vec3 position[6] = vec3[](
                    vec3(-1.0, -uv.y, uv.x),
                    vec3(1.0, -uv.y, -uv.x),
                    vec3(uv.x, -1.0, -uv.y),
                    vec3(uv.x, 1.0, uv.y),
                    vec3(-uv.x, -uv.y, -1.0),
                    vec3(uv.x, -uv.y, 1.0)
                );

                vec3 rayDir = normalize(position[faceIndex]);
                fragColor = texture(mainColor, rayDir);
            }`;

        const vertexShader = new Shader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);

        const shaderProgramList: ShaderProgram[] = [];
        for (const preprocessorOutput of preprocessedData.preprocessorOutputs) {
            const fragmentShader = new Shader(this.gl, this.gl.FRAGMENT_SHADER, preprocessorOutput.src, preprocessedData.fileList);
            shaderProgramList.push(new ShaderProgram(this.gl, vertexShader, fragmentShader));
        }


        // private preprocessorOutputs: string[];
        // private renderPassList: string[];
        // private fileList: string[];
    
/*
        const passes: RenderPass[] = [];
     
        for (const renderPassInfo of preprocessedData.renderPassList) {

            let textureWrapSStr: string = "";
            let textureWrapTStr: string = "";
            let textureWrapRStr: string = "";
            let textureMinFilterStr: string = "";
            let textureMagFilterStr: string = "";
            let widthStr: string = "vw";
            let heightStr: string = "vh";
            let isCubeMap = false;


            let frameBuffer: IFrameBuffer;
            if (renderPassInfo.isDoubleBuffer){
                frameBuffer = new DoubleFrameBuffer(
                    this.gl,
                    width,
                    height,
                    textureWrapS,
                    textureWrapT,
                    textureWrapR,
                    textureMinFilter,
                    textureMagFilter,
                    1,
                    isCubeMap
                );
            }else{
                frameBuffer = new FrameBuffer(
                    this.gl,
                    width,
                    height,
                    textureWrapS,
                    textureWrapT,
                    textureWrapR,
                    textureMinFilter,
                    textureMagFilter,
                    1,
                    isCubeMap
                );
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


        const displayFbo = passes[passes.length - 1].getFrameBuffer();

        let isCubeMap = false;
        if (displayFbo != null) {
            isCubeMap = displayFbo.getTextureType() == this.gl.TEXTURE_CUBE_MAP;
        }

        // 最后一个pass用于渲染到屏幕上
        const vertexShader = new Shader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = new Shader(this.gl, this.gl.FRAGMENT_SHADER, isCubeMap ? cubeMapFragmentShaderSource: fragmentShaderSource);
        const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);
        const renderPassInfo = getDefaultRenderPassInfo();
        renderPassInfo.stringsToCheck["iResolution"].active = true;
        passes.push(new RenderPass(this.gl, shaderProgram, [{uniformName: "mainColor", textureSource:this.frameBuffers[0].createTextureReference(0)}], null, renderPassInfo));

        // 初始化渲染管线
        this.pipeline = new Pipeline(this.gl, passes);

        this.pipeline.init();
        
        console.log("Viewer initialized successfully.");

        */
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

    // public viewportResize(width: number, height: number): void {
    //     for (const frameBuffer of this.frameBuffers) {
    //         if (frameBuffer == null) continue;
    //         frameBuffer.resize(width, height);
    //     }
    //     this.reset();
    // }

    public setMouse(x: number, y: number): void {
        this.mouse = {x, y};
    }











/*
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

        const cubeMapFragmentShaderSource = 
            `#version 300 es
            precision highp float;
            layout(location = 0) out vec4 fragColor;
            uniform vec4 fragCoord;
            uniform vec4 iResolution;
            uniform samplerCube mainColor;

            void main() {
                vec2 uv = gl_FragCoord.xy / iResolution.xy;

                // 计算当前像素所在的列和行
                int col = int(uv.x * 3.0); // 乘以列数 3
                int row = int(uv.y * 2.0); // 乘以行数 2
                int faceIndex = col * 2 + row % 2;

                // 修改UV映射到每个区域的1/3宽度和1/2高度
                uv.x = fract(uv.x * 3.0);
                uv.y = fract(uv.y * 2.0);

                vec3 position[6] = vec3[](
                    vec3(-1.0, -uv.y, uv.x),
                    vec3(1.0, -uv.y, -uv.x),
                    vec3(uv.x, -1.0, -uv.y),
                    vec3(uv.x, 1.0, uv.y),
                    vec3(-uv.x, -uv.y, -1.0),
                    vec3(uv.x, -uv.y, 1.0)
                );

                vec3 rayDir = normalize(position[faceIndex]);
                fragColor = texture(mainColor, rayDir);
            }`;

        const passes: RenderPass[] = [];
        const renderPassInfos = this.webglContext.shaderData.renderPassInfos;

        for (let index = 0; index < renderPassInfos.length; index++) {
            const renderPassInfo = renderPassInfos[index];

            let textureWrapSStr: string = "";
            let textureWrapTStr: string = "";
            let textureWrapRStr: string = "";
            let textureMinFilterStr: string = "";
            let textureMagFilterStr: string = "";
            let widthStr: string = "vw";
            let heightStr: string = "vh";
            let isCubeMap = false;

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_type")){
                isCubeMap = renderPassInfo.configurableSettings["texture_type"][0] == "texture_cube_map";
            }
            
            if (isCubeMap){
                heightStr = widthStr;
                textureWrapSStr = "clamp_to_edge";
                textureWrapTStr = "clamp_to_edge";
                textureWrapRStr = "clamp_to_edge";
            }
            
            if (renderPassInfo.configurableSettings.hasOwnProperty("resolution")){
                const resolution = renderPassInfo.configurableSettings["resolution"];
                widthStr = String(resolution[0]);
                if (resolution.length <= 1 || resolution[1] == ""){
                    heightStr = widthStr;
                }else{
                    heightStr = String(resolution[1]);
                }
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_wrap")){
                const textureWrapStr = String(renderPassInfo.configurableSettings["texture_wrap"][0]);
                textureWrapSStr = textureWrapStr;
                textureWrapTStr = textureWrapStr;
                textureWrapRStr = textureWrapStr;
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_wrap_s")){
                textureWrapSStr = String(renderPassInfo.configurableSettings["texture_wrap_s"][0]);
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_wrap_t")){
                textureWrapTStr = String(renderPassInfo.configurableSettings["texture_wrap_t"][0]);
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_wrap_r")){
                textureWrapRStr = String(renderPassInfo.configurableSettings["texture_wrap_r"][0]);
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_filter")){
                const textureFilterStr = String(renderPassInfo.configurableSettings["texture_filter"][0]);
                textureMinFilterStr = textureFilterStr;
                textureMagFilterStr = textureFilterStr;
            }
            
            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_min_filter")){
                textureMinFilterStr = String(renderPassInfo.configurableSettings["texture_min_filter"][0]);
            }

            if (renderPassInfo.configurableSettings.hasOwnProperty("texture_mag_filter")){
                textureMagFilterStr = String(renderPassInfo.configurableSettings["texture_mag_filter"][0]);
            }

            const content = {vw: this.gl.canvas.width, vh: this.gl.canvas.height};
            const width = new Expression(widthStr, content);
            const height = new Expression(heightStr, content);
            const textureWrapS: number = this.getTextureWrap(textureWrapSStr);
            const textureWrapT: number = this.getTextureWrap(textureWrapTStr);
            const textureWrapR: number = this.getTextureWrap(textureWrapRStr);
            const textureMinFilter: number = this.getTextureFilter(textureMinFilterStr);
            const textureMagFilter: number = this.getTextureFilter(textureMagFilterStr);

            let frameBuffer: IFrameBuffer;
            if (renderPassInfo.isDoubleBuffering){
                frameBuffer = new DoubleFrameBuffer(
                    this.gl,
                    width,
                    height,
                    textureWrapS,
                    textureWrapT,
                    textureWrapR,
                    textureMinFilter,
                    textureMagFilter,
                    1,
                    isCubeMap
                );
            }else{
                frameBuffer = new FrameBuffer(
                    this.gl,
                    width,
                    height,
                    textureWrapS,
                    textureWrapT,
                    textureWrapR,
                    textureMinFilter,
                    textureMagFilter,
                    1,
                    isCubeMap
                );
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


        const displayFbo = passes[passes.length - 1].getFrameBuffer();

        let isCubeMap = false;
        if (displayFbo != null) {
            isCubeMap = displayFbo.getTextureType() == this.gl.TEXTURE_CUBE_MAP;
        }

        // 最后一个pass用于渲染到屏幕上
        const vertexShader = new Shader(this.webglContext, this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = new Shader(this.webglContext, this.gl.FRAGMENT_SHADER, isCubeMap ? cubeMapFragmentShaderSource: fragmentShaderSource);
        const shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);
        const renderPassInfo = getDefaultRenderPassInfo();
        renderPassInfo.stringsToCheck["iResolution"].active = true;
        passes.push(new RenderPass(this.gl, shaderProgram, [{uniformName: "mainColor", textureSource:this.frameBuffers[0].createTextureReference(0)}], null, renderPassInfo));

        // 初始化渲染管线
        this.pipeline = new Pipeline(this.gl, passes);

        this.pipeline.init();
        
        console.log("Viewer initialized successfully.");
    }

    public getTextureWrap(textureWrapStr: string): number {
        switch (textureWrapStr){
            case "repeat":
                return this.gl.REPEAT;
            case "mirrored_repeat":
                return this.gl.MIRRORED_REPEAT;
            case "clamp_to_edge":
                return this.gl.CLAMP_TO_EDGE;
            default:
                return this.gl.REPEAT;
        }
    }

    public getTextureFilter(textureFilterStr: string): number {
        switch (textureFilterStr){
            case "nearest":
                return this.gl.NEAREST;
            case "linear":
                return this.gl.LINEAR;
            default:
                return this.gl.LINEAR;
        }
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

    */
}