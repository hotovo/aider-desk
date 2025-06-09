import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { delay } from "@common/utils";
import { is } from "@electron-toolkit/utils";

import logger from "./logger";
import {
  getCurrentPythonLibVersion,
  getLatestPythonLibVersion,
  getPythonVenvBinPath,
} from "./utils";
import {
  AIDER_DESK_DIR,
  SETUP_COMPLETE_FILENAME,
  PYTHON_VENV_DIR,
  AIDER_DESK_CONNECTOR_DIR,
  RESOURCES_DIR,
  PYTHON_COMMAND,
  AIDER_DESK_MCP_SERVER_DIR,
} from "./constants";

const execAsync = promisify(exec);

const uvPath = path.join(AIDER_DESK_DIR, "bin", "uv");

// Removed SUPPORTED_PYTHON_VERSIONS
// Removed getOSPythonExecutable function
// Removed checkPythonVersion function

const createVirtualEnv = async (): Promise<void> => {
  logger.info(
    `Creating Python virtual environment using uv in: ${PYTHON_VENV_DIR}`,
  );
  try {
    // Ensure the parent directory for PYTHON_VENV_DIR exists if uv doesn't create it
    const venvParentDir = path.dirname(PYTHON_VENV_DIR);
    if (!fs.existsSync(venvParentDir)) {
      fs.mkdirSync(venvParentDir, { recursive: true });
    }

    const command = `"${uvPath}" venv "${PYTHON_VENV_DIR}" --python 3.12`;
    logger.info(`Executing uv venv command: ${command}`);
    const { stdout, stderr } = await execAsync(command, { windowsHide: true });

    if (stdout.trim()) {
      logger.debug("uv venv stdout:", { stdout: stdout.trim() });
    }
    if (stderr.trim()) {
      // uv venv can output informational messages to stderr, check if it's an actual error
      if (stderr.toLowerCase().includes("error")) {
        logger.error("uv venv stderr:", { stderr: stderr.trim() });
        throw new Error(`uv venv command failed: ${stderr.trim()}`);
      } else {
        logger.info("uv venv stderr (info):", { stderr: stderr.trim() });
      }
    }
    logger.info(
      `Python virtual environment created successfully using uv in: ${PYTHON_VENV_DIR}`,
    );
  } catch (error) {
    logger.error("Failed to create virtual environment using uv", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(
      `Failed to create virtual environment using uv. Error: ${error}`,
    );
  }
};

const setupAiderConnector = async (
  cleanInstall: boolean,
  updateProgress?: UpdateProgressFunction,
): Promise<void> => {
  if (!fs.existsSync(AIDER_DESK_CONNECTOR_DIR)) {
    fs.mkdirSync(AIDER_DESK_CONNECTOR_DIR, { recursive: true });
  }

  // Copy connector.py from resources
  const sourceConnectorPath = path.join(
    RESOURCES_DIR,
    "connector/connector.py",
  );
  const destConnectorPath = path.join(AIDER_DESK_CONNECTOR_DIR, "connector.py");
  fs.copyFileSync(sourceConnectorPath, destConnectorPath);

  await installAiderConnectorRequirements(cleanInstall, updateProgress);
};

const installAiderConnectorRequirements = async (
  cleanInstall: boolean,
  updateProgress?: UpdateProgressFunction,
): Promise<void> => {
  const pythonBinPath = getPythonVenvBinPath(); // This should still be valid for PYTHON_COMMAND
  const packages = [
    // pip is not needed to be installed explicitly, uv handles it.
    // "pip",
    "aider-chat",
    "python-socketio==5.12.1",
    "websocket-client==1.8.0",
    "nest-asyncio==1.6.0",
    "boto3==1.38.25",
  ];

  logger.info("Starting Aider connector requirements installation", {
    packages,
  });

  for (
    let currentPackage = 0;
    currentPackage < packages.length;
    currentPackage++
  ) {
    const pkg = packages[currentPackage];
    if (updateProgress) {
      updateProgress({
        step: "Installing Requirements",
        message: `Installing package: ${pkg.split("==")[0]} (${currentPackage + 1}/${packages.length})`,
      });
    }
    try {
      // Using uv pip install. PYTHON_COMMAND should point to the python executable in the venv.
      // uv will use this python to ensure packages are installed into the correct environment.
      const installCommand = `"${uvPath}" pip install --python "${PYTHON_COMMAND}" --upgrade --no-cache-dir ${pkg}`;

      if (!cleanInstall) {
        const packageName = pkg.split("==")[0];
        const currentVersion = await getCurrentPythonLibVersion(packageName);

        if (currentVersion) {
          if (pkg.includes("==")) {
            // Version-pinned package - check if matches required version
            const requiredVersion = pkg.split("==")[1];
            if (currentVersion === requiredVersion) {
              logger.info(
                `Package ${pkg} is already at required version ${requiredVersion}, skipping`,
              );
              continue;
            }
          } else {
            // For non-version-pinned packages, check if newer version is available
            const latestVersion = await getLatestPythonLibVersion(packageName);
            if (latestVersion && currentVersion === latestVersion) {
              logger.info(
                `Package ${pkg} is already at latest version ${currentVersion}, skipping`,
              );
              continue;
            }
          }
        }
        // If currentVersion is null, the package is not installed, so proceed with installation.
      }

      logger.info(`Installing package: ${pkg}`);
      const { stdout, stderr } = await execAsync(installCommand, {
        windowsHide: true,
        env: {
          ...process.env,
          VIRTUAL_ENV: PYTHON_VENV_DIR,
          PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
        },
      });

      if (stdout.trim()) {
        logger.debug(`Package ${pkg} installation output`, {
          stdout: stdout.trim(),
        });
      }
      if (stderr.trim()) {
        logger.warn(`Package ${pkg} installation warnings`, {
          stderr: stderr.trim(),
        });
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.trim().endsWith("No module named pip") &&
        !cleanInstall
      ) {
        logger.warn(
          "Failed to install package. pip is not installed. Trying full clean venv reinstallation...",
        );
        fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
        await createVirtualEnv();
        await installAiderConnectorRequirements(true, updateProgress);
        return;
      }

      logger.error(`Failed to install package: ${pkg}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Failed to install Aider connector requirements. Package: ${pkg}. Error: ${error}`,
      );
    }
  }

  if (updateProgress) {
    updateProgress({
      step: "Installing Requirements",
      message: "Completed installing all packages",
    });
  }
  logger.info("Completed Aider connector requirements installation");
};

const setupMcpServer = async () => {
  if (is.dev) {
    logger.info("Skipping AiderDesk MCP server setup in dev mode");
    return;
  }

  if (!fs.existsSync(AIDER_DESK_MCP_SERVER_DIR)) {
    fs.mkdirSync(AIDER_DESK_MCP_SERVER_DIR, { recursive: true });
  }

  // Copy all files from the MCP server directory
  const sourceMcpServerDir = path.join(RESOURCES_DIR, "mcp-server");

  if (fs.existsSync(sourceMcpServerDir)) {
    const files = fs.readdirSync(sourceMcpServerDir);

    for (const file of files) {
      const sourceFilePath = path.join(sourceMcpServerDir, file);
      const destFilePath = path.join(AIDER_DESK_MCP_SERVER_DIR, file);

      // Skip directories for now, only copy files
      if (fs.statSync(sourceFilePath).isFile()) {
        fs.copyFileSync(sourceFilePath, destFilePath);
      }
    }
  } else {
    logger.error(`MCP server directory not found: ${sourceMcpServerDir}`);
  }
};

const performUpdateCheck = async (
  updateProgress: UpdateProgressFunction,
): Promise<void> => {
  updateProgress({
    step: "Update Check",
    message: "Updating Aider connector...",
  });

  await setupAiderConnector(false, updateProgress);

  updateProgress({
    step: "Update Check",
    message: "Updating MCP server...",
  });

  await setupMcpServer();
};

export type UpdateProgressData = {
  step: string;
  message: string;
};

export type UpdateProgressFunction = (data: UpdateProgressData) => void;

const installUV = async (
  updateProgress: UpdateProgressFunction,
): Promise<void> => {
  updateProgress({
    step: "Installing UV",
    message: "Checking UV installation...",
  });

  // uvPath is now a global constant in this file
  const uvBinDir = path.dirname(uvPath); // e.g. AIDER_DESK_DIR/bin
  let uvFound = false;

  try {
    await execAsync(`"${uvPath}" --version`, { windowsHide: true });
    logger.info(`UV already installed at ${uvPath}`);
    uvFound = true;
  } catch (error) {
    logger.info("UV not found locally, checking system PATH...", { error });
    try {
      // Try running 'uv' directly, relying on system PATH
      await execAsync("uv --version", { windowsHide: true });
      logger.info(
        "UV found in system PATH. Will proceed to use locally managed version if not already at desired path.",
      );
      // If we want to *use* the system path version, we'd change uvPath here or handle it.
      // For now, the logic prioritizes installing to our own directory if not already there.
    } catch (pathError) {
      logger.info("UV not found in system PATH either.", { pathError });
    }
  }

  // If not found at the designated uvPath, attempt installation.
  if (!fs.existsSync(uvPath)) {
    logger.info(`UV not found at ${uvPath}, proceeding with installation.`);
    uvFound = false; // Force re-evaluation for installation
  }

  if (!uvFound) {
    try {
      logger.info(
        `UV not found or not executable at ${uvPath}. Installing UV to ${uvBinDir}...`,
      );
      if (!fs.existsSync(uvBinDir)) {
        fs.mkdirSync(uvBinDir, { recursive: true });
      }

      const installCommand = `curl -LsSf https://astral.sh/uv/install.sh | sh -s -- --to "${uvBinDir}"`;
      logger.info(`Executing UV install command: ${installCommand}`);
      await execAsync(installCommand, { windowsHide: true });

      logger.info(`Verifying UV installation at ${uvPath}...`);
      await execAsync(`"${uvPath}" --version`, { windowsHide: true });
      logger.info(`UV installed and verified successfully at ${uvPath}.`);
    } catch (error) {
      logger.error("Failed to install UV", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error(
        `Failed to install UV. Please ensure curl is installed and your system can run the install script from astral.sh. Error: ${error}`,
      );
    }
  }

  // Ensure UV is executable - The install script should handle this, but good to double check on some OSes.
  // On POSIX systems, fs.chmodSync might be needed if the script doesn't set +x.
  // However, the official install script usually handles this.
  // For example: if (process.platform !== 'win32') { fs.chmodSync(uvPath, 0o755); }
  // For now, we assume the install script makes it executable.

  updateProgress({
    step: "Installing UV",
    message: "UV installation checked/completed.",
  });
};

export const performStartUp = async (
  updateProgress: UpdateProgressFunction,
): Promise<boolean> => {
  logger.info("Starting AiderDesk setup process");

  await installUV(updateProgress);

  if (
    fs.existsSync(SETUP_COMPLETE_FILENAME) &&
    fs.existsSync(PYTHON_VENV_DIR)
  ) {
    logger.info("Setup previously completed, performing update check");
    await performUpdateCheck(updateProgress);
    return true;
  }

  updateProgress({
    step: "AiderDesk Setup",
    message: "Performing initial setup...",
  });

  await delay(2000);

  if (!fs.existsSync(AIDER_DESK_DIR)) {
    logger.info(`Creating AiderDesk directory: ${AIDER_DESK_DIR}`);
    fs.mkdirSync(AIDER_DESK_DIR, { recursive: true });
  }

  try {
    // Removed:
    // updateProgress({
    //   step: "Checking Python Installation",
    //   message: "Verifying Python installation...",
    // });
    // logger.info("Checking Python version compatibility");
    // await checkPythonVersion();

    updateProgress({
      step: "Creating Virtual Environment",
      message: "Setting up Python virtual environment...",
    });

    // logger.info(`Creating Python virtual environment in: ${PYTHON_VENV_DIR}`); // createVirtualEnv now logs this
    await createVirtualEnv();

    updateProgress({
      step: "Setting Up Connector",
      message: "Installing Aider connector (this may take a while)...",
    });

    logger.info("Setting up Aider connector");
    await setupAiderConnector(true);

    updateProgress({
      step: "Setting Up MCP Server",
      message: "Installing MCP server...",
    });

    logger.info("Setting up MCP server");
    await setupMcpServer();

    updateProgress({
      step: "Finishing Setup",
      message: "Completing installation...",
    });

    // Create setup complete file
    logger.info(`Creating setup complete file: ${SETUP_COMPLETE_FILENAME}`);
    fs.writeFileSync(SETUP_COMPLETE_FILENAME, new Date().toISOString());

    logger.info("AiderDesk setup completed successfully");
    return true;
  } catch (error) {
    logger.error("AiderDesk setup failed", { error });

    // Clean up if setup fails
    if (fs.existsSync(PYTHON_VENV_DIR)) {
      logger.info(`Removing virtual environment directory: ${PYTHON_VENV_DIR}`);
      fs.rmSync(PYTHON_VENV_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(SETUP_COMPLETE_FILENAME)) {
      logger.info(`Removing setup complete file: ${SETUP_COMPLETE_FILENAME}`);
      fs.unlinkSync(SETUP_COMPLETE_FILENAME);
    }
    throw error;
  }
};
