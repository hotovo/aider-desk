// Renders the pending inline plan review. The component is deliberately gated
// ONLY on the extension-provided data (data.kind === 'plan'): the pending review
// data exists exactly while the exit_plan_mode tool call is waiting for a
// decision, while the optional `message` prop is not passed by the renderer for
// unfinished tool messages — so it can never be used for gating here.
({ data, message, executeExtensionAction, ui, projectDir }) => {
  const { useState, useCallback } = React;
  const [feedback, setFeedback] = useState('');
  // Track WHICH review round this instance submitted, keyed by the
  // extension-provided data.reviewId (a fresh unique ID per pending review).
  // The component is mounted once at task level (stable key), so a plain
  // boolean `submitted` would leak into the next plan-review round
  // (plan -> null -> plan) and hide the action buttons forever; deriving from
  // the reviewId re-arms the buttons whenever a new review round arrives, and
  // the same ID is echoed back on actions so the extension can reject stale
  // (superseded) panels whose review no longer exists.
  const [submittedFor, setSubmittedFor] = useState(null);
  const submitted = !!data && data.reviewId != null && data.reviewId === submittedFor;
  const reviewId = data?.reviewId ?? null;

  // All hooks must run BEFORE any conditional return: the component is mounted
  // at task level even while data is null, and a varying hook count across
  // renders would crash React. ui.* components stay below the return on purpose.
  // Actions ALWAYS carry the CURRENT data.reviewId (truthy here because the
  // extension data carries a fresh unique ID per pending review round); if no
  // ID was rendered, no action is sent at all — the extension rejects any
  // missing or non-matching reviewId echo as a stale payload, so sending
  // nothing is the only safe behavior.
  const normalizeFeedback = (value) => typeof value === 'string' ? value.trim() : '';

  const handleApprove = useCallback(() => {
    if (!reviewId) return;
    setSubmittedFor(reviewId);
    executeExtensionAction('approve', { feedback: normalizeFeedback(feedback), reviewId });
  }, [reviewId, executeExtensionAction, feedback]);

  const handleDeny = useCallback(() => {
    if (!reviewId) return;
    setSubmittedFor(reviewId);
    executeExtensionAction('deny', { feedback: normalizeFeedback(feedback), reviewId });
  }, [reviewId, executeExtensionAction, feedback]);

  if (!data || data.kind !== 'plan') return null;

  const Button = ui.Button;
  const TextArea = ui.TextArea;

  return (
    <div className="mt-2 mb-1 px-1 flex flex-col gap-2 rounded-md border border-border-default p-3 bg-bg-primary">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">Plan Review</span>
        <span className="text-2xs text-text-muted">Approve to start implementation</span>
      </div>
      <pre className="max-h-64 overflow-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth rounded bg-bg-secondary-light p-2 text-xs text-text-primary whitespace-pre-wrap break-words">
        {data.plan}
      </pre>
      <TextArea
        label="Feedback (optional)"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Approval notes, or reasons the plan needs changes..."
        rows={3}
      />
      {submitted ? (
        <div className="text-xs text-text-secondary">Review submitted...</div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <Button variant="contained" color="primary" size="sm" onClick={handleApprove}>
            Approve
          </Button>
          <Button variant="contained" color="danger" size="sm" onClick={handleDeny}>
            Request changes
          </Button>
        </div>
      )}
    </div>
  );
};
