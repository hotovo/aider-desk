({ message, ui, icons }) => {
  const { ExpandableMessageBlock, Tooltip } = ui;
  const [expanded, setExpanded] = React.useState(false);
  const { CgSpinner } = icons.Cg;
  const { RiCheckboxCircleFill, RiErrorWarningFill, RiFile3Line, RiImageLine, RiMusic2Line, RiVideoLine } = icons.Ri;

  const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tif', 'tiff', 'heic']);
  const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac']);
  const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']);
  const DOCUMENT_EXTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'rtf', 'odt', 'ods', 'odp', 'csv', 'txt', 'md', 'html', 'log']);

  const basename = (filePath) => (typeof filePath === 'string' ? filePath.split(/[\\/]/).pop() : '');

  const extname = (filePath) => {
    const name = basename(filePath) || '';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  };

  const categoryOf = (mediaType, filePath) => {
    const mime = typeof mediaType === 'string' ? mediaType : '';
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('text/') || mime === 'application/pdf') return 'document';
    const ext = extname(filePath);
    if (IMAGE_EXTS.has(ext)) return 'image';
    if (AUDIO_EXTS.has(ext)) return 'audio';
    if (VIDEO_EXTS.has(ext)) return 'video';
    if (DOCUMENT_EXTS.has(ext)) return 'document';
    return 'file';
  };

  const prettyBytes = (bytes) => {
    if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const bytesFromText = (text) => {
    const match = /([0-9][0-9,]*)\s+bytes/.exec(text || '');
    return match ? Number(match[1].replace(/,/g, '')) : null;
  };

  const bytesFromBase64 = (data) => {
    if (typeof data !== 'string') return null;
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
  };

  const parseResult = (rawContent) => {
    if (!rawContent) {
      return { text: '', media: null, isError: false };
    }

    let value = rawContent;
    for (let i = 0; i < 4; i++) {
      if (typeof value !== 'string') {
        break;
      }
      try {
        value = JSON.parse(value);
      } catch {
        break;
      }
    }

    if (typeof value === 'string') {
      return { text: value, media: null, isError: /^error/i.test(value) };
    }

    const texts = [];
    let media = null;

    const walk = (node) => {
      if (!node || typeof node !== 'object') {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (node.type === 'text' && typeof node.text === 'string') {
        texts.push(node.text);
        return;
      }
      if (
        (node.type === 'media' || node.type === 'image' || node.type === 'image-data') &&
        typeof (node.data ?? node.image) === 'string' &&
        (node.data ?? node.image).length > 64
      ) {
        const data = node.data ?? node.image;
        const mimeType = typeof node.mimeType === 'string' ? node.mimeType : typeof node.mediaType === 'string' ? node.mediaType : 'application/octet-stream';
        if (!media) {
          media = { data, mimeType };
        }
        return;
      }
      if (node.type === 'file' && node.data && typeof node.data === 'object' && typeof node.data.data === 'string' && node.data.data.length > 64) {
        const mimeType = typeof (node.mediaType ?? node.data.mediaType) === 'string' ? node.mediaType ?? node.data.mediaType : 'application/octet-stream';
        if (!media) {
          media = { data: node.data.data, mimeType };
        }
        return;
      }
      Object.entries(node).forEach(([, child]) => walk(child));
    };

    walk(value);

    const isError = (typeof value === 'object' && (value.isError === true || value.type === 'error-json' || value.type === 'error-text')) || (!media && /^\s*error/i.test(texts.join(' ')));

    return { text: texts.join('\n'), media, isError };
  };

  const result = parseResult(message.content);
  const filePath = typeof message.args?.filePath === 'string' ? message.args.filePath : '';
  const fileName = basename(filePath) || 'unknown file';
  const mediaType = result.media?.mimeType ?? '';
  const category = categoryOf(mediaType || message.args?.mediaType, filePath);

  const titleLabels = {
    image: 'Read image',
    video: 'Read video',
    audio: 'Read audio',
    document: 'Read document',
    file: 'Read file',
  };

  const categoryIcons = {
    image: RiImageLine,
    video: RiVideoLine,
    audio: RiMusic2Line,
    document: RiFile3Line,
    file: RiFile3Line,
  };
  const CategoryIcon = categoryIcons[category] ?? RiFile3Line;

  const sizeMatch = /(\d+)\s+bytes/.exec(result.text ?? '');
  const sizeBytes = sizeMatch ? parseInt(sizeMatch[1], 10) : result.media ? Math.round((result.media.data.length * 3) / 4) : null;
  const sizeLabel = sizeBytes !== null ? prettyBytes(sizeBytes) : '';

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted flex-shrink-0">
        <CategoryIcon className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary flex-shrink-0">{titleLabels[category] ?? 'Read file'}</div>
      <span className="text-xs text-text-secondary truncate flex-1 min-w-0">{fileName}</span>
      {!message.content ? (
        <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />
      ) : result.isError ? (
        <Tooltip content={result.text}>
          <RiErrorWarningFill className="w-3 h-3 text-error flex-shrink-0" />
        </Tooltip>
      ) : (
        <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
      )}
    </div>
  );

  const dataUrl = result.media ? `data:${result.media.mimeType};base64,${result.media.data}` : null;

  const handleImageClick = () => {
    setExpanded(!expanded);
  };

  const preview =
    dataUrl && category === 'image' ? (
      <img
        src={dataUrl}
        alt={fileName}
        onClick={handleImageClick}
        className={
          'max-w-full rounded-md border border-border-default-dark bg-bg-primary p-1 object-contain cursor-pointer hover:opacity-80 transition-opacity' +
          (expanded ? '' : ' max-h-40 max-w-[200px]')
        }
      />
    ) : dataUrl && category === 'audio' ? (
      <audio controls src={dataUrl} className="w-full max-w-md" />
    ) : dataUrl && category === 'video' ? (
      <video controls src={dataUrl} className="max-h-64 max-w-full rounded-md border border-border-default-dark" />
    ) : dataUrl ? (
      <div className="flex items-center gap-2 rounded-md border border-border-default-dark bg-bg-primary px-3 py-2 max-w-xs">
        <RiFile3Line className="w-5 h-5 text-text-muted flex-shrink-0" />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-medium text-text-primary truncate">{fileName}</span>
          <span className="text-2xs text-text-tertiary">Attached to the model request</span>
        </div>
      </div>
    ) : null;

  const content = (
    <div className="px-3 pb-3 text-xs text-text-tertiary bg-bg-secondary relative">
      <div className="flex flex-col gap-1 mb-2">
        <div className="text-2xs text-text-tertiary truncate">
          <span className="font-medium uppercase tracking-wide text-text-secondary">File&nbsp;&nbsp;</span>
          <span className="font-mono" title={filePath}>
            {filePath || fileName}
          </span>
        </div>
        {mediaType && (
          <div className="text-2xs text-text-tertiary">
            <span className="font-medium uppercase tracking-wide text-text-secondary">Type&nbsp;&nbsp;</span>
            {mediaType}
            {sizeLabel ? ` · ${sizeLabel}` : ''}
          </div>
        )}
        {typeof message.args?.mediaType === 'string' && message.args.mediaType && (
          <div className="text-2xs text-text-tertiary">
            <span className="font-medium uppercase tracking-wide text-text-secondary">Override&nbsp;&nbsp;</span>
            {message.args.mediaType}
          </div>
        )}
      </div>

      {message.content &&
        (result.isError ? (
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-bg-primary-light p-3 font-mono text-2xs text-error">
            {result.text}
          </pre>
        ) : (
          <div className="mt-1">{preview}</div>
        ))}

    </div>
  );

  return (
    <ExpandableMessageBlock
      message={message}
      title={title}
      content={content}
      usageReport={message.usageReport}
      initialExpanded={true}
      hideMessageBar={true}
    />
  );
};
