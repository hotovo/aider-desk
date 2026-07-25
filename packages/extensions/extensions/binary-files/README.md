# Read Binary Files Tool

Adds the `read_binary_file` tool, which reads a local binary file and attaches it to the next model request as multimodal content.

## When to Use It

Use this extension when you want the AI to inspect an image, PDF, Office document, audio recording, video, or another binary attachment. Mention the file path and what you want to learn about it in your prompt; the AI can invoke the tool when the selected model supports that file type.

### Example Prompts

- `What can you see in screenshot.png?`
- `Summarize Invoice.pdf for me.`
- `Extract the key terms from contracts/vendor-agreement.docx.`
- `Describe what happens in demo.avi.`
- `Transcribe and summarize meeting-recording.mp3.`

File paths can be relative to the task working directory, absolute, or begin with `~/`. The tool infers MIME types for common image, PDF, Office, audio, and video extensions. Unsupported extensions use `application/octet-stream` by default; the AI can supply a MIME type override when necessary.
