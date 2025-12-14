import fetch from 'node-fetch';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { extract } from "tar";
import AdmZip from 'adm-zip';

const streamPipeline = promisify(pipeline);

const PROBE_VERSION = 'v0.6.0-rc161';
const BASE_URL = `https://github.com/probelabs/probe/releases/download/${PROBE_VERSION}`;
const RESOURCES_DIR = './resources';

const TARGET_PLATFORMS = [
    { platform: 'linux', arch: 'x64', filename: `probe-${PROBE_VERSION}-x86_64-unknown-linux-musl.tar.gz`, extractSubdir: 'linux', probeExeName: 'probe', sourceExeName: 'probe' },
    { platform: 'linux', arch: 'arm64', filename: `probe-${PROBE_VERSION}-aarch64-unknown-linux-gnu.tar.gz`, extractSubdir: 'linux-arm64', probeExeName: 'probe', sourceExeName: 'probe' },
    { platform: 'darwin', arch: 'x64', filename: `probe-${PROBE_VERSION}-x86_64-apple-darwin.tar.gz`, extractSubdir: 'macos-x64', probeExeName: 'probe', sourceExeName: 'probe' },
    { platform: 'darwin', arch: 'arm64', filename: `probe-${PROBE_VERSION}-aarch64-apple-darwin.tar.gz`, extractSubdir: 'macos-arm64', probeExeName: 'probe', sourceExeName: 'probe' },
    { platform: 'win32', arch: 'x64', filename: `probe-${PROBE_VERSION}-x86_64-pc-windows-msvc.zip`, extractSubdir: 'win', probeExeName: 'probe.exe', sourceExeName: 'probe.exe' }
];

async function downloadAndExtractProbeForPlatform(target) {
    const { platform, arch, filename, extractSubdir, probeExeName, sourceExeName } = target;
    const url = `${BASE_URL}/${filename}`;
    const extractPath = join(RESOURCES_DIR, extractSubdir);
    const probeDestinationPath = join(extractPath, probeExeName);

    // Ensure the specific platform directory exists
    if (!existsSync(extractPath)) {
        mkdirSync(extractPath, { recursive: true });
    }

    // Check if probe already exists for this platform
    if (existsSync(probeDestinationPath)) {
        console.log(`probe executable for ${platform}-${arch} already exists at ${probeDestinationPath}. Skipping download.`);
        return;
    }

    const tempFilePath = join(RESOURCES_DIR, filename);
    console.log(`Downloading probe for ${platform}-${arch} from ${url} to ${tempFilePath}`);

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
            // The probe executable might be inside a directory like probe-v0.6.0-rc128-x86_64-unknown-linux-gnu/probe-binary
            const extractedDirName = filename.replace('.tar.gz', '');
            const probeInExtractedDir = join(extractPath, extractedDirName, sourceExeName);
            const probeAtTopLevel = join(extractPath, sourceExeName);

            if (existsSync(probeInExtractedDir)) {
                 if (existsSync(probeDestinationPath)) {
                    unlinkSync(probeDestinationPath);
                }
                renameSync(probeInExtractedDir, probeDestinationPath);
                console.log(`Moved ${sourceExeName} to ${probeDestinationPath}`);
                // Clean up the extracted directory
                rmSync(join(extractPath, extractedDirName), { recursive: true });
            } else if (existsSync(probeAtTopLevel)) {
                 // If not found in extractedDir, check the top level (for older releases or different structures)
                 if (existsSync(probeDestinationPath)) {
                    unlinkSync(probeDestinationPath);
                }
                renameSync(probeAtTopLevel, probeDestinationPath);
                console.log(`Moved ${sourceExeName} to ${probeDestinationPath}`);
            } else {
                throw new Error(`Could not find ${sourceExeName} executable in the extracted archive for ${platform}.`);
            }

        } else if (filename.endsWith('.zip')) {
            const zip = new AdmZip(tempFilePath, {});
            zip.extractAllTo(extractPath, true); // Overwrite existing files

            const extractedDirName = filename.replace('.zip', '');
            const probeExePath = join(extractPath, extractedDirName, sourceExeName);
            console.log(`probeExePath: ${probeExePath}`);

            if (existsSync(probeExePath)) {
                if (existsSync(probeDestinationPath)) {
                    unlinkSync(probeDestinationPath);
                }
                renameSync(probeExePath, probeDestinationPath);
                console.log(`Renamed ${sourceExeName} to ${probeExeName}`);
                // Clean up the extracted directory
                rmSync(join(extractPath, extractedDirName), { recursive: true });
            }
        }

        console.log(`probe for ${platform}-${arch} downloaded and extracted successfully.`);

    } catch (error) {
        console.error(`Error downloading or extracting probe for ${platform}-${arch}: ${error.message}`);
        // Do not exit on error for one platform, try others.
    } finally {
        // Clean up the temporary archive file
        if (existsSync(tempFilePath)) {
            unlinkSync(tempFilePath);
        }
    }
}

async function downloadAllProbes() {
    // Ensure the base resources directory exists
    if (!existsSync(RESOURCES_DIR)) {
        mkdirSync(RESOURCES_DIR, { recursive: true });
    }

    for (const target of TARGET_PLATFORMS) {
        await downloadAndExtractProbeForPlatform(target);
    }
    console.log("All necessary probe executables processed.");

    // After downloading all, copy the correct one for the current platform if it's macOS
    if (process.platform === 'darwin') {
        const arch = process.arch;
        const sourceDir = join(RESOURCES_DIR, `macos-${arch}`);
        const targetDir = join(RESOURCES_DIR, 'macos');
        const sourceFile = join(sourceDir, 'probe');
        const targetFile = join(targetDir, 'probe');

        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }

        if (existsSync(sourceFile)) {
            console.log(`Copying probe for local development on macOS ${arch}...`);
            fs.copyFileSync(sourceFile, targetFile);
            console.log('probe copied successfully for local development.');
        } else {
            console.error(`probe binary for macOS ${arch} not found at ${sourceFile}, skipping copy for local development.`);
        }
    }
}

downloadAllProbes();
