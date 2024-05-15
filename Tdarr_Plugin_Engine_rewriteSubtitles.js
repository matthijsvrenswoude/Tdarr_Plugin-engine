
/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_rewriteSubtitles",
        Stage: "Post-processing",
        Name: "WIP",
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
    const path = require("path");

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

    const fetchAllFilesFromGivenFolder = (fullPath) => {
        let files = [];
        fs.readdirSync(fullPath).forEach(file => {
            const absolutePath = path.join(fullPath, file);
            if (fs.statSync(absolutePath).isDirectory()){
                const filesFromNestedFolder = fetchAllFilesFromGivenFolder(absolutePath);
                filesFromNestedFolder.forEach(file => {
                    files.push(file);
                })
            } else return files.push(absolutePath);
        }); return files
    }

    function filterOnlySubtitleFiles(files){
        return files.filter(file => file[1].endsWith(".srt"));
    }

    function rewriteSubtitleContent(filePath){
        fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).forEach(function(line){
            console.log(line);
        })
    }

    function ProcessSubtitles(currentMediaFileDirectory,currentMediaFileName, response){
        const subtitleImportFolderName = "backup";
        const allFiles = fetchAllFilesFromGivenFolder(currentMediaFileDirectory).map(file => getFileDetails(file));
        const allSubtitleFiles = filterOnlySubtitleFiles(allFiles);

        const allSubtitleFileData = allSubtitleFiles.map(file => {
            const fileName = file[0];
            const fileNameSections = fileName.toLowerCase().split(".");
            const shouldAddFile = fileName.endsWith(".add.srt");
            let languageCode = fileNameSections.reverse().slice(0,2).find(fileNameSection => fileNameSection.length === 2);
            let hasDefaultLanguageBeenSet = false;
            if (!languageCode){
                languageCode = "en";
                hasDefaultLanguageBeenSet = true;
            }

            return [file,languageCode,shouldAddFile, hasDefaultLanguageBeenSet]
        });

        console.log(allSubtitleFileData);

        const newSubtitleFolder = `${currentMediaFileDirectory}/${subtitleImportFolderName}/`;
        if (allSubtitleFileData && !fs.existsSync(newSubtitleFolder)){
            fs.mkdirSync(path.join(currentMediaFileDirectory,subtitleImportFolderName));
        }

        let subtitleFFmpegCommandArgs = [];
        let delayedSubtitleFFmpegCommandArgs = [];
        allSubtitleFileData.forEach(selectedSubtitle => {
            const selectedSubtitleFileDirectory = selectedSubtitle[0][0];
            const selectedSubtitleFileName = selectedSubtitle[0][1];
            const selectedSubtitleBaseFileName = selectedSubtitleFileName.replace(".add.srt","");
            const subtitleLanguageCode = selectedSubtitle[1];
            const shouldAddSubtitle = selectedSubtitle[2];
            const hasDefaultLanguageBeenSet = selectedSubtitle[3];



            rewriteSubtitleContent(`${selectedSubtitleFileDirectory}/${selectedSubtitleFileName}`);





            let newSelectedSubtitleName;
            if (hasDefaultLanguageBeenSet){
                newSelectedSubtitleName = `${selectedSubtitleBaseFileName}.en.srt`;
            } else{
                newSelectedSubtitleName = `${selectedSubtitleBaseFileName}.${subtitleLanguageCode}.srt`;
            }


            if (shouldAddSubtitle){
                fs.renameSync(`${selectedSubtitleFileDirectory}${selectedSubtitleFileName}`,`${newSubtitleFolder}${newSelectedSubtitleName}`)
                subtitleFFmpegCommandArgs.push(`-i ${subtitleImportFolderName}/${newSelectedSubtitleName}`);
                delayedSubtitleFFmpegCommandArgs.push(``);
            }
        })
        //create backup folder
        //move to backup folder


        //copy all subs with OG prefix before filter



        //filter file
        //including {\an8}
        //and empty music notes


        //add [Manual] title tag

        //in file replacement except forced subtitles
    }


    const currentMediaFilePath = file.file;
    const currentMediaFileDetails = getFileDetails(currentMediaFilePath);
    const currentMediaFileDirectory = currentMediaFileDetails[0];
    const currentMediaFileName = currentMediaFileDetails[1];

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file,response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const videoCheckResponse = exitIfFileIsNotAVideo(file, response);
    if (videoCheckResponse !== false) return videoCheckResponse;

    const processSubtitleResults = ProcessSubtitles(currentMediaFileDirectory,currentMediaFileName, response);



    return response;
    // if (movieCreditsTimestamp === false) return processSubtitleResults[1];



    let ffmpegCommandArgs = [
        `,`
    ];


    ffmpegCommandArgs.push("-map 0 -c copy -max_muxing_queue_size 9999");


    response.processFile = true;
    response.preset = ffmpegCommandArgs.join(" ");
    response.FFmpegMode = true;
    response.reQueueAfter = true;
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
