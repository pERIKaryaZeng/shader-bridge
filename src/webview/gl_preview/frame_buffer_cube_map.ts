import { FrameBufferInterface, FrameBufferTextureReference } from "./frame_buffer_interface";
import { Expression, globalExpressionContext } from '../../vs_code/expression';

export default class FrameBufferCubeMap implements FrameBufferInterface{
    private gl: WebGL2RenderingContext;
    private glFrameBuffer: WebGLFramebuffer | null;
    private glTextures: WebGLTexture[];
    private length: Expression;
    private outputNumber: number;
    private textureWrapS: number;
    private textureWrapT: number;
    private textureWrapR: number;
    private textureMinFilter: number;
    private textureMagFilter: number;

    constructor(
        gl: WebGL2RenderingContext,
        props: any
    ) {
        this.gl = gl;
        this.outputNumber = props.outputNumber? props.outputNumber : 1;
        this.length = props.length? props.length : new Expression("vh", globalExpressionContext);
        this.textureWrapS = props.textureWrapS? props.textureWrapS : gl.CLAMP_TO_EDGE;
        this.textureWrapT = props.textureWrapT? props.textureWrapT : gl.CLAMP_TO_EDGE;
        this.textureWrapR = props.textureWrapR? props.textureWrapR : gl.CLAMP_TO_EDGE;
        this.textureMinFilter = props.textureMinFilter? props.textureMinFilter : gl.LINEAR;
        this.textureMagFilter = props.textureMagFilter? props.textureMagFilter : gl.LINEAR;

        this.glFrameBuffer = gl.createFramebuffer();
        if (!this.glFrameBuffer) throw new Error("Failed to create framebuffer");

        this.glTextures = this.createTextures();
        this.attachResources();
    }

    public getTextureType(): number {
        return this.gl.TEXTURE_CUBE_MAP;
    }

    public get(): WebGLFramebuffer | null {
        return this.glFrameBuffer;
    }

    public getLength(): number {
        return this.length.get();
    }

    private createTextures(): WebGLTexture[] {
        const textures: WebGLTexture[] = [];
        const length = this.length.get();
        for (let i = 0; i < this.outputNumber; i++) {
            const texture = this.gl.createTexture();
            if (!texture) throw new Error(`Failed to create texture for output ${i}`);

            this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture);
            // 使用 texStorage2D 提高性能
            this.gl.texStorage2D(this.gl.TEXTURE_CUBE_MAP, 1, this.gl.RGBA8, length, length);
            // 设置纹理参数
            this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_S, this.textureWrapS);
            this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_T, this.textureWrapT);
            this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_WRAP_R, this.textureWrapR);
            this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_MIN_FILTER, this.textureMinFilter);
            this.gl.texParameteri(this.gl.TEXTURE_CUBE_MAP, this.gl.TEXTURE_MAG_FILTER, this.textureMagFilter);

            textures.push(texture);
        }
        return textures;
    }

    private attachResources(): void {
        if (!this.glFrameBuffer) throw new Error("Failed to create frameBuffer");

        const gl = this.gl;

        this.bind();

        const drawBuffers: number[] = [];

        for (let i = 0; i < this.outputNumber; i++) {
            for (let face = 0; face < 6; face++) {
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0 + i,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                    this.glTextures[i],
                    0
                );
            }
            drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
        }

        // 使用 WebGL 2.0 的内置 drawBuffers
        gl.drawBuffers(drawBuffers);

        // 检查帧缓冲区完整性
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer is incomplete: ${status.toString(16)}`);
        }

        // 解绑帧缓冲区
        this.unbind();
    }

    public resize(): void {
        this.length.update();
    
        const gl = this.gl;
    
        // 删除旧资源
        this.glTextures.forEach((texture) => gl.deleteTexture(texture));

        // 重新创建纹理
        this.glTextures = this.createTextures();
        // 重新绑定所有资源
        this.attachResources();
    }

    public bind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.glFrameBuffer);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0 + 0,
            this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + 0,
            this.glTextures[0],
            0
        );
    }

    public unbind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }

    public clearTextures(clearColor: [number, number, number, number]): void {
        const gl = this.gl;
    
        if (!this.glFrameBuffer) throw new Error("Framebuffer is not initialized");
    
        this.bind();
        gl.clearColor(...clearColor);

        // 清除每个面的立方体贴图
        for (let i = 0; i < this.outputNumber; i++) {
            for (let face = 0; face < 6; face++) {
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0 + i,
                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                    this.glTextures[i],
                    0
                );
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
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

        this.glFrameBuffer = null;
        this.glTextures = [];
    }
}