import WebGLContext from './web_gl_context.js';
import ShaderProgram from './shader_program.js';
import Renderer from './renderer.js';

export default class Viewer {
    constructor(canvasId, vertexShaderSource, fragmentShaderSource) {
        this.webglContext = new WebGLContext(canvasId);
        this.gl = this.webglContext.getGL();

        this.shaderProgram = new ShaderProgram(this.gl, vertexShaderSource, fragmentShaderSource);
        this.renderer = new Renderer(this.gl, this.shaderProgram);

        this.currentTime = 0;
        this.startTime = null;
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

    start() {
        this.shaderProgram.use();
        this.renderer.initializeBuffer();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}
