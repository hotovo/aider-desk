({ data, task, ui, icons, executeExtensionAction }) => {
  const { Button } = ui;
  const MdOutlineSchedule = icons.Md.MdOutlineSchedule;

  const schedule = data?.schedule;
  const isTodo = !task?.state || task?.state === 'TODO';

  if (schedule || !isTodo) {
    return null;
  }

  return (
    <Button variant="outline" color="primary" size="xs" onClick={() => executeExtensionAction('add')}>
      <MdOutlineSchedule className="mr-1 w-3 h-3" />
      Set Schedule
    </Button>
  );
};
