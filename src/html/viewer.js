import WebGLContext from './web_gl_context.js';
import ShaderProgram from './shader_program.js';
import Shader from './shader.js';
import Renderer from './renderer.js';

export default class Viewer {
    constructor(canvasId) {
        this.webglContext = new WebGLContext(canvasId);
        this.gl = this.webglContext.getGL();


        const vertexShaderSource = `
            attribute vec4 a_position;
            void main() {
                gl_Position = a_position;
            }
        `;
        const vertexShader = new Shader(this.webglContext, vertexShaderSource, this.gl.VERTEX_SHADER);




        const fragmentShader = new Shader(this.webglContext, this.webglContext.fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        this.shaderProgram = new ShaderProgram(this.gl, vertexShader, fragmentShader);


        
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
