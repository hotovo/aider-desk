import fetch from 'node-fetch';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, renameSync, rmdirSync } from 'fs';
import { join } from 'path';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { extract } from "tar";
import AdmZip from 'adm-zip';

const streamPipeline = promisify(pipeline);

const UV_VERSION = '0.7.22';
const BASE_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;
const RESOURCES_DIR = './resources';

const TARGET_PLATFORMS = [
    { platform: 'linux', arch: 'x64', filename: 'uv-x86_64-unknown-linux-gnu.tar.gz', extractSubdir: 'linux-x64', uvExeName: 'uv' },
    { platform: 'linux', arch: 'arm64', filename: 'uv-aarch64-unknown-linux-gnu.tar.gz', extractSubdir: 'linux-arm64', uvExeName: 'uv' },
    { platform: 'darwin', arch: 'x64', filename: 'uv-x86_64-apple-darwin.tar.gz', extractSubdir: 'macos-x64', uvExeName: 'uv' },
    { platform: 'darwin', arch: 'arm64', filename: 'uv-aarch64-apple-darwin.tar.gz', extractSubdir: 'macos-arm64', uvExeName: 'uv' },
    { platform: 'win32', arch: 'x64', filename: 'uv-x86_64-pc-windows-msvc.zip', extractSubdir: 'win-x64', uvExeName: 'uv.exe' },
    { platform: 'win32', arch: 'arm64', filename: 'uv-aarch64-pc-windows-msvc.zip', extractSubdir: 'win-arm64', uvExeName: 'uv.exe' }
];

async function downloadAndExtractUVForPlatform(target) {
    const { platform, arch, filename, extractSubdir, uvExeName } = target;
    const url = `${BASE_URL}/${filename}`;
    const extractPath = join(RESOURCES_DIR, extractSubdir);
    const uvDestinationPath = join(extractPath, uvExeName);

    // Ensure the specific platform directory exists
    if (!existsSync(extractPath)) {
        mkdirSync(extractPath, { recursive: true });
    }

    // Check if uv already exists for this platform
    if (existsSync(uvDestinationPath)) {
        console.log(`uv executable for ${platform}-${arch} already exists at ${uvDestinationPath}. Skipping download.`);
        return;
    }

    const tempFilePath = join(RESOURCES_DIR, filename);
    console.log(`Downloading uv for ${platform}-${arch} from ${url} to ${tempFilePath}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        await streamPipeline(response.body, createWriteStream(tempFilePath));

        console.log(`Downloaded ${filename}. Extracting...`);

        if (filename.endsWith('.tar.gz')) {
            await extract({
                cwd: extractPath,
                file: tempFilePath,
                strip: 0 // Do not strip any components from the file path initially
            });
            // The uv executable might be inside a directory like uv-x86_64-unknown-linux-gnu/uv
            const extractedDirName = filename.replace('.tar.gz', '');
            const uvInExtractedDir = join(extractPath, extractedDirName, uvExeName);
            const uvAtTopLevel = join(extractPath, uvExeName);

            if (existsSync(uvInExtractedDir)) {
                 if (existsSync(uvDestinationPath)) {
                    unlinkSync(uvDestinationPath);
                }
                renameSync(uvInExtractedDir, uvDestinationPath);
                console.log(`Moved ${uvExeName} to ${uvDestinationPath}`);
                // Clean up the extracted directory
                rmdirSync(join(extractPath, extractedDirName), { recursive: true });
            } else if (existsSync(uvAtTopLevel)) {
                 // If not found in extractedDir, check the top level (for older releases or different structures)
                 if (existsSync(uvDestinationPath)) {
                    unlinkSync(uvDestinationPath);
                }
                renameSync(uvAtTopLevel, uvDestinationPath);
                console.log(`Moved ${uvExeName} to ${uvDestinationPath}`);
            } else {
                throw new Error(`Could not find ${uvExeName} executable in the extracted archive for ${platform}.`);
            }

        } else if (filename.endsWith('.zip')) {
            const zip = new AdmZip(tempFilePath);
            zip.extractAllTo(extractPath, true); // Overwrite existing files
        }

        console.log(`uv for ${platform}-${arch} downloaded and extracted successfully.`);

    } catch (error) {
        console.error(`Error downloading or extracting uv for ${platform}-${arch}: ${error.message}`);
        // Do not exit on error for one platform, try others.
    } finally {
        // Clean up the temporary archive file
        if (existsSync(tempFilePath)) {
            unlinkSync(tempFilePath);
        }
    }
}

async function downloadAllUVs() {
    // Ensure the base resources directory exists
    if (!existsSync(RESOURCES_DIR)) {
        mkdirSync(RESOURCES_DIR, { recursive: true });
    }

    for (const target of TARGET_PLATFORMS) {
        await downloadAndExtractUVForPlatform(target);
    }
    console.log("All necessary uv executables processed.");

    // After downloading all, copy the correct one for the current platform
    if (process.platform === 'darwin') {
        const arch = process.arch;
        const sourceDir = join(RESOURCES_DIR, `macos-${arch}`);
        const targetDir = join(RESOURCES_DIR, 'macos');
        const sourceFile = join(sourceDir, 'uv');
        const targetFile = join(targetDir, 'uv');

        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }

        if (existsSync(sourceFile)) {
            console.log(`Copying uv for local development on macOS ${arch}...`);
            fs.copyFileSync(sourceFile, targetFile);
            console.log('uv copied successfully for local development.');
        } else {
            console.error(`uv binary for macOS ${arch} not found at ${sourceFile}, skipping copy for local development.`);
        }
    } else if (process.platform === 'win32') {
        const arch = process.arch; // 'x64' or 'arm64'
        const sourceDir = join(RESOURCES_DIR, `win-${arch}`);
        const targetDir = join(RESOURCES_DIR, 'win');
        const sourceFile = join(sourceDir, 'uv.exe');
        const targetFile = join(targetDir, 'uv.exe');

        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }

        if (existsSync(sourceFile)) {
            console.log(`Copying uv.exe for local development on Windows ${arch}...`);
            fs.copyFileSync(sourceFile, targetFile);
            console.log('uv.exe copied successfully for local development.');
        } else {
            console.error(`uv.exe binary for Windows ${arch} not found at ${sourceFile}, skipping copy for local development.`);
        }
    } else if (process.platform === 'linux') {
        const arch = process.arch; // 'x64' or 'arm64'
        const sourceDir = join(RESOURCES_DIR, `linux-${arch}`);
        const targetDir = join(RESOURCES_DIR, 'linux');
        const sourceFile = join(sourceDir, 'uv');
        const targetFile = join(targetDir, 'uv');
        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }
        if (existsSync(sourceFile)) {
            console.log(`Copying uv for local development on Linux ${arch}...`);
            fs.copyFileSync(sourceFile, targetFile);
            console.log('uv copied successfully for local development.');
        } else {
            console.error(`uv binary for Linux ${arch} not found at ${sourceFile}, skipping copy for local development.`);
        }
    }
}

downloadAllUVs();
