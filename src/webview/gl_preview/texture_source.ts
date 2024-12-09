export interface TextureSource {
    getTexture(): WebGLTexture; // 获取 WebGL 纹理对象
    getIsFixedSize(): boolean;
}

export interface TextureSourceInfo {
    uniformName: string;
    textureSource: TextureSource;
}