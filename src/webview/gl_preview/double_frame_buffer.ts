import { FrameBufferInterface, FrameBufferTextureReference } from "./frame_buffer_interface";

export default class DoubleFrameBuffer<T extends FrameBufferInterface>{
    private frameBufferA: FrameBufferInterface;
    private frameBufferB: FrameBufferInterface;
    private isFlipped: boolean = false;
    constructor(
        FrameBufferClass: new (gl: WebGL2RenderingContext, props: any) => T, // 通过构造函数类型约束
        gl: WebGL2RenderingContext,
        props: Object
    ) {
        this.frameBufferA = new FrameBufferClass(
            gl,
            props
        );
        
        this.frameBufferB = new FrameBufferClass(
            gl,
            props
        );
    }

    private getCurrentFrameBuffer(): FrameBufferInterface {
        return this.isFlipped ? this.frameBufferB : this.frameBufferA;
    }

    private getPreviousFrameBuffer(): FrameBufferInterface {
        return this.isFlipped ? this.frameBufferA : this.frameBufferB;
    }

    public getTextureType(): number {
        return this.getCurrentFrameBuffer().getTextureType();
    }
    
    public get(): WebGLFramebuffer | null {
        return this.getCurrentFrameBuffer().get();
    }

    // public getSize(): { width: number; height: number } {
    //     return this.getCurrentFrameBuffer().getSize();
    // }

    public resize(): void {
        this.frameBufferA.resize();
        this.frameBufferB.resize();
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