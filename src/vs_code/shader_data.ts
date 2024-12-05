/*
Example Structure:

ShaderData{
    fileInfos: [
        FileInfo 1{
            filePath: string,
            webviewUri: string,
            fileContent?: string
        },
        FileInfo 2{
            filePath: string,
            webviewUri: string,
            fileContent?: string
        },
        ...
    ],
    renderPassInfos: [
        RenderPassInfo 1{
            lineMappings:[
                LineMapping 1{
                    fileIndex: number,
                    localLine: number,
                },
                LineMapping 2{
                    fileIndex: number,
                    localLine: number,
                },
                ...
            ],
        },
        RenderPassInfo 2{
            lineMappings:[
                LineMapping 1{
                    fileIndex: number,
                    localLine: number,
                },
                LineMapping 2{
                    fileIndex: number,
                    localLine: number,
                },
                ...
            ],
            stringsToCheck:{ string 1: boolean } 
        },
        ...
    ]
}
*/



export interface FileInfo {
    filePath: string;
    webviewUri: string;
    fileContent?: string;
}

export interface LineMapping {
    fileIndex: number;
    localLine: number;
}

export interface RenderPassInfo {
    lineMappings: LineMapping[];
    stringsToCheck: { [key: string]: boolean };
}

export interface ShaderData {
    fileInfos: FileInfo[];
    renderPassInfos: RenderPassInfo[];
}

export const checkingStrings = Object.fromEntries(
    [
        // "gl_Position",
        // "gl_FragColor",
        // "gl_FragCoord",
        "iTime",
        "iResolution",
        "iTimeDelta",
        "iMouse",
    ].map(key => [key, false])
);

// 构造正则表达式，仅匹配未找到的字符串
export const checkingRegex = new RegExp(
    Object.keys(checkingStrings)
        .map(key => `(?<![a-zA-Z0-9_])${key}(?![a-zA-Z0-9_])`) // GLSL 边界匹配
        .join('|'),
    'g'
);