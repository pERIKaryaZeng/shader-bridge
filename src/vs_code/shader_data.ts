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
            includeFileTree: [
                {
                    fileIndex: number
                    parentTreeIndex: number
                },
                ...
            ]
            lineMappings:[
                LineMapping 1{
                    treeIndex: number,
                    localLine: number,
                },
                LineMapping 2{
                    treeIndex: number,
                    localLine: number,
                },
                ...
            ],
            stringsToCheck:{ string 1: boolean } 
            requiredRenderPasses: { [key: string]: number };
        },
        RenderPassInfo 2{
            includeFileTree: [
                {
                    fileIndex: number
                    parentTreeIndex: number
                },
                ...
            ]
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
            requiredRenderPasses: { [key: string]: number };
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
    treeIndex: number;
    localLine: number;
    type?: string;
    replaceContent?: string;
}

export interface fileTreeNode {
    fileIndex: number;
    parentTreeIndex: number;
    parentIncludeLine: number;
}

export interface RenderPassInfo {
    includeFileTree: fileTreeNode[],
    lineMappings: LineMapping[];
    stringsToCheck: { [key: string]: boolean };
    requiredRenderPasses: { [key: string]: number };
    glslVersion: string | null;
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