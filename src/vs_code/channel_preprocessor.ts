import * as fs from 'fs';
import * as path from 'path';
import { Value } from './value';
import { preprocessorSetting, channelSettingsReferenceManager } from './preprocessor_setting';
import { removeComments } from './string_tools';
// Need to remove "type": "module" in @shaderfrog/glsl-parser/package.json
import { parser, GlslSyntaxError } from '@shaderfrog/glsl-parser';

export type DeclarationDetections = {[key: string]: boolean};

type DeclarationDetectionReferences = {[key: string]: {type: string}};
const declarationDetectionReferences: DeclarationDetectionReferences = {
    "iResolution": {type: "vec4"},
    "iTime": {type: "float"},
    "iTimeDelta": {type: "float"},
};

export function getInitDeclarationDetections(): DeclarationDetections{
    const result: DeclarationDetections = {};
    for (const key in declarationDetectionReferences) {
        result[key] = false;
    }
    return result;
}

export type ChannelSettings = {[key: string]: Value}

export type ChannelInfo = {filePath: string, settings: ChannelSettings};

type MacroMap = Map<string, string | { params: string[]; body: string } | undefined>;

type ChannelMap = Map<string, ChannelInfo>;

type IfStatementStack = {
    active: boolean;
    line: number;
    type: string;
}

type TextureUniformInfo = {
    uniformName: string;
    type: 'texture';
    textureIndex: number;
} | {
    uniformName: string;
    type: 'fbo';
    renderPassIndex: number;
    useLastBuffer: boolean;
}

export type ChannelOutput = {
    version: string;
    floatPrecision: string;
    src: string,
    defaultLocation: number;
    outputNumber: number;
    textureUniformInfos: TextureUniformInfo[];
    declarationDetections: DeclarationDetections;
}


export class ChannelPreprocessor {
    
    private mainFilePath: string;
    private macros: MacroMap = new Map();
    private includeSet: Set<string> = new Set();
    private channelInfos: ChannelMap = new Map();
    private fileMap: Map<string, number>;
    private output: ChannelOutput = {
        version: '',
        floatPrecision: '',
        src: '',
        defaultLocation: preprocessorSetting.useMinDefinedLocationAsDefault ? 9999 : 0,
        outputNumber: 1,
        textureUniformInfos: [],
        declarationDetections: getInitDeclarationDetections()
    };
    private hasMain: boolean = false;
    private hasMainImage: boolean = false;
    private defaultLocationOutput: {
            changed: boolean,
            identifier: string,
            specifier: string
        } = {
            changed: false,
            identifier: preprocessorSetting.prefix + "FragColor",
            specifier: "vec4"
        };

    private constructor(mainFilePath: string, fileMap: Map<string, number>) {
        this.mainFilePath = mainFilePath;
        this.fileMap = fileMap;
    }

    static async create(mainFilePath: string, fileMap: Map<string, number>): Promise<ChannelPreprocessor> {
        const instance = new ChannelPreprocessor(mainFilePath, fileMap);
        await instance.init();
        return instance;
    }

    
    private async init(): Promise<void> {
        this.preprocessSrc();
        await this.astProceess();
        this.addAutoDefaultLines();
    }

    private preprocessSrc(): void {
        this.output.src = this.preprocess(this.mainFilePath).join('\n');
    }


    
    private async astProceess(): Promise<void> {
        try{
            const ast = parser.parse(this.output.src);
            console.log(ast);

            // 检查是否包含 precision 函数
            const floatPrecisionResult = ast.program.find((item) => {
                if (item.type !== "declaration_statement") return false;
                const declaration = item.declaration;
                if (!declaration || declaration.type !== "precision") return false;
                const floatPrecisionSpecifier = declaration.specifier?.specifier;
                if (floatPrecisionSpecifier.type !== "keyword" ||
                    floatPrecisionSpecifier.token !== "float") return false;
                this.output.floatPrecision = declaration.qualifier.token;
                return true;
            });

            // 检查是否包含 location = 0 的 output
            ast.program.find((item) => {
                if (item.type !== "declaration_statement") return false;
                const declaration = item.declaration;
                if (!declaration ||
                    declaration.type !== "declarator_list" ||
                    declaration.specified_type.type !== "fully_specified_type"
                ) return false;
                if (declaration.specified_type.qualifiers?.length == 2) {
                    const layoutQualifier = declaration.specified_type.qualifiers[0];
                    if (layoutQualifier.type !== "layout_qualifier" || layoutQualifier.qualifiers.length != 1) return false;
                    const locationQualifier = layoutQualifier.qualifiers[0];
                    if (locationQualifier.identifier.identifier !== 'location' ||
                        locationQualifier.expression.type !== "int_constant"
                    ) return false;

                    const outQualifier = declaration.specified_type.qualifiers[1];
                    if (outQualifier.type !== "keyword" ||
                        outQualifier.token !== "out") return false;

                    if (declaration.specified_type.specifier.specifier.type !== "keyword" ||
                        declaration.declarations.length !== 1) return false;
                    
                    const locationInt = parseInt(locationQualifier.expression.token);

                    if (locationInt <= this.output.defaultLocation) {
                        this.output.defaultLocation = locationInt;
                        this.defaultLocationOutput.changed = true;
                        this.defaultLocationOutput.identifier = declaration.declarations[0].identifier.identifier;
                        this.defaultLocationOutput.specifier = declaration.specified_type.specifier.specifier.token;
                    }
                    
                    if (locationInt >= this.output.outputNumber) {
                        this.output.outputNumber = locationInt + 1;
                    }

                    return false;
                }else if (declaration.specified_type.qualifiers?.length == 1){
                    const outQualifier = declaration.specified_type.qualifiers[0];
                    if (outQualifier.type !== "keyword" ||
                        outQualifier.token !== "out") return false;

                    if (declaration.specified_type.specifier.specifier.type !== "keyword" ||
                        declaration.declarations.length !== 1) return false;
    
                    this.defaultLocationOutput.changed = true;
                    this.defaultLocationOutput.identifier = declaration.declarations[0].identifier.identifier;
                    this.defaultLocationOutput.specifier = declaration.specified_type.specifier.specifier.token;
                    return true;
                }else{
                    return false;
                };

            });

            // 处理未定义的变量
            ast.scopes.forEach((scope) => {
                const bindings = scope.bindings;
        
                // 遍历 bindings
                for (const [key, value] of Object.entries(bindings)) {
                    if (value.declaration === undefined) {
                        // 如果 declaration 是 undefined，查询是否为常见变量名
                        if (this.output.declarationDetections.hasOwnProperty(key)){
                            this.output.declarationDetections[key] = true;
                        }
                    }
                }
            });
            

            // 检查是否包含 main 函数
            const mainResult = ast.program.find((item) => {
                if (item.type !== "function") return false;
            
                const prototype = item.prototype;
                if (!prototype) return false;
            
                const header = prototype.header;
                if (!header || header.name?.identifier !== "main") return false;

                const returnSpecifier = header.returnType.specifier.specifier;
                if (returnSpecifier.type !== "keyword" ||
                    returnSpecifier.token !== "void") return false;
            
                const parameters = prototype.parameters;
                if (parameters !== undefined) return false;
            
                return true;
            });

            if (mainResult != undefined) {
                this.hasMain = true;
            }

            console.log("Find main: ", mainResult);

            // 检查是否包含 mainImage 函数
            const mainImageResult = ast.program.find((item) => {
                if (item.type !== "function") return false;
            
                const prototype = item.prototype;
                if (!prototype) return false;
            
                const header = prototype.header;
                if (!header || header.name?.identifier !== "mainImage") return false;

                const returnSpecifier = header.returnType.specifier.specifier;
                if (returnSpecifier.type !== "keyword" ||
                    returnSpecifier.token !== "void") return false;
            
                const parameters = prototype.parameters;
                if (!parameters || parameters.length !== 2) return false;
            
                const [param0, param1] = parameters;
            
                // 检查第一个参数
                const param0Specifier = param0.specifier.specifier;
                if (
                    param0Specifier.type !== "keyword" ||
                    param0Specifier.token !== this.defaultLocationOutput.specifier ||
                    param0?.qualifier?.length !== 1 ||
                    param0?.qualifier[0]?.token !== "out"
                ) {
                    return false;
                }
            
                // 检查第二个参数
                const param1Specifier = param1.specifier.specifier;
                const param1Qualifier = param1.qualifier;
                if (
                    param1Specifier.type !== "keyword" ||
                    param1Specifier.token !== "vec2" ||
                    !(
                        param1Qualifier.length === 0 ||
                        (param1Qualifier.length === 1 && param1Qualifier[0].token === "in")
                    )
                ) {
                    return false;
                }
            
                return true;
            });

            if (mainImageResult != undefined) {
                this.hasMainImage = true;
            }

            console.log("Find mainImage: ", mainImageResult);


            

            //this.output.src = generate(ast);

        } catch (e) {
            console.log(e);
            let error = e as GlslSyntaxError;
            console.log(error.name, ": ", error.message);
            console.log("At: ", error.location)
        }
    }

    private addAutoDefaultLines(): void {
        const mainFileNumber = this.fileMap.get(this.mainFilePath);
        const newOutputLines: string[] = [];

        // Auto add version
        if (!this.output.version) {
            this.output.version = `300 es`;
        }
        newOutputLines.push(`#version ${this.output.version}`);

        // Auto add float precision
        if (!this.output.floatPrecision) {
            this.output.floatPrecision = `highp`;
            newOutputLines.push(`#line ${-1} ${mainFileNumber}`);
            newOutputLines.push(`precision highp float;`);
        }

        if (!this.defaultLocationOutput.changed) {
            this.output.defaultLocation = 0;
            newOutputLines.push(`#line ${-1} ${mainFileNumber}`);
            newOutputLines.push(`layout(location = 0) out ${this.defaultLocationOutput.specifier} ${this.defaultLocationOutput.identifier};`);
        }

        for (const [declarationDetection, isDetected] of Object.entries(this.output.declarationDetections)) {
            if (isDetected) {
                const declarationDetectionReference = declarationDetectionReferences[declarationDetection];
                newOutputLines.push(`#line ${-1} ${mainFileNumber}`);
                newOutputLines.push(`uniform ${declarationDetectionReference.type} ${declarationDetection};`);
            }
        }

        newOutputLines.push(this.output.src);

        if (!this.hasMain && this.hasMainImage) {
            newOutputLines.push(`#line ${-2} ${mainFileNumber}`);
            newOutputLines.push(`void main() {mainImage(${this.defaultLocationOutput.identifier}, gl_FragCoord.xy);}`);
        }
        this.output.src = newOutputLines.join("\n");

    }

    public getOutput(): ChannelOutput {
        return this.output;
    }

    public getChannelInfos(): ChannelMap {
        return this.channelInfos;
    }

    private readGLSLFile(filePath: string): string {
        return fs.readFileSync(filePath, 'utf8');
    }

    private getFileNumber(filePath: string): number {
        let fileNumber = this.fileMap.get(filePath);
        if (!fileNumber) {
            fileNumber = this.fileMap.size + 1;
            this.fileMap.set(filePath, fileNumber);
        }
        return fileNumber;
    }

    /**
     * 预处理 GLSL 源代码
     * @param source GLSL 源代码
     * @returns 预处理后的 GLSL 代码
     */
    private preprocess (filePath: string): string[] {
        // #include 只有第一次会复制文件内容，避免重复内容
        if (this.includeSet.has(filePath)) {
            return [];
        }
        this.includeSet.add(filePath);

        const src = removeComments(this.readGLSLFile(filePath));
        let fileNumber = this.getFileNumber(filePath);
        const lines = src.split("\n");
        const output: string[] = [];
        const stack: IfStatementStack[] = []; // 条件编译栈
        let includeBlock = true; // 当前行是否包含在编译中
        let lineNumber = 1;
        let lastLineNumber = -1;
        let tempLines: string[] = [];

        const addLines = (newLines: string[]) => {
            if (lineNumber != lastLineNumber + 1) {
                output.push(`#line ${lineNumber} ${fileNumber}`);
            }
            output.push(...newLines);
            lastLineNumber = lineNumber - 1 + newLines.length;
        }

        const handleBlockPreprocessors = (args: string, tokens: string[], line: string): string[] => {
            const directive = tokens[0];
            switch (directive) {
                case "#define":
                    this.handleDefine(args, lineNumber);
                    return [line];
                case "#undef":
                    this.handleUndef(args);
                    return [line];
                case "#version":
                    this.output.version = args;
                    return [];
                case "#set":
                    tokens[1]


    
                    return [];
                case "#include":
                    const includeMatch = args.match(/^\s*["'](.+?)["']/);
                    if (includeMatch) {
                        const includePath = path.resolve(path.dirname(filePath), includeMatch[1]);
                        const includePreprocessedLines = this.preprocess(includePath);
                        return includePreprocessedLines;
                    }
                    return [line];
                default:
                    

                    //const ichannelMatch = line.match(/^\s*#iChannel(?:(\d+)|:(\w+))\s+["'](.+?)["']/);
                    const ichannelMatch = line.match(/^\s*#iChannel(?:(\d+)|:(\w+))(?:::(\w+)\s+(.+)|\s+(["'])(.+?)\5)/);
                    if (ichannelMatch) {
                        const channelNumber = ichannelMatch[1];
                        const customName = ichannelMatch[2];
                        const settingType = ichannelMatch[3];
                        const uniformName = customName || `iChannel${channelNumber}`;

                    
                        if (settingType){
                            const channelData = this.channelInfos.get(uniformName);
                            if (channelData){
                                const parameter = ichannelMatch[4];
                                channelData.settings[settingType] = channelSettingsReferenceManager.verify(settingType, parameter);
                                return [];
                            }else{
                                throw new Error(`Can not set "${settingType}", uniform name "${uniformName}" is not initialized before.`);
                            }
                        }

                        // const quotedMatch = parameter.match(/^["'](.+?)["']$/);
                        // if (!quotedMatch) {
                        //     throw new Error(`Can not initialize "${uniformName}", file path should be surrounded by "".`);
                        // }

                        let channelPath = ichannelMatch[6]; // 获取文件路径

                        const isLocalPath = !/^https?:\/\/\S+/.test(channelPath);
                        if (isLocalPath){
                            // 使用 replace 方法替换"file://"
                            channelPath = channelPath.replace( /^\s*file\s*:\s*\/\s*\//i, '');
                            if (channelPath.trim() === "self"){
                                channelPath = filePath;
                            }else{
                                channelPath = path.resolve(path.dirname(filePath), channelPath);
                            }
                        }

                        this.channelInfos.set(
                            uniformName, 
                            {
                                filePath: channelPath,
                                settings: {}
                            }
                        ); // 添加到 iChannelFiles Map
                        return [];
                    }
    
                    return [line];
            }
        }

        for (let i = 0; i < lines.length; i++) {
            lineNumber = i + 1;
            let line = lines[i];
            const lineTrimStart = line.trimStart();

            // 匹配预处理指令
            if (tempLines.length > 0 || lineTrimStart.startsWith("#")) {
                const lineTrimEnd = line.trimEnd();
                if (lineTrimEnd.endsWith("\\")) {
                    tempLines.push(lineTrimEnd.slice(0, -1));
                    continue;
                } else {
                    tempLines.push(line);
                    line = tempLines.join();
                    tempLines = [];
                }


                const tokens = lineTrimStart.split(/\s+/);
                const directive = tokens[0];
                const args = tokens.slice(1).join(" ");

                switch (directive) {
                    case "#if":
                        includeBlock = this.handleIf(args, stack, lineNumber);
                        break;
                    case "#ifdef":
                        includeBlock = this.handleIfdef(args, stack, lineNumber);
                        break;
                    case "#ifndef":
                        includeBlock = this.handleIfndef(args, stack, lineNumber);
                        break;
                    case "#else":
                        includeBlock = this.handleElse(stack, lineNumber);
                        break;
                    case "#elif":
                        includeBlock = this.handleElif(args, stack, lineNumber);
                        break;
                    case "#endif":
                        includeBlock = this.handleEndif(stack, lineNumber);
                        break;
                    default:
                        if (includeBlock) {
                            const fileLines = handleBlockPreprocessors(args, tokens, line);
                            addLines(fileLines);
                        }
                        break;
                }
            }else if (includeBlock) {
                // 非预处理行输出
                addLines([line]);
            }
        }

        // 检查未闭合的条件
        if (stack.length > 0) {
            const lastStatement = stack.pop();
            throw new Error(`Error: Unmatched ${lastStatement?.type} at line ${lastStatement?.line}}.`);
        }

        return output;
    }

    /**
     * 处理 #define 指令
     */
    private handleDefine(args: string, lineNumber: number): void {
        // if (args.includes("#") || args.includes("##")) {
        //     throw new Error(`Error: GLSL does not support stringize (#) or token concatenation (##) at line ${lineNumber}.`);
        // }
    
        const validateMacroName = (name: string): void => {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
                throw new Error(`Error: Invalid macro name "${name}" at line ${lineNumber}.`);
            }
    
            // 检查是否是 GLSL 的保留关键字或内建宏
            const reservedKeywords = new Set([
                "attribute", "const", "uniform", "varying", "break", "continue", "do", "for", "while",
                "if", "else", "in", "out", "inout", "float", "int", "void", "bool", "true", "false",
                "discard", "return", "mat2", "mat3", "mat4", "vec2", "vec3", "vec4", "ivec2", "ivec3",
                "ivec4", "bvec2", "bvec3", "bvec4", "sampler2D", "samplerCube", "struct",
                "__LINE__", "__FILE__", "__VERSION__", "__GLSL_ES__"
            ]);
    
            if (reservedKeywords.has(name)) {
                throw new Error(`Error: Macro name "${name}" is a reserved keyword at line ${lineNumber}.`);
            }

            // 检查是否有预处理器默认前缀
            if (name.startsWith(preprocessorSetting.prefix)) {
                throw new Error(`Error: Macro name "${name}" cannot have the preprocessor prefix "${preprocessorSetting.prefix}" at line ${lineNumber}.`);
            }
        };
    
        const match = args.match(/^(\w+)\(([^)]*)\)\s+(.+)$/);
        if (match) {
            const [, key, params, body] = match;
            validateMacroName(key); // 检查宏名称是否合法
            const paramList = params.split(",").map(p => p.trim());
            paramList.forEach(validateMacroName); // 检查参数名称是否合法
            this.macros.set(key, { params: paramList, body: this.replaceMacros(body, paramList)});
        } else {
            const [key, ...valueParts] = args.split(/\s+/);
            validateMacroName(key); // 检查宏名称是否合法
            const value = valueParts.join(" ") || "1";
            this.macros.set(key, this.replaceMacros(value));// 默认值为 "1"
        }
    }

    /**
     * 处理 #undef 指令
     */
    private handleUndef(args: string): void {
        if (args in this.macros) {
            this.macros.delete(args);
        }
    }

    /**
     * 处理 #if 指令
     */
    private handleIf(args: string, stack: IfStatementStack[], lineNumber: number): boolean {
        const newCondition = this.evaluateExpression(args, lineNumber);
        stack.push({active: newCondition, line: lineNumber, type: "#if"});
        return newCondition;
    }

    /**
     * 处理 #ifdef 指令
     */
    private handleIfdef(args: string, stack: IfStatementStack[], lineNumber: number): boolean {
        const newCondition = args in this.macros;
        stack.push({active: newCondition, line: lineNumber, type: "#ifdef"});
        return newCondition;
    }

    /**
     * 处理 #ifndef 指令
     */
    private handleIfndef(args: string, stack: IfStatementStack[], lineNumber: number): boolean {
        const newCondition = !(args in this.macros);
        stack.push({active: newCondition, line: lineNumber, type: "#ifndef"});
        return newCondition;
    }

    /**
     * 处理 #else 指令
     */
    private handleElse(stack: IfStatementStack[], lineNumber: number): boolean {
        const lastCondition = stack.pop();
        const newCondition = !(lastCondition?.active) && stack.every(Boolean);
        stack.push({active: newCondition, line: lineNumber, type: "#else"});
        return newCondition;
    }

    /**
     * 处理 #elif 指令
     */
    private handleElif(args: string, stack: IfStatementStack[], lineNumber: number): boolean {
        if (stack.length === 0) {
            throw new Error(`Error: #endif at line ${lineNumber} without matching #if, #ifdef, or #ifndef.`);
        }
        
        const lastCondition = stack.pop();
        const newCondition = !(lastCondition?.active) && this.evaluateExpression(args, lineNumber) && stack.every(Boolean);
        stack.push({active: newCondition, line: lineNumber, type: "#elif"});
        return newCondition;
    }

    /**
     * 处理 #endif 指令
     */
    private handleEndif(stack: IfStatementStack[], lineNumber: number): boolean {
        if (stack.length === 0) {
            throw new Error(`Error: Unexpected #endif at line ${lineNumber} without matching #if, #ifdef, or #ifndef.`);
        }
        stack.pop();
        return stack.every(block => block.active);
    }

    private replaceMacros(input: string, expects: string[] = []): string {

        const parseNestedParams = (params: string): string[] => {
            const result: string[] = [];
            let buffer = '';
            let depth = 0;
        
            for (let i = 0; i < params.length; i++) {
                const char = params[i];
        
                if (char === ',' && depth === 0) {
                    result.push(buffer.trim());
                    buffer = '';
                } else {
                    if (char === '(') depth++;
                    else if (char === ')') depth--;
        
                    buffer += char;
                }
            }
        
            if (buffer.trim()) {
                result.push(buffer.trim());
            }
        
            return result;
        }

        const replaceFunctions = (input: string):string => {
            const functionRegex = /(?<![a-zA-Z0-9_])([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
        
            while (true) {
                const match = input.match(functionRegex);
                if (!match) break;
        
                const macroName = match[1];
                if (expects.includes(macroName)) {
                    continue;
                }
                const startIdx = input.indexOf(match[0]);
                const paramsEndIdx = input.indexOf(')', startIdx);
                if (paramsEndIdx === -1) throw new Error('Unmatched parentheses');
        
                const params = input.slice(startIdx + macroName.length + 1, paramsEndIdx);
        
                const macroValue = this.macros.get(macroName);
                if (macroValue && typeof macroValue === "object" && macroValue.params && macroValue.body) {
            
                    const paramList = parseNestedParams(params);
                    if (macroValue.params.length !== paramList.length) {
                        throw new Error(`Macro ${macroName} expects ${macroValue.params.length} arguments, but got ${paramList.length}`);
                    }
            
                    let replacedBody = macroValue.body;
                    macroValue.params.forEach((param: string, idx: number) => {
                        const paramRegex = new RegExp(`(?<![a-zA-Z0-9_])${param}(?![a-zA-Z0-9_])`, 'g');
                        replacedBody = replacedBody.replace(paramRegex, paramList[idx]);
                    });
            
                    input = input.slice(0, startIdx) + replacedBody + input.slice(paramsEndIdx + 1);
                }
            }
        
            return input;
        }

        const replaceString = (input: string):string => {
            const regex = /(?<![a-zA-Z0-9_])([a-zA-Z_][a-zA-Z0-9_]*)(?![a-zA-Z0-9_])/g;
    
            // 替换逻辑
            return input.replace(regex, (match, macroName): string => {
                if (expects.includes(macroName)) {
                    return match;
                }
                const macroValue = this.macros.get(macroName);
                if (macroValue && typeof macroValue === "string") {
                    // 如果是简单宏，直接替换
                    return macroValue;
                }
                return match; // 如果不是宏，则保留原内容
            });
        }

        return replaceFunctions(replaceString(input));
    }
    
    /**
     * 解析和评估表达式
     */
    private evaluateExpression(expr: string, lineNumber: number): boolean {
        const expandedExpr = this.replaceMacros(expr); // 展开表达式中的所有宏
        console.log(`Expanded expression: ${expandedExpr}`);
    
        // 检查是否包含浮点数（GLSL #if 仅支持整数表达式）
        // if (/[.]/.test(expandedExpr)) {
        //     throw new Error(`Error: Float values are not allowed in #if expressions at line ${lineNumber}.`);
        // }
    
        try {
            return !!eval(expandedExpr); // 使用 eval 计算结果
        } catch {
            throw new Error(`Error: Invalid expression "${expandedExpr}" in #if at line ${lineNumber}.`);
        }
    }
}


// export class GLSLProcessor {
//     private filePath: string;

//     constructor(filePath: string) {
//         this.filePath = filePath;
//     }

//     private readGLSLFile(filePath: string): string {
//         return fs.readFileSync(filePath, 'utf8');
//     }

//     private addLineMappingComments(commentsRemovedSrc: string): string {
//         // 将代码分割为行
//         const lines = commentsRemovedSrc.split("\n");

//         const processedLines:string[] = [];

//         let preprocessorLine = "";
//         // 遍历每一行并添加注释
//         for (let index = 0; index < lines.length; index++){
//             const line = lines[index];
//             const trimStartLine = line.trimStart();
//             if (trimStartLine.startsWith("#") || preprocessorLine != "") {
//                 const trimedEndLine = line.trimEnd();
//                 if (trimedEndLine.endsWith("\\")){
//                     preprocessorLine += trimedEndLine.slice(0, -1);
//                 }else{
//                     processedLines.push(`${preprocessorLine + line}`);
//                     preprocessorLine = "";
//                 }
//             }else {
//                 processedLines.push(`${line} //0:${index + 1}`);
//             }
//         };

//         // 将处理后的行重新组合为字符串
//         return processedLines.join("\n");
//     }

//     public visitAst(astObj: any, callback: (astObj: any) => void): void {
//         if (Array.isArray(astObj)) {
//             // 如果是数组，递归遍历每个元素
//             for (const item of astObj) {
//                 this.visitAst(item, callback);
//             }
//         } else if (typeof astObj === "object" && astObj !== null) {
//             // 调用回调函数处理对象
//             callback(astObj);
    
//             // 遍历对象的每个键值对
//             for (const key in astObj) {
//                 if (astObj.hasOwnProperty(key)) {
//                     this.visitAst(astObj[key], callback);
//                 }
//             }
//         }
//     }

//     public extractNested(input: string): { type: string; content: any[]; remaining: string } {
//         let depth = 0;
//         let currentContent: any[] = [];
//         let stack: any[] = [];
//         let i = 0;
    
//         for (; i < input.length; i++) {
//             const char = input[i];
//             if (char === "(") {
//                 depth++;
//                 const newNode = { type: "parenthesis", content: [] };
//                 currentContent.push(newNode);
//                 stack.push(currentContent);
//                 currentContent = newNode.content;
//             } else if (char === ")") {
//                 depth--;
//                 if (depth < 0) {
//                     throw new Error("Mismatched parentheses");
//                 }
//                 currentContent = stack.pop();
//             } else {
//                 // Merge adjacent characters into strings instead of splitting into individual characters
//                 if (depth > 0) {
//                     if (typeof currentContent[currentContent.length - 1] === "string") {
//                         currentContent[currentContent.length - 1] += char;
//                     } else {
//                         currentContent.push(char);
//                     }
//                 } else {
//                     // Handle root-level characters outside parentheses
//                     if (typeof currentContent[currentContent.length - 1] === "string") {
//                         currentContent[currentContent.length - 1] += char;
//                     } else {
//                         currentContent.push(char);
//                     }
//                 }
//             }
//         }
    
//         if (depth !== 0) {
//             throw new Error("Mismatched parentheses");
//         }
    
//         return { type: "root", content: currentContent, remaining: input.slice(i) };
//     }
    
    

//     public processLineMappings(astObj: any): void {
//         this.visitAst(astObj, (astObj) => {
//             if ("text" in astObj) {
//                 const lines = astObj.text.split("\n"); // 按行分割字符串
//                 const textLines: {text: string, lineMapping: {fileIndex: number, lineIndex: number}}[] = [];
            
//                 const regex = /\/\/(\d+):(\d+)$/; // 匹配 //int:int 格式
            
//                 for (const line of lines) {
//                     const match = line.match(regex); // 检查是否匹配注释格式
//                     if (match) {
//                         const fileIndex = parseInt(match[1], 10); // 提取第一个整数
//                         const lineIndex = parseInt(match[2], 10); // 提取第二个整数
//                         textLines.push({
//                             text: line.replace(regex, "").trimEnd(), // 去除注释并去掉末尾多余空格
//                             lineMapping: {fileIndex, lineIndex}}
//                         );
//                     }
//                 }

//                 astObj.textLines = textLines;
//             }
//         });
//     }
    
//     public generateFileWithMapping(astObj: any): string {
//         let file = "";
//         let lastLineIndex = -1;
//         this.visitAst(astObj, (astObj) => {
//             if ("textLines" in astObj) {
//                 for (const textLine of astObj.textLines) {
//                     if (lastLineIndex + 1 != textLine.lineMapping.lineIndex){
//                         file += `#line ${textLine.lineMapping.lineIndex}\n`;
//                     }
//                     file += textLine.text + "\n";
//                     lastLineIndex = textLine.lineMapping.lineIndex;
//                 }
//             }
//         });
//         return file;
//     }

//     public parserPreprocess(source: string): {lineNumber: number, type: string, text: string}[] {
//         const lines = source.split("\n");
//         const codeBlock: {lineNumber: number, type: string, text: string}[] = [];

//         let textLineNumber = 1;
//         let text = "";
//         for (let i = 0; i < lines.length; i++) {
//             const lineNumber = i + 1;
//             const line = lines[i].trim();

//             // 匹配预处理指令
//             if (line.startsWith("#")) {
//                 if (text != ""){
//                     codeBlock.push({lineNumber: textLineNumber, type: "text", text: text});
//                     text = "";
//                 }
//                 const tokens = line.split(/\s+/);
//                 const directive = tokens[0];
//                 const args = tokens.slice(1).join(" ");
//                 codeBlock.push({lineNumber: lineNumber, type: directive, text: args});
//                 textLineNumber = lineNumber + 1;
                
//             } else {
//                 text += line + "\n";
//             }
//         }
//         if (text != ""){
//             // text.slice(0, -1)去末尾最后一个\n
//             codeBlock.push({lineNumber: textLineNumber, type: "text", text: text.slice(0, -1)});
//         }
//         return codeBlock;
//     }

//     public process(): void {

//         let error: GlslSyntaxError | undefined;
//         try {
//             //const src = this.readGLSLFile(this.filePath);
//             //const commentsRemovedSrc = preprocessComments(src);
//             (async () => {
    


//                 // const src = this.readGLSLFile(this.filePath);
//                 // const commentsRemovedSrc = preprocessComments(src);
//                 // const preprocessedResult = this.parserPreprocess(commentsRemovedSrc);
//                 // console.log(preprocessedResult);

//                 // for (const codeBlock of preprocessedResult) {
//                 //     if (codeBlock.type == "text") {
//                 //         console.log("----------------------------------------------------");
//                 //         console.log(this.extractNested(codeBlock.text));
//                 //     }
                    
//                 // }






//                 // console.log(commentsRemovedSrc);
//                 // const commentedSrc = this.addLineMappingComments(commentsRemovedSrc);
//                 // console.log(commentedSrc);
//                 // const ast = parser.parse(commentedSrc);



//     /*



//                 const src = this.readGLSLFile(this.filePath);
//                 const commentsRemovedSrc = preprocessComments(src);
//                 console.log(commentsRemovedSrc);
//                 const commentedSrc = this.addLineMappingComments(commentsRemovedSrc);
//                 console.log(commentedSrc);
//                 const ast = parser.parse(commentedSrc);
//                 this.processLineMappings(ast);
//                 preprocessAst(ast);
//                 console.log(ast);
//                 const file = this.generateFileWithMapping(ast);
//                 console.log(file);



//     */





//                 // const src = this.readGLSLFile(this.filePath);
//                 // const commentsRemovedSrc = preprocessComments(src);
//                 // console.log(commentsRemovedSrc);
//                 // const ast = parser.parse(commentsRemovedSrc);
//                 // //this.processLineMappings(ast);
//                 // preprocessAst(ast);
//                 // console.log(ast);
//                 // console.log(generate(ast));




//                 //const preprocessed = generate(ast);
//                 //console.log(preprocessed);

//                 //console.log(generate(ast));



                
//                 // const src = this.readGLSLFile(this.filePath);




//                 const ast = parser.parse(preprocessedSrc);
        
//                 visit(ast, {
//                     preprocessor: {
//                         enter: (astPath: any) => {
//                             console.log("Entering astPath: ", astPath);
                            
//                             const line = astPath.node.line;


//                             // 优先匹配 #include 指令
//                             const includeMatch = line.match(/^#include\s+["'](.+?)["']/);
//                             if (includeMatch) {
//                                 let includeFilePath = includeMatch[1];
//                                 console.log('Preprocessing include: ', includeFilePath);

//                                 const isLocalPath = !/^https?:\/\/\S+/.test(includeFilePath);
//                                 if (isLocalPath){
//                                     // 使用 replace 方法替换"file://"
//                                     includeFilePath = includeFilePath.replace( /^\s*file\s*:\s*\/\s*\//i, '');
//                                     if (includeFilePath.trim() === "self"){
//                                         includeFilePath = this.filePath;
//                                     }else{
//                                         includeFilePath = path.resolve(path.dirname(this.filePath), includeFilePath);
//                                     }
//                                 }
                                
//                                 const includeSrc = this.readGLSLFile(includeFilePath);
//                                 const includeAst = parser.parse(includeSrc);
//                                 console.log('includeAst: ', includeAst);

//                                 // let includeNodes: any;
//                                 // visit(includeAst, {
//                                 //     program: {
//                                 //         enter: (astPath: any) => {
//                                 //             includeNodes = astPath.node;
//                                 //         },
//                                 //         exit: (astPath: any) => {},
//                                 //     }
//                                 // });

//                                 astPath.replaceWith(includeAst);

//                                 return;
//                             }
                        
//                             // 匹配 #iChannel:uniformName "文件地址" 或 #iChannel{数字} "文件地址" (兼容shader toy)
//                             const iChannelMatch = line.match(/^#iChannel(?:(\d+)|:(\w+))\s+["'](.+?)["']/);
//                             if (iChannelMatch){
//                                 const channelNumber = iChannelMatch[1];
//                                 const customName = iChannelMatch[2];
//                                 const uniformName = customName || `iChannel${channelNumber}`;
//                                 console.log('Preprocessing iChannel with uniformName: ', uniformName);
//                                 return;
//                             }
                            
//                             console.log('Unknown preprocessor: ', line);
                            

//                         },
//                         exit: (astPath: any) => {
//                             console.log("Exiting astPath: ", astPath);
//                         },
//                     }
//                 });

                

//                 console.log(ast);

//                 console.log(generate(ast));

//             })();

//         } catch (e) {
//             console.log(e);
//             error = e as GlslSyntaxError;
//             console.log(error.name, ": ", error.message);
//             console.log("At: ", error.location)
//         }

        
//     }

// }


// export function processChannel(
//     filePath: string,
//     fileMap: Map<string, number>,
//     passMap: Map<string, number>,
//     shaderData: ShaderData,
// ): number {

//     // 获取该pass在全局文件列表中的index
//     let passIndex = passMap.get(filePath);
//     // 如果pass在全局中被添加过， 则跳过
//     if (passIndex != undefined){
//         shaderData.renderPassInfos[passIndex].isDoubleBuffering = true;
//         return passIndex;
//     }

//     passIndex = passMap.size;
//     passMap.set(filePath, passIndex);
        
//     console.log(`Process channels with file path: ${filePath}`);
//     const channelFiles = new Map<string, {path: string, lineMapping: LineMapping}>();
//     let renderPassInfo: RenderPassInfo = getDefaultRenderPassInfo();
//     shaderData.renderPassInfos.push(renderPassInfo);

//     // 处理该文件 (全部相关的#include 会被整合为一个文件，而全部的 #ichannel 会被找出进行额外计算）
//     const processedFiles = new Set<string>();
//     parseGLSL(
//         filePath,
//         fileMap,
//         renderPassInfo,
//         processedFiles,
//         channelFiles
//     );

//     const insertLineMappings: LineMapping[] = [];

//     // 如果未找到版本号， 默认版本号为 300 es
//     if (renderPassInfo.glslVersionMapping == null){
//         renderPassInfo.glslVersionMapping = {
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `#version 300 es`
//         };
//     }
//     insertLineMappings.push(renderPassInfo.glslVersionMapping);

//     // 如果未找到 int 精度， 默认为 highp
//     if (renderPassInfo.precisionIntMapping == null){
//         renderPassInfo.precisionIntMapping = {
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `precision highp int;`
//         };
//     }
//     insertLineMappings.push(renderPassInfo.precisionIntMapping);

//     // 如果未找到 float 精度， 默认为 highp
//     if (renderPassInfo.precisionFloatMapping == null){
//         renderPassInfo.precisionFloatMapping = {
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `precision highp float;`
//         };
//     }
//     insertLineMappings.push(renderPassInfo.precisionFloatMapping);

//     // 如果找到 string， 启用 uniform
//     Object.entries(renderPassInfo.stringsToCheck).forEach(([string, stringInfo]) => {
//         if (!stringInfo.active) return;

//         insertLineMappings.push({
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `uniform ${stringInfo.type} ${string};`,
//         });
//     });

//     if (!renderPassInfo.definedOutput){
//         insertLineMappings.push({
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `out vec4 FragColor;`,
//         });
//     }
    
//     // 处理从上面获取的每一个 #ichannel
//     const reversedChannelFiles = [...channelFiles.entries()].reverse();
//     for (const [uniformName, channelInfo] of reversedChannelFiles) {
//         console.log(`Process channel: ${uniformName}`);

//         const isLocalPath = !/^https?:\/\/\S+/.test(channelInfo.path);
//         if (isLocalPath){
//             // 使用 replace 方法替换"file://"
//             channelInfo.path = channelInfo.path.replace( /^\s*file\s*:\s*\/\s*\//i, '');
//             if (channelInfo.path.trim() === "self"){
//                 channelInfo.path = filePath;
//             }else{
//                 channelInfo.path = path.resolve(path.dirname(filePath), channelInfo.path);
//             }
//         }

//         // 获取文件的扩展名
//         const fileExtension = path.extname(channelInfo.path).toLowerCase();
//         //console.log(`File extension: ${fileExtension}`);
            
//         // 根据文件类型处理
//         switch (fileExtension) {
//             case '.png':
//             case '.jpg':
//             case '.jpeg':
//                 console.log(`Processing image file: ${channelInfo.path}`);
//                 // 获取该文件在全局文件列表中的index
//                 let fileIndex = fileMap.get(channelInfo.path);
//                 // 如果文件在全局中未被添加过， 添加到全局
//                 if (fileIndex == undefined){
//                     fileIndex = fileMap.size;
//                     fileMap.set(channelInfo.path, fileIndex);
//                 }
//                 renderPassInfo.requiredTextures[uniformName] = fileIndex;
//                 insertLineMappings.push(channelInfo.lineMapping);
//                 break;
//             case '.glsl':
//                 let currentPassIndex = processChannel(channelInfo.path, fileMap, passMap, shaderData);
//                 renderPassInfo.requiredRenderPasses[uniformName] = currentPassIndex;
//                 insertLineMappings.push(channelInfo.lineMapping);
//                 break;
//             default:
//                 console.log(`Unsupported file type: ${fileExtension}`);
//                 break;
//         }
//     }

//     renderPassInfo.lineMappings.unshift(...insertLineMappings);

//     if (!renderPassInfo.definedOutput && !renderPassInfo.hasMain && renderPassInfo.hasMainImage){
//         renderPassInfo.lineMappings.push({
//             treeIndex: 0,
//             localLine: -1,
//             type: "replace",
//             replaceContent: `void main() {mainImage(FragColor, gl_FragCoord.xy);}`,
//         });
//     }
//     return passIndex;

// }


// function parseGLSL(
//     filePath: string,
//     fileMap: Map<string, number>,
//     renderPassInfo: RenderPassInfo,
//     processedFiles: Set<string>, // 用于跟踪已解析的文件路径
//     iChannelFiles: Map<string, {path: string, lineMapping: LineMapping}>, // 用于跟踪 #ichannel 文件路径
//     startLine = 1,
//     parentTreeIndex: number = -1,
//     parentIncludeLine: number = -1
// ): number {
//     // 如果文件已经被解析过，直接返回当前行号
//     if (processedFiles.has(filePath)) {
//         return startLine;
//     }

//     // 标记当前文件为已处理
//     processedFiles.add(filePath);

//     // 获取该文件在全局文件列表中的index
//     let fileIndex = fileMap.get(filePath);
//     // 如果文件在全局中未被添加过， 添加到全局
//     if (fileIndex == undefined){
//         fileIndex = fileMap.size;
//         fileMap.set(filePath, fileIndex);
//     }

//     const treeIndex = renderPassInfo.includeFileTree.length;

//     renderPassInfo.includeFileTree.push({
//         fileIndex: fileIndex,
//         parentTreeIndex: parentTreeIndex,
//         parentIncludeLine: parentIncludeLine
//     });

//     const content = removeComments(fs.readFileSync(filePath, 'utf-8'));
    
//     const lines = content.split('\n');

//     // 遍历每一行，处理该文件
//     let currentGlobalLine = startLine;
//     for (let i = 0; i < lines.length; i++) {
//         const line = lines[i];
//         //const cleanLine = removeComments(line); // 移除注释

//         // 检查 #version 指令
//         const versionMatch = line.match(/^#version\s+(\d+)(\s+es)?/);
//         if (versionMatch) {
//             if (!renderPassInfo.glslVersionMapping){
//                 const versionNumber = versionMatch[1]; // 提取版本号
//                 const isES = !!versionMatch[2]; // 检查是否是 ES 版本
    
//                 const versionString = `${versionNumber}${isES ? ' es' : ''}`;
    
//                 console.log(
//                     `Found #version directive in file: ${filePath}, Line: ${i + 1}, Version: ${versionString}`
//                 );
    
//                 renderPassInfo.glslVersionMapping = {
//                     treeIndex: treeIndex,
//                     localLine: i + 1,
//                     type: "replace",
//                     replaceContent: `#version ${versionString}`
//                 };
//             }
//             continue;
//         }

//         // 匹配 precision 指令
//         const precisionMatch = line.match(/^\s*precision\s+(lowp|mediump|highp)\s+(float|int)\s*;/);
//         if (precisionMatch) {
//             const precisionLevel = precisionMatch[1]; // lowp, mediump, or highp
//             const dataType = precisionMatch[2]; // float or int

//             if (dataType == "int"){
//                 if (!renderPassInfo.precisionIntMapping){
//                     console.log(
//                         `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: int`
//                     );

//                     renderPassInfo.precisionIntMapping = {
//                         treeIndex: treeIndex,
//                         localLine: i + 1,
//                         type: "replace",
//                         replaceContent: `precision ${precisionLevel} int;`
//                     };
//                 }
//             }else if (dataType == "float"){
//                 if (!renderPassInfo.precisionFloatMapping){
//                     console.log(
//                         `Found precision directive in file: ${filePath}, Line: ${i + 1}, Precision: ${precisionLevel}, Type: float`
//                     );

//                     renderPassInfo.precisionFloatMapping = {
//                         treeIndex: treeIndex,
//                         localLine: i + 1,
//                         type: "replace",
//                         replaceContent: `precision ${precisionLevel} float;`
//                     };
//                 }
//             }

//             continue;
//         }

//         // 检查是否设置out输出
//         if (!renderPassInfo.definedOutput) {
//             const outMatch = line.match(/^(layout\s*\(.*?\)\s*)?out\s+\w+/);
//             if (outMatch) {
//                 console.log(`Found "out" declaration in file: ${filePath}, Line: ${i + 1}`);
//                 renderPassInfo.definedOutput = true;
//             }
//         }

//         // 检查是否有main()
//         if (!renderPassInfo.hasMain) {
//             const mainMatch = line.match(/^\s*void\s+main\s*\(\s*\)/);
//             if (mainMatch) {
//                 console.log(`Found "main" function declaration in file: ${filePath}, Line: ${i + 1}`);
//                 renderPassInfo.hasMain = true;
//             }
//         }

//         // 检查是否有mainImage()
//         if (!renderPassInfo.hasMainImage) {
//             const mainImageMatch = line.match(/^\s*void\s+mainImage\s*\(\s*out\s+vec4\s+\w+,\s*(in\s+)?vec2\s+\w+\s*\)/);
//             if (mainImageMatch) {
//                 console.log(`Found "mainImage" function declaration in file: ${filePath}, Line: ${i + 1}`);
//                 renderPassInfo.hasMainImage = true;
//             }
//         }
                
//         // 优先匹配 #include 指令
//         const includeMatch = line.match(/^\s*#include\s+["'](.+?)["']/);
//         if (includeMatch) {
//             const includePath = path.resolve(path.dirname(filePath), includeMatch[1]);

//             // 递归解析 #include 文件，传递已处理文件集合
//             currentGlobalLine = parseGLSL(
//                 includePath,
//                 fileMap,
//                 renderPassInfo,
//                 processedFiles,
//                 iChannelFiles,
//                 currentGlobalLine,
//                 treeIndex,
//                 i + 1
//             );
//             continue; // 如果是 #include 指令，处理完后继续下一行
//         }

//         // 匹配 #iChannel:uniformName "文件地址" 或 #iChannel{数字} "文件地址" (兼容shader toy)
//         const ichannelMatch = line.match(/^\s*#iChannel(?:(\d+)|:(\w+))\s+["'](.+?)["']/);
//         if (ichannelMatch) {
//             const channelNumber = ichannelMatch[1];
//             const customName = ichannelMatch[2];
//             const uniformName = customName || `iChannel${channelNumber}`;
//             const ichannelPath = ichannelMatch[3]; // 获取文件路径
//             iChannelFiles.set(
//                 uniformName, 
//                 {
//                     path: ichannelPath,
//                     lineMapping: {
//                         treeIndex: 0,
//                         localLine: i + 1,
//                         type: "replace",
//                         replaceContent: `uniform sampler2D ${uniformName};`
//                     }
//                 }
//             ); // 添加到 iChannelFiles Map

//             continue; // 处理完后直接跳到下一行
//         }

//         const setMatches = line.match(/^\s*#set\s+(.*)/);
//         if (setMatches) {
//             const content = setMatches[1].split(/\s+/);
//             const setName = content[0];
//             if (definedConfigurableSettings.hasOwnProperty(setName)) {
//                 const parameterLists = definedConfigurableSettings[setName];
//                 console.log(`Found #set ${setName}`);
//                 for (const parameterList of parameterLists) {
//                     if (parameterList.length === content.length - 1) {
//                         const typedParameterList: (string|number|boolean)[] = [];
//                         let passed = true;
//                         for (let index = 0; index < parameterList.length && passed; index++) {
//                             const parameter = parameterList[index];
//                             const inputContent = content[index + 1];
//                             switch(parameter) {
//                                 case "string":
//                                     typedParameterList.push(inputContent);
//                                     break;
//                                 case "number":
//                                     let numberParameter = Number(inputContent);
//                                     if (isNaN(numberParameter)){
//                                         numberParameter = 0;
//                                     }
//                                     typedParameterList.push(numberParameter);
//                                     break;
//                                 case "bool":
//                                     typedParameterList.push(Boolean(inputContent));
//                                     break;
//                                 default:
//                                     if (parameter == inputContent.toLowerCase()){
//                                         typedParameterList.push(parameter);
//                                         break;
//                                     }
//                                     passed = false;
//                                     //console.log("Unknown parameter type: " + parameter);
//                             }
//                         }
//                         if (passed) {
//                             renderPassInfo.configurableSettings[setName] = typedParameterList;
//                             break; 
//                         }
//                     }
//                 }
//             }
//             continue; // 处理完后直接跳到下一行
//         }

//         // 对存在变量的查询
//         const matches = line.match(checkingRegex);
//         if (matches) {
//             for (const match of matches) {
//                 renderPassInfo.stringsToCheck[match].active = true;
//             }
//         }

//         // 如果是普通行，添加到行映射
//         renderPassInfo.lineMappings.push({
//             treeIndex: treeIndex,
//             localLine: i + 1, // 当前文件中的行号，从 1 开始
//         });

//         currentGlobalLine++;
//     }

//     return currentGlobalLine - 1;
// }

