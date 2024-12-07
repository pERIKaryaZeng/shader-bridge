import Pass from './pass';
import ShaderProgram from './shader_program';
import FrameBuffer from './frame_buffer';
import TextureSource from './texture_source';

export default class RenderPass implements Pass {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram; // 使用原生 WebGLProgram 类型
    private textureSources: TextureSource[];
    private positionBuffer: WebGLBuffer | null;
    private frameBuffer: FrameBuffer | null;

    constructor(
        gl: WebGLRenderingContext,
        shaderProgram: ShaderProgram,
        textureSources: TextureSource[],
        frameBuffer: FrameBuffer | null = null
    ) {
        this.gl = gl;
        this.program = shaderProgram.get();
        this.positionBuffer = null;
        this.textureSources = textureSources;
        this.frameBuffer = frameBuffer;
    }


    init(): void {
        const gl = this.gl;
        console.log("RenderPass initialized");

        this.positionBuffer = gl.createBuffer();
        if (!this.positionBuffer) {
            throw new Error("Failed to create buffer");
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1, 1, -1, -1, 1,
                -1, 1, 1, -1, 1, 1
            ]),
            gl.STATIC_DRAW
        );

        gl.useProgram(this.program); // 确保绑定了正确的 WebGLProgram

        const positionLocation = gl.getAttribLocation(this.program, 'a_position');
        if (positionLocation < 0) {
            throw new Error("Attribute 'a_position' not found in program");
        }

        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);


    }



    update(dt: number): void {
        const gl = this.gl;
        
        let size: {width: number, height: number};

        // 绑定到 FBO
        if (this.frameBuffer == null){
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            size = {width: gl.canvas.width, height: gl.canvas.height};
        }else{
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer.get());
            size = this.frameBuffer.getSize();
        }

        // 渲染到 FBO
        gl.viewport(0, 0, size.width, size.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    dispose(): void {
        console.log("RenderPass disposed");
    }
}
