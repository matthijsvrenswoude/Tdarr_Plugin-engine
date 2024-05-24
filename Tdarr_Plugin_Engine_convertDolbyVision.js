


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

    const writeUnsupportedDV = (data) => fs.writeFileSync(`${currentMediaFileDirectory}/unsupported.DV`, JSON.stringify(data));

    let currentMediaTitle = file?.meta?.Title?.toString() ?? file?.meta?.FileName ?? "";
    currentMediaTitle = cleanMediaTitle(currentMediaTitle);

    function getFileDolbyVisionData(fileFFProbeData){
        const allVideoStreams = fileFFProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
        let dolbyVisionStreams = [];
        allVideoStreams.forEach((currentStream, videoStreamsId) => {
            if (currentStream.side_data_list && Array.isArray(currentStream.side_data_list)){
                currentStream.side_data_list.forEach(sideData => {
                    const dolbyVisionProfile = sideData?.dv_profile;
                    const dolbyVisionLevel = sideData?.dv_level;
                    if (dolbyVisionProfile && dolbyVisionLevel){
                        if (dolbyVisionProfile == 5 || dolbyVisionProfile == 8 || dolbyVisionProfile == 7){
                            dolbyVisionStreams.push([videoStreamsId,currentStream,dolbyVisionProfile]);
                        } else{
                            writeUnsupportedDV(currentStream);
                        }
                    }
                });
            }
        });
        if (dolbyVisionStreams.filter(dolbyVisionStream => dolbyVisionStream[2] == 7).length > 1){
            writeUnsupportedDV("Error: Dolby vision - Profile 7 multi layer");
            dolbyVisionStreams = dolbyVisionStreams.filter(dolbyVisionStream => dolbyVisionStream[2] !== 7);
        }
        return dolbyVisionStreams;
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function getAudioTrackTitle(codec,channelLayout,language){
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

    function reworkAudioStreams(inputs, response, currentMediaFileName){
        const allAudioStreams = file.ffProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "audio");

        const codecQualityOrder = [
            "truehd",
            "dts:DTS-HD MA",
            "eac3",
            "dts:DTS-HD",
            "dts:DTS",
            "opus",
            "ac3",
            "aac:LC"
        ];

        //Codec, Max bitrate, max channels
        const mp4CompatibleCodecs = [
            ["truehd",18000000,32],
            ["eac3",1664000,8],
            ["ac3",640000,6],
            ["aac:LC",256000,2],
        ];

        //Codec, Minimum channels, File extension
        const extractCodecs = [
            ["dts:DTS-HD MA",6,"dts"]
        ];

        //Codec, Minimum bitrate, Minimum channels
        const passTroughCodecs = [
            ["truehd",0,0],
            ["eac3",1024000,6],
            ["opus",0,6]
        ];

        //Codec, target bitrate, target channels
        const targetCodecs = [
            ["ac3",640000,6],
            ["aac:LC",256000,2]
        ];

        let availableAudioStreams = [];
        allAudioStreams.forEach((currentStream, audioStreamsId) => {
            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamProfile = currentStream?.profile ?? "";
            const currentStreamChannels = currentStream?.channels;
            const currentStreamChannelLayout = currentStream?.channel_layout;
            const currentStreamBitRate = currentStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
            const currentStreamLanguage = currentStream?.tags?.language ?? "und";
            let  currentStreamCodecTag = currentStreamCodec;
            if (currentStreamProfile){
                currentStreamCodecTag = `${currentStreamCodecTag}:${currentStreamProfile}`;
            }
            availableAudioStreams.push([
                currentStreamCodecTag,
                currentStreamChannels,
                currentStreamChannelLayout,
                currentStreamBitRate,
                currentStreamLanguage,
                audioStreamsId,
                0,
            ])
        });

        availableAudioStreams.sort((a, b) => {
            let indexA = codecQualityOrder.indexOf(a[0]);
            let indexB = codecQualityOrder.indexOf(b[0]);
            if (indexA === -1) indexA = codecQualityOrder.length;
            if (indexB === -1) indexB = codecQualityOrder.length;

            if (indexA === indexB) {
                if (a[1] === b[1]) {
                    return b[2] - a[2];
                }
                return b[1] - a[1];
            }
            return indexA - indexB;
        })

        const bestSourceAudio = availableAudioStreams[0];
        let defaultAudioSet = false;
        let audioFFmpegExportCommandArgs = [];
        let audioFFmpegMappingCommandArgs = [];
        let audioFFmpegSettingsCommandArgs = [];
        let toKeepAudioCodecDetails = passTroughCodecs.map(passTroughCodec => [...passTroughCodec,"passTrough"]).concat(
            targetCodecs.map(targetCodec => [...targetCodec,"target"])
        );

        availableAudioStreams = availableAudioStreams.map((availableAudioStream, mappedAudioStreamId) => {
            const currentStreamCodecTag = availableAudioStream[0];
            const currentStreamChannels = availableAudioStream[1];
            const currentStreamBitRate = availableAudioStream[2];
            const audioStreamsId = availableAudioStream[5];

            let keepAudioStream = true;
            const currentToKeepAudioCodecDetails = toKeepAudioCodecDetails.find(toKeepAudioCodecDetail => toKeepAudioCodecDetail[0] === currentStreamCodecTag);
            const currentCompatibleCodecDetails = mp4CompatibleCodecs.find(compatibleCodec => compatibleCodec[0] === currentStreamCodecTag);
            if (currentToKeepAudioCodecDetails && currentCompatibleCodecDetails){
                if (currentStreamChannels < currentToKeepAudioCodecDetails[1]) keepAudioStream = false;
                if (currentStreamBitRate < currentToKeepAudioCodecDetails[2]) keepAudioStream = false;
                if (currentStreamBitRate > currentCompatibleCodecDetails[1]) keepAudioStream = false;
                if (currentStreamChannels > currentCompatibleCodecDetails[2]) keepAudioStream = false;
            } else{
                keepAudioStream = false;
            }

            if (!defaultAudioSet && keepAudioStream){
                audioFFmpegMappingCommandArgs.push(`-map 0:a:${audioStreamsId}`);
                audioFFmpegSettingsCommandArgs.push(`-disposition:a:${mappedAudioStreamId} default`)
                defaultAudioSet = true;
            } else{
                audioFFmpegMappingCommandArgs.push(`-map ${keepAudioStream ? "" : "-"}0:a:${audioStreamsId}`);
                if (keepAudioStream){
                    audioFFmpegSettingsCommandArgs.push(`-disposition:a:${mappedAudioStreamId} 0`);
                }
            }

            availableAudioStream[6] = mappedAudioStreamId;
            availableAudioStream.push(keepAudioStream);
            return availableAudioStream;
        });

        let currentMappedStreamsCount = availableAudioStreams.length;
        const bestAudioStreamChannels = bestSourceAudio[1];
        const bestAudioStreamChannelLayout = bestSourceAudio[2];
        const bestAudioStreamBitrate = bestSourceAudio[3];
        const bestAudioStreamId = bestSourceAudio[4];
        targetCodecs.forEach((targetCodec) => {
            const doesCodecAlreadyExists = availableAudioStreams.find(availableAudioStream => availableAudioStream[0] === targetCodec[0] && availableAudioStream[7] === true);
            if (!doesCodecAlreadyExists){
                const newAudioStreamCodec = targetCodec[0];
                const newAudioStreamBitrate = targetCodec[1];
                let newAudioStreamChannels = targetCodec[2];
                const newAudioStreamType = targetCodec[3];

                if (bestAudioStreamBitrate > newAudioStreamBitrate){
                    if (bestAudioStreamChannels < newAudioStreamChannels){
                        newAudioStreamChannels = bestAudioStreamChannels;
                    }

                    const formattedNewAudioStreamBitrate = newAudioStreamBitrate > 10000 ? `${newAudioStreamBitrate / 1000}k` : newAudioStreamBitrate;
                    const audioStreamTitle = getAudioTrackTitle(newAudioStreamCodec,bestAudioStreamChannelLayout,bestAudioStreamChannelLayout);
                    if (newAudioStreamType === "target"){
                        audioFFmpegMappingCommandArgs.push(`-map 0:a:${bestAudioStreamId}`);
                        audioFFmpegSettingsCommandArgs.push(`-metadata:s:a:${currentMappedStreamsCount} title="${audioStreamTitle}" -c:a:${currentMappedStreamsCount} ${newAudioStreamCodec} -b:a:${currentMappedStreamsCount} ${formattedNewAudioStreamBitrate} -ac:a:${currentMappedStreamsCount} ${newAudioStreamChannels}`);
                    } else{
                        audioFFmpegMappingCommandArgs.push(`-map 0:a:${bestAudioStreamId}`);
                        audioFFmpegSettingsCommandArgs.push(`-metadata:s:a:${currentMappedStreamsCount} title="${audioStreamTitle}" -c:a:${currentMappedStreamsCount} copy`);
                    }
                    currentMappedStreamsCount++;
                }
            }
        });


        let extractedFiles = []
        extractCodecs.forEach((extractCodec) => {
            const extractCodecTag = extractCodec[0];
            const extractCodecMinimumChannels = extractCodec[1];
            const extractCodecFileExtension = extractCodec[2];
            availableAudioStreams.map(availableAudioStream => {
                const currentStreamCodecTag = availableAudioStream[0];
                const currentStreamChannels = availableAudioStream[1];
                const currentStreamLanguage = availableAudioStream[4].substring(0, 2);
                if (availableAudioStream[7] === false && extractCodecTag === currentStreamCodecTag && extractCodecMinimumChannels <= currentStreamChannels){
                    const createNewUniqueFileName = (number) => `${currentMediaFileName}.${currentStreamLanguage}${number > 0 ? `.${number}` : ""}.${extractCodecFileExtension}`;
                    let uniqueFileNameCounter = 0;
                    let newFileName = createNewUniqueFileName(uniqueFileNameCounter);
                    while (extractedFiles.includes(newFileName)) {
                        newFileName = createNewUniqueFileName(uniqueFileNameCounter)
                    }
                    audioFFmpegExportCommandArgs.push(`-map_metadata 0:s:a:0 -map 0:a:0 -c copy -strict unofficial "${currentMediaFileName}.${currentStreamLanguage}.${extractCodecFileExtension}"`);
                    extractedFiles.push(newFileName);
                }
            })
        });
        return [response, [audioFFmpegExportCommandArgs.join(" "), audioFFmpegMappingCommandArgs.join(" "), audioFFmpegSettingsCommandArgs.join(" ")]];
    }

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file, response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const isCleanedCheckResponse = exitIfFileIsNotProcessable(file, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const dolbyVisionStreams = getFileDolbyVisionData(file.ffProbeData);
    if (dolbyVisionStreams.length === 0) return response;



    let ffmpegCommandArgs = [
        `,`
    ];

    const reworkedAudioResults = reworkAudioStreams(inputs, response, currentMediaFileName);
    response = reworkedAudioResults[0];
    ffmpegCommandArgs.push(reworkedAudioResults[1][0]);

    ffmpegCommandArgs.push(`-map 0:v ${reworkedAudioResults[1][1]} -map 0:s`);

    ffmpegCommandArgs.push(reworkedAudioResults[1][2]);

    ffmpegCommandArgs.push(`-metadata title=\"${currentMediaTitle}\" -c:v copy -c:s mov_text -strict unofficial`);

    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;

