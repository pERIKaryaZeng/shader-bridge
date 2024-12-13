import { TextureSource } from "./texture_source";

export interface IFrameBuffer {
    get(): WebGLFramebuffer | null;
    getSize(): { width: number; height: number };
    resize(newWidth: number, newHeight: number): void;
    bind(): void;
    unbind(): void;
    clearTextures(clearColor: [number, number, number, number]): void;
    getTexture(index: number): WebGLTexture;
    createTextureReference(index: number): FrameBufferTextureReference;
    endFrame(): void;
    destroy(): void;
}

export class FrameBuffer implements IFrameBuffer{
    private gl: WebGL2RenderingContext; // 更新为 WebGL2RenderingContext
    private glFrameBuffer: WebGLFramebuffer | null;
    private glTextures: WebGLTexture[];
    //private glRenderBuffer: WebGLRenderbuffer | null;
    private width: number;
    private height: number;
    private outputNumber: number;

    constructor(gl: WebGL2RenderingContext, width: number, height: number, outputNumber: number) {
        this.gl = gl;
        this.width = width;
        this.height = height;
        this.outputNumber = outputNumber;

        this.glFrameBuffer = gl.createFramebuffer();
        if (!this.glFrameBuffer) throw new Error("Failed to create framebuffer");

        this.glTextures = this.createTextures();
        this.attachResources();
        //this.glRenderBuffer = this.createRenderbuffer(width, height);
    }

    public get(): WebGLFramebuffer | null {
        return this.glFrameBuffer;
    }

    public getSize(): { width: number; height: number } {
        return { width: this.width, height: this.height };
    }

    private createTextures(): WebGLTexture[] {
        const textures: WebGLTexture[] = [];
        for (let i = 0; i < this.outputNumber; i++) {
            const texture = this.gl.createTexture();
            if (!texture) throw new Error(`Failed to create texture for output ${i}`);

            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

            // 使用 texStorage2D 提高性能
            this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA8, this.width, this.height);

            // 设置纹理参数
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

            textures.push(texture);
        }
        return textures;
    }

    // private createRenderbuffer(width: number, height: number): WebGLRenderbuffer | null {
    //     const renderbuffer = this.gl.createRenderbuffer();
    //     if (!renderbuffer) return null;

    //     this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, renderbuffer);
    //     this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);

    //     return renderbuffer;
    // }

    private attachResources(): void {
        if (!this.glFrameBuffer) throw new Error("Failed to create frameBuffer");

        const gl = this.gl;

        this.bind();

        const drawBuffers: number[] = [];
        for (let i = 0; i < this.outputNumber; i++) {
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

        // // 可选：为深度缓冲区附加 renderbuffer
        // if (this.glRenderBuffer) {
        //     gl.framebufferRenderbuffer(
        //         gl.FRAMEBUFFER,
        //         gl.DEPTH_ATTACHMENT,
        //         gl.RENDERBUFFER,
        //         this.glRenderBuffer
        //     );
        // }

        // 检查帧缓冲区完整性
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer is incomplete: ${status.toString(16)}`);
        }

        // 解绑帧缓冲区
        this.unbind();
    }

    public resize(newWidth: number, newHeight: number): void {
        // if (this.width === newWidth && this.height === newHeight) {
        //     // 如果分辨率未变化，直接返回
        //     return;
        // }
    
        this.width = newWidth;
        this.height = newHeight;


    
        const gl = this.gl;
    
        // 删除旧资源
        this.glTextures.forEach((texture) => gl.deleteTexture(texture));
        // if (this.glRenderBuffer) {
        //     gl.deleteRenderbuffer(this.glRenderBuffer);
        // }

        // 重新创建纹理
        this.glTextures = this.createTextures();
        // 重新绑定所有资源
        this.attachResources();
    
        //// 重新创建渲染缓冲区
        //this.glRenderBuffer = this.createRenderbuffer(newWidth, newHeight);
    }

    public bind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.glFrameBuffer);
    }

    public unbind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    public clearTextures(clearColor: [number, number, number, number]): void {
        const gl = this.gl;
    
        if (!this.glFrameBuffer) throw new Error("Framebuffer is not initialized");
    
        this.bind();
    
        // 遍历每个纹理并清空
        for (let i = 0; i < this.outputNumber; i++) {
            // 设置清除颜色
            gl.clearColor(...clearColor);
    
            // 附加当前纹理为渲染目标
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0 + i,
                gl.TEXTURE_2D,
                this.glTextures[i],
                0
            );
    
            // 清除当前附件
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
    
        this.unbind();
    }

    public getTexture(index: number): WebGLTexture {
        if (index < 0 || index >= this.glTextures.length) {
            throw new Error(`Texture index ${index} out of range`);
        }
        return this.glTextures[index];
    }

    public createTextureReference(index: number): FrameBufferTextureReference {
        return new FrameBufferTextureReference(this, index);
    }

    public endFrame(): void {}

    public destroy(): void {
        const gl = this.gl;

        if (this.glFrameBuffer) gl.deleteFramebuffer(this.glFrameBuffer);
        this.glTextures.forEach((texture) => gl.deleteTexture(texture));
        //if (this.glRenderBuffer) gl.deleteRenderbuffer(this.glRenderBuffer);

        this.glFrameBuffer = null;
        this.glTextures = [];
        //this.glRenderBuffer = null;
    }
}

export class FrameBufferTextureReference implements TextureSource {
    private frameBuffer: IFrameBuffer;
    private textureIndex: number;
    constructor(frameBuffer: IFrameBuffer, textureIndex: number) {
        this.frameBuffer = frameBuffer;
        this.textureIndex = textureIndex;
    }

    public getTexture(): WebGLTexture {
        return this.frameBuffer.getTexture(this.textureIndex);
    }

}

