const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_convertDolbyVision",
        Stage: "Pre-processing",
        Name: "Convert Dolby Vision MKVs to MP4 for playback on LG TVs",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "plugin-state-beta,post-processing,ffmpeg,MP4Box,MkvExtract,DoviTool",
        Inputs: [
        ],
    };
};

const plugin = (file, librarySettings, inputs, otherArguments) => {
    const lib = require('../methods/lib')();
    const { execSync } = require('child_process');
    inputs = lib.loadDefaultValues(inputs, details);

    const ffMpegPath = otherArguments.ffmpegPath;
    const mkvExtractPath = otherArguments.mkvpropeditPath?.replace("mkvpropedit","mkvextract");
    const doviToolPath = "C:/Tdarr/DoviTool/dovi_tool.exe";
    const mp4BoxPath = "C:/Program Files/GPAC/mp4box.exe";

    let response = {
        processFile: false,
        preset: "",
        container: `.mp4`,
        handBrakeMode: false,
        FFmpegMode: false,
        reQueueAfter: false,
        infoLog: "",
        mkvExtractLog: "",
        conversionLog: ""
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

    function cleanMediaTitle(currentMediaTitle){
        return currentMediaTitle
            .replaceAll('"',"")
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

    const cacheFileDirectory = getFileDetails(otherArguments.cacheFilePath)[0].replaceAll("\\","/");
    const currentMediaFilePath = otherArguments.originalLibraryFile.file;

    const currentMediaFileDetails = getFileDetails(currentMediaFilePath);
    const currentMediaFileDirectory = currentMediaFileDetails[0];
    const currentMediaFileName = currentMediaFileDetails[1];

    let currentMediaTitle = getMediaTitle(file);
    currentMediaTitle = cleanMediaTitle(currentMediaTitle);

    function convertDualLayerDolbyVision(){
        const reEncodedDolbyVisionFileName = "reencoded-dolby-vision-layer.mp4";
        const dolbyVisionExtractionFile = `${cacheFileDirectory}raw-dolby-vision.hevc`;
        const extractionCommand = `"${ffMpegPath}" -i "${file.file}" -dn -c:v copy -bsf hevc_mp4toannexb -f hevc - | "${doviToolPath}" -m 2 convert --discard - -o "${dolbyVisionExtractionFile}"`;
        const reEncodeCommand = `"${mp4BoxPath}" -add "${dolbyVisionExtractionFile}":dvp=8.1:xps_inband:hdr=none -brand mp42isom -ab dby1 -no-iod -enable 1 "${cacheFileDirectory}${reEncodedDolbyVisionFileName}" -tmp "${cacheFileDirectory}"`;
        const addDividerLine = () => {
            response.conversionLog += "-------------------";
        };
        addDividerLine();
        response.conversionLog += `Initiating extraction with command: ${extractionCommand}`;
        addDividerLine();
        response.conversionLog += execSync(extractionCommand);
        addDividerLine();
        response.conversionLog += `Initiating re-encoding with command: ${reEncodeCommand}`;
        addDividerLine();
        response.conversionLog += execSync(reEncodeCommand);
        addDividerLine();
        return reEncodedDolbyVisionFileName;
    }

    function getFileDolbyVisionData(fileFFProbeData, response){
        const allVideoStreams = fileFFProbeData.streams.filter(stream => stream.codec_type.toLowerCase() === "video");
        let dolbyVisionStreams = [];
        let unsupportedDolbyVisionDetected = false;
        allVideoStreams.forEach((currentStream, videoStreamsId) => {
            if (currentStream.side_data_list && Array.isArray(currentStream.side_data_list)){
                currentStream.side_data_list.forEach(sideData => {
                    const dolbyVisionProfile = sideData?.dv_profile;
                    if (dolbyVisionProfile){
                        if (dolbyVisionProfile === 5 || dolbyVisionProfile === 8 || dolbyVisionProfile === 7){
                            response.infoLog += `Found: Dolby vision stream profile ${dolbyVisionProfile} \n`;
                            dolbyVisionStreams.push([videoStreamsId,currentStream,dolbyVisionProfile]);
                        } else{
                            unsupportedDolbyVisionDetected = true;
                        }
                    }
                });
            }
        });
        if (unsupportedDolbyVisionDetected){
            response.infoLog += `Unsupported dolby vision profile found: ${dolbyVisionStreams[0][2]}, Aborting.. \n`;
            dolbyVisionStreams = [];
        }
        return [dolbyVisionStreams,response];
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

    function reworkAudioStreams(inputs, response, currentMediaFileName, outputFileDirectory){
        const allStreams = file.ffProbeData.streams;

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

        // Codec, Max bitrate, max channels (Truehd according to MP4 Spec is supported, however Ffmpeg muxing to mp4 isnt stable enough)
        const mp4CompatibleCodecs = [
            ["eac3",1664000,8],
            ["ac3",640000,6],
            ["aac:LC",256000,2],
        ];

        // Codec, Minimum channels, File extension
        const extractCodecs = [
            ["dts:DTS-HD MA",6,"dts"],
            ["truehd",0,"thd"]
        ];

        // Codec, Minimum bitrate, Minimum channels
        const passTroughCodecs = [
            ["eac3",448000,6],
            ["opus",0,6]
        ];

        // Codec, target bitrate, target channels
        const targetCodecs = [
            ["ac3",640000,6],
            ["aac:LC",256000,2]
        ];

        let availableAudioStreams = [];
        let audioStreamsId = 0;
        allStreams.forEach((currentStream, globalStreamId) => {
            if (currentStream.codec_type.toLowerCase() !== "audio") return;

            const currentStreamCodec = currentStream?.codec_name?.toLowerCase() ?? "";
            const currentStreamProfile = currentStream?.profile ?? "";
            const currentStreamChannels = currentStream?.channels;
            const currentStreamChannelLayout = currentStream?.channel_layout;

            let currentStreamBitRate = currentStream?.bit_rate ? Number(currentStream?.bit_rate) :  0;
            if (!currentStreamBitRate) {
                const potentialBitRate = currentStream?.tags?.BPS;
                currentStreamBitRate = potentialBitRate ? Number(potentialBitRate) : 0;
            }

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
                globalStreamId,
                0,
            ])
            if (currentStream.codec_type.toLowerCase() === "audio"){
                audioStreamsId++;
            }
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
        let mkvExtractCommandArgs = [];
        let audioFFmpegMappingCommandArgs = [];
        let audioFFmpegSettingsCommandArgs = [];
        let toKeepAudioCodecDetails = passTroughCodecs.concat(targetCodecs);

        let mappedAudioStreamId = 0;
        availableAudioStreams = availableAudioStreams.map((availableAudioStream) => {
            const currentStreamCodecTag = availableAudioStream[0];
            const currentStreamChannels = availableAudioStream[1];
            const currentStreamChannelLayout = availableAudioStream[2];
            const currentStreamBitRate = availableAudioStream[3];
            const currentStreamLanguage = availableAudioStream[4];
            const audioStreamsId = availableAudioStream[5];

            let keepAudioStream = true;
            const currentToKeepAudioCodecDetails = toKeepAudioCodecDetails.find(toKeepAudioCodecDetail => toKeepAudioCodecDetail[0] === currentStreamCodecTag);
            const currentCompatibleCodecDetails = mp4CompatibleCodecs.find(compatibleCodec => compatibleCodec[0] === currentStreamCodecTag);
            if (currentToKeepAudioCodecDetails && currentCompatibleCodecDetails){
                if (currentStreamChannels < currentToKeepAudioCodecDetails[2]) keepAudioStream = false;
                if (currentStreamBitRate < currentToKeepAudioCodecDetails[1]) keepAudioStream = false;
                if (currentStreamBitRate > currentCompatibleCodecDetails[1]) keepAudioStream = false;
                if (currentStreamChannels > currentCompatibleCodecDetails[2]) keepAudioStream = false;
            } else{
                keepAudioStream = false;
            }

            const audioStreamTitle = getAudioTrackTitle(currentStreamCodecTag,currentStreamChannelLayout,currentStreamLanguage);
            if (!defaultAudioSet && keepAudioStream){
                audioFFmpegMappingCommandArgs.push(`-map 0:a:${audioStreamsId}`);
                audioFFmpegSettingsCommandArgs.push(`-disposition:a:${mappedAudioStreamId} default`);
                audioFFmpegSettingsCommandArgs.push(`-metadata:s:a:${mappedAudioStreamId} title="${audioStreamTitle}" -c:a:${mappedAudioStreamId} copy`);
                response.infoLog += `Copied audio stream 0:a:${audioStreamsId} as default \n`;
                defaultAudioSet = true;
            } else{
                if (keepAudioStream){
                    audioFFmpegMappingCommandArgs.push(`-map 0:a:${audioStreamsId}`);
                    audioFFmpegSettingsCommandArgs.push(`-disposition:a:${mappedAudioStreamId} 0`);
                    audioFFmpegSettingsCommandArgs.push(`-metadata:s:a:${mappedAudioStreamId} title="${audioStreamTitle}" -c:a:${mappedAudioStreamId} copy`);
                    response.infoLog += `Copied audio stream 0:a:${audioStreamsId} \n`;
                } else{
                    response.infoLog += `Discarded audio stream 0:a:${audioStreamsId} \n`;
                }
            }

            availableAudioStream[7] = mappedAudioStreamId;
            availableAudioStream.push(keepAudioStream);

            if (keepAudioStream){
                mappedAudioStreamId++;
            }
            return availableAudioStream;
        });

        let currentMappedStreamsCount = availableAudioStreams.filter(availableAudioStream => availableAudioStream[8] === true).length;
        const bestAudioStreamChannels = bestSourceAudio[1];
        const bestAudioStreamChannelLayout = bestSourceAudio[2];
        const bestAudioStreamBitrate = bestSourceAudio[3];
        const bestAudioStreamLanguage = bestSourceAudio[4];
        const bestAudioStreamId = bestSourceAudio[5];
        targetCodecs.forEach((targetCodec) => {
            const doesCodecAlreadyExists = availableAudioStreams.find(availableAudioStream => availableAudioStream[0] === targetCodec[0] && availableAudioStream[8] === true);
            if (!doesCodecAlreadyExists){
                let newAudioStreamCodec = targetCodec[0];
                const newAudioStreamBitrate = targetCodec[1];
                let newAudioStreamChannels = targetCodec[2];
                let newAudioStreamChannelLayout = bestAudioStreamChannelLayout;

                if (bestAudioStreamBitrate > newAudioStreamBitrate){
                    if (bestAudioStreamChannels < newAudioStreamChannels){
                        newAudioStreamChannels = bestAudioStreamChannels;
                        newAudioStreamChannelLayout = bestAudioStreamChannels;
                    }

                    const formattedNewAudioStreamBitrate = newAudioStreamBitrate > 10000 ? `${newAudioStreamBitrate / 1000}k` : newAudioStreamBitrate;
                    const audioStreamTitle = getAudioTrackTitle(newAudioStreamCodec,newAudioStreamChannelLayout,bestAudioStreamLanguage);
                    audioFFmpegMappingCommandArgs.push(`-map 0:a:${bestAudioStreamId}`);
                    if (newAudioStreamCodec === "aac:LC"){
                        newAudioStreamCodec = "aac";
                    }
                    audioFFmpegSettingsCommandArgs.push(`-metadata:s:a:${currentMappedStreamsCount} title="${audioStreamTitle}" -c:a:${currentMappedStreamsCount} ${newAudioStreamCodec} -b:a:${currentMappedStreamsCount} ${formattedNewAudioStreamBitrate} -ac:a:${currentMappedStreamsCount} ${newAudioStreamChannels}`);
                    response.infoLog += `Created new ${audioStreamTitle} \n`;
                    currentMappedStreamsCount++;
                }
            }
        });

        let extractedFiles = []
        extractCodecs.forEach((extractCodec) => {
            const extractCodecTag = extractCodec[0];
            const extractCodecMinimumChannels = extractCodec[1];
            const extractCodecFileExtension = extractCodec[2];
            availableAudioStreams.map((availableAudioStream) => {
                const currentStreamCodecTag = availableAudioStream[0];
                const currentStreamChannels = availableAudioStream[1];
                const currentStreamLanguage = availableAudioStream[4].substring(0, 2);
                const currentStreamGlobalStreamId = availableAudioStream[6];
                if (availableAudioStream[8] === false && extractCodecTag === currentStreamCodecTag && extractCodecMinimumChannels <= currentStreamChannels){
                    const createNewUniqueFileName = (number) => `${currentMediaFileName.replace(".mkv","")}.${currentStreamLanguage}${number > 0 ? `.${number}` : ""}.${extractCodecFileExtension}`;
                    let uniqueFileNameCounter = 0;
                    let newFileName = createNewUniqueFileName(uniqueFileNameCounter);
                    while (extractedFiles.includes(newFileName)) {
                        newFileName = createNewUniqueFileName(uniqueFileNameCounter)
                    }
                    mkvExtractCommandArgs.push(`${currentStreamGlobalStreamId}:"${outputFileDirectory}${newFileName}"`)
                    extractedFiles.push(newFileName);
                    response.infoLog += `Extracting existing audio stream ${currentStreamCodecTag} 0:a:${availableAudioStream[5]} to separate file \n`;
                }
            })
        });
        return [response, [mkvExtractCommandArgs.join(" "), audioFFmpegMappingCommandArgs.join(" "), audioFFmpegSettingsCommandArgs.join(" ")], availableAudioStreams];
    }

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file, response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const isCleanedCheckResponse = exitIfFileIsNotProcessable(file, response);
    if (isCleanedCheckResponse !== false) return isCleanedCheckResponse;

    const dolbyVisionStreamsDetails = getFileDolbyVisionData(file.ffProbeData, response);
    response = dolbyVisionStreamsDetails[1];
    const dolbyVisionStreams = dolbyVisionStreamsDetails[0];
    if (dolbyVisionStreams.length === 0){
        response.infoLog += `No Dolby Vision streams found, Aborting.. \n`;
        return response;
    }
    let reEncodedDolbyVisionVideo = "";
    if (dolbyVisionStreams.find(dolbyVisionStream => dolbyVisionStream[2] === 7)){
        response.infoLog += `Detected Dolby vision profile 7, Starting conversion process... (This may take a while)\n`;
        reEncodedDolbyVisionVideo = convertDualLayerDolbyVision();
    }

    let ffmpegCommandArgs = [`,`];
    if (reEncodedDolbyVisionVideo){
        ffmpegCommandArgs.push(`-i ${cacheFileDirectory}${reEncodedDolbyVisionVideo} -map 1:v`);
    } else{
        ffmpegCommandArgs.push("-map 0:v");
    }

    let mkvExtractCommandArgs = [
        `${mkvExtractPath} tracks "${currentMediaFileDirectory}${currentMediaFileName}"`
    ];

    const reworkedAudioResults = reworkAudioStreams(inputs, response, currentMediaFileName, currentMediaFileDirectory);
    response = reworkedAudioResults[0];
    const audioFFmpegMappingCommandArgs = reworkedAudioResults[1][1];
    const audioFFmpegSettingsCommandArgs = reworkedAudioResults[1][2];
    const audioMkvExtractCommandArgs = reworkedAudioResults[1][0];

    ffmpegCommandArgs.push(`${audioFFmpegMappingCommandArgs} -map 0:s?`);
    ffmpegCommandArgs.push(audioFFmpegSettingsCommandArgs);
    ffmpegCommandArgs.push(`-metadata title=\"${currentMediaTitle}\" -c:v copy -c:s mov_text`);
    ffmpegCommandArgs.push("-strict unofficial");

    if (audioMkvExtractCommandArgs){
        mkvExtractCommandArgs.push(reworkedAudioResults[1][0]);
    }
    if (mkvExtractCommandArgs.length > 1){
        let mkvExtractOutput = execSync(mkvExtractCommandArgs.join(" "));
        response.mkvExtractLog += "-------------------";
        response.mkvExtractLog += mkvExtractOutput;
        response.mkvExtractLog += "-------------------";
    }

    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;

