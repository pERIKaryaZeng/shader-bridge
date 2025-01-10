/*
import { TextureSource } from "./texture_source";

export default class Texture implements TextureSource {
    private gl: WebGL2RenderingContext;
    private texture: WebGLTexture;

    constructor(gl: WebGL2RenderingContext, imageData: HTMLImageElement) {
        this.gl = gl;
        this.texture = this.createTexture(imageData);
    }

    private createTexture(imageData: HTMLImageElement): WebGLTexture {
        const texture = this.gl.createTexture();
        if (!texture) {
            throw new Error("Failed to create WebGL texture.");
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // 加载图像数据到纹理
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0, // Level of detail
            this.gl.RGBA8, // Internal format
            this.gl.RGBA, // Format
            this.gl.UNSIGNED_BYTE, // Data type
            imageData // Source
        );

        // this.gl.texImage2D(
        //     this.gl.TEXTURE_2D,
        //     0, // Level of detail
        //     this.gl.RGBA16F, // Internal format: 16-bit float per channel
        //     this.gl.RGBA, // Format: RGBA
        //     this.gl.FLOAT, // Data type: 32-bit float
        //     imageData // Source
        // );

        // 设置纹理参数
        // if (this.isPowerOf2(imageData.width) && this.isPowerOf2(imageData.height)) {
        //     this.gl.generateMipmap(this.gl.TEXTURE_2D);
        //     this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        // } else {
            // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
            // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
            // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        //}
        // this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // 解绑纹理
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        return texture;
    }

    // private isPowerOf2(value: number): boolean {
    //     return (value & (value - 1)) === 0;
    // }

    public getTexture(): WebGLTexture {
        return this.texture;
    }

    public getTextureType(): number {
        return this.gl.TEXTURE_2D;
    }


}
*/