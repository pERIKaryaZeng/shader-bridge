import Pass from './pass';
import ShaderProgram from './shader_program';
import FrameBuffer from './frame_buffer';
import {TextureSourceInfo} from './texture_source';

export default class RenderPass implements Pass {
    private gl: WebGL2RenderingContext;
    private shaderProgram: ShaderProgram;
    private textureSourceInfos: (TextureSourceInfo | null)[];
    private positionBuffer: WebGLBuffer | null;
    private vao: WebGLVertexArrayObject | null;
    private frameBuffer: FrameBuffer | null;

    constructor(
        gl: WebGL2RenderingContext,
        shaderProgram: ShaderProgram,
        textureSourceInfos: (TextureSourceInfo | null)[],
        frameBuffer: FrameBuffer | null = null
    ) {
        this.gl = gl;
        this.shaderProgram = shaderProgram;
        this.positionBuffer = null;
        this.textureSourceInfos = textureSourceInfos;
        this.vao = null;
        this.frameBuffer = frameBuffer;
    }

    init(): void {
        const gl = this.gl;
        console.log("RenderPass initialized");

        this.vao = gl.createVertexArray();
        if (!this.vao) throw new Error("Failed to create VAO");

        gl.bindVertexArray(this.vao);

        this.positionBuffer = gl.createBuffer();
        if (!this.positionBuffer) throw new Error("Failed to create buffer");

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1, 1, -1, -1, 1,
                -1, 1, 1, -1, 1, 1,
            ]),
            gl.STATIC_DRAW
        );

        const glProgram = this.shaderProgram.get();
        gl.useProgram(glProgram);

        const positionLocation = gl.getAttribLocation(glProgram, 'a_position');
        if (positionLocation < 0) {
            throw new Error("Attribute 'a_position' not found in program");
        }

        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
        this.bindTextureUniforms();
    }

    bindTextureUniforms(): void {
        const gl = this.gl;
        let index = 0;
        this.textureSourceInfos.forEach((textureSourceInfo) => {
            if (!textureSourceInfo) return;

            const texture = textureSourceInfo.textureSource.getTexture();
            const uniformName = textureSourceInfo.uniformName;

            const uniformLocation = this.shaderProgram.getUniformLocation(uniformName);
            if (uniformLocation === null) {
                console.log(`Uniform ${uniformName} not found in program`);
                return;
            }

            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(uniformLocation, index);
            index++;
        });
    }

    update(dt: number): void {
        const gl = this.gl;

        let size: { width: number; height: number };
        if (this.frameBuffer == null) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            size = { width: gl.canvas.width, height: gl.canvas.height };
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer.get());
            size = this.frameBuffer.getSize();
        }

        gl.viewport(0, 0, size.width, size.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(this.shaderProgram.get());
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }

    dispose(): void {
        console.log("RenderPass disposed");
    }
}