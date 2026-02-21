const { spawn } = require('child_process');

/**
 * Lint Checker Hook for AiderDesk
 *
 * This hook runs linting after an agent finishes and can automatically
 * prompt the agent to fix any linting issues found.
 *
 * Usage: Copy this file to your project's `.aider-desk/hooks/` directory or to `~/.aider-desk/hooks/` for global use.
 */

/**
 * Runs npm lint command and returns the result
 */
const runLint = (projectDir) => {
    return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';

        const proc = spawn('npm', ['run', 'lint'], {
            cwd: projectDir,
            shell: true,
            timeout: 120000 // 2 minutes timeout
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
                output: `Failed to run lint: ${error.message}`
            });
        });
    });
};

module.exports = {
    onAgentFinished: async (event, context) => {
        // Skip if the agent was aborted
        if (event.aborted) {
            return;
        }

        context.addLoadingMessage('Running linting...');
        const result = await runLint(context.projectDir);
        context.addLoadingMessage('Running linting...', true);

        if (!result.success) {
            context.addWarningMessage(`Linting issues found`);

            // Optionally: automatically prompt the agent to fix the issues
            // Uncomment the line below to enable auto-fix
            // await context.task.runPrompt(`Fix the linting issues:\n\n\`\`\`${result.output}\`\`\``, 'agent', false);
        }
    }
};
