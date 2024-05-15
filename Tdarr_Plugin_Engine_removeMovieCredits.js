
/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_removeMovieCredits",
        Stage: "Post-processing",
        Name: "Remove movie credits from video file",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "post-processing,audio only,ffmpeg,configurable",
        Inputs: [
        ],
    };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    const fs = require('fs');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
    inputs = lib.loadDefaultValues(inputs, details);

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
            response.infoLog += "☒ File has errors, Skipping..\n"  + `${mediaInfoRead} ${ffProbeMetaError} ${JSON.stringify(ffProbeErrors)}`;
            response.processFile = false;
            response.reQueueAfter = true;
            return response;
        }
        return false;
    }

    function exitIfFileIsAlreadyProcessed(mediaTitle, response){
        if (mediaTitle.includes("[End]")) {
            response.infoLog += '☒ File is already modified, Skipping..\n';
            response.processFile = false;
            return response;
        }
        return false;
    }

    function exitIfFileIsNotAVideo(file,response){
        if (file.container !== 'mkv' && file.container !== 'mp4') {
            response.infoLog += '☒ File is not video \n';
            response.processFile = false;
            return response;
        }
        return false;
    }

    function getFileDetails(file){
        const fileParts = file.replaceAll("/","\\").split("\\");
        const fileName = fileParts.pop();
        const filePath = fileParts.join("\\") + "\\";
        return [filePath, fileName];
    }

    function cleanMediaTitle(currentMediaTitle){
        return currentMediaTitle.replaceAll('"',"")
            .replace(".mkv","")
            .replace(".mp4","")
            .replaceAll(".", " ")
            .replaceAll(",","");
    }

    function keepNumbersAndColons(inputString) {
        const cleanedString = inputString.replace(/[^0-9:]/g, '');
        return cleanedString;
    }

    function formatNumber(number){
        return number > 9 ? number : `0${number}`;
    }

    function parseTimestamp(endFileTimestamp){
        const timestampParts = endFileTimestamp.split(":");
        let formattedTimestamp;
        if (timestampParts.length >= 3){
            formattedTimestamp = `${timestampParts[0]}:${formatNumber(Number(timestampParts[1]))}:${formatNumber(Number(timestampParts[2]))}`;
        } else{
            formattedTimestamp = `${timestampParts[0]}:${formatNumber(Number(timestampParts[1]))}`;
        }
        return formattedTimestamp;
    }

    function processEndFile(directoryPath, filename, response){
        const fileNameWithoutExtension =  filename.replace(".mkv","").replace(".mp4","");
        const endFilePath = `${directoryPath}${fileNameWithoutExtension}.end`;
        if (fs.existsSync(endFilePath)){
            const endFileContent = fs.readFileSync(endFilePath, 'utf8');
            const endFileTimestamp = keepNumbersAndColons(endFileContent);

            if (!endFileTimestamp){
                response.infoLog += "☒ No timestamp details provided, skipping."
                return [false, response];
            } else{
                const formattedTimestamp = parseTimestamp(endFileTimestamp);
                response.infoLog += `☒ Timestamp found: ${formattedTimestamp}`
                fs.unlinkSync(endFilePath);
                return [formattedTimestamp, response]
            }
        } else{
            const endFileContent = ` `;
            fs.writeFileSync(endFilePath, endFileContent);
            response.infoLog += `☒ .end successfully created`;
            return [false, response];
        }
    }

    const currentMediaFilePath = file.file;
    const currentMediaFileDetails = getFileDetails(currentMediaFilePath);
    const currentMediaFileDirectory = currentMediaFileDetails[0];
    const currentMediaFileName = currentMediaFileDetails[1];

    let currentMediaTitle = file?.meta?.Title?.toString() ?? file?.meta?.FileName ?? "";
    currentMediaTitle = cleanMediaTitle(currentMediaTitle);

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file,response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const videoCheckResponse = exitIfFileIsNotAVideo(file, response);
    if (videoCheckResponse !== false) return videoCheckResponse;

    const isCleanedCheckResponse = exitIfFileIsAlreadyProcessed(currentMediaTitle, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const processEndFileResults = processEndFile(currentMediaFileDirectory,currentMediaFileName, response);
    const movieCreditsTimestamp = processEndFileResults[0];
    if (movieCreditsTimestamp === false) return processEndFileResults[1];

    const newFileTitle = `${currentMediaTitle.replace("[End]","").trim()} [End]`;

    let ffmpegCommandArgs = [
        `, -metadata title=\"${newFileTitle}\" -map 0`
    ];

    const allVideoStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
    allVideoStreams.forEach((currentStream, videoStreamsId) => {
        const language = currentStream?.tags?.language ?? "eng";
        ffmpegCommandArgs.push(`-metadata:s:v:${videoStreamsId} DURATION-${language}=${movieCreditsTimestamp}.000000000`)
    });

    const allAudioStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "audio");
    allAudioStreams.forEach((currentStream, audioStreamsId) => {
        const language = currentStream?.tags?.language ?? "eng";
        ffmpegCommandArgs.push(`-metadata:s:a:${audioStreamsId} DURATION-${language}=${movieCreditsTimestamp}.000000000`)
    });


    ffmpegCommandArgs.push(`-t ${movieCreditsTimestamp}`);
    ffmpegCommandArgs.push("-c copy -max_muxing_queue_size 9999");


    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
