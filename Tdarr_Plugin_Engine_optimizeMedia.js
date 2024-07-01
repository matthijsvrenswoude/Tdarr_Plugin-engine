/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_optimizeMedia",
        Stage: "Pre-processing",
        Name: "Cleans Movies or TV efficiently",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "plugin-state-stable,pre-processing,ffmpeg,configurable",
        Inputs: [
            {
                name: 'target_container_type',
                type: 'string',
                defaultValue: 'Original',
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'Original',
                        'MKV',
                        'MP4',
                    ],
                },
                tooltip: `Sets the target container, for all the processed media`
            },
            {
                name: 'dovi_target_container_type',
                type: 'string',
                defaultValue: 'MP4',
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'Original',
                        'MP4',
                    ],
                },
                tooltip: `Sets the target container, for all Dolby Vision media`
            },
            {
                name: 'upgrade_legacy_video',
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: 'Allow upgrade of legacy video codecs to H265/HEVC'
            },
            {
                name: "to_remove_video_codecs",
                type: 'string',
                defaultValue: '',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Specify key words here for video tracks you'd like to have removed.
                            \\nExample:\\n
                             mjpeg,png,gif`,
            },
            {
                name: 'to_keep_audio_languages',
                type: 'string',
                defaultValue: 'eng,und',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Specify language tag/s here for the audio tracks you'd like to keep and in what order
               \\nRecommended to keep "und" as this stands for underdetermined
               \\nSome files may not have the language specified.
               \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
               \\nExample:\\n
               eng

               \\nExample:\\n
               eng,und

               \\nExample:\\n
               eng,und,jpn`,
            },
            {
                name: 'tag_title_for_audio',
                type: 'boolean',
                defaultValue: false,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: 'Specify audio tracks with no title to be tagged with the number of channels they contain.'
            },
            {
                name: "to_remove_subtitle_codecs",
                type: 'string',
                defaultValue: '',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Specify key words here for subtitle tracks you'd like to have removed.
                            \\nExample:\\n
                             hdmv_pgs_subtitle
                             \\nExample:\\n
                            hdmv_pgs_subtitle,dvd_subtitle`,
            },
            {
                name: 'to_keep_subtitle_languages',
                type: 'string',
                defaultValue: 'eng',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Specify language tag/s here for the subtitle tracks you'd like to keep and what language as default.
                   \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                   \\nExample:\\n
                   eng
    
                   \\nExample:\\n
                   eng,jpn`,
            },
            {
                name: 'cleanup_text_subtitles',
                type: 'boolean',
                defaultValue: true,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: 'Allow clean up of Text subtitles'
            },
            {
                name: 'temporary_force_clean',
                type: 'boolean',
                defaultValue: false,
                inputUI: {
                    type: 'dropdown',
                    options: [
                        'false',
                        'true',
                    ],
                },
                tooltip: `Temporary allows you to re-clean your whole media library by using the scan(Fresh) button under Tdarr libraries. \\n
                Switch this setting off after usage.`
            },
        ],
    };
};

class Muxing {
    static actionsEnum = Object.freeze({
        EXTRACT:   "EXTRACT",
        CREATE:   "CREATE",
        MODIFY:   "MODIFY",
        COPY:  "COPY",
        COPYDOVI:  "COPYDOVI",
        DISCARD: "DISCARD"
    });
    static formatAction = (globalStreamId,type,typeStreamId,currentStreamCodec,currentStreamLanguage,currentStreamBitRate,title,defaultStream,formats) => {
        return new Map([
            ['globalStreamId', globalStreamId],
            ['type', type],
            ['typeStreamId', typeStreamId],
            ['codec', currentStreamCodec],
            ['bitrate', Number(currentStreamBitRate)],
            ['language', currentStreamLanguage],
            ['title',title],
            ['default', defaultStream],
            ['formats', formats]
        ]);
    }
}


function createCompatibleCodecItem(codec,maxBitrate,maxChannels) {
    return new Map([
        ['codec',codec],
        ['maxBitrate', maxBitrate],
        ['maxChannels',maxChannels],
    ]);
}

function createCodecLimit(codec,minChannels,maxChannels,enforceStrict) {
    return new Map([
        ['codec', codec],
        ['minChannels', minChannels],
        ['maxChannels', maxChannels],
        ['strict', enforceStrict],
    ]);
}

function createTargetCodec(targetCodec,targetBitrate,targetChannels) {
    return new Map([
        ['targetCodec', targetCodec],
        ['targetBitrate', targetBitrate],
        ['targetChannels', targetChannels],
    ]);
}

function createExtractCodec(codec,minimumChannels) {
    return new Map([
        ['codec',codec],
        ['minChannels',minimumChannels],
    ]);
}

function parseCodecToFileExtension(codecName){
    const codecDictionary = new Map([
        ['hevc','hevc'],
        ['aac:LC', 'aac'],
        ['ac3', 'ac3'],
        ['eac3', 'eac3'],
        ['truehd', 'thd'],
        ['dts:DTS-HD MA', 'dts'],
        ['dts:DTS-HD', 'dts'],
        ['dts:DTS', 'dts'],
        ['opus', 'opus'],
        ["subrip", "srt"],
        ["mov_text", "txt"]
    ]);
    return codecDictionary.get(codecName) ?? "";
}

function parseCodecToCodecName(codecName){
    const codecDictionary = new Map([
        ['aac:LC', 'AAC'],
        ['ac3', 'Dolby Digital'],
        ['eac3', 'Dolby Digital+'],
        ['truehd', 'Dolby TrueHD'],
        ['dts:DTS-HD MA', 'DTS-HD Master Audio'],
        ['dts:DTS-HD', 'DTS-HD'],
        ['dts:DTS', 'DTS'],
        ['opus', 'Opus'],
        ['hdmv_pgs_subtitle', 'HDMV PGS'],
        ['subrip', 'Subrip'],
        ['mov_text', 'MovText'],
        ['dvd_subtitle', 'VobSub'],
        ['ass', 'SubStation Alpha']
    ]);
    return codecDictionary.get(codecName) ?? "";
}

function getModifiedActionValue(action,property, noFallback = false){
    if (action.hasOwnProperty(2) && action[2].has(property)){
        return action[2].get(property);
    }
    if (!noFallback){
        return action[1].get(property);
    }
    return null;
}


class MKVExtractExtractor {
    programPath = "";
    savePath = "";
    originalFile = null;
    fileActions = [];
    constructor(pathVars,originalFile,savePath) {
        this.programPath = pathVars.get("mkvextract");
        this.originalFile = originalFile;
        this.savePath = savePath;
    }

    loadActions(actions){
        const toLoadActions = [];
        actions.forEach((action, index) => {
            const [actionType, actionData, actionModifications] = action;
            if (![Muxing.actionsEnum.EXTRACT].includes(actionType)) return;
            toLoadActions[index] = action;
        })
        this.fileActions = toLoadActions;
        return actions;
    }

    processActions(){
        return this.fileActions.map(action => {
            return action ? this.executeAction(action) : action;
        })
    }

    executeAction(action){
        const newFileExtension = parseCodecToFileExtension(action[1].get("codec"))
        const newFileName = `${this.originalFile.get("baseName")}.${action[1].get("language")}.${action[1].get("typeStreamId")}.${newFileExtension}`;
        const exportFile = `${this.savePath}${newFileName}`;
        return new Map([
            ["action", action],
            ["preset", () => [`${this.programPath} tracks ${this.originalFile.get("complete")} ${action[1].get("globalStreamId")}:"${exportFile}"`,exportFile]],
        ]);
    }
}

class MP4BoxExtractor {
    programPath = "";
    savePath = "";
    originalFile = null;
    fileActions = [];
    constructor(pathVars,originalFile,savePath) {
        this.programPath = pathVars.get("mp4box");
        this.originalFile = originalFile;
        this.savePath = savePath;
    }

    loadActions(actions){
        const toLoadActions = [];
        actions.forEach((action, index) => {
            const [actionType, actionData, actionModifications] = action;
            if (![Muxing.actionsEnum.EXTRACT].includes(actionType)) return;
            toLoadActions[index] = action;
        })
        this.fileActions = toLoadActions;
    }

    processActions(){
        return this.fileActions.map(action => {
            return action ? this.executeAction(action) : action;
        })
    }

    executeAction(action){
        const newFileExtension = parseCodecToFileExtension(action[1].get("codec"))
        const newFileName = `${this.originalFile.get("baseName")}.${action[1].get("language")}.${action[1].get("typeStreamId")}.${newFileExtension}`;
        const exportFile = `${this.savePath}${newFileName}`;
        return new Map([
            ["action", action],
            ["preset", () => [`${this.programPath} -single ${action[1].get("globalStreamId")} "${this.originalFile.get("complete")}" "${exportFile}"`, exportFile]],
        ]);
    }
}

class FFMpegTranscoder{
    programPath = "";
    customFFmpegInstalls = [];
    savePath = "";
    originalFile = null;
    fileActions = [];
    ffmpegOnlyMode = false;

    decodeableCodecs = new Map([
        ["h264", true],
        ["hevc", true],
        ["mpeg4", true],
        ["vc1", true],
        ["av1", true],
        ["dts:DTS-HD MA", true],
        ["dts:DTS-HD", true],
        ["dts:DTS", true],
        ["truehd", false],
        ["eac3", true],
        ["ac3", true],
        ["aac:LC", true],
        ["opus", true],
        ["mov_text", true],
        ["subrip", true],
        ["hdmv_pgs_subtitle", false],
        ["dvd_subtitle", false],
    ])

    encodeableCodecs = new Map ([
        ["h264", true],
        ["hevc", true],
        ["mpeg4", true],
        ["vc1", false],
        ["av1", true],
        ["dts:DTS-HD MA", false],
        ["dts:DTS-HD", false],
        ["dts:DTS", false],
        ["truehd", false],
        ["eac3", false],
        ["ac3", true],
        ["aac:LC", true],
        ["opus", true],
        ["mov_text", true],
        ["subrip", true],
        ["hdmv_pgs_subtitle", false],
        ["dvd_subtitle", false],
    ])

    exportToRawHevc(action){
        "ffmpeg -i input.mkv -c:v copy -bsf:v hevc_mp4toannexb -f hevc -"
    }


    constructor(pathVars,originalFile,savePath) {
        this.programPath = pathVars.get("ffmpeg");
        this.originalFile = originalFile;
        this.savePath = savePath;

        if(pathVars.has("ffmpegfdk")){
            this.customFFmpegInstalls.push(
                new Map([
                    ["applyToCodec", "aac:LC"],
                    ["customPreset", (mappedStreamId, audioStreamId, bitrate, channels, exportFile) => [`${pathVars.get("ffmpegfdk")} -i "${this.originalFile.get("complete")}" -vn -map 0:a:${audioStreamId} -c:a libfdk_aac ${bitrate && `-b:a:0 ${bitrate / 1000}k`} -ac:a ${channels} "${exportFile}"`, exportFile]]
                ])
            )
        }
    }

    setFFMpegOnlyMode(ffMpegOnlyMode){
        this.ffmpegOnlyMode = ffMpegOnlyMode;
    }

    loadActions(actions){
        const toLoadActions = [];
        actions.forEach((action, index) => {
            const [actionType, actionData, actionModifications] = action;
            if (![Muxing.actionsEnum.CREATE,Muxing.actionsEnum.MODIFY].includes(actionType)) return;
            const decodingCodec = this.decodeableCodecs.get(actionData.get("codec"));
            let encodingCodec = this.encodeableCodecs.get(actionData.get("codec"));
            if (actionModifications.has("codec")){
                encodingCodec = this.encodeableCodecs.get(actionModifications.get("codec"));
            }

            let error = [];
            if(decodingCodec === undefined) error.push(`Failed to load action, failed to determine decoder support for codec: ${decodingCodec}`);
            if(decodingCodec === false) error.push(`Failed to load action, FFMpeg has no decoder for codec: ${decodingCodec}`);
            if(encodingCodec === undefined) error.push(`Failed to load action, failed to determine encoder support for codec: ${encodingCodec}`);
            if(encodingCodec === false) error.push(`Failed to load action, FFMpeg has no encoder for codec: ${decodingCodec}`);
            if (error.length > 0) throw error.join(" ");
            toLoadActions[index] = action;
        })
        this.fileActions = toLoadActions;
    }

    processActions(){
        return this.fileActions.map(action => {
            return this.executeAction(action);
        })
    }

    executeAction(action){
        const newFileExtension = parseCodecToFileExtension(getModifiedActionValue(action,"codec"))
        const newFileName = `${this.originalFile.get("baseName")}.${action[1].get("language")}.${action[1].get("typeStreamId")}.${newFileExtension}`;
        let exportFile = `${this.savePath}${newFileName}`;
        let preset = ``;
        const ffmpegOnlyModeDisabled = this.ffmpegOnlyMode ? "" : true;

        switch (action[1].get("type")){
            case "v":
                const newActionFormats = getModifiedActionValue(action,"formats", true);
                const newPixelFormat = newActionFormats && newActionFormats[0][0].includes("10le") ? "p010le" : null;
                preset = (mappedStreamId = 0) => [
                    `${ffmpegOnlyModeDisabled && `${this.programPath} -i "${this.originalFile.get("complete")}" -an `} -map 0:v:${action[1].get("typeStreamId")} -c:v:${mappedStreamId} hevc_nvenc ${newPixelFormat && `-pix_fmt ${newPixelFormat}`}  -rc vbr -tune hq -preset p7 -cq 2 ${ffmpegOnlyModeDisabled && ` -strict unofficial "${exportFile}"`}`,
                    this.ffmpegOnlyMode ? null : exportFile
                ];
                break
            case "a":
                const newActionCodec = getModifiedActionValue(action,"codec");
                const newActionBitrate = getModifiedActionValue(action, "bitrate", true);
                const newActionChannels = getModifiedActionValue(action,"formats")[0];
                const potentialCustomPreset = this.customFFmpegInstalls.find(install => install.get("applyToCodec") === newActionCodec);
                const newActionStreamId = action[1].get("typeStreamId");
                if (potentialCustomPreset){
                    const customPresetGenerator = potentialCustomPreset.get("customPreset");
                    preset = (mappedStreamId = 0) => customPresetGenerator(mappedStreamId, newActionStreamId, newActionBitrate, newActionChannels, exportFile);
                } else{
                    preset = (mappedStreamId = 0) => {
                        const newMappedStreamId = ffmpegOnlyModeDisabled ? 0 : mappedStreamId;
                        return [
                            `${ffmpegOnlyModeDisabled && `${this.programPath} -i "${this.originalFile.get("complete")}" -vn `}-map 0:a:${newActionStreamId} -c:a:${newMappedStreamId} ${newActionCodec.split(":")[0]} ${newActionBitrate && `-b:a:${newMappedStreamId} ${newActionBitrate / 1000}k`} -ac:a:${newMappedStreamId} ${newActionChannels}${ffmpegOnlyModeDisabled && ` -strict unofficial "${exportFile}"`}`,
                            this.ffmpegOnlyMode ? null : exportFile
                        ]
                    };
                }
                break;
            case "s":
                preset = (mappedStreamId = 0) => {
                    const newMappedStreamId = ffmpegOnlyModeDisabled ? 0 : mappedStreamId;
                    return [
                        `${ffmpegOnlyModeDisabled && `${this.programPath} -i "${this.originalFile.get("complete")}" -sn `}-map 0:s:${action[1].get("typeStreamId")} -c:s:${newMappedStreamId} ${getModifiedActionValue(action,"codec")}${ffmpegOnlyModeDisabled && `-strict unofficial "${exportFile}"`}`,
                        this.ffmpegOnlyMode ? null : exportFile
                    ];
                }
                break;
            default:
                break;
        }
        return new Map([
            ["action", action],
            ["preset", preset],
        ]);
    }
}

class DoViToolsMuxer {
    programPath = "";
    workingDirectory = "";
    originalFile = null;
    fileActions = [];
    compatibleCodecs = ["dvhe","dvh1","hevc","hvc1"];
    FFMpegTranscoder = null;
    MKVExtractExtractor = null

    constructor(pathVars,originalFile,workingDirectory) {
        this.programPath = pathVars.get("dovitool");
        this.ffmpegTranscoder = new FFMpegTranscoder(pathVars,originalFile,workingDirectory);
        this.MKVExtractExtractor = new MKVExtractExtractor(pathVars,originalFile,workingDirectory);
    }

    loadActions(actions){
        const toLoadActions = [];
        actions.forEach((action, index) => {
            const [actionType, actionData, actionModifications] = action;
            if (![Muxing.actionsEnum.COPYDOVI].includes(actionType)) return;
            const currentActionCodec = actionData.get("codec");
            if (![5,7,8].includes(Number(actionData.get("formats").find(supportedFormats => supportedFormats[0] === "Dolby Vision")[1]))){
                throw `Dolby Vision profile is unsupported`;
            }
            if (!this.compatibleCodecs.includes(currentActionCodec)){
                throw `Dolby Vision in codec: ${currentActionCodec} is unsupported`;
            }
            toLoadActions[index] = action;
        });
        if (toLoadActions.filter(action => action[0] === Muxing.actionsEnum.COPYDOVI).length > 1){
            throw "Multilayer Dolby vision is unsupported";
        }
        this.fileActions = toLoadActions;
    };

    processActions(){
        const firstStreamIndex = this.fileActions.findIndex(action => action && action[0] === Muxing.actionsEnum.COPYDOVI);
        if (firstStreamIndex >= 0){
            const primaryDoViStreamAction = this.fileActions[firstStreamIndex];
            const [formatType, dolbyVisionProfile, dolbyVisionLevel] = primaryDoViStreamAction.get("formats").some(supportedFormats => supportedFormats[0] === "Dolby Vision");
            if (Number(dolbyVisionProfile) === 7){
                this.FFMpegTranscoder.exportToRawHevc(primaryDoViStreamAction);
            } else{
                this.MKVExtractExtractor.executeAction(primaryDoViStreamAction);
            }
        }
        return [];
    }
}

class MP4BoxPresetGenerator {
    programPath = "";
    extractorInterface = null;
    transcoderInterface = null;
    doviMuxerInterface = null;
    fileMetaData = null;
    fileActions = [];

    containerCodecs = new Map([
        ['mp4', new Map([
            ["h264", true],
            ["hevc", true],
            ["mpeg4", true],
            ["vc1", true],
            ["av1", true],
            ["dts:DTS-HD MA", false],
            ["dts:DTS-HD", false],
            ["dts:DTS", false],
            ["truehd", false],
            ["eac3", true],
            ["ac3", true],
            ["aac:LC", true],
            ["opus", true],
            ["mov_text", true],
            ["subrip", false],
            ["hdmv_pgs_subtitle", false],
            ["dvd_subtitle", false],
        ])]
    ]);

    constructor(pathVars,extractorInterface,transcoderInterface,doviMuxerInterface) {
        this.programPath = pathVars.get("mp4box");
        this.extractorInterface = extractorInterface;
        this.transcoderInterface = transcoderInterface;
        this.doviMuxerInterface = doviMuxerInterface;
    }

    loadFileMetaData(fileMetaData){
        this.fileMetaData = fileMetaData;
    };

    loadActions(actions){
        this.fileActions = actions
    };

    generatePresets(){
        if (!this.fileActions || !this.fileMetaData) return;
        if(this.fileActions.filter(action => [Muxing.actionsEnum.DISCARD,Muxing.actionsEnum.EXTRACT].includes(action[0])).length === this.fileActions.length){
            "mp4box -rem 3 sample.mp4"
        }
        else{
            this.doviMuxerInterface.loadActions(this.fileActions);
            this.transcoderInterface.loadActions(this.fileActions);
            this.extractorInterface.loadActions(this.fileActions);
        }
    }
}

class FFMpegPresetGenerator {
    programPath = "";
    extractorInterface = null;
    transcoderInterface = null;
    doviMuxerInterface = null;
    fileMetaData = null;
    fileActions = [];

    containerCodecs = new Map([
        ['mkv', new Map([
            ["h264", true],
            ["hevc", true],
            ["mpeg4", true],
            ["vc1", true],
            ["av1", true],
            ["dts:DTS-HD MA", true],
            ["dts:DTS-HD", true],
            ["dts:DTS", true],
            ["truehd", true],
            ["eac3", true],
            ["ac3", true],
            ["aac:LC", true],
            ["opus", true],
            ["mov_text", false],
            ["subrip", true],
            ["hdmv_pgs_subtitle", true],
            ["dvd_subtitle", true],
        ])]
    ]);

    constructor(pathVars, extractorInterface, transcoderInterface, doviMuxerInterface) {
        this.programPath = pathVars.get("ffmpeg");
        this.extractorInterface = extractorInterface;
        this.transcoderInterface = transcoderInterface;
        this.doviMuxerInterface = doviMuxerInterface;
    }

    loadFileMetaData(fileMetaData){
        this.fileMetaData = fileMetaData;
    };

    loadActions(actions){
        const currentContainerSupportedCodecs = this.containerCodecs.get(this.fileMetaData.get("targetContainerType"));
        actions = actions.map((action, index) => {
            const [actionType, actionData, actionModifications] = action;
            if ([Muxing.actionsEnum.DISCARD].includes(actionType)) return action;
            const originalCodec = action[1].get("codec");
            const targetCodec = getModifiedActionValue(action,"codec");
            const isTargetCodecSupported = currentContainerSupportedCodecs.get(targetCodec);

            if(isTargetCodecSupported === undefined) throw `No definition for codec ${targetCodec} in target container`;
            if(isTargetCodecSupported === false){
                if([Muxing.actionsEnum.COPY].includes(actionType)){
                    action[0] = Muxing.actionsEnum.EXTRACT;
                }
                if([Muxing.actionsEnum.MODIFY].includes(actionType)){
                    if(currentContainerSupportedCodecs.get(originalCodec)){
                        action[0] = Muxing.actionsEnum.COPY;
                    }else{
                        action[0] = Muxing.actionsEnum.DISCARD;
                    }
                }
                if ([Muxing.actionsEnum.CREATE].includes(actionType)){
                    action[0] = Muxing.actionsEnum.DISCARD;
                }
            }
            return action;
        })

        this.fileActions = actions;
    };

    processCopyActions(){
        const copyPresetActions = [];
        this.fileActions.forEach((copyAction, index) => {
            if (copyAction[0] !== Muxing.actionsEnum.COPY) return;
            let preset = null;
            switch (this.fileMetaData.get("presetProgram")) {
                case ".mkv.mkv":
                    preset = (mappedStreamId = 0) => [
                        `-map 0:${copyAction[1].get("type")}:${mappedStreamId} -c:a:${mappedStreamId} copy`,
                        null
                    ];
                    break;
                case ".mp4.mkv":
                    [copyAction, preset] = this.extractorInterface.executeAction(copyAction);
                    break;
                default:
                    throw "No program found for current and target container type";
            }
            copyPresetActions[index] = new Map([
                ["action", copyAction],
                ["preset", preset],
            ]);
        });
        return copyPresetActions;
    }


    generatePresets(){
        if (!this.fileActions || !this.fileMetaData) return;

        this.doviMuxerInterface.loadActions(this.fileActions);
        this.transcoderInterface.loadActions(this.fileActions);
        this.extractorInterface.loadActions(this.fileActions);

        let processedActionsData = [];
        this.processCopyActions().forEach((action, index) => action ? processedActionsData[index] = action : null);
        this.doviMuxerInterface.processActions().forEach((action, index) => action ? processedActionsData[index] = action : null);
        this.transcoderInterface.processActions().forEach((action, index) => action ? processedActionsData[index] = action : null);
        this.extractorInterface.processActions().forEach((action, index) => action ? processedActionsData[index] = action : null);

        console.log(processedActionsData.map(processedAction => [
            processedAction.get("action"),
            processedAction.get("preset")(),
        ]));

        let childPresets = [];
        let mainPreset = "";
        switch (this.fileMetaData.get("presetProgram")){
            case ".mkv.mkv":
                const programPath = this.programPath;
                let externalFiles = [this.fileMetaData.get("originalFile").get("complete")];
                const getMappedExternalFileId = () => externalFiles.length - 1;
                let containerPresetParts = [];

                let mappedIds = new Map([
                    ["v", -1],
                    ["a", -1],
                    ["s", -1]
                ]);
                processedActionsData.forEach(rawAction => {
                    const presetAction = rawAction.get("action");
                    const presetActionDetails = presetAction[1];
                    const presetActionModifications = presetAction[2];
                    const presetActionRawPreset = rawAction.get("preset");
                    const currentPresetActionType = presetActionDetails.get("type");

                    mappedIds.set(currentPresetActionType, mappedIds.get(currentPresetActionType) + 1);
                    const [presetActionPreset, presetActionPresetFile] = presetActionRawPreset(mappedIds.get(currentPresetActionType));
                    const newActionTitle = getModifiedActionValue(presetAction,"title");
                    const metaDataPresetPart = `-disposition:${currentPresetActionType}:${mappedIds.get(currentPresetActionType)} ${getModifiedActionValue(presetAction,"default") ? "default" : 0} ${newActionTitle && `-metadata:s:${currentPresetActionType}:${mappedIds.get(currentPresetActionType)} title="${newActionTitle}"`} -metadata:s:${currentPresetActionType}:${mappedIds.get(currentPresetActionType)} language=${presetActionDetails.get("language")}`;
                    if (presetActionPresetFile !== null){
                        childPresets.push(presetActionPreset);
                        externalFiles.push(presetActionPresetFile);
                        containerPresetParts.push(`-map ${getMappedExternalFileId()}:${currentPresetActionType}:0 -c:${currentPresetActionType}:${mappedIds.get(currentPresetActionType)} copy ${metaDataPresetPart}`);
                    } else{
                        containerPresetParts.push(`${presetActionPreset} ${metaDataPresetPart}`);
                    }
                })

                const originalFile = this.fileMetaData.get("originalFile");
                const fileTitle = this.fileMetaData.get("fileTitle");
                const newFileName = `${originalFile.get("directory")}${originalFile.get("baseName")}-transcoded.${originalFile.get("extension")}`;

                mainPreset = `${programPath} ${externalFiles.map(externalFile => `-i "${externalFile}"`).join(" ")} ${fileTitle ? `-metadata title="${fileTitle} " ` : ""}-map_chapters -1 ${containerPresetParts.join(" ")} -strict unofficial "${newFileName}"`;
                break;
            case ".mp4.mkv":

                break;
            default:
                throw "No program found for current and target container type";
        }

        return [childPresets, mainPreset];
    }
}

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    const fs = require('fs')
    const path = require('path');
    inputs = lib.loadDefaultValues(inputs, details);

    inputs.languageDictionary = new Map([
        ['und', 'Unknown'],
        ["abk", "Abkhazian"],
        ["aar", "Afar"],
        ["afr", "Afrikaans"],
        ["aka", "Akan"],
        ["sqi", "Albanian"],
        ["amh", "Amharic"],
        ["ara", "Arabic"],
        ["arg", "Aragonese"],
        ["hye", "Armenian"],
        ["asm", "Assamese"],
        ["ava", "Avaric"],
        ["ave", "Avestan"],
        ["aym", "Aymara"],
        ["aze", "Azerbaijani"],
        ["bam", "Bambara"],
        ["bak", "Bashkir"],
        ["eus", "Basque"],
        ["bel", "Belarusian"],
        ["ben", "Bengali"],
        ["bis", "Bislama"],
        ["bos", "Bosnian"],
        ["bre", "Breton"],
        ["bul", "Bulgarian"],
        ["mya", "Burmese"],
        ["cat", "Catalan"],
        ["cha", "Chamorro"],
        ["che", "Chechen"],
        ["nya", "Chewa"],
        ["zho", "Chinese"],
        ["chu", "Slavonic"],
        ["chv", "Chuvash"],
        ["cor", "Cornish"],
        ["cos", "Corsican"],
        ["cre", "Cree"],
        ["hrv", "Croatian"],
        ["ces", "Czech"],
        ["dan", "Danish"],
        ["div", "Divehi"],
        ["nld", "Dutch"],
        ["dzo", "Dzongkha"],
        ["eng", "English"],
        ["epo", "Esperanto"],
        ["est", "Estonian"],
        ["ewe", "Ewe"],
        ["fao", "Faroese"],
        ["fij", "Fijian"],
        ["fin", "Finnish"],
        ["fra", "French"],
        ["fry", "Western Frisian"],
        ["ful", "Fulah"],
        ["gla", "Gaelic"],
        ["glg", "Galician"],
        ["lug", "Ganda"],
        ["kat", "Georgian"],
        ["deu", "German"],
        ["ell", "Greek"],
        ["kal", "Kalaallisut"],
        ["grn", "Guarani"],
        ["guj", "Gujarati"],
        ["hat", "Haitian"],
        ["hau", "Hausa"],
        ["heb", "Hebrew"],
        ["her", "Herero"],
        ["hin", "Hindi"],
        ["hmo", "Hiri Motu"],
        ["hun", "Hungarian"],
        ["isl", "Icelandic"],
        ["ido", "Ido"],
        ["ibo", "Igbo"],
        ["ind", "Indonesian"],
        ["ina", "Interlingua"],
        ["ile", "Interlingue"],
        ["iku", "Inuktitut"],
        ["ipk", "Inupiaq"],
        ["gle", "Irish"],
        ["ita", "Italian"],
        ["jpn", "Japanese"],
        ["jav", "Javanese"],
        ["kan", "Kannada"],
        ["kau", "Kanuri"],
        ["kas", "Kashmiri"],
        ["kaz", "Kazakh"],
        ["khm", "Central Khmer"],
        ["kik", "Kikuyu"],
        ["kin", "Kinyarwanda"],
        ["kir", "Kirghiz"],
        ["kom", "Komi"],
        ["kon", "Kongo"],
        ["kor", "Korean"],
        ["kua", "Kuanyama"],
        ["kur", "Kurdish"],
        ["lao", "Lao"],
        ["lat", "Latin"],
        ["lav", "Latvian"],
        ["lim", "Limburgan"],
        ["lin", "Lingala"],
        ["lit", "Lithuanian"],
        ["lub", "Luba-Katanga"],
        ["ltz", "Luxembourgish"],
        ["mkd", "Macedonian"],
        ["mlg", "Malagasy"],
        ["msa", "Malay"],
        ["mal", "Malayalam"],
        ["mlt", "Maltese"],
        ["glv", "Manx"],
        ["mri", "Maori"],
        ["mar", "Marathi"],
        ["mah", "Marshallese"],
        ["mon", "Mongolian"],
        ["nau", "Nauru"],
        ["nav", "Navajo"],
        ["nde", "North Ndebele"],
        ["nbl", "South Ndebele"],
        ["ndo", "Ndonga"],
        ["nep", "Nepali"],
        ["nor", "Norwegian"],
        ["nob", "Norwegian Bokmål"],
        ["nno", "Norwegian Nynorsk"],
        ["oci", "Occitan"],
        ["oji", "Ojibwa"],
        ["ori", "Oriya"],
        ["orm", "Oromo"],
        ["oss", "Ossetian"],
        ["pli", "Pali"],
        ["pus", "Pashto"],
        ["fas", "Persian"],
        ["pol", "Polish"],
        ["por", "Portuguese"],
        ["pan", "Punjabi"],
        ["que", "Quechua"],
        ["ron", "Romanian"],
        ["roh", "Romansh"],
        ["run", "Rundi"],
        ["rus", "Russian"],
        ["sme", "Northern Sami"],
        ["smo", "Samoan"],
        ["sag", "Sango"],
        ["san", "Sanskrit"],
        ["srd", "Sardinian"],
        ["srp", "Serbian"],
        ["sna", "Shona"],
        ["snd", "Sindhi"],
        ["sin", "Sinhala"],
        ["slk", "Slovak"],
        ["slv", "Slovenian"],
        ["som", "Somali"],
        ["sot", "Southern Sotho"],
        ["spa", "Spanish"],
        ["sun", "Sundanese"],
        ["swa", "Swahili"],
        ["ssw", "Swati"],
        ["swe", "Swedish"],
        ["tgl", "Tagalog"],
        ["tah", "Tahitian"],
        ["tgk", "Tajik"],
        ["tam", "Tamil"],
        ["tat", "Tatar"],
        ["tel", "Telugu"],
        ["tha", "Thai"],
        ["bod", "Tibetan"],
        ["tir", "Tigrinya"],
        ["ton", "Tonga"],
        ["tso", "Tsonga"],
        ["tsn", "Tswana"],
        ["tur", "Turkish"],
        ["tuk", "Turkmen"],
        ["twi", "Twi"],
        ["uig", "Uighur"],
        ["ukr", "Ukrainian"],
        ["urd", "Urdu"],
        ["uzb", "Uzbek"],
        ["ven", "Venda"],
        ["vie", "Vietnamese"],
        ["vol", "Volapük"],
        ["wln", "Walloon"],
        ["cym", "Welsh"],
        ["wol", "Wolof"],
        ["xho", "Xhosa"],
        ["iii", "Sichuan Yi"],
        ["yid", "Yiddish"],
        ["yor", "Yoruba"],
        ["zha", "Zhuang"],
        ["zul", "Zulu"]
    ]);

    inputs.upgradeableCodecs = ["vc1","mpeg4","h264"];

    inputs.atmosCapableCodecs = ["truehd","eac3"];

    inputs.filterableSubtitleCodecs = ["subrip","mov_text"];

    inputs.allowSevenChannelAudio = false; // False converts 6.1 Audio to 5.1
    inputs.audioCodecLimits = [
        createCodecLimit("aac:LC", 2,6,true),
        createCodecLimit(["dts:DTS","dts:DTS-HD","dts:DTS-HD MA"], 6,8, false),
        // StrictEnforce will always discard audioTrack if it fails the set requirements
        // StrictEnforce disabled will only discard track if no higher channel track could be found.
        // Providing an array as codec will treat all codecs as equal.
    ];

    inputs.targetAudioCodecs = [
        createTargetCodec("ac3",640000,6),
        createTargetCodec("aac:LC",256000,2),
    ];

    const allStreams = file.ffProbeData.streams;

    function getFileDetails(file){
        const fileParts = file.replaceAll("/","\\").split("\\");
        const fileName = fileParts.pop();
        const fileNameParts = fileName.split(".")
        const fileExtension = fileNameParts.pop();
        const baseFileName = fileNameParts.join(".");
        const filePath = fileParts.join("\\") + "\\";
        return [filePath, fileName, baseFileName, fileExtension];
    }


    let pathVars = [
        ["ffmpeg", otherArguments.ffmpegPath],
        ["mkvextract", otherArguments.mkvpropeditPath?.replace("mkvpropedit","mkvextract")],
        ["dovitool", "C:/Tdarr/DoviTool/dovi_tool.exe"],
        ["mp4box", "C:/Program Files/GPAC/mp4box.exe"],
    ];
    const possibleFdkFFmpegDirectory = otherArguments.ffmpegPath.replace("/ffmpeg/","/ffmpeg-fdk/");
    if (fs.existsSync(possibleFdkFFmpegDirectory)){
        pathVars.push(["ffmpegfdk",possibleFdkFFmpegDirectory])
    }
    pathVars = new Map(pathVars);

    let response = {
        processFile: false,
        preset: "",
        container: `.${file.container}`,
        handBrakeMode: false,
        FFmpegMode: false,
        reQueueAfter: false,
        infoLog: "",
    };


    function ifFileErrorExecuteReenqueue(file, response){
        const mediaInfoRead = file?.scannerReads?.mediaInfoRead ?? "";
        const ffProbeErrors = file?.ffProbeData?.meta?.errors ?? [];
        const ffProbeMetaError = file?.ffProbeData?.meta?.Error?.toLowerCase() ?? "";
        if (mediaInfoRead?.includes("EBUSY") || ffProbeErrors.length !== 0 || ffProbeMetaError.includes("error")){
            response.infoLog += "☒File has errors, Skipping..\n"  + `${mediaInfoRead} ${ffProbeMetaError} ${JSON.stringify(ffProbeErrors)}`;
            response.processFile = false;
            response.reQueueAfter = true;
            return response;
        }
        return false;
    }

    function exitIfFileIsAlreadyCleaned(inputs, mediaTitle, response){
        if (inputs.temporary_force_clean){
            return false;
        }
        if (mediaTitle.includes("[Organized]")) {
            response.infoLog += '☒File is already organized/transcoded, Skipping..\n';
            response.processFile = false;
            return response;
        }
        return false;
    }

    function exitIfFileIsNotAVideo(file,response){
        if (file.fileMedium !== 'video') {
            response.infoLog += '☒File is not video \n';
            response.processFile = false;
            return response;
        }
        return false;
    }

    function checkIfInputFieldsAreEmpty(inputs){
        if (inputs.to_keep_audio_languages === '') {
            response.infoLog += '☒Audio Language/s not set, please configure required options. Skipping this plugin.  \n';
            response.processFile = false;
            return response;
        }
        return false
    }

    function getMediaTitle(file){
        const metaTitleTag = file?.meta?.Title?.toString()?.trim() ?? "";
        const mp4TitleTag = file?.ffProbeData?.format?.tags?.title?.trim() ?? "";
        let mediaTitle = file?.meta?.FileName ?? "";
        if (metaTitleTag.trim().length > 0){
            mediaTitle = metaTitleTag;
        }
        if (mp4TitleTag.trim().length > 0){
            mediaTitle = mp4TitleTag;
        }
        return mediaTitle;
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function cleanMediaTitle(currentMediaTitle){
        return currentMediaTitle
            .replaceAll('"',"")
            .replace(".mkv","")
            .replace(".mp4","")
            .replaceAll(".", " ")
            .replaceAll(",","");
    }

    function setTargetContainerType(inputs, file, doesFileContainDoVi){
        const originalContainer = file.container.toLowerCase();
        if (doesFileContainDoVi){
            const doviTargetContainerType = inputs.dovi_target_container_type;
            if (doviTargetContainerType === "Original"){
                return originalContainer;
            }
            return `${doviTargetContainerType.toLowerCase()}`;
        }
        if (inputs.target_container_type === "MKV"){
            return "mkv";
        }
        if (inputs.target_container_type === "MP4"){
            return "mp4";
        }
        return originalContainer;
    }

    function writeNewTitlesForActions(actions){
        return actions.map(currentAction => {
            let newActionTitle = "";
            switch (currentAction[1].get("type")){
                case "v":
                    break;
                case "a":
                    newActionTitle = generateAudioTrackTitle(
                        inputs,
                        getModifiedActionValue(currentAction,"codec"),
                        getModifiedActionValue(currentAction,"formats")[1],
                        currentAction[1].get("language"),
                        currentAction[1].get("title")
                    );
                    break;
                case "s":
                    newActionTitle = generateSubtitleTrackTitle(
                        inputs,
                        getModifiedActionValue(currentAction,"codec"),
                        getModifiedActionValue(currentAction,"formats"),
                        currentAction[1].get("language"),
                        currentAction[1].get("title")
                    );
                    break;
                default:
                    break;
            }
            if (newActionTitle !== "" || currentAction[1].get("title")){
                if (currentAction.hasOwnProperty(2)){
                    const currentActionModifications = currentAction[2];
                    currentActionModifications.set("title",newActionTitle);
                    currentAction[2] = currentActionModifications;
                } else{
                    currentAction[2] = new Map([
                        ["title", newActionTitle]
                    ]);
                }
            }
            return currentAction;
        })
    }

    function getStreamSpecialVideoFormats(videoStreamId,currentStream){
        const currentStreamVideoFormats = [[currentStream.pix_fmt]];
        if (currentStream.side_data_list && Array.isArray(currentStream.side_data_list)) {
            currentStream.side_data_list.forEach(sideData => {
                let sideDataType = sideData.side_data_type ?? "";
                const dolbyVisionProfile = sideData.dv_profile ?? 0;
                const dolbyVisionLevel = sideData.dv_level ?? 0;
                if (dolbyVisionProfile && dolbyVisionLevel) {
                    sideDataType = "DOVI configuration record"
                }
                switch (sideDataType) {
                    case "DOVI configuration record":
                        currentStreamVideoFormats.push(["Dolby Vision", dolbyVisionProfile,dolbyVisionLevel]);
                        response.infoLog += `☒Video stream 0:v:${videoStreamId} detected as having ${sideDataType} ${dolbyVisionProfile} \n`;
                        break;
                    case "Dolby Vision Metadata":
                        currentStreamVideoFormats.push(["Dolby Vision", "Per-Frame"]);
                        response.infoLog += `☒Video stream 0:v:${videoStreamId} detected as having ${sideDataType} Per-Frame \n`;
                        break;
                    case "Content Light Level Metadata":
                    case "Mastering Display Metadata":
                        currentStreamVideoFormats.push(["HDR10"]);
                        response.infoLog += `☒Video stream 0:v:${videoStreamId} detected as having ${sideDataType} \n`;
                        break;
                    case "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)":
                        currentStreamVideoFormats.push(["HDR10+"]);
                        response.infoLog += `☒Video stream 0:v:${videoStreamId} detected as having ${sideDataType} \n`;
                        break;
                    default:
                        break;
                }
            })
        }
        return currentStreamVideoFormats;
    }

    function generateVideoStreamActions(inputs, videoTranscoderInterface){
        const toRemoveVideoCodecs = inputs.to_remove_video_codecs.split(',');
        let videoActions = [];
        let videoStreamsId = 0;
        allStreams.forEach((currentStream, globalStreamId) => {
            if (currentStream.codec_type.toLowerCase() !== "video") return;
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamLanguage = currentStream?.tags?.language?.toLowerCase() ?? "";
            const currentStreamBitRate = currentStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
            const currentStreamTitle = currentStream?.tags?.title?.toLowerCase() ?? "";
            const removeCurrentStream = toRemoveVideoCodecs.includes(currentStreamCodec);

            if (removeCurrentStream) {
                response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as being ${currentStreamCodec}, removing. \n`;
            }
            const currentStreamSpecialFormats = getStreamSpecialVideoFormats(videoStreamsId,currentStream);
            const isCurrentStreamDoVi = currentStreamSpecialFormats.some(format => format[0] === "Dolby Vision");

            let currentStreamActionFormat = Muxing.formatAction(
                globalStreamId,
                'v',
                videoStreamsId,
                currentStreamCodec,
                currentStreamLanguage,
                currentStreamBitRate,
                currentStreamTitle,
                videoStreamsId === 0,
                currentStreamSpecialFormats);
            let currentStreamActionModifications = null;
            let currentStreamAction = Muxing.actionsEnum.DISCARD;
            if (!removeCurrentStream){
                if (isCurrentStreamDoVi){
                    currentStreamAction = Muxing.actionsEnum.COPYDOVI
                } else{
                    currentStreamAction = Muxing.actionsEnum.COPY
                    if (inputs.upgrade_legacy_video && inputs.upgradeableCodecs.includes(currentStreamCodec) && videoTranscoderInterface.decodeableCodecs.get(currentStreamCodec)){
                        currentStreamAction = Muxing.actionsEnum.MODIFY;
                        const currentPixelFormat = currentStreamSpecialFormats[0][0];
                        let currentStreamModifications = [["codec","hevc"]];
                        if(["yuv420p","yuv422p","yuv444p"].includes(currentPixelFormat)) currentStreamModifications.push(["formats", [[`${currentPixelFormat}10le`]]])
                        currentStreamActionModifications = new Map(currentStreamModifications);
                    }
                }
            }
            if (currentStreamActionModifications){
                videoActions.push([currentStreamAction, currentStreamActionFormat,currentStreamActionModifications]);
            } else{
                videoActions.push([currentStreamAction, currentStreamActionFormat]);
            }
            videoStreamsId++;
        });
        videoActions = writeNewTitlesForActions(videoActions);

        return videoActions;
    }

    function parseChannelsToChannelLayout(channels){
        if (channels <= 2){
            return `${channels}.0`;
        }
        if (channels <= 8){
            return `${channels - 1}.1`;
        }
        return "";
    }

    function generateAudioTrackTitle(inputs,codec,channelLayout,language,originalTitle){
        if (Number.isInteger(channelLayout)){
            channelLayout = parseChannelsToChannelLayout(channelLayout);
        }

        const IsAtmosTrack = originalTitle.toLowerCase().includes("atmos");
        const languageCode = language.toLowerCase().substring(0, 3)
        let languageName = capitalizeFirstLetter(language);
        if (inputs.languageDictionary.has(languageCode)){
            languageName = inputs.languageDictionary.get(languageCode);
        }

        let codecName = capitalizeFirstLetter(codec);
        if (parseCodecToCodecName(codec)){
            codecName = parseCodecToCodecName(codec);
        }

        return `${languageName} - ${codecName}${IsAtmosTrack && inputs.atmosCapableCodecs.includes(codec) ? " Atmos" : ""}${channelLayout ? ` ${channelLayout}` : ""}`;
    }

    function generateSubtitleTrackTitle(inputs,codec,formats,language,originalTitle){
        const languageCode = language.toLowerCase().substring(0, 3);
        let languageName = capitalizeFirstLetter(language);
        if (inputs.languageDictionary.has(languageCode)){
            languageName = inputs.languageDictionary.get(languageCode);
        }

        let codecName = capitalizeFirstLetter(codec);
        if (parseCodecToCodecName(codec)){
            codecName = parseCodecToCodecName(codec);
        }

        return `${languageName} - ${codecName}${formats.includes("forced") ? " Forced" : ""}${formats.includes("commentary") ? " Commentary" : ""}`;
    }

    function sortAudioStreamsOnQuality(audioActions){
        const codecQualityOrder = [
            "dts:DTS-HD MA",
            "truehd",
            "dts:DTS-HD",
            "eac3",
            "dts:DTS",
            "opus",
            "ac3",
            "aac:LC"
        ];

        audioActions.sort((a, b) => {
            let indexA = codecQualityOrder.indexOf(getModifiedActionValue(a,"codec"));
            let indexB = codecQualityOrder.indexOf(getModifiedActionValue(b,"codec"));

            if (indexA === -1) indexA = codecQualityOrder.length;
            if (indexB === -1) indexB = codecQualityOrder.length;
            const aChannelCount = a[1].get("formats")[0];
            const bChannelCount = a[1].get("formats")[0];

            if (indexA === indexB) {
                if (aChannelCount === bChannelCount) {
                    return b[1].get("bitrate") - a[1].get("bitrate");
                }
                return bChannelCount - aChannelCount;
            }
            return indexA - indexB;
        })
        return audioActions;
    }


    function generateAudioStreamActions(inputs, videoTranscoderInterface){
        let audioActions = [];
        let audioStreamId = 0;
        allStreams.forEach((currentStream, globalStreamId) => {
            if (currentStream.codec_type.toLowerCase() !== "audio") return;
            const currentStreamTitle = currentStream?.tags?.title?.toLowerCase() ?? "";
            const currentStreamLanguageTag = currentStream?.tags?.language?.toLowerCase() ?? "und";
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamProfile = currentStream?.profile ?? "";
            let currentStreamBitRate = currentStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
            if (!currentStreamBitRate) {
                const potentialBitRate = currentStream?.tags?.BPS;
                currentStreamBitRate = potentialBitRate ? Number(potentialBitRate) : 0;
            }
            if (!currentStreamBitRate) {
                const potentialBitRate = currentStream?.tags[`BPS-${currentStreamLanguageTag}`];
                currentStreamBitRate = potentialBitRate ? Number(potentialBitRate) : 0;
            }
            let  currentStreamCodecTag = currentStreamCodec;
            if (currentStreamProfile){
                currentStreamCodecTag = `${currentStreamCodecTag}:${currentStreamProfile}`;
            }
            const currentStreamChannels = currentStream?.channels;
            const currentStreamChannelLayout = currentStream?.channel_layout;
            const currentStreamIsCommentary = currentStream?.disposition?.comment ?? 0;
            const currentStreamIsHearingImpaired = currentStream?.disposition?.hearing_impaired ?? 0;
            const currentStreamIsVisualImpaired = currentStream?.disposition?.visual_impaired ?? 0;

            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh') || currentStreamIsCommentary || currentStreamIsHearingImpaired || currentStreamIsVisualImpaired;

            const currentAudioStreamFormats = [currentStreamChannels,currentStreamChannelLayout];
            if (isCommentaryTrack) currentAudioStreamFormats.push("commentary");
            audioActions.push([isCommentaryTrack ? Muxing.actionsEnum.DISCARD : Muxing.actionsEnum.COPY,
                Muxing.formatAction(
                    globalStreamId,
                    'a',
                    audioStreamId,
                    currentStreamCodecTag,
                    currentStreamLanguageTag,
                    currentStreamBitRate,
                    currentStreamTitle,
                    audioStreamId === 0,
                    currentAudioStreamFormats)]);

            if (isCommentaryTrack){
                response.infoLog += `☒Audio stream 0:a:${audioStreamId} detected as being descriptive, removing. \n`;
            }
            audioStreamId++;
        });


        // Remove all non preferred language tracks if preferred ones exists.
        const toKeepAudioLanguages = inputs.to_keep_audio_languages.split(',');
        if (audioActions.some(audioAction => audioAction[0] !== Muxing.actionsEnum.DISCARD && toKeepAudioLanguages.includes(audioAction[1].get("language")))){
            audioActions = audioActions.map(audioAction => {
                const currentAudioActionLanguage = audioAction[1].get("language");
                if (!toKeepAudioLanguages.includes(currentAudioActionLanguage)){
                    audioAction[0] = Muxing.actionsEnum.DISCARD;
                    response.infoLog += `☒Audio stream 0:a:${audioAction[1].get("typeStreamId")} has unwanted language tag ${currentAudioActionLanguage}, removing. \n`;
                }
                return audioAction;
            })
        }


        // Remove lower quality Audio tracks of the same codec and channelCount
        for (let index = audioActions.length - 1; index >= 0; index--) {
            const action = audioActions[index];
            if(action[0] === Muxing.actionsEnum.DISCARD) continue;
            const currentActionCodec = action[1].get("codec");
            const currentActionAudioStreamId = action[1].get("typeStreamId");
            const currentActionLanguage = action[1].get("language");
            const currentActionBitrate = action[1].get("bitrate");
            const isHigherQualityTrackAvailable = audioActions.some(selectedAction =>
                selectedAction[0] !== Muxing.actionsEnum.DISCARD &&
                currentActionCodec === selectedAction[1].get("codec") &&
                currentActionLanguage === selectedAction[1].get("language") &&
                currentActionBitrate <= selectedAction[1].get("bitrate") &&
                currentActionAudioStreamId !== selectedAction[1].get("typeStreamId"));
            if (isHigherQualityTrackAvailable){
                response.infoLog += `☒Audio stream 0:a:${action[1].get("typeStreamId")} as ${currentActionCodec} discarded as a higher quality track is available, removing. \n`;
                action[0] = Muxing.actionsEnum.DISCARD;
                audioActions[index] = action;
            }
        }

        audioActions = sortAudioStreamsOnQuality(audioActions);


        // Apply total channel limits per codec and Downmux 6.1 audio to 5.1 surround.
        audioActions = audioActions.map((action) => {
            if(action[0] === Muxing.actionsEnum.DISCARD) return action;
            const currentActionCodecLimit = inputs.audioCodecLimits.find(codecLimit => {
                const codecLimitCodec = action[1].get("codec");
                if(Array.isArray(codecLimitCodec)){
                    return codecLimitCodec.includes(codecLimit.get("codec"));
                }
                return codecLimit.get("codec") === codecLimitCodec;
            });
            if (currentActionCodecLimit){
                const currentActionFormat = action[1];
                const currentActionCodec = currentActionFormat.get("codec");
                const currentActionBitrate = currentActionFormat.get("bitrate");
                const currentActionAudioFormats = currentActionFormat.get("formats");
                const codecLimitMinChannels = currentActionCodecLimit.get("minChannels");
                const codecLimitMaxChannels = currentActionCodecLimit.get("maxChannels");
                const codecLimitEnforceStrict = currentActionCodecLimit.get("enforceStrict");
                const currentActionChannels = currentActionAudioFormats[0];
                if (currentActionChannels > codecLimitMaxChannels){
                    const currentBitratePerChannel = currentActionBitrate / currentActionChannels;
                    const possibleTargetTrack = audioActions.find(
                        selectedAction => selectedAction[0] !== Muxing.actionsEnum.DISCARD &&
                            currentActionCodec === selectedAction[1].get("codec") &&
                            currentActionFormat.get("language") === selectedAction[1].get("language") &&
                            currentActionFormat.get("formats")[0] === selectedAction[1].get("formats")[0]);
                    if (possibleTargetTrack && (possibleTargetTrack[1].get("bitrate") >= currentBitratePerChannel * codecLimitMaxChannels)){
                        return [Muxing.actionsEnum.DISCARD, currentActionFormat];
                    } else{
                        const newActionAudioFormats = currentActionAudioFormats;
                        newActionAudioFormats[0] = codecLimitMaxChannels;
                        newActionAudioFormats[1] = parseChannelsToChannelLayout(codecLimitMaxChannels);
                        return [Muxing.actionsEnum.MODIFY, currentActionFormat, new Map([["formats",newActionAudioFormats]])];
                    }
                }

                if (currentActionChannels < codecLimitMinChannels){
                    if (codecLimitEnforceStrict){
                        return [Muxing.actionsEnum.DISCARD, currentActionFormat];
                    } else{
                        const possibleBetterTrack = audioActions.find(
                            selectedAction => {
                                const selectedActionCodec = selectedAction[1].get("codec");
                                const doesSelectedActionMatchCurrentCodec = Array.isArray(selectedActionCodec) ? selectedActionCodec.includes(currentActionCodec) : currentActionCodec === selectedActionCodec;
                                return selectedAction[0] !== Muxing.actionsEnum.DISCARD &&
                                    doesSelectedActionMatchCurrentCodec &&
                                    currentActionFormat.get("language") === selectedAction[1].get("language") &&
                                    selectedAction.get("formats")[0] >= codecLimitMinChannels
                            });
                        if (possibleBetterTrack){
                            return [Muxing.actionsEnum.DISCARD, currentActionFormat];
                        }
                    }
                }

                if (!inputs.allowSevenChannelAudio && (currentActionChannels === 7 || currentActionAudioFormats[1].includes("6.1"))){
                    currentActionAudioFormats[0] = 6;
                    currentActionAudioFormats[1] = "5.1";
                    return [Muxing.actionsEnum.MODIFY, currentActionFormat, new Map([["formats",currentActionAudioFormats]])];
                }
            }
            return action;
        });

        const keptAudioStreamLanguages = [...new Set(audioActions.map(audioStream => {
            if (audioStream[0] !== Muxing.actionsEnum.DISCARD){
                return audioStream[1].get("language");
            }
            return null;
        }).filter((language) => language !== null))];


        const bestAudioStreamsPerLanguage = keptAudioStreamLanguages.map(language => {
            return audioActions.find(audioStream => audioStream[0] !== Muxing.actionsEnum.DISCARD && audioStream[1].get("language") === language && videoTranscoderInterface.decodeableCodecs.get(audioStream[1].get("codec")));
        })

        bestAudioStreamsPerLanguage.forEach(bestAudioStreamPerLanguage => {
            if (!bestAudioStreamPerLanguage){
                response.infoLog += `Tried adding extra audio tracks for ${bestAudioStreamPerLanguage[1].get("language")} however, no transcodeable source track could be found. \n`;
                return
            }

            const bestAudioStreamLanguage = bestAudioStreamPerLanguage[1].get("language");
            const bestAudioStreamFormats = bestAudioStreamPerLanguage[1].get("formats");
            const bestAudioStreamBitrate = bestAudioStreamPerLanguage[1].get("bitrate");

            inputs.targetAudioCodecs.forEach((targetCodec) => {
                const doesAudioAlreadyExists = audioActions.find(selectedAudioStream => selectedAudioStream[0] !== Muxing.actionsEnum.DISCARD && selectedAudioStream[1].get("codec") === targetCodec.get("targetCodec") && selectedAudioStream[1].get("language") === bestAudioStreamLanguage);
                if (!doesAudioAlreadyExists){
                    let targetCodecCodec = targetCodec.get("targetCodec");
                    const targetCodecBitrate = targetCodec.get("targetBitrate");
                    const targetCodecChannels = targetCodec.get("targetChannels");
                    const newAudioStreamFormats = [...bestAudioStreamFormats];

                    if (bestAudioStreamBitrate >= targetCodecBitrate || bestAudioStreamBitrate === 0){
                        if (newAudioStreamFormats[0] > targetCodecChannels){
                            newAudioStreamFormats[0] = targetCodecChannels;
                            newAudioStreamFormats[1] = parseChannelsToChannelLayout(targetCodecChannels);
                        }

                        audioActions.push([
                            Muxing.actionsEnum.CREATE,
                            bestAudioStreamPerLanguage[1],
                            new Map([
                                ["codec", targetCodecCodec],
                                ["bitrate", targetCodecBitrate],
                                ["title", ""],
                                ["default", false],
                                ["formats", newAudioStreamFormats]
                            ])
                        ]);
                        response.infoLog += `Created new ${targetCodecCodec} ${newAudioStreamFormats[1]} track \n`;
                    }
                }
            });
        })

        audioActions = writeNewTitlesForActions(audioActions);

        audioActions = sortAudioStreamsOnQuality(audioActions);
        return audioActions;
    }

    function generateSubtitleStreamActions(inputs, videoTranscoderInterface){
        const toKeepSubtitleLanguages = inputs.to_keep_subtitle_languages.split(',');
        let subtitleActions = [];
        let subtitleStreamId = 0;
        allStreams.forEach((currentStream, globalStreamId) => {
            if (currentStream.codec_type.toLowerCase() !== "subtitle") return;
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamTitle = currentStream?.tags?.title?.toString()?.toLowerCase() ?? "";
            const currentStreamLanguage = currentStream?.tags?.language?.toLowerCase() ?? "und";
            let currentStreamSpecialFormats = [];
            const currentStreamIsForced = currentStream?.disposition?.forced ?? 0;
            const currentStreamIsCommentary = currentStream?.disposition?.comment ?? 0;
            const currentStreamIsHearingImpaired = currentStream?.disposition?.hearing_impaired ?? 0;
            const currentStreamIsVisualImpaired = currentStream?.disposition?.visual_impaired ?? 0;
            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh') || currentStreamIsCommentary || currentStreamIsHearingImpaired || currentStreamIsVisualImpaired;
            const toRemoveSubtitleCodecs = inputs.to_remove_subtitle_codecs.split(',');
            const keepCurrentStream = toKeepSubtitleLanguages.includes(currentStreamLanguage) && !toRemoveSubtitleCodecs.includes(currentStreamCodec) && !isCommentaryTrack;

            if (currentStreamTitle.includes('forced') || currentStreamIsForced){
                currentStreamSpecialFormats.push("forced");
            }

            if (isCommentaryTrack){
                currentStreamSpecialFormats.push("commentary");
                response.infoLog += `☒Subtitle stream 0:s:${subtitleStreamId} detected as being descriptive, removing. \n`;
            } else if(toRemoveSubtitleCodecs.includes(currentStreamCodec)){
                response.infoLog += `☒Subtitle stream detected as unwanted. removing subtitle stream 0:s:${subtitleStreamId} - ${currentStreamCodec}. \n`;
            } else{
                response.infoLog += `☒Subtitle stream 0:s:${subtitleStreamId} has unwanted language tag ${currentStreamLanguage}, removing. \n`;
            }

            subtitleActions.push([keepCurrentStream ? Muxing.actionsEnum.COPY : Muxing.actionsEnum.DISCARD,
                Muxing.formatAction(
                    globalStreamId,
                    's',
                    subtitleStreamId,
                    currentStreamCodec,
                    currentStreamLanguage,
                    0,
                    currentStreamTitle,
                    subtitleStreamId === 0,
                    currentStreamSpecialFormats)]);
            subtitleStreamId++;
        });

        subtitleActions.sort((a, b) => {
            let indexA = toKeepSubtitleLanguages.indexOf(a[1]);
            let indexB = toKeepSubtitleLanguages.indexOf(b[1]);
            if (indexA === -1) indexA = toKeepSubtitleLanguages.length;
            if (indexB === -1) indexB = toKeepSubtitleLanguages.length;
            return indexA - indexB;
        })

        subtitleActions = writeNewTitlesForActions(subtitleActions);

        return subtitleActions;
    }


    let currentMediaTitle = getMediaTitle(file);

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file, response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const isCleanedCheckResponse = exitIfFileIsAlreadyCleaned(inputs, currentMediaTitle, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const videoCheckResponse = exitIfFileIsNotAVideo(file, response);
    if (videoCheckResponse !== false) return videoCheckResponse;

    const inputCheckResponse = checkIfInputFieldsAreEmpty(file, response);
    if (inputCheckResponse !== false) return inputCheckResponse;

    const newFileTitle = `${cleanMediaTitle(currentMediaTitle).replace("[Organized]","").trim()} [Organized]`;

    const cacheFileDirectory = getFileDetails(otherArguments.cacheFilePath)[0].replaceAll("\\","/");
    const originalFile = otherArguments.originalLibraryFile.file;
    const [originalFileDirectory, originalFileName,  baseFileName, fileExtension] = getFileDetails(originalFile);
    const originalFileDetails = new Map([
        ['directory', originalFileDirectory],
        ['name', originalFileName],
        ['baseName', baseFileName],
        ['extension', fileExtension],
        ['complete', originalFile],
    ]);

    let videoTranscoderInterface = new FFMpegTranscoder(pathVars,originalFileDetails,cacheFileDirectory);

    const videoStreamActions = generateVideoStreamActions(inputs, videoTranscoderInterface);
    const audioStreamActions = generateAudioStreamActions(inputs, videoTranscoderInterface);
    const subtitleStreamActions = generateSubtitleStreamActions(inputs, videoTranscoderInterface);

    const doesFileContainDoVi = videoStreamActions.some(action => action[1].get("formats").some(supportedFormat => supportedFormat[0] === "Dolby Vision"));
    const targetContainerType = setTargetContainerType(inputs, file, doesFileContainDoVi);
    const currentContainerType = file.container.toLowerCase();
    const presetProgram = `.${currentContainerType}.${targetContainerType}`;

    let videoExtractorInterface = null;
    let videoDoViMuxerInterface = new DoViToolsMuxer(pathVars,originalFileDetails,cacheFileDirectory);
    let videoPresetGeneratorInterface = null;

    switch (presetProgram){
        case ".mkv.mkv":
            videoTranscoderInterface.setFFMpegOnlyMode(true);
            videoExtractorInterface = new MKVExtractExtractor(pathVars,originalFileDetails,originalFileDirectory);
            videoPresetGeneratorInterface = new FFMpegPresetGenerator(pathVars, videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface)
            break;
        case ".mkv.mp4":
            videoExtractorInterface = new MKVExtractExtractor(pathVars,originalFileDetails,originalFileDirectory);
            videoPresetGeneratorInterface = new MP4BoxPresetGenerator(pathVars, videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        case ".mp4.mp4":
            videoExtractorInterface = new MP4BoxExtractor(pathVars,originalFileDetails,originalFileDirectory);
            videoPresetGeneratorInterface = new MP4BoxPresetGenerator(pathVars, videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        case ".mp4.mkv":
            videoExtractorInterface = new MP4BoxExtractor(pathVars,originalFileDetails,originalFileDirectory);
            videoPresetGeneratorInterface = new FFMpegPresetGenerator(pathVars, videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        default:
            break;
    }

    // console.log([
    //     ["fileTitle",newFileTitle],
    //     ["currentContainerType",currentContainerType],
    //     ["targetContainerType",targetContainerType]
    // ])
    // console.log([...videoStreamActions,...audioStreamActions,...subtitleStreamActions].filter(item => item[0] !== Muxing.actionsEnum.DISCARD));

    videoPresetGeneratorInterface.loadFileMetaData(new Map([
        ["fileTitle", newFileTitle],
        ["currentContainerType", currentContainerType],
        ["targetContainerType", targetContainerType],
        ["presetProgram", presetProgram],
        ["originalFile", originalFileDetails]
    ]));

    videoPresetGeneratorInterface.loadActions([...videoStreamActions,...audioStreamActions,...subtitleStreamActions]);
    const presets = videoPresetGeneratorInterface.generatePresets();


    const tempPresets = presets.flat();
    console.log(tempPresets);

    function stringifyYAML(obj, indent = 0) {
        const spaces = '  '.repeat(indent);
        if (Array.isArray(obj)) {
            return obj.map(item => `${spaces}- ${stringifyYAML(item, indent + 1).trimStart()}`).join('\n');
        } else if (typeof obj === 'object' && obj !== null) {
            return Object.keys(obj).map(key => {
                const value = stringifyYAML(obj[key], indent + 1).trimStart();
                return `${spaces}${key}: ${value.includes('\n') ? '\n' + value : value}`;
            }).join('\n');
        } else {
            return `${spaces}${obj}`;
        }
    }

    fs.writeFileSync(`${originalFileDirectory}/file.json`, JSON.stringify([...videoStreamActions,...audioStreamActions,...subtitleStreamActions].map(item => [item[0],Array.from(item[1])])));
    fs.writeFileSync(`${originalFileDirectory}/presets.yaml`, stringifyYAML([`mkdir "${cacheFileDirectory}"`,...tempPresets]));



    if (!doesFileContainDoVi && ["dv","dovi"].some(substring => file?.meta?.FileName?.toLowerCase().includes(substring) || file?.meta?.Title?.toLowerCase().includes(substring))){
        response.infoLog += `☒ File says it includes Dolby Vision, However no DoVi Metadata could be found. \n`;
    }

    return response;

    response.container = targetContainerType;
    response.processFile = true;
    response.preset = presets;
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
