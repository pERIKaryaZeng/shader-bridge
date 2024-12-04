
/**
 * RenderPass 接口，所有渲染过程需要实现此接口
 */
export default interface Pass {
    init(): void;
    update(dt: number): void;
    dispose(): void;
}