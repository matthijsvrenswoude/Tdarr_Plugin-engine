
/* eslint-disable */
const details = () => {
    return {
        id: "Tdarr_Plugin_Engine_removeImportedDownloads",
        Stage: "Post-processing",
        Name: "Remove media from downloads folder after importing",
        Type: "any",
        Operation: "Transcode",
        Version: "1.00",
        Tags: "plugin-state-stable,pre-processing,audio only,ffmpeg,configurable",
        Inputs: [
            {
                name: 'blocked_video_tags',
                type: 'string',
                defaultValue: 'sample,trailer,screens,featurettes',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Any identifier for a video file that is not a movie`,
            },
            {
                name: 'used_drive_letters',
                type: 'string',
                defaultValue: 'C:,D:',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Driveletters where Qbittorent downloads folder could be stored`,
            },
            {
                name: 'qbittorent_completed_downloads_path',
                type: 'string',
                defaultValue: '/Qbittorrent/media/',
                inputUI: {
                    type: 'text',
                },
                tooltip: `Path minus driveletter where completed downloads are stored`,
            }
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

    const videoExtensions = [
        'mkv', 'mp4', 'webm', '3gp', '3g2', 'asf', 'wmv', 'avi', 'divx', 'evo',
        'f4v', 'flv', 'mkv', 'mk3d', 'mpg', 'mpeg',
        'm2p', 'ps', 'ts', 'm2ts', 'mxf', 'ogg', 'mov', 'qt',
        'rmvb', 'vob',
    ];

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

    function getFileName(filePath){
        return filePath.split("\\").pop()
    }

    function filterFiles(files){
        return files.filter(file => videoExtensions.includes(file.split(".").pop()))
    }

    function getFileDetails(file){
        const fileParts = file.replaceAll("/","\\").split("\\");
        const fileName = fileParts.pop();
        const filePath = fileParts.join("\\") + "\\";
        return [filePath, fileName];
    }

    function getExistingPaths(driverLetters,path){
        const activeDownloadFolders = driverLetters.map(driveLetter => `${driveLetter}${path}`).filter(potentialExistingPath => fs.existsSync(potentialExistingPath));
        return activeDownloadFolders;
    }

    function getFileStorageDetails(files, returnSeparateFileParts = false){
        return files.map(file => {
            const fileStats = fs.statSync(file);
            let fileDetails = file;
            if (returnSeparateFileParts){
                fileDetails = getFileDetails(file);
            }
            return [fileDetails,fileStats.size,fileStats.blocks];
        })
    }

    const isFileErroredResponse = ifFileErrorExecuteReenqueue(file,response);
    if (isFileErroredResponse !== false) return isFileErroredResponse;

    const blockedVideoFileTags = inputs.blocked_video_tags.split(",") ?? [];
    const usedDriveLetters = inputs.used_drive_letters.split(",") ?? [];
    const completedDownloadsPath = inputs.qbittorent_completed_downloads_path;

    const currentMediaFilePath = file.file;
    const currentMediaFileTitle = file?.meta?.Title?.toString() ?? '';
    const currentMediaFileDetails = [getFileDetails(currentMediaFilePath), file.statSync.size, file.statSync.blocks];

    const existingDownloadFolders = getExistingPaths(usedDriveLetters,completedDownloadsPath);

    const videosInDownloadFolders = new Map(existingDownloadFolders.map(downloadFolder => {
        const allFiles = fetchAllFilesFromGivenFolder(downloadFolder);
        const allVideoFiles = filterFiles(allFiles);
        let allVideoFilesData = getFileStorageDetails(allVideoFiles, false);
        allVideoFilesData = allVideoFilesData.filter(videoFile => {
            const videoFileName = getFileName(videoFile[0]).toLowerCase();
            const isFileBlocked = (blockedVideoFileTags.some(blockedVideoFileTag => videoFileName.includes(blockedVideoFileTag)));
            return !isFileBlocked;
        });

        let filesTree = new Map();
        allVideoFilesData.forEach(currentVideoFileData => {
            const currentVideoFileParts = currentVideoFileData[0].split("\\");
            const currentVideoFileName = currentVideoFileParts.pop();
            currentVideoFileData[0] = currentVideoFileName;
            const currentVideoFilePath = currentVideoFileParts.join("\\") + "\\";

            if (filesTree.has(currentVideoFilePath)) {
                let fileTreeExistingFolder = filesTree.get(currentVideoFilePath);
                fileTreeExistingFolder.push(currentVideoFileData);
                filesTree.set(currentVideoFilePath, fileTreeExistingFolder);
            } else {
                filesTree.set(currentVideoFilePath, [currentVideoFileData]);
            }
        });
        return [...filesTree.entries()].sort((a,b) => b[0].length - a[0].length);
    }).flat());

    videosInDownloadFolders.forEach((folderContents, folderPath) => {
        const leftOverFilesInFolder = folderContents.filter(video => {
            const fileName = video[0];
            const fileSize = video[1];
            const fileBlocks = video[2]

            if (currentMediaFileDetails[0][1] === fileName){
                const isFileAlreadyCleaned = currentMediaFileTitle.includes("[Organized]") || currentMediaFileTitle.includes("[Transcoded]");
                const doesFileSizeCheckout = currentMediaFileDetails[1] === fileSize && currentMediaFileDetails[2] === fileBlocks;
                const isFileCopiedCompletely = doesFileSizeCheckout || isFileAlreadyCleaned;

                response.infoLog += `☒ Imported file: ${fileName} found, ${isFileCopiedCompletely ? "deleting from downloads folder" : "However not copied completely, Aborting"} \n`;
                if (isFileCopiedCompletely){
                    fs.unlinkSync(`${folderPath}${fileName}`);
                    return false;
                }
            }
            return true;
        });
        if (leftOverFilesInFolder.length === 0){
            fs.rmSync(folderPath, { recursive: true, force: true });
            response.infoLog += `☒ Folder contents imported, deleting Folder: ${folderPath} \n`;
        }
    })
    return response;
};

module.exports.details = details;
module.exports.plugin = plugin;
