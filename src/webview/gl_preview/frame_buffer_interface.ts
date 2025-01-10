import { TextureSource } from "./texture_source";

export interface FrameBufferInterface {
    getTextureType(): number;
    get(): WebGLFramebuffer | null;
    //getSize(): { width: number; height: number };
    resize(): void;
    bind(): void;
    unbind(): void;
    clearTextures(clearColor: [number, number, number, number]): void;
    getTexture(index: number): WebGLTexture;
    createTextureReference(index: number): FrameBufferTextureReference;
    endFrame(): void;
    destroy(): void;
}

export class FrameBufferTextureReference implements TextureSource {
    private frameBuffer: FrameBufferInterface;
    private textureIndex: number;
    constructor(frameBuffer: FrameBufferInterface, textureIndex: number) {
        this.frameBuffer = frameBuffer;
        this.textureIndex = textureIndex;
    }

    public getTexture(): WebGLTexture {
        return this.frameBuffer.getTexture(this.textureIndex);
    }

    public getTextureType(): number {
        return this.frameBuffer.getTextureType();
    }

}