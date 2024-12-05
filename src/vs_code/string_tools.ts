// Base64 编解码工具
export function encodeBase64(content: string): string {
    return Buffer.from(content).toString('base64');
}

export function decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}

// 移除单行和多行注释的辅助函数
export function removeComments(content: string): string {
    // 去除单行注释和多行注释
    return content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
}
