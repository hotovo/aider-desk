(props) => {
  const { task, ui, icons, executeExtensionAction } = props;
  const { Button } = ui;
  const { useCallback } = React;
  const VscRunCoverage = icons.Vsc.VscRunCoverage;

  const handleProceedAndVerify = useCallback(() => {
    executeExtensionAction('proceed-and-verify', task?.id);
  }, [executeExtensionAction, task?.id]);

  if (task?.state !== 'READY_FOR_IMPLEMENTATION') {
    return null;
  }

  return (
    <Button variant="outline" color="primary" size="xs" onClick={handleProceedAndVerify}>
      <VscRunCoverage className="w-4 h-4 mr-1" />
      Proceed & Verify
    </Button>
  );
};
