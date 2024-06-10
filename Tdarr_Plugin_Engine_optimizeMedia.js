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
            ['bitrate', currentStreamBitRate],
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


class MKVExtractExtractor {
    programPath = "";
    constructor(programPath) {
        this.programPath = programPath;
    }
}

class MP4BoxExtractor {
    programPath = "";
    constructor(programPath) {
        this.programPath = programPath;
    }
}

class FFMpegTranscoder{

    //"dvd_subtitle" no
    programPath = "";

    compatibleCodecs = new Map([
        ['mp4', [
            "h264",
            "hevc",
            "mpeg4",
            "vc1",
            "av1",
            "eac3",
            "ac3",
            "aac:LC",
            "opus",
            "mov_text"
        ]],
        ['mkv', [
            "h264",
            "hevc",
            "mpeg4",
            "av1",
            "vc1",
            "dts:DTS-HD MA",
            "dts:DTS-HD",
            "dts:DTS",
            "truehd",
            "eac3",
            "ac3",
            "aac:LC",
            "opus",
            "subrip",
            "hdmv_pgs_subtitle",
            "dvd_subtitle"
        ]]
    ]);


    constructor(programPath){
        this.programPath = programPath;
    }
}

class DoViToolsMuxer {
    programPath = "";
    compatibleCodecs = ["hevc"];

    constructor(programPath) {
        this.programPath = programPath;
    }
}

class MP4BoxPresetGenerator {
    programPath = "";
    extractorInterface = null;
    transcoderInterface = null;
    doviMuxerInterface = null;
    actions = [];

    compatibleCodecs = new Map([
        ['mp4', [
            "h264",
            "hevc",
            "mpeg4",
            "vc1",
            "av1",
            "eac3",
            "ac3",
            "aac:LC",
            "opus",
            "mov_text"
        ]],
    ]);


    constructor(programPath,extractorInterface,transcoderInterface,doviMuxerInterface) {
        this.programPath = programPath;
        this.extractorInterface = extractorInterface;
        this.transcoderInterface = transcoderInterface;
        this.doviMuxerInterface = doviMuxerInterface;
    }

    loadActions(actions){

    };

    generatePresets(){

    }
}

class FFMpegPresetGenerator {
    programPath = "";
    extractorInterface = null;
    transcoderInterface = null;
    doviMuxerInterface = null;
    fileMetaData = null;
    fileActions = [];

    compatibleCodecs = new Map([
        ['mp4', [
            "h264",
            "hevc",
            "mpeg4",
            "vc1",
            "av1",
            "eac3",
            "ac3",
            "aac:LC",
            "opus",
            "mov_text"
        ]],
        ['mkv', [
            "h264",
            "hevc",
            "mpeg4",
            "av1",
            "vc1",
            "dts:DTS-HD MA",
            "dts:DTS-HD",
            "dts:DTS",
            "truehd",
            "eac3",
            "ac3",
            "aac:LC",
            "opus",
            "subrip",
            "hdmv_pgs_subtitle",
            "dvd_subtitle"
        ]]
    ]);

    constructor(programPath,extractorInterface,transcoderInterface,doviMuxerInterface) {
        this.programPath = programPath;
        this.extractorInterface = extractorInterface;
        this.transcoderInterface = transcoderInterface;
        this.doviMuxerInterface = doviMuxerInterface;
    }

    loadFileMetaData(fileMetaData){
        this.fileMetaData = fileMetaData;
    };

    loadActions(actions){
        this.fileActions = [...this.fileActions,actions];
    };

    generatePresets(){
        if (!this.fileActions || !this.fileMetaData) return;
    }
}

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    inputs = lib.loadDefaultValues(inputs, details);

    inputs.targetCodecs = [
        createTargetCodec("ac3",640000,6),
        createTargetCodec("aac:LC",256000,2),
    ];

    inputs.allowedExtractCodecs = [
        createExtractCodec("dts:DTS-HD MA", 6),
        createExtractCodec("truehd", 0),
    ];

    const allStreams = file.ffProbeData.streams;

    const ffMpegPath = otherArguments.ffmpegPath;
    const mkvExtractPath = otherArguments.mkvpropeditPath?.replace("mkvpropedit","mkvextract");
    const doviToolPath = "C:/Tdarr/DoviTool/dovi_tool.exe";
    const mp4BoxPath = "C:/Program Files/GPAC/mp4box.exe";

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
        if (mediaTitle.includes("[Organized]") || mediaTitle.includes("[Transcoded]")) {
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

    function setTargetContainerType(inputs, file){
        if (inputs.target_container_type === "MKV"){
            return ".mkv";
        }
        if (inputs.target_container_type === "MP4"){
            return ".mp4";
        }
        return file.container.toLowerCase();
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
        ]);

        return codecDictionary.get(codecName) ?? ""
    }

    function getStreamSpecialVideoFormats(videoStreamId,currentStream){
        const currentStreamVideoFormats = [];
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

    function generateVideoStreamActions(inputs){
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
            videoActions.push([removeCurrentStream ? Muxing.actionsEnum.DISCARD : (isCurrentStreamDoVi? Muxing.actionsEnum.COPYDOVI : Muxing.actionsEnum.COPY),
                Muxing.formatAction(
                    globalStreamId,
                    'v',
                    videoStreamsId,
                    currentStreamCodec,
                    currentStreamLanguage,
                    currentStreamBitRate,
                    currentStreamTitle,
                    videoStreamsId === 0,
                    currentStreamSpecialFormats)]);
            videoStreamsId++;
        });
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

    function generateAudioTrackTitle(codec,channelLayout,language,originalTitle){
        if (Number.isInteger(channelLayout)){
            channelLayout = parseChannelsToChannelLayout(channelLayout);
        }

        const IsAtmosTrack = originalTitle.toLowerCase().includes("atmos");
        const languageCode = language.toLowerCase().substring(0, 2)
        const languageDictionary = new Map([
            ['en', 'English'],
            ['nl', 'Dutch'],
            ['un', 'Unknown']
        ]);

        const codecDictionary = new Map([
            ['aac:LC', 'AAC'],
            ['ac3', 'Dolby Digital'],
            ['eac3', 'Dolby Digital+'],
            ['truehd', 'Dolby TrueHD'],
            ['dts:DTS-HD MA', 'DTS-HD Master Audio'],
            ['dts:DTS-HD', 'DTS-HD'],
            ['dts:DTS', 'DTS'],
            ['opus', 'Opus'],
        ]);

        let languageName = capitalizeFirstLetter(language);
        if (languageDictionary.has(languageCode)){
            languageName = languageDictionary.get(languageCode);
        }

        let codecName = capitalizeFirstLetter(codec);
        if (codecDictionary.has(codec)){
            codecName = codecDictionary.get(codec);
        }

        return `${languageName} - ${codecName}${IsAtmosTrack? " Atmos" : ""}${channelLayout ? ` ${channelLayout}` : ""}`;
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
            let indexA = codecQualityOrder.indexOf(a[1].get("codec"));
            let indexB = codecQualityOrder.indexOf(b[1].get("codec"));
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


    function generateAudioStreamActions(inputs){
        const allAudioStreams = allStreams.filter(allStream => allStream.codec_type.toLowerCase() !== "audio");

        // Codec, Existing bitrate
        const discardStreamIfHigherQualityFound = [
            ["ac3",448000]
        ]
        const toKeepAudioLanguages = inputs.to_keep_audio_languages.split(',');
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
            let higherQualityTrackFound = false;
            if (discardStreamIfHigherQualityFound.some(otherStream => otherStream[0] === currentStreamCodec && otherStream[1] === currentStreamBitRate) && allAudioStreams.some(selectedStream => {
                const selectedStreamCodec = selectedStream?.codec_name?.toLowerCase() ?? "";
                const selectedStreamBitRate = selectedStream?.bit_rate ? Number(selectedStream?.bit_rate) : 0;
                return selectedStreamCodec === currentStreamCodec && selectedStreamBitRate > currentStreamBitRate;
            })){
                higherQualityTrackFound = true;
            }

            const currentAudioStreamFormats = [currentStreamChannels,currentStreamChannelLayout];
            if (isCommentaryTrack) currentAudioStreamFormats.push("commentary");
            const keepCurrentAudioStream = toKeepAudioLanguages.includes(currentStreamLanguageTag) && !isCommentaryTrack && !higherQualityTrackFound;
            audioActions.push([!keepCurrentAudioStream ? Muxing.actionsEnum.DISCARD : Muxing.actionsEnum.COPY,
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

            if (!keepCurrentAudioStream) {
                if (isCommentaryTrack){
                    response.infoLog += `☒Audio stream 0:a:${audioStreamId} detected as being descriptive, removing. \n`;
                } else{
                    response.infoLog += `☒Audio stream 0:a:${audioStreamId} has unwanted language tag ${currentStreamLanguageTag}, removing. \n`;
                }
                if (higherQualityTrackFound){
                    response.infoLog += `☒Audio stream 0:a:${audioStreamId} discard as a higher quality track is available, removing. \n`;
                }
            }
            audioStreamId++;
        });

        if (audioActions.filter(audioStream => audioStream[0] === Muxing.actionsEnum.COPY).length === 0){
            if (audioActions[0]){
                audioActions[0][0] = Muxing.actionsEnum.COPY;
                response.infoLog += '☒Re-added first audio stream to prevent no audio. \n';
            }
            if (audioActions[1] && audioActions[0][1].get("language") === audioActions[1][1].get("language") && audioActions[1][0] === Muxing.actionsEnum.DISCARD && !audioActions[1][1].get("formats").includes("commentary")){
                audioActions[1][0] = Muxing.actionsEnum.COPY;
                response.infoLog += '☒First audio stream is probably DTS:X or Dolby TrueHD, adding second audio stream back as well. \n';
            }
        }

        audioActions = sortAudioStreamsOnQuality(audioActions);

        const keptAudioStreamLanguages = [...new Set(audioActions.map(audioStream => {
            if (audioStream[0] === Muxing.actionsEnum.COPY){
                return audioStream[1].get("language");
            }
            return null;
        }).filter((language) => language !== null))];

        const bestAudioStreamsPerLanguage = keptAudioStreamLanguages.map(language => {
            return audioActions.find(audioStream => audioStream[0] === Muxing.actionsEnum.COPY && audioStream[1].get("language") === language);
        })

        bestAudioStreamsPerLanguage.forEach(bestAudioStreamsPerLanguage => {
            const bestAudioStreamChannels = bestAudioStreamsPerLanguage[1].get("formats")[0];
            const bestAudioStreamBitrate = bestAudioStreamsPerLanguage[1].get("bitrate");
            const bestAudioStreamLanguage = bestAudioStreamsPerLanguage[1].get("language");
            const bestAudioStreamGlobalId = bestAudioStreamsPerLanguage[1].get("globalStreamId");
            const bestAudioStreamAudioStreamId = bestAudioStreamsPerLanguage[1].get("typeStreamId");

            inputs.targetCodecs.forEach((targetCodec) => {
                const doesAudioAlreadyExists = audioActions.find(selectedAudioStream => selectedAudioStream[0] === Muxing.actionsEnum.COPY && selectedAudioStream[1].get("") === targetCodec[0]);
                if (!doesAudioAlreadyExists){
                    let newAudioStreamCodec = targetCodec.get("targetCodec");
                    const newAudioStreamBitrate = targetCodec.get("targetBitrate");
                    let newAudioStreamChannels = targetCodec.get("targetChannels");
                    let newAudioStreamChannelLayout = targetCodec.get("targetChannels");

                    if (bestAudioStreamBitrate > newAudioStreamBitrate){
                        if (bestAudioStreamChannels < newAudioStreamChannels){
                            newAudioStreamChannels = bestAudioStreamChannels;
                            newAudioStreamChannelLayout = bestAudioStreamChannels;
                        }

                        audioActions.push([
                            Muxing.actionsEnum.CREATE,
                            Muxing.formatAction(
                                bestAudioStreamGlobalId,
                                'a',
                                bestAudioStreamAudioStreamId,
                                newAudioStreamCodec,
                                bestAudioStreamLanguage,
                                newAudioStreamBitrate,
                                "",
                                false,
                                [newAudioStreamChannels,newAudioStreamChannelLayout]
                            )])
                        response.infoLog += `Created new ${newAudioStreamCodec} ${newAudioStreamChannelLayout} track \n`;
                    }
                }
            });
        })

        audioActions = sortAudioStreamsOnQuality(audioActions);
        return audioActions;
    }

    function generateSubtitleStreamActions(inputs){
        const toKeepSubtitleLanguages = inputs.to_keep_subtitle_languages.split(',');
        let subtitleActions = [];
        let subtitleStreamId = 0;
        allStreams.forEach((currentStream, globalStreamId) => {
            if (currentStream.codec_type.toLowerCase() !== "subtitle") return;
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamTitle = currentStream?.tags?.title?.toString()?.toLowerCase() ?? "";
            const currentStreamLanguage = currentStream?.tags?.language?.toLowerCase() ?? "und";
            let currentStreamSpecialFormats = [];
            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh');
            const toRemoveSubtitleCodecs = inputs.to_remove_subtitle_codecs.split(',');
            const keepCurrentStream = toKeepSubtitleLanguages.includes(currentStreamLanguage) && !toRemoveSubtitleCodecs.includes(currentStreamCodec) && !isCommentaryTrack;

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

    const targetContainerType = setTargetContainerType(inputs, file);
    const currentContainerType = file.container.toLowerCase();

    const videoStreamActions = generateVideoStreamActions(inputs);
    const audioStreamActions = generateAudioStreamActions(inputs);
    const subtitleStreamActions = generateSubtitleStreamActions(inputs);

    let videoExtractorInterface = null;
    let videoTranscoderInterface = new FFMpegTranscoder();
    let videoDoViMuxerInterface = new DoViToolsMuxer(doviToolPath);
    let videoPresetGeneratorInterface = null;
    switch (`${currentContainerType}${targetContainerType}`){
        case ".mkv.mkv":
            videoExtractorInterface = new MKVExtractExtractor(mkvExtractPath);
            videoPresetGeneratorInterface = new FFMpegPresetGenerator(ffMpegPath,videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface)
            break;
        case ".mkv.mp4":
            videoExtractorInterface = new MKVExtractExtractor(mkvExtractPath);
            videoPresetGeneratorInterface = new MP4BoxPresetGenerator(mp4BoxPath,videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        case ".mp4.mp4":
            videoExtractorInterface = new MP4BoxExtractor(mp4BoxPath);
            videoPresetGeneratorInterface = new MP4BoxPresetGenerator(mp4BoxPath,videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        case ".mp4.mkv":
            videoExtractorInterface = new MP4BoxExtractor(mp4BoxPath);
            videoPresetGeneratorInterface = new FFMpegPresetGenerator(ffMpegPath,videoExtractorInterface, videoTranscoderInterface, videoDoViMuxerInterface);
            break;
        default:
            break;
    }

    console.log([...videoStreamActions,...audioStreamActions,...subtitleStreamActions]);

    const fs = require('fs')
    fs.writeFileSync('file.json', JSON.stringify([...videoStreamActions,...audioStreamActions,...subtitleStreamActions].map(item => [item[0],Array.from(item[1])])));
    return;
    videoPresetGeneratorInterface.loadFileMetaData(new Map([
        ["fileTitle",newFileTitle],
        ["currentContainerType",currentContainerType],
        ["targetContainerType",targetContainerType]
    ]));
    videoPresetGeneratorInterface.loadActions([...videoStreamActions,...audioStreamActions,...subtitleStreamActions]);
    const presets = videoPresetGeneratorInterface.generatePresets();


    if (specialVideoStreamsResults[1].filter(stream => stream[3][0] === "Dolby Vision").length === 0 && ["dv","dovi"].some(substring => file?.meta?.FileName?.toLowerCase().includes(substring) || file?.meta?.Title?.toLowerCase().includes(substring))){
        response.infoLog += `☒ File says it includes Dolby Vision, However no DoVi Metadata could be found. \n`;
    }

    response.container = targetContainerType;
    response.processFile = true;
    response.preset = presets;
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
