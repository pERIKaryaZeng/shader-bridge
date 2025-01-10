import * as fs from 'fs';
import * as path from 'path';

import { ChannelSettings, ChannelInfo, ChannelOutput, ChannelPreprocessor } from './channel_preprocessor';

type RenderPassInfo = {
    channelIndex: number
    settings: ChannelSettings;
    isDoubleBuffer: boolean;
}

export type PipelineData = {
    state: "success"
    channelOutputs: ChannelOutput[]
    renderPassList: RenderPassInfo[]
    renderOrder: number[]
    fileList: string[]
} | {
    state: "failure"
    error: string
}


export class PipelinePreprocessor {
    private mainFilePath: string;
    private channelIndexMap = new Map<string, number>();
    public channelOutputs: ChannelOutput[] = [];
    private renderPassIndexMap =  new Map<string, number>();
    public renderPassList: RenderPassInfo[] = [];
    private branchSet = new Set<number>();
    public fileMap: Map<string, number> = new Map<string, number>();
    public renderOrder: number[] = [];

    private constructor(rootPath: string) {
        this.mainFilePath = rootPath;
    }

    static async create(mainFilePath: string): Promise<PipelinePreprocessor> {
        const instance = new PipelinePreprocessor(mainFilePath);
        await instance.init();
        return instance;
    }

    private async init(): Promise<void> {
        await this.preprocess(this.mainFilePath);
    }

    
    public getOutput(): PipelineData {
        return {
            state: "success",
            channelOutputs: this.channelOutputs,
            renderPassList: this.renderPassList,
            renderOrder: this.renderOrder,
            fileList: Array.from(this.fileMap.keys())
        };
    }

    private async preprocess (
        filePath: string,
        channelSettings: ChannelSettings = {
            MinFilter: 'Linear',
            MagFilter: 'Linear',
            WrapMode: 'Repeat'
        }
    ): Promise<number> {



        let channelIndex = this.channelIndexMap.get(filePath);
        let channelOutput: ChannelOutput;
        let channelInfos: Map<string, ChannelInfo> | undefined;
        if (channelIndex == undefined) {
            const channelPreprocessor = await ChannelPreprocessor.create(filePath, this.fileMap);
            channelOutput = channelPreprocessor.getOutput();
            channelInfos = channelPreprocessor.getChannelInfos();
            console.log("channelOutput.src: \n", channelOutput.src);
            console.log("channelInfos: ", channelInfos);
            channelIndex = this.channelOutputs.length;
            this.channelIndexMap.set(filePath, channelIndex);
            this.channelOutputs.push(channelOutput);
        } else {
            channelOutput = this.channelOutputs[channelIndex];
            channelInfos = undefined;
        }

        const key = [
            channelIndex,
            channelSettings.MinFilter,
            channelSettings.MagFilter,
            channelSettings.WrapMode
        ].join(",");

        let renderPassIndex = this.renderPassIndexMap.get(key);
        if (renderPassIndex != undefined) {
            return renderPassIndex;
        }
        renderPassIndex = this.renderPassList.length;

        let renderPassInfo: RenderPassInfo = {
            channelIndex: channelIndex,
            settings: channelSettings,
            isDoubleBuffer: false
        }
        
        this.renderPassIndexMap.set(key, renderPassIndex);
        this.renderPassList.push(renderPassInfo);



        this.branchSet.add(renderPassIndex);

        if (channelInfos != undefined) {
            
            for (const [uniformName, childChannelInfo] of channelInfos) {
                console.log(`uniformName: ${uniformName}`);

                const childChannelPath = childChannelInfo.filePath;

                // 获取文件的扩展名
                const fileExtension = path.extname(childChannelPath).toLowerCase();
                //console.log(`File extension: ${fileExtension}`);

                const exists = await this.checkFileExists(childChannelPath);
                console.log( "checkFileExists: ", childChannelPath, ", ", exists);


                // 根据文件类型处理
                switch (fileExtension) {
                    case '.png':
                    case '.jpg':
                    case '.jpeg':
                        let channelType = 'texture2d';
                        if (!exists){
                            if (/\{\}/.test(childChannelPath)){
                                channelType = 'cubeMap';
                                const cubeMapMissingList: string[] = [];

                                const faceNameGroups = [
                                    ['px', 'nx', 'py', 'ny', 'pz', 'nz'],
                                    ['e', 'w', 'u', 'd', 'n', 's'], 
                                    ['east', 'west', 'up', 'down', 'north', 'south'], 
                                    ['posx', 'negx', 'posy', 'negy', 'posz', 'negz'],
                                ];

                                const cubeMapPaths = await Promise.all(
                                    faceNameGroups[0].map(async (_, faceIndex) => {
                                        // 获取所有命名方式中当前面的命名列表
                                        const faceStrings = faceNameGroups.map(group => group[faceIndex]);
                                
                                        // 遍历当前面的命名方式，找到第一个存在的路径
                                        for (const faceStr of faceStrings) {
                                            const replacedPath = childChannelPath.replace(/\{\}/g, faceStr);
                                            const cubeFaceExists = await this.checkFileExists(replacedPath);
                                
                                            if (cubeFaceExists) {
                                                // 找到有效路径，返回结果并跳过后续命名方式
                                                return replacedPath;
                                            }
                                        }
                                        
                                        // 如果所有命名方式都不存在，报错
                                        cubeMapMissingList.push(faceStrings[0]);
                                    })
                                );

                                if (cubeMapMissingList.length > 0){
                                    throw new Error(`Cube map ${cubeMapMissingList.join(", ")} face texture not found: ${childChannelPath}`);
                                }
                            }else{
                                throw new Error(`Texture file not found: ${childChannelPath}`);
                            }
                            
                        }



                        // let channelTextureInfo = {
                        //     index: this.channelRenderMap.size,
                        //     type: channelType,
                        //     dataIndex: textureIndex,
                        //     settings: channelInfo.settings,
                        //     isFBO: false,
                        // }

                        
                        // const key = [
                        //     textureIndex,
                        //     channelInfo.settings.MinFilter,
                        //     channelInfo.settings.MagFilter,
                        //     channelInfo.settings.WrapMode
                        // ].join(",");
                        
                        // this.channelRenderMap.set(key, channelTextureInfo);
                        
                        break;
                    case '.glsl':
                        const childRenderPassIndex = await this.preprocess(
                            childChannelPath,
                            childChannelInfo.settings
                        );

                        let useLastBuffer = false;

                        if (this.branchSet.has(childRenderPassIndex)) {
                            const channelPreprocessor = this.renderPassList[childRenderPassIndex];
                            channelPreprocessor.isDoubleBuffer = true;
                            useLastBuffer = true;
                        }

                        channelOutput.textureUniformInfos.push({
                            uniformName: uniformName,
                            type: 'fbo',
                            renderPassIndex: childRenderPassIndex,
                            useLastBuffer: useLastBuffer
                        });

                        break;
                    default:
                        throw new Error(`Unsupported file type: ${fileExtension}`);
                }

            }


        }

        this.branchSet.delete(renderPassIndex);

        this.renderOrder.push(renderPassIndex);


        return renderPassIndex;
    }

    private checkLocalFileExists(filePath: string): boolean {
        try {
            return fs.existsSync(filePath); // 同步检查文件是否存在
        } catch {
            return false; // 如果路径无效或不可访问，返回 false
        }
    }
    
    
    
    private async checkHttpUrlExists(url: string): Promise<boolean> {
        try {
            const response = await fetch(url, { method: "HEAD" });
            return response.ok;
        } catch {
            return false;
        }
    }
    
    private async checkFileExists(path: string): Promise<boolean> {
        if (/^https?:\/\//.test(path)) {
            // HTTP 地址检测
            return await this.checkHttpUrlExists(path);
        } else {
            // 本地文件检测
            return await this.checkLocalFileExists(path);
        }
    }

}