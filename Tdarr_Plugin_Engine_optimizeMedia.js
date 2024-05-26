/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_optimizeMedia",
        Stage: "Pre-processing",
        Name: "Cleans Movies or TV efficiently",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "pre-processing,ffmpeg,configurable",
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
    inputs = lib.loadDefaultValues(inputs, details);
    //Must return this object

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

    function cleanMediaTitle(currentMediaTitle){
        return currentMediaTitle.replaceAll('"',"")
            .replace(".mkv","")
            .replace(".mp4","")
            .replaceAll(".", " ")
            .replaceAll(",","");
    }

    function getTargetContainerType(inputs, response){
        if (inputs.target_container_type === "MKV"){
            return ".mkv";
        }
        if (inputs.target_container_type === "MP4"){
            return ".mp4";
        }
        return response.container;
    }

    function getHasSpecialVideoFormats(fileFFProbeData, response){
        const allVideoStreams = fileFFProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
        const specialVideoFormatStreams = [];
        allVideoStreams.forEach((currentStream, videoStreamsId) => {
            if (currentStream.side_data_list && Array.isArray(currentStream.side_data_list)){
                currentStream.side_data_list.forEach(sideData => {
                    let sideDataType = sideData.side_data_type ?? "";
                    const dolbyVisionProfile = sideData.dv_profile ?? 0;
                    const dolbyVisionLevel = sideData.dv_level ?? 0;
                    if (dolbyVisionProfile && dolbyVisionLevel){
                        sideDataType = "DOVI configuration record"
                    }
                    switch (sideDataType){
                        case "DOVI configuration record":
                            specialVideoFormatStreams.push([videoStreamsId,currentStream,["Dolby Vision",dolbyVisionProfile]]);
                            response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as having ${sideDataType} ${dolbyVisionProfile} \n`;
                            break;
                        case "Dolby Vision Metadata":
                            specialVideoFormatStreams.push([videoStreamsId,currentStream,["Dolby Vision","Per-Frame"]]);
                            response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as having ${sideDataType} Per-Frame \n`;
                            break;
                        case "Content Light Level Metadata":
                        case "Mastering Display Metadata":
                            specialVideoFormatStreams.push([videoStreamsId,currentStream,["HDR10"]]);
                            response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as having ${sideDataType} \n`;
                            break;
                        case "HDR Dynamic Metadata SMPTE2094-40 (HDR10+)":
                            specialVideoFormatStreams.push([videoStreamsId,currentStream,["HDR10+"]]);
                            response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as having ${sideDataType} \n`;
                            break;
                        default:
                            break;
                    }
                })
            }
        });
        return [response, specialVideoFormatStreams];
    }

    function cleanVideoStreams(inputs, response){
        const allVideoStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
        const toRemoveVideoCodecs = inputs.to_remove_video_codecs.split(',');
        let videoFFmpegCommandArgs = [];

        allVideoStreams.forEach((currentStream, videoStreamsId) => {
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            if (toRemoveVideoCodecs.includes(currentStreamCodec)) {
                videoFFmpegCommandArgs.push(`-map -0:v:${videoStreamsId}`);
                response.infoLog += `☒Video stream 0:v:${videoStreamsId} detected as being ${currentStreamCodec}, removing. \n`;
            }
        });

        return [response, videoFFmpegCommandArgs.join(" ")];
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
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

    function getAudioTrackTitle(codec,channelLayout,language){
        if (Number.isInteger(channelLayout)){
            channelLayout = parseChannelsToChannelLayout(channelLayout);
        }

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

        return `${languageName} - ${codecName}${channelLayout ? ` ${channelLayout}` : ""}`;
    }


    function cleanAudioStreams(inputs, response){
        // Codec, Existing bitrate
        const discardStreamIfHigherQualityFound = [
            ["ac3",448000]
        ]
        const toKeepAudioLanguages = inputs.to_keep_audio_languages.split(',');
        let audioFFmpegCommandArgs = [];
        let audioTracksOrder = [];
        const allAudioStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "audio");

        allAudioStreams.forEach((currentStream, audioStreamsId) => {
            const currentStreamTitle = currentStream?.tags?.title?.toLowerCase() ?? "";
            const currentStreamLanguageTag = currentStream?.tags?.language?.toLowerCase() ?? "";
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamBitRate = currentStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
            const currentStreamIsCommentary = currentStream?.disposition?.comment ?? 0;
            const currentStreamIsHearingImpaired = currentStream?.disposition?.hearing_impaired ?? 0;
            const currentStreamIsVisualImpaired = currentStream?.disposition?.visual_impaired ?? 0;

            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh') || currentStreamIsCommentary || currentStreamIsHearingImpaired || currentStreamIsVisualImpaired;
            let higherQualityTrackFound = false;
            if (discardStreamIfHigherQualityFound.some(discardStream => discardStream[0] === currentStreamCodec && discardStream[1] === currentStreamBitRate) && allAudioStreams.some(selectedAudioStream => {
                const selectedStreamCodec = selectedAudioStream?.codec_name?.toLowerCase() ?? "";
                const selectedStreamBitRate = selectedAudioStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
                return selectedStreamCodec === currentStreamCodec && selectedStreamBitRate > currentStreamBitRate;
            })){
                higherQualityTrackFound = true;
            }

            if (toKeepAudioLanguages.includes(currentStreamLanguageTag) && !isCommentaryTrack && !higherQualityTrackFound) {
                audioTracksOrder.push([audioStreamsId, currentStreamLanguageTag, true, isCommentaryTrack]);
            } else{
                audioTracksOrder.push([audioStreamsId, currentStreamLanguageTag, false, isCommentaryTrack]);
                if (isCommentaryTrack){
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} detected as being descriptive, removing. \n`;
                } else{
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} has unwanted language tag ${currentStreamLanguageTag}, removing. \n`;
                }
                if (higherQualityTrackFound){
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} discard as a higher quality track is available, removing. \n`;
                }
            }
        });

        if (audioTracksOrder.filter(audioTrack => audioTrack[2]).length === 0){
            if (audioTracksOrder[0]){
                audioTracksOrder[0][2] = true;
                response.infoLog += '☒Re-added first audio stream to prevent no audio. \n';
            }
            if (audioTracksOrder[1] && audioTracksOrder[0]?.tags?.language?.toLowerCase() === audioTracksOrder[1]?.tags?.language?.toLowerCase() && audioTracksOrder[1][3] !== true){
                audioTracksOrder[1][2] = true;
                response.infoLog += '☒First audio stream is probably DTS:X or Dolby TrueHD, adding second audio stream back as well. \n';
            }
        }

        audioTracksOrder.sort((a, b) => {
            let indexA = toKeepAudioLanguages.indexOf(a[1]);
            let indexB = toKeepAudioLanguages.indexOf(b[1]);
            if (indexA === -1) indexA = toKeepAudioLanguages.length;
            if (indexB === -1) indexB = toKeepAudioLanguages.length;
            return indexA - indexB;
        })

        audioTracksOrder.forEach((audioTrack, index) => {
            const audioStreamsId = audioTrack[0];
            const keepAudioStream = audioTrack[2];

            if (index === 0){
                audioFFmpegCommandArgs.push(`-map 0:a:${audioStreamsId} -disposition:a:0 default`)
            } else{
                audioFFmpegCommandArgs.push(`-map ${keepAudioStream ? "" : "-"}0:a:${audioStreamsId}  ${keepAudioStream ? `-disposition:a:${audioStreamsId} 0` : ""}`);
            }


            if (Boolean(inputs.tag_title_for_audio) === true){
                const currentStream = allAudioStreams[audioStreamsId];
                const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
                const currentStreamProfile = currentStream?.profile ?? "";
                const currentStreamChannelLayout = currentStream?.channel_layout;
                const currentStreamTitle = currentStream?.tags?.title ?? "";
                const currentStreamLanguage = currentStream?.tags?.language ?? "und";

                let currentStreamCodecTag = currentStreamCodec;
                if (currentStreamProfile){
                    currentStreamCodecTag = `${currentStreamCodecTag}:${currentStreamProfile}`;
                }

                const audioStreamTitle = getAudioTrackTitle(currentStreamCodecTag,currentStreamChannelLayout,currentStreamLanguage,currentStreamTitle);
                audioFFmpegCommandArgs.push(`-metadata:s:a:${audioStreamsId} title="${audioStreamTitle}"`);
            }
        });

        return [response, audioFFmpegCommandArgs.join(" ")];
    }

    function cleanSubtitles(inputs, response){
        const toKeepSubtitleLanguages = inputs.to_keep_subtitle_languages.split(',');
        let subtitleFFmpegCommandArgs = [];
        let subtitleTracksOrder = [];
        const allSubtitleStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "subtitle");

        allSubtitleStreams.forEach((currentStream, subtitleStreamsId) => {
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamTitle = currentStream?.tags?.title?.toString()?.toLowerCase() ?? "";
            const currentStreamLanguageTag = currentStream?.tags?.language?.toLowerCase() ?? "";
            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh');

            const toRemoveSubtitleCodecs = inputs.to_remove_subtitle_codecs.split(',');

            if (toKeepSubtitleLanguages.includes(currentStreamLanguageTag) && !toRemoveSubtitleCodecs.includes(currentStreamCodec) && !isCommentaryTrack) {
                subtitleTracksOrder.push([subtitleStreamsId, currentStreamLanguageTag, true]);
            } else{
                subtitleTracksOrder.push([subtitleStreamsId, currentStreamLanguageTag, false]);
                if (isCommentaryTrack){
                    response.infoLog += `☒Subtitle stream 0:s:${subtitleStreamsId} detected as being descriptive, removing. \n`;
                } else if(toRemoveSubtitleCodecs.includes(currentStreamCodec)){
                    response.infoLog += `☒Subtitle stream detected as unwanted. removing subtitle stream 0:s:${subtitleStreamsId} - ${currentStream.codec_name}. \n`;
                } else{
                    response.infoLog += `☒Subtitle stream 0:s:${subtitleStreamsId} has unwanted language tag ${currentStreamLanguageTag}, removing. \n`;
                }
            }
        });

        subtitleTracksOrder.sort((a, b) => {
            let indexA = toKeepSubtitleLanguages.indexOf(a[1]);
            let indexB = toKeepSubtitleLanguages.indexOf(b[1]);
            if (indexA === -1) indexA = toKeepSubtitleLanguages.length;
            if (indexB === -1) indexB = toKeepSubtitleLanguages.length;
            return indexA - indexB;
        })

        subtitleTracksOrder.forEach((SubtitleTrack, mappedSubtitleIndex) => {
            const subtitleStreamsId = SubtitleTrack[0];
            const keepSubtitleStream = SubtitleTrack[2];

            if (mappedSubtitleIndex === 0 && keepSubtitleStream){
                subtitleFFmpegCommandArgs.push(`-map 0:s:${subtitleStreamsId} -disposition:s:0 default`)
            } else{
                subtitleFFmpegCommandArgs.push(`-map ${keepSubtitleStream ? "" : "-"}0:s:${subtitleStreamsId} ${keepSubtitleStream ? `-disposition:s:${mappedSubtitleIndex} 0` : ""}`);
            }
        });

        return [response, subtitleFFmpegCommandArgs.join(" ")];
    }

    let currentMediaTitle = file?.meta?.Title?.toString() ?? file?.meta?.FileName ?? "";
    currentMediaTitle = cleanMediaTitle(currentMediaTitle);

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file, response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const isCleanedCheckResponse = exitIfFileIsAlreadyCleaned(inputs, currentMediaTitle, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const videoCheckResponse = exitIfFileIsNotAVideo(file, response);
    if (videoCheckResponse !== false) return videoCheckResponse;

    const inputCheckResponse = checkIfInputFieldsAreEmpty(file, response);
    if (inputCheckResponse !== false) return inputCheckResponse;

    const newFileTitle = `${currentMediaTitle.replace("[Organized]","").trim()} [Organized]`;
    let ffmpegCommandArgs = [
        `, -metadata title=\"${newFileTitle}\" -map_chapters -1 -map 0:v`
    ];

    response.container = getTargetContainerType(inputs, response);

    const cleanVideoResults = cleanVideoStreams(inputs, response);
    response = cleanVideoResults[0];
    ffmpegCommandArgs.push(cleanVideoResults[1]);

    const cleanAudioResults = cleanAudioStreams(inputs, response);
    response = cleanAudioResults[0];
    ffmpegCommandArgs.push(cleanAudioResults[1]);

    const cleanSubtitleResults = cleanSubtitles(inputs, response);
    response = cleanSubtitleResults[0];
    ffmpegCommandArgs.push(cleanSubtitleResults[1]);

    ffmpegCommandArgs.push("-c copy");

    const specialVideoStreamsResults = getHasSpecialVideoFormats(file.ffProbeData,response);
    response = specialVideoStreamsResults[0];

    if (specialVideoStreamsResults[1].length > 0){
        ffmpegCommandArgs.push("-strict unofficial");
    }

    if (specialVideoStreamsResults[1].filter(stream => stream[2][0] === "Dolby Vision").length === 0 && ["dv","dovi"].some(substring => file?.meta?.FileName?.toLowerCase().includes(substring) || file?.meta?.Title?.toLowerCase().includes(substring))){
        response.infoLog += `☒ File says it supports Dolby Vision, However no DoVi Metadata could be found. \n`;
    }

    ffmpegCommandArgs.push("-max_muxing_queue_size 9999");

    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
