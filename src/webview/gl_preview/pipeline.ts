import Pass from './pass';
import FrameState from './frame_state';

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
        this.passes.forEach((pass) => pass.update(frameState));
    }

    /**
     * 销毁资源
     */
    public dispose(): void {
        this.passes.forEach((pass) => pass.dispose());
    }

}