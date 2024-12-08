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
    stringsToCheck: CheckingStrings;
    requiredRenderPasses: { [key: string]: number };
    glslVersionInfo: {version:string, lingMapping: LineMapping} | null;
    precisionFloatInfo: {precision:string, lingMapping: LineMapping} | null;
    precisionIntInfo: {precision:string, lingMapping: LineMapping} | null;
}

export interface ShaderData {
    fileInfos: FileInfo[];
    renderPassInfos: RenderPassInfo[];
}

export interface CheckingStrings {[key: string]: {active: boolean, type: string}}

export const checkingStrings: CheckingStrings = {
    "gl_FragColor": {active: false, type: "vec2"},
    "iResolution": {active: false, type: "vec2"},
    "iTime": {active: false, type: "float"},
    "iTimeDelta": {active: false, type: "float"},
    "iMouse": {active: false, type: "vec4"},
}

// 构造正则表达式，仅匹配未找到的字符串
export const checkingRegex = new RegExp(
    Object.keys(checkingStrings)
        .map(key => `(?<![a-zA-Z0-9_])${key}(?![a-zA-Z0-9_])`) // GLSL 边界匹配
        .join('|'),
    'g'
);