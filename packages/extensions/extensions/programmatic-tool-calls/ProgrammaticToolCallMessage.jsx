({ message, projectDir, task, ui, icons }) => {
  const { CodeBlock, ExpandableMessageBlock, Tooltip } = ui;
  const { CgSpinner } = icons.Cg;
  const { RiCheckboxCircleFill, RiCodeSSlashLine, RiErrorWarningFill } = icons.Ri;

  const parseResult = (rawContent) => {
    if (!rawContent) {
      return { text: '', isError: false };
    }

    try {
      const parsed = JSON.parse(rawContent);
      if (typeof parsed === 'string') {
        return { text: parsed, isError: false };
      }

      let value = parsed;
      let isError = false;

      if (value && typeof value === 'object' && (value.type === 'json' || value.type === 'error-json')) {
        isError = value.type === 'error-json';
        value = value.value;
      }

      if (value && typeof value === 'object' && Array.isArray(value.content)) {
        isError = isError || value.isError === true;
        const text = value.content
          .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
          .map((item) => item.text)
          .join('');

        if (text) {
          return { text, isError };
        }
      }

      return { text: JSON.stringify(value, null, 2), isError };
    } catch {
      return { text: rawContent, isError: false };
    }
  };

  const result = parseResult(message.content);
  const code = typeof message.args?.code === 'string' ? message.args.code : '';
  const resultText = result.text || (message.finished ? 'Execution completed with no result.' : 'Executing…');
  let jsonResult = null;

  try {
    jsonResult = JSON.stringify(JSON.parse(resultText), null, 2);
  } catch {
    jsonResult = null;
  }

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiCodeSSlashLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary">Programmatic tool call</div>
      {!message.content ? (
        <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />
      ) : result.isError ? (
        <Tooltip content={resultText}>
          <RiErrorWarningFill className="w-3 h-3 text-error" />
        </Tooltip>
      ) : (
        <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
      )}
    </div>
  );

  const content = (
    <div className="px-3 text-xs text-text-tertiary bg-bg-secondary">
      <CodeBlock baseDir={projectDir || ''} taskId={task?.id} language="javascript" isComplete={true} className="text-2xs">
        {code}
      </CodeBlock>

      <div className="mb-1 ml-1 text-2xs font-medium uppercase tracking-wide text-text-secondary">Result</div>
      {jsonResult !== null ? (
        <CodeBlock
          baseDir={projectDir || ''}
          taskId={task?.id}
          language="json"
          isComplete={true}
          className="max-h-48 overflow-y-auto text-2xs"
        >
          {jsonResult}
        </CodeBlock>
      ) : (
        <pre
          className={`max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-bg-primary-light p-3 font-mono text-2xs scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-secondary-light hover:scrollbar-thumb-bg-fourth ${result.isError ? 'text-error' : 'text-text-primary'}`}
        >
          {resultText}
        </pre>
      )}
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
