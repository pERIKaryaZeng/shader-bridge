import Pass from './pass';
import ShaderProgram from './shader_program';
import FrameBuffer from './frame_buffer';
import {TextureSourceInfo} from './texture_source';
import { RenderPassInfo } from '../../vs_code/shader_data';
import FrameState from './frame_state';

export default class RenderPass implements Pass {
    private gl: WebGL2RenderingContext;
    private shaderProgram: ShaderProgram;
    private textureSourceInfos: TextureSourceInfo[];
    private positionBuffer: WebGLBuffer | null;
    private vao: WebGLVertexArrayObject | null;
    private frameBuffer: FrameBuffer | null;
    private renderPassInfo: RenderPassInfo;
    private uniformLocations: { [key: string]: WebGLUniformLocation} = {};
    private textureLocations: { [key: string]: WebGLUniformLocation} = {};

    constructor(
        gl: WebGL2RenderingContext,
        shaderProgram: ShaderProgram,
        textureSourceInfos: TextureSourceInfo[],
        frameBuffer: FrameBuffer | null = null,
        renderPassInfo: RenderPassInfo
    ) {
        this.gl = gl;
        this.shaderProgram = shaderProgram;
        this.positionBuffer = null;
        this.textureSourceInfos = textureSourceInfos;
        this.vao = null;
        this.frameBuffer = frameBuffer;
        this.renderPassInfo = renderPassInfo;

 
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

    }

    public init(): void {
        this.uniformLocations = {};
        this.gl.useProgram(this.shaderProgram.get());
        this.addRequiredUniforms();
        this.bindTextureUniforms();
    }

    private addRequiredUniforms(): void {
        Object.entries(this.renderPassInfo.stringsToCheck).forEach(([uniformName, stringInfo]) => {
            if (!stringInfo.active) return;
            const uniformLocation = this.shaderProgram.getUniformLocation(uniformName);
            if (uniformLocation !== null) {
                this.uniformLocations[uniformName] = uniformLocation;
            }
        });
    }

    private bindTextureUniforms(): void {
        const gl = this.gl;
        let index = 0;
        this.textureSourceInfos.forEach((textureSourceInfo) => {
            const texture = textureSourceInfo.textureSource.getTexture();
            const uniformName = textureSourceInfo.uniformName;

            let uniformLocation: WebGLUniformLocation | null;
            if (this.textureLocations.hasOwnProperty(uniformName)) {
                uniformLocation = this.textureLocations[uniformName];
            }else{
                uniformLocation = this.shaderProgram.getUniformLocation(uniformName);
                if (uniformLocation === null) {
                    console.log(`Uniform ${uniformName} not found in program`);
                    return;
                }

                this.textureLocations[uniformName] = uniformLocation;
            }

            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(uniformLocation, index);
            index++;
        });
    }

    public update(frameState: FrameState): void {
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

        gl.uniform2f(this.uniformLocations.iResolution, size.width, size.height);
        gl.uniform1f(this.uniformLocations.iTime, frameState.time);
        gl.uniform1f(this.uniformLocations.iTimeDelta, frameState.timeDelta);
        gl.uniform4f(this.uniformLocations.iMouse, frameState.mouse.x, frameState.mouse.y, 0.0, 0.0);

        this.bindTextureUniforms();

        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
    }

    public dispose(): void {
        console.log("RenderPass disposed");
    }
}