const { spawn } = require('child_process');
const path = require('path');

/**
 * Lint Checker Hook for AiderDesk
 *
 * This hook runs eslint --fix on files that were modified by file_edit or file_write tools.
 * If linting fails after a successful file operation, the result is updated with the error.
 *
 * Usage: Copy this file to your project's `.aider-desk/hooks/` directory or to `~/.aider-desk/hooks/` for global use.
 */

const CHECKED_TOOL_NAMES = ['power---file_edit', 'power---file_write'];

/**
 * Runs eslint --fix on a specific file and returns the result
 */
const runEslint = (projectDir, filePath) => {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn('npx', ['eslint', '--fix', filePath], {
            cwd: projectDir,
            shell: true,
            timeout: 60000 // 1 minute timeout
        });

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            resolve({
                success: code === 0,
                output: stdout + stderr
            });
        });

        proc.on('error', (error) => {
            resolve({
                success: false,
                output: `Failed to run eslint: ${error.message}`
            });
        });
    });
};

/**
 * Checks if the result indicates a successful file operation
 */
const isSuccessfulResult = (result) => {
    if (typeof result !== 'string') {
        return false;
    }
    return result.startsWith('Successfully');
};

/**
 * Checks if the file should be linted (TypeScript or JavaScript files only)
 */
const shouldLintFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs';
};

module.exports = {
    onToolFinished: async (event, context) => {
        const { toolName, args, result } = event;

        if (!CHECKED_TOOL_NAMES.includes(toolName)) {
            return;
        }

        if (!isSuccessfulResult(result)) {
            return;
        }

        const filePath = args?.filePath;
        if (!filePath || !shouldLintFile(filePath)) {
            return;
        }

        context.addLoadingMessage('Running eslint...');
        const eslintResult = await runEslint(context.projectDir, filePath);
        context.addLoadingMessage('Running eslint...', true);

        if (!eslintResult.success) {
            // Return a string to modify the tool's result
            return `Error: file has been updated but linting failed:\n\n\`\`\`${eslintResult.output}\`\`\``;
        }
    }
};
