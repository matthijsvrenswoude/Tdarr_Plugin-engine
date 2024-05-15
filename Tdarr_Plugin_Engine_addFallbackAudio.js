/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_addFallbackAudio",
        Stage: "Pre-processing",
        Name: "Add fallback audio tracks to video",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "pre-processing,ffmpeg,configurable",
        Inputs: [
            {
                name: 'target_container_type',
                type: 'string',
                defaultValue: 'MKV',
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

    function AddAudioStreams(inputs, response){
        const toKeepAudioLanguages = inputs.to_keep_audio_languages.split(',');
        let audioFFmpegCommandArgs = [];
        let audioTracksOrder = [];
        const allAudioStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "audio");

        allAudioStreams.forEach((currentStream, audioStreamsId) => {
            const currentStreamTitle = currentStream?.tags?.title?.toLowerCase() ?? "";
            const currentStreamLanguageTag = currentStream?.tags?.language?.toLowerCase() ?? "";

            const isCommentaryTrack = currentStreamTitle.includes('commentary') || currentStreamTitle.includes('description') || currentStreamTitle.includes('sdh');

            if (toKeepAudioLanguages.includes(currentStreamLanguageTag) && !isCommentaryTrack) {
                audioTracksOrder.push([audioStreamsId, currentStreamLanguageTag, true, isCommentaryTrack]);
            } else{
                audioTracksOrder.push([audioStreamsId, currentStreamLanguageTag, false, isCommentaryTrack]);
                if (isCommentaryTrack){
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} detected as being descriptive, removing. \n`;
                } else{
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} has unwanted language tag ${currentStreamLanguageTag}, removing. \n`;
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

            const audioStreamTitle = allAudioStreams[audioStreamsId]?.tags?.title;
            if (file.container === ".mkv" && audioStreamTitle && inputs.tag_title_for_audio === true){
                if (currentStream.channels === 8) {
                    audioFFmpegCommandArgs.push(`-metadata:s:a:${audioStreamsId} title="7.1"`);
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} detected as 8 channel with no title, tagging. \n`;
                }
                if (currentStream.channels === 6) {
                    audioFFmpegCommandArgs.push(`-metadata:s:a:${audioStreamsId} title="5.1"`);
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} detected as 6 channel with no title, tagging. \n`;
                }
                if (currentStream.channels === 2) {
                    audioFFmpegCommandArgs.push(`-metadata:s:a:${audioStreamsId} title="2.0"`);
                    response.infoLog += `☒Audio stream 0:a:${audioStreamsId} detected as 2 channel with no title, tagging. \n`;
                }
            }
        });

        return [response, audioFFmpegCommandArgs.join(" ")];
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

    const newFileTitle = `${currentMediaTitle.replace("[Organized]","")} [Organized]`;
    let ffmpegCommandArgs = [
        `, -metadata title=\"${newFileTitle}\" -map 0:v`
    ];

    response.container = getTargetContainerType(inputs, response);



    ffmpegCommandArgs.push("-c copy -max_muxing_queue_size 9999");

    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
