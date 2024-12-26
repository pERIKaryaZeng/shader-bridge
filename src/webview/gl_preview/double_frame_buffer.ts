import {IFrameBuffer, FrameBuffer, FrameBufferTextureReference} from './frame_buffer';
import Expression from '../../vs_code/expression';

export default class DoubleFrameBuffer implements IFrameBuffer{
    private frameBufferA: FrameBuffer;
    private frameBufferB: FrameBuffer;
    private isFlipped: boolean = false;
    constructor(
        gl: WebGL2RenderingContext,
        width: Expression,
        height: Expression,
        textureWrapS: number,
        textureWrapT: number,
        textureWrapR: number,
        textureMinFilter: number,
        textureMagFilter: number,
        outputNumber: number,
        isCubeMap: boolean = false
    ) {
        this.frameBufferA = new FrameBuffer(
            gl,
            width,
            height,
            textureWrapS,
            textureWrapT,
            textureWrapR,
            textureMinFilter,
            textureMagFilter,
            outputNumber,
            isCubeMap
        );
        
        this.frameBufferB = new FrameBuffer(
            gl,
            width,
            height,
            textureWrapS,
            textureWrapT,
            textureWrapR,
            textureMinFilter,
            textureMagFilter,
            outputNumber,
            isCubeMap
        );
    }

    private getCurrentFrameBuffer(): FrameBuffer {
        return this.isFlipped ? this.frameBufferB : this.frameBufferA;
    }

    private getPreviousFrameBuffer(): FrameBuffer {
        return this.isFlipped ? this.frameBufferA : this.frameBufferB;
    }

    public getTextureType(): number {
        return this.getCurrentFrameBuffer().getTextureType();
    }
    
    public get(): WebGLFramebuffer | null {
        return this.getCurrentFrameBuffer().get();
    }

    public getSize(): { width: number; height: number } {
        return this.getCurrentFrameBuffer().getSize();
    }

    public resize(newWidth: number, newHeight: number): void {
        this.frameBufferA.resize(newWidth, newHeight);
        this.frameBufferB.resize(newWidth, newHeight);
    }

    public bind(): void {
        this.getCurrentFrameBuffer().bind();
    }

    public unbind(): void {
        this.getCurrentFrameBuffer().unbind();
    }

    public clearTextures(clearColor: [number, number, number, number]): void {
        this.frameBufferA.clearTextures(clearColor);
        this.frameBufferB.clearTextures(clearColor);
    }

    public getTexture(index: number): WebGLTexture {
        return this.getPreviousFrameBuffer().getTexture(index);
    }

    public createTextureReference(index: number): FrameBufferTextureReference {
        return new FrameBufferTextureReference(this, index);
    }

    public endFrame(): void {
        this.isFlipped = !this.isFlipped;
    }

    public destroy(): void {
        this.frameBufferA.destroy();
        this.frameBufferB.destroy();
    }
}