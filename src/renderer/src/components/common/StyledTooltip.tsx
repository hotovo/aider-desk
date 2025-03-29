import { Tooltip } from 'react-tooltip';

type Props = {
  id: string;
};

export const StyledTooltip = ({ id }: Props) => (
  <Tooltip
    id={id}
    className="!bg-neutral-900 !text-neutral-300 !text-xxs !py-1 !px-2 !opacity-100 !rounded-md !max-w-[300px] z-50"
    border="1px solid #495057"
  />
);
