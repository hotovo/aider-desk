({ message, projectDir, task, ui, icons }) => {
  const { CodeBlock, ExpandableMessageBlock, Tooltip } = ui;
  const { CgSpinner } = icons.Cg;
  const { RiCheckboxCircleFill, RiCoinsLine, RiErrorWarningFill, RiFileList3Line, RiLightbulbFlashLine } = icons.Ri;

  const isAskJevFiles = message.toolName === 'ask-jev-files';

  const parseResult = (rawContent) => {
    if (!rawContent) return { parsed: null, isError: false, text: '' };
    try {
      const value = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
      if (value && typeof value === 'object' && Array.isArray(value.content)) {
        const text = value.content
          .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
          .map((item) => item.text)
          .join('');
        const parsed = text ? JSON.parse(text) : null;
        return { parsed, isError: value.isError === true, text };
      }
      if (value && typeof value === 'object') {
        return { parsed: value, isError: value.isError === true, text: JSON.stringify(value, null, 2) };
      }
      return { parsed: null, isError: false, text: String(rawContent) };
    } catch {
      return { parsed: null, isError: false, text: String(rawContent) };
    }
  };

  const result = parseResult(message.content);
  const questions = message.args?.questions_json ? (() => {
    try {
      return JSON.stringify(JSON.parse(message.args.questions_json), null, 2);
    } catch {
      return message.args.questions_json;
    }
  })() : null;

  const prettyPercent = (value) => `${(Math.round((value ?? 0) * 1000) / 10).toFixed(1)}%`;
  const prettyCost = (cost) => {
    if (cost === null || cost === undefined) return null;
    if (cost > 0 && cost < 0.01) return `$${cost.toFixed(6)}`;
    return `$${cost.toFixed(4)}`;
  };

  const AnswerLine = ({ label, value, highlight }) => (
    <Tooltip content="Probability that this answer applies">
      <div className="flex flex-col gap-0.5 text-2xs leading-tight">
        <div className="flex items-baseline justify-between gap-2">
          <span className={highlight ? 'truncate text-text-primary font-medium' : 'truncate text-text-secondary'}>{label}</span>
          <span className={highlight ? 'font-mono text-text-primary' : 'font-mono text-text-tertiary'}>{prettyPercent(value)}</span>
        </div>
        <div className="h-1 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className={highlight ? 'h-full rounded-full bg-success' : 'h-full rounded-full bg-text-muted'}
            style={{ width: `${Math.min(100, Math.max(0, (value ?? 0) * 100))}%` }}
          />
        </div>
      </div>
    </Tooltip>
  );

  const maxOf = (entries) => Math.max(0, ...entries.map(([, p]) => p ?? 0));

  const cardClass = 'flex flex-col gap-1 min-w-0 rounded-md border border-border-default-dark bg-bg-secondary px-2 py-1.5';
  const Badge = ({ children }) => (
    <span className="rounded-full bg-bg-tertiary px-2 py-0.5 text-2xs font-medium text-text-secondary">{children}</span>
  );

  const AnswerCard = ({ id, answer }) => {
    if (!answer) return null;
    if (answer.type === 'noul') {
      return (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary truncate">{id}</span>
            <Badge>{answer.noul >= 0.5 ? 'Yes' : 'No'}</Badge>
          </div>
          <AnswerLine label="Likelihood" value={answer.noul} highlight={answer.noul >= 0.5} />
        </div>
      );
    }
    if (answer.type === 'choice') {
      const entries = Object.entries(answer.probabilities ?? {}).filter(([, p]) => (p ?? 0) > 0);
      return (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary truncate">{id}</span>
            <div className="flex items-center gap-2">
              <Badge>{String(answer.choice)}</Badge>
              <span className="text-2xs text-text-tertiary">{prettyPercent(answer.confidence)} confidence</span>
            </div>
          </div>
          {entries.map(([option, p]) => (
            <AnswerLine key={option} label={option} value={p} highlight={p === maxOf(entries)} />
          ))}
        </div>
      );
    }
    if (answer.type === 'score') {
      const entries = Object.entries(answer.probabilities ?? {}).filter(([, p]) => (p ?? 0) > 0);
      return (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary truncate">{id}</span>
            <div className="flex items-center gap-2">
              <Badge>{Number(answer.score).toFixed(2)}</Badge>
              {answer.legend?.[Math.round(answer.score)] ? (
                <span className="text-2xs text-text-tertiary">{answer.legend[Math.round(answer.score)]}</span>
              ) : null}
            </div>
          </div>
          {entries.map(([level, p]) => (
            <AnswerLine key={level} label={answer.legend?.[level] ?? level} value={p} highlight={p === maxOf(entries)} />
          ))}
        </div>
      );
    }
    return (
      <CodeBlock baseDir={projectDir || ''} taskId={task?.id} language="json" isComplete={true} className="text-2xs">
        {JSON.stringify(answer, null, 2)}
      </CodeBlock>
    );
  };

  const stateSummary = result.parsed?.state_summary;
  const fileResults = result.parsed?.results;

  const title = (
    <div className="flex items-center gap-2 w-full">
      <div className="text-text-muted">
        <RiLightbulbFlashLine className="w-4 h-4" />
      </div>
      <div className="text-xs text-text-primary">{isAskJevFiles ? 'Ask Jev — files' : 'Ask Jev'}</div>
      {!message.content ? (
        <CgSpinner className="animate-spin w-3 h-3 text-text-muted-light flex-shrink-0" />
      ) : result.isError ? (
        <Tooltip content={result.text}>
          <RiErrorWarningFill className="w-3 h-3 text-error" />
        </Tooltip>
      ) : (
        <RiCheckboxCircleFill className="w-3 h-3 text-success flex-shrink-0" />
      )}
    </div>
  );

  const inputs = (
    <div className="flex flex-col gap-1 mb-2">
      {isAskJevFiles && Array.isArray(message.args?.paths) && (
        <div className="text-2xs text-text-tertiary">
          <span className="font-medium uppercase tracking-wide text-text-secondary">Paths&nbsp;&nbsp;</span>
          {message.args.paths.join(', ')}
          {message.args.recursive ? ' (recursive)' : ''}
        </div>
      )}
      {!isAskJevFiles && Array.isArray(message.args?.paths) && message.args.paths.length > 0 && (
        <div className="text-2xs text-text-tertiary">
          <span className="font-medium uppercase tracking-wide text-text-secondary">Files&nbsp;&nbsp;</span>
          {message.args.paths.join(', ')}
        </div>
      )}
      {!isAskJevFiles && message.args?.command ? (
        <div className="text-2xs text-text-tertiary font-mono truncate">
          <span className="font-medium uppercase tracking-wide text-text-secondary not-italic">Command&nbsp;&nbsp;</span>
          {message.args.command}
        </div>
      ) : null}
      {!isAskJevFiles && stateSummary && Array.isArray(stateSummary.files) && stateSummary.files.length > 0 && (
        <div className="text-2xs text-text-tertiary">
          <span className="font-medium uppercase tracking-wide text-text-secondary">Read&nbsp;&nbsp;</span>
          {stateSummary.files.join(', ')}
        </div>
      )}
    </div>
  );

  const answersSection = (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-1.5 mt-1 rounded-lg border border-border-default-dark bg-bg-primary p-1.5">
      {isAskJevFiles
        ? (fileResults ?? []).map((r, i) => (
            <div key={r.path ?? i} className="flex flex-col gap-0.5 min-w-0 rounded-md border border-border-default-dark bg-bg-secondary px-2 py-1.5">
              <div className="text-2xs font-medium text-text-primary font-mono truncate">{r.path}</div>
              <div className="text-2xs text-text-secondary">{r.summary || Object.keys(r.answers ?? {}).join(', ')}</div>
            </div>
          ))
        : Object.entries(result.parsed?.answers ?? {}).map(([id, answer]) => <AnswerCard key={id} id={id} answer={answer} />)}
      {isAskJevFiles && result.parsed?.first_pick && (
        <div className="col-span-full text-2xs text-text-secondary">
          <span className="font-medium uppercase tracking-wide text-text-secondary">Pick first&nbsp;&nbsp;</span>
          {result.parsed.first_pick.path ? `${result.parsed.first_pick.path} (${prettyPercent(result.parsed.first_pick.confidence)} confidence)` : 'none'}
        </div>
      )}
      {(() => {
        const usage = result.parsed?.usage;
        const hasUsage = usage && (usage.input_tokens > 0 || usage.output_tokens > 0 || usage.cost_usd !== null);
        if (!isAskJevFiles && !stateSummary && !hasUsage) return null;
        return (
          <div className="col-span-full flex flex-wrap items-center gap-3 pt-1.5 border-t border-border-default-dark px-1 text-2xs">
            {isAskJevFiles && typeof result.parsed?.calls === 'number' && <span className="text-text-tertiary">{result.parsed.calls} Jev calls</span>}
            {!isAskJevFiles && stateSummary && (
              <span className="text-text-tertiary">
                {stateSummary.tokens} tokens of state evaluated
                {Array.isArray(stateSummary.skipped) && stateSummary.skipped.length > 0 ? `, ${stateSummary.skipped.length} skipped` : ''}
              </span>
            )}
            {hasUsage && (
              <span className="inline-flex items-center gap-2 text-text-tertiary">
                <Tooltip content={`Jev usage: ${usage.input_tokens} input + ${usage.output_tokens} output tokens`}>
                  <span className="inline-flex items-center gap-1">
                    <RiFileList3Line className="w-3 h-3" />
                    {usage.input_tokens + usage.output_tokens} tokens
                  </span>
                </Tooltip>
                {prettyCost(usage.cost_usd ?? usage.cost) ? (
                  <Tooltip content="Jev reported cost (USD)">
                    <span className="inline-flex items-center gap-1">
                      <RiCoinsLine className="w-3 h-3" />
                      {prettyCost(usage.cost_usd ?? usage.cost)}
                    </span>
                  </Tooltip>
                ) : null}
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );

  const content = (
    <div className="px-3 pb-3 text-xs text-text-tertiary bg-bg-secondary">
      {inputs}
      {questions && (
        <>
          <div className="mb-1 ml-1 text-2xs font-medium uppercase tracking-wide text-text-secondary">Questions</div>
          <CodeBlock baseDir={projectDir || ''} taskId={task?.id} language="json" isComplete={true} className="text-2xs">
            {questions}
          </CodeBlock>
        </>
      )}
      {message.content && (
        <>
          <div className="mb-1 ml-1 mt-2 text-2xs font-medium uppercase tracking-wide text-text-secondary">Answers</div>
          {result.isError ? (
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded bg-bg-primary-light p-3 font-mono text-2xs text-error">
              {result.text}
            </pre>
          ) : (
            answersSection
          )}
        </>
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
