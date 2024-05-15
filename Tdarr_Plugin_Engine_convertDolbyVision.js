


const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_convertDolbyVision",
        Stage: "Pre-processing",
        Name: "WIP",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "pre-processing,ffmpeg,configurable",
        Inputs: [
        ],
    };
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    const fs = require('fs')
    inputs = lib.loadDefaultValues(inputs, details);

    let response = {
        processFile: false,
        preset: "",
        container: `.mp4`,
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

    function exitIfFileIsNotProcessable(file,response){
        if (file.container  !== 'mkv') {
            response.infoLog += '☒ File is not processable \n';
            response.processFile = false;
            return response;
        }
        return false;
    }

    function cleanMediaTitle(currentMediaTitle){
        return currentMediaTitle.replaceAll('"',"")
            .replace(".mkv","")
            .replace(".mp4","")
            .replaceAll(".", " ")
            .replaceAll(",","");
    }


    function getFileDetails(file){
        const fileParts = file.replaceAll("/","\\").split("\\");
        const fileName = fileParts.pop();
        const filePath = fileParts.join("\\") + "\\";
        return [filePath, fileName];
    }

    const currentMediaFilePath = file.file;

    const currentMediaFileDetails = getFileDetails(currentMediaFilePath);
    const currentMediaFileDirectory = currentMediaFileDetails[0];
    const currentMediaFileName = currentMediaFileDetails[1];



    let currentMediaTitle = file?.meta?.Title?.toString() ?? file?.meta?.FileName ?? "";
    currentMediaTitle = cleanMediaTitle(currentMediaTitle);

    function getFileDolbyVisionData(fileFFProbeData){
        const allVideoStreams = fileFFProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
        const dolbyVisionStreams = [];
        allVideoStreams.forEach((currentStream, videoStreamsId) => {
            const dolbyVisionProfile = currentStream.side_data_list[0]?.dv_profile;
            const dolbyVisionLevel = currentStream.side_data_list[0]?.dv_level;
            if (dolbyVisionProfile && dolbyVisionLevel){
                if (dolbyVisionProfile == 5 || dolbyVisionProfile == 8){
                    dolbyVisionStreams.push([videoStreamsId,currentStream,dolbyVisionProfile]);
                } else{
                    fs.writeFileSync(`${currentMediaFileDirectory}/unsupported.DV`, JSON.stringify(currentStream));
                }
            }
        });
        return dolbyVisionStreams;
    }


    function cleanAudioStreams(inputs, response){
        const allAudioStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "audio");
        const toKeepAudioCodec = ["truehd", "eac3", "ac3"];
        const audioFFmpegCommandArgs = [];

        allAudioStreams.forEach((currentStream, audioStreamsId) => {
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            if (!toKeepAudioCodec.includes(currentStreamCodec)) {
                audioFFmpegCommandArgs.push(`-map -0:a:${audioStreamsId}`);
                response.infoLog += `☒ Audio stream 0:a:${audioStreamsId} detected as being ${currentStreamCodec}, removing. \n`;
            }
        });

        return [response, audioFFmpegCommandArgs.join(" ")];
    }

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file, response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const isCleanedCheckResponse = exitIfFileIsNotProcessable(file, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const dolbyVisionStreams = getFileDolbyVisionData(file.ffProbeData);
    if (dolbyVisionStreams.length === 0) return response;



    let ffmpegCommandArgs = [
        `, -metadata title=\"${currentMediaTitle}\" -c copy -c:s mov_text -strict unofficial -map 0`
    ];

    const cleanAudioResults = cleanAudioStreams(inputs, response);
    response = cleanAudioResults[0];
    ffmpegCommandArgs.push(cleanAudioResults[1]);



    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;

