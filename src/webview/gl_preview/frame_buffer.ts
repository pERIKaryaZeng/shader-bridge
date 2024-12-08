import { TextureSource } from "./texture_source";

export default class FrameBuffer {
    private gl: WebGL2RenderingContext; // 更新为 WebGL2RenderingContext
    private glFrameBuffer: WebGLFramebuffer | null;
    private glTextures: WebGLTexture[];
    private glRenderBuffer: WebGLRenderbuffer | null;
    private width: number;
    private height: number;

    constructor(gl: WebGL2RenderingContext, width: number, height: number, outputs: number) {
        this.gl = gl;
        this.width = width;
        this.height = height;

        this.glFrameBuffer = gl.createFramebuffer();
        if (!this.glFrameBuffer) throw new Error("Failed to create framebuffer");

        this.glTextures = this.createTextures(width, height, outputs);
        this.glRenderBuffer = this.createRenderbuffer(width, height);

        this.attachResources(outputs);
    }

    public get(): WebGLFramebuffer | null {
        return this.glFrameBuffer;
    }

    public getSize(): { width: number; height: number } {
        return { width: this.width, height: this.height };
    }

    private createTextures(width: number, height: number, outputs: number): WebGLTexture[] {
        const textures: WebGLTexture[] = [];
        for (let i = 0; i < outputs; i++) {
            const texture = this.gl.createTexture();
            if (!texture) throw new Error(`Failed to create texture for output ${i}`);

            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

            // 使用 texStorage2D 提高性能
            this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA8, width, height);

            // 设置纹理参数
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

            textures.push(texture);
        }
        return textures;
    }

    private createRenderbuffer(width: number, height: number): WebGLRenderbuffer | null {
        const renderbuffer = this.gl.createRenderbuffer();
        if (!renderbuffer) return null;

        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);

        return renderbuffer;
    }

    private attachResources(outputs: number): void {
        if (!this.glFrameBuffer) throw new Error("Failed to create frameBuffer");

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.glFrameBuffer);

        const drawBuffers: number[] = [];
        for (let i = 0; i < outputs; i++) {
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0 + i,
                gl.TEXTURE_2D,
                this.glTextures[i],
                0
            );
            drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
        }

        // 使用 WebGL 2.0 的内置 drawBuffers
        gl.drawBuffers(drawBuffers);

        // 可选：为深度缓冲区附加 renderbuffer
        if (this.glRenderBuffer) {
            gl.framebufferRenderbuffer(
                gl.FRAMEBUFFER,
                gl.DEPTH_ATTACHMENT,
                gl.RENDERBUFFER,
                this.glRenderBuffer
            );
        }

        // 检查帧缓冲区完整性
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer is incomplete: ${status.toString(16)}`);
        }

        // 解绑帧缓冲区
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    bind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.glFrameBuffer);
    }

    unbind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    getTexture(index: number): WebGLTexture {
        if (index < 0 || index >= this.glTextures.length) {
            throw new Error(`Texture index ${index} out of range`);
        }
        return this.glTextures[index];
    }

    createTextureReference(index: number): FrameBufferTextureReference {
        return new FrameBufferTextureReference(this, index);
    }

    destroy(): void {
        const gl = this.gl;

        if (this.glFrameBuffer) gl.deleteFramebuffer(this.glFrameBuffer);
        this.glTextures.forEach((texture) => gl.deleteTexture(texture));
        if (this.glRenderBuffer) gl.deleteRenderbuffer(this.glRenderBuffer);

        this.glFrameBuffer = null;
        this.glTextures = [];
        this.glRenderBuffer = null;
    }
}

export class FrameBufferTextureReference implements TextureSource {
    private frameBuffer: FrameBuffer;
    private textureIndex: number;
    constructor(frameBuffer: FrameBuffer, textureIndex: number) {
        this.frameBuffer = frameBuffer;
        this.textureIndex = textureIndex;
    }

    getTexture(): WebGLTexture {
        return this.frameBuffer.getTexture(this.textureIndex);
    }
}
