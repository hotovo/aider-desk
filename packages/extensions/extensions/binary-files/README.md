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

## Custom Tool Message

The extension registers a custom message renderer for `read_binary_file` tool results. The message title is chosen by the attached file's category — "Read image", "Read video", "Read audio", "Read document" (PDF, Office, text files), or "Read file" — followed by the file name with a media-type icon and the execution status (spinner, success, or error).

Depending on the media type, the message body shows:

- `image/*` — the image previewed inline; click it to open a full-size lightbox (click anywhere or the ✕ button to close)
- `audio/*` — an audio player
- `video/*` — a video player
- other types (PDF, Office, ...) — a file card indicating the file was attached to the model request

Below the preview, the message shows the file path, media type, and size.
