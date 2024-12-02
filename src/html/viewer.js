import WebGLContext from './web_gl_context.js';
import ShaderProgram from './shader_program.js';
import Shader from './shader.js';
import Renderer from './renderer.js';

export default class Viewer {
    constructor(canvasId) {
        this.initializationPromise = this.initialize(canvasId);
    }

    async initialize(canvasId) {
        // 初始化 WebGL 上下文
        this.webglContext = new WebGLContext(canvasId);

        // 加载文件内容（异步）
        try {
            await this.webglContext.loadAllFileContents(); // 确保文件加载完成
        } catch (error) {
            console.error("Failed to load shader files:", error);
            return; // 如果加载失败，停止后续操作
        }

        // 文件加载完成后初始化 WebGL 相关内容
        this.gl = this.webglContext.getGL();

        // 初始化着色器
        const vertexShaderSource = `
            attribute vec4 a_position;
            void main() {
                gl_Position = a_position;
            }
        `;
        const vertexShader = new Shader(this.webglContext, vertexShaderSource, this.gl.VERTEX_SHADER);

        const fragmentShader = new Shader(this.webglContext, this.webglContext.fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        this.shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);

        // 初始化渲染器
        this.renderer = new Renderer(this.gl, this.shaderProgram);

        // 初始化时间控制
        this.currentTime = 0;
        this.startTime = null;

        console.log("Viewer initialized successfully.");
    }

    update(deltaTime) {
        this.currentTime += deltaTime;
        this.shaderProgram.setUniform1f('u_time', this.currentTime);
    }

    gameLoop(timestamp) {
        if (!this.startTime) this.startTime = timestamp;
        const deltaTime = (timestamp - this.startTime) / 1000;
        this.startTime = timestamp;

        this.update(deltaTime);
        this.renderer.render();

        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    async start() {
        // 等待初始化完成
        await this.initializationPromise;

        // 开始渲染
        this.shaderProgram.use();
        this.renderer.initializeBuffer();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}