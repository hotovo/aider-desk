# Reasoning Selector

Adds a reasoning-effort selector next to the model selector in Agent Mode.

![Reasoning Selector](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/reasoning-selector/screenshot.png)

## Usage

1. Enable the extension and open a task in Agent Mode.
2. Choose a reasoning effort from the selector: **Use default**, **None**, **Minimal**, **Low**, **Medium**, **High**, or **xHigh**.
3. Start the task. The selected reasoning effort is applied to models that support reasoning.

Choose **Use default** to leave the model's default reasoning behavior unchanged.

New tasks inherit the selected reasoning effort from the most recently updated task using the same provider and model in the project. The extension checks up to the 10 most recently updated tasks.
