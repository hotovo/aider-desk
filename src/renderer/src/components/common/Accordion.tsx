import { ReactNode, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import clsx from 'clsx';

type Props = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  defaultOpen?: boolean;
  chevronPosition?: 'left' | 'right';
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  style?: React.CSSProperties;
};

export const Accordion = ({
  title,
  children,
  className,
  buttonClassName = '',
  defaultOpen = false,
  chevronPosition = 'left',
  isOpen: controlledIsOpen,
  onOpenChange,
  style,
}: Props) => {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : uncontrolledIsOpen;

  const handleOpenChange = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setUncontrolledIsOpen(!uncontrolledIsOpen);
    }
  };

  const chevron = (
    <FaChevronDown className={clsx('w-3 h-3 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90', chevronPosition === 'right' && 'ml-1')} />
  );

  return (
    <div className={className} style={style}>
      <button
        onClick={handleOpenChange}
        className={clsx('w-full flex items-center gap-2 p-2 rounded hover:bg-neutral-700/50 transition-colors', buttonClassName)}
      >
        {chevronPosition === 'left' && chevron}
        {title}
        {chevronPosition === 'right' && chevron}
      </button>
      <div
        className={clsx(
          'overflow-hidden transition-all duration-200',
          isOpen
            ? 'max-h-screen opacity-100 overflow-y-auto scrollbar-thin scrollbar-track-neutral-850 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600'
            : 'max-h-0 opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
};
