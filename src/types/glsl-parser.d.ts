declare module 'glsl-parser' {
    type Token = {
        type: string;
        data: string;
        position: [number, number, number];
    };

    interface ASTNode {
        type: string;
        data?: string;
        children?: ASTNode[];
        position?: [number, number, number];
        metadata?: any; // 如果 `ASTNode` 包含额外信息
    }

    export function parse(tokens: Token[]): ASTNode[];
}