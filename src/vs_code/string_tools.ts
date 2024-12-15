// Base64 编解码工具
export function encodeBase64(content: string): string {
    return Buffer.from(content).toString('base64');
}

export function decodeBase64(encoded: string): string {
    return Buffer.from(encoded, 'base64').toString('utf-8');
}

// 移除单行和多行注释的辅助函数
export function removeComments(content: string): string {
    // 匹配字符串字面量和注释
    const pattern = /(["'`])(?:(?=(\\?))\2.)*?\1|\/\/.*$|\/\*[\s\S]*?\*\//gm;
    
    // 用于存放原始字符串字面量
    const literals: string[] = [];
    
    // 替换字符串字面量和注释，字符串存入数组，注释替换为等长空白
    content = content.replace(pattern, (match, quote) => {
        if (quote) { // 是字符串字面量
            literals.push(match);
            return `___PLACEHOLDER___${literals.length - 1}___`;
        } else { // 是注释
            return match.startsWith('//') ? ''.padEnd(match.length, ' ') : match.split('\n').map(line => ''.padEnd(line.length, ' ')).join('\n');
        }
    });

    // 将占位符替换回原始的字符串字面量
    content = content.replace(/___PLACEHOLDER___(\d+)___/g, (_, index) => {
        return literals[index];
    });

    //console.log("Final content:", content);

    return content;
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