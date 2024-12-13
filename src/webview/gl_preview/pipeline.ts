import Pass from './pass';
import FrameState from './frame_state';
import { IFrameBuffer } from './frame_buffer';

export default class Pipeline {
    private gl: WebGL2RenderingContext; // 更新为 WebGL2RenderingContext
    private passes: Pass[] = []; // 存储所有的 RenderPass 实例

    constructor(gl: WebGL2RenderingContext, passes: Pass[]) {
        this.gl = gl;
        this.passes = passes;

        // 初始化渲染管线
        this.init();
    }

    /**
     * 初始化渲染管线
     */
    public init(): void {
        this.passes.forEach((pass) => pass.init());
    }

    /**
     * 执行所有渲染过程
     * @param dt 时间步长
     */
    public update(frameState: FrameState): void {
        //const gl = this.gl;
        this.passes.forEach((pass, index) => {
            pass.update(frameState)
        });



        // const lastPass = this.passes[this.passes.length - 1];
        // const frameBuffer: IFrameBuffer = lastPass.getFrameBuffer();
        // const size = frameBuffer.getSize();

        // // 绑定 FBO 作为读取源
        // gl.bindFramebuffer(gl.READ_FRAMEBUFFER, frameBuffer.get());
        // // 绑定默认帧缓冲（屏幕）作为写入目标
        // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

        // // 将 FBO 的内容复制到屏幕
        // gl.blitFramebuffer(
        //     0, 0, size.width, size.height,                   // 源区域
        //     0, 0, size.width, size.height, // 目标区域
        //     gl.COLOR_BUFFER_BIT,              // 只复制颜色缓冲
        //     gl.NEAREST                        // 使用最近邻缩放
        // );
    }

    public endFrame(): void {
        this.passes.forEach((pass) => pass.endFrame());
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        this.passes.forEach((pass) => pass.dispose());
    }

}