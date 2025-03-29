import { Checkbox } from '../common/Checkbox';

type Props = {
  serverName: string;
  disabled: boolean;
  onToggle: (serverName: string) => void;
};

export const McpServerSelectorItem = ({ serverName, disabled, onToggle }: Props) => {
  return (
    <div className="flex items-center px-3 py-1 hover:bg-neutral-700 cursor-pointer text-xs" onClick={() => onToggle(serverName)}>
      <Checkbox checked={!disabled} onChange={() => onToggle(serverName)} className="mr-1" label={serverName} />
    </div>
  );
};
