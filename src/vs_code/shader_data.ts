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

import Texture from "../webview/gl_preview/texture";

export interface FileInfo {
    filePath: string;
    webviewUri: string;
    fileContent?: string | Texture;
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
    requiredTextures: { [key: string]: number };
    glslVersionMapping: LineMapping | null;
    precisionFloatMapping: LineMapping | null;
    precisionIntMapping: LineMapping | null;
    definedOutput: boolean;
    hasMain: boolean;
    hasMainImage: boolean;
    isDoubleBuffering: boolean;
    configurableSettings: ConfigurableSettings;
}

export function getDefaultRenderPassInfo(): RenderPassInfo{
    return {
        includeFileTree: [],
        lineMappings: [],
        stringsToCheck: getDefaultCheckingStrings(),
        requiredRenderPasses: {},
        requiredTextures: {},
        glslVersionMapping: null,
        precisionFloatMapping: null,
        precisionIntMapping: null,
        definedOutput: false,
        hasMain: false,
        hasMainImage: false,
        isDoubleBuffering: false,
        configurableSettings: {}
    };
}

export interface ShaderData {
    fileInfos: FileInfo[];
    renderPassInfos: RenderPassInfo[];
}

export interface CheckingStrings {[key: string]: {active: boolean, type: string}}


export function getDefaultCheckingStrings(): CheckingStrings{
    return {
        "gl_FragColor": {active: false, type: "vec2"},
        "iResolution": {active: false, type: "vec4"},
        "iTime": {active: false, type: "float"},
        "iTimeDelta": {active: false, type: "float"},
        "iMouse": {active: false, type: "vec4"},
    };
}

// 构造正则表达式，仅匹配未找到的字符串
export const checkingRegex = new RegExp(
    Object.keys(getDefaultCheckingStrings())
        .map(key => `(?<![a-zA-Z0-9_])${key}(?![a-zA-Z0-9_])`) // GLSL 边界匹配
        .join('|'),
    'g'
);


export interface DefinedConfigurableSettings {[key: string]: string[][]}
export interface ConfigurableSettings {[key: string]: (string|number|boolean)[]}

const texture_type = [["texture_2d"], ["texture_cube_map"]];
const textureWrapList = [["repeat"], ["mirrored_repeat"], ["clamp_to_edge"]];
const textureFilterList = [["nearest"], ["linear"]];

// 每个key可以有多个不同的parameter输入list
export const definedConfigurableSettings: DefinedConfigurableSettings = {
    "resolution": [["string", "string"], ["string"]],
    "texture_type": texture_type,
    "texture_wrap": textureWrapList,
    "texture_wrap_s": textureWrapList,
    "texture_wrap_t": textureWrapList,
    "texture_wrap_r": textureWrapList,
    "texture_filter": textureFilterList,
    "texture_min_filter": textureFilterList,
    "texture_mag_filter": textureFilterList,
};