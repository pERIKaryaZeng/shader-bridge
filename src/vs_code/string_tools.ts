// Base64 编解码工具
export function encodeBase64(content: string): string {
    return Buffer.from(content).toString('base64');
}

export function decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}

// 移除单行和多行注释的辅助函数
export function removeComments(content: string): string {
    // 正则表达式
    const singleLineComments = /\/\/.*$/gm; // 匹配单行注释
    const multiLineComments = /\/\*[\s\S]*?\*\//g; // 匹配多行注释

    // 替换单行注释为对应行的空白
    const withoutSingleLineComments = content.replace(singleLineComments, (match) => {
        return ''.padEnd(match.length, ' '); // 替换为等长的空格
    });

    // 替换多行注释为等长度的空行或空白
    const withoutMultiLineComments = withoutSingleLineComments.replace(multiLineComments, (match) => {
        const lines = match.split('\n'); // 计算多行注释的行数
        return lines.map((line) => ''.padEnd(line.length, ' ')).join('\n'); // 替换为对应的空白
    });

    return withoutMultiLineComments;
}

export function generateRandomId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function jsonDeepCopy<T>(object: T): T {
    if (object === null || typeof object !== 'object') {
        throw new Error('Invalid input: jsonDeepCopy expects an object or array');
    }
    return JSON.parse(JSON.stringify(object));
}