({ data, executeExtensionAction, ui, icons }) => {
  const { useState, useCallback, useMemo, useEffect } = React;
  const { Button, TextArea } = ui;
  const { FiChevronLeft, FiChevronRight, FiX, FiSend } = icons.Fi;

  const [answers, setAnswers] = useState({});

  const questions = data?.questions || [];
  const currentIndex = data?.currentIndex || 0;
  const totalQuestions = data?.totalQuestions || 0;
  const isActive = data?.isActive;

  const currentQuestion = questions[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalQuestions - 1;

  const answeredCount = useMemo(() => {
    return questions.filter(q => answers[q.id]).length;
  }, [questions, answers]);

  const allAnswered = useMemo(() => {
    return totalQuestions > 0 && answeredCount === totalQuestions;
  }, [totalQuestions, answeredCount]);

  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] || '') : '';

  const handlePrev = useCallback(() => {
    executeExtensionAction('navigate', 'prev');
  }, [executeExtensionAction]);

  const handleNext = useCallback(() => {
    executeExtensionAction('navigate', 'next');
  }, [executeExtensionAction]);

  const handleAnswerChange = useCallback((e) => {
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: e.target.value
      }));
    }
  }, [currentQuestion]);

  const handleClose = useCallback(() => {
    executeExtensionAction('close');
  }, [executeExtensionAction]);

  const handleSubmit = useCallback(() => {
    const answersArray = questions.map(q => ({
      id: q.id,
      text: q.text,
      answer: answers[q.id] || ''
    }));

    executeExtensionAction('submit-answers', answersArray);
    setAnswers({});
  }, [questions, answers, executeExtensionAction]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (hasNext) {
        handleNext();
      }
    }
  }, [handleNext, hasNext]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (!isActive) return;

      if (e.altKey && e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        handlePrev();
      } else if (e.altKey && e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isActive, hasPrev, hasNext, handlePrev, handleNext]);

  if (!isActive || questions.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-accent-primary/10 border border-border-dark-light rounded-lg p-3 mb-2">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-accent-primary">
            Questionnaire
          </span>
          <span className="text-xs text-text-muted">
            {answeredCount}/{totalQuestions} answered
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-text-muted hover:text-text-primary transition-colors"
          title="Close questionnaire"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-bg-secondary/50 rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          {currentAnswer && (
            <span className="text-xs text-success">Answered</span>
          )}
        </div>
        <p className="text-sm text-text-primary leading-relaxed">
          {currentQuestion?.text}
        </p>
      </div>

      <div className="mb-3">
        <TextArea
          value={currentAnswer}
          onChange={handleAnswerChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer here... (Alt+←/→ to navigate, Ctrl/Cmd+Enter for next)"
          rows={3}
          className="w-full text-sm"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrev}
            disabled={!hasPrev}
            size="sm"
            variant="outline"
            color="tertiary"
          >
            <FiChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <Button
            onClick={handleNext}
            disabled={!hasNext}
            size="sm"
            variant="outline"
            color="tertiary"
          >
            Next
            <FiChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!allAnswered}
          size="sm"
          color="primary"
        >
          <FiSend className="w-4 h-4 mr-1" />
          Submit All
        </Button>
      </div>
    </div>
  );
};
