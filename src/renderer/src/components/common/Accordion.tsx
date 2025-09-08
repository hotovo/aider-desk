import { ReactNode, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

type Props = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  defaultOpen?: boolean;
  chevronPosition?: 'left' | 'right';
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  noMaxHeight?: boolean;
  scrollToVisibleWhenExpanded?: boolean;
  showCollapseButton?: boolean;
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
  noMaxHeight = false,
  scrollToVisibleWhenExpanded = false,
  showCollapseButton = false,
}: Props) => {
  const { t } = useTranslation();
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : uncontrolledIsOpen;
  const contentRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = () => {
    if (onOpenChange) {
      onOpenChange(!isOpen);
    } else {
      setUncontrolledIsOpen(!uncontrolledIsOpen);
    }

    // Scroll to visible when expanding
    if (!isOpen && scrollToVisibleWhenExpanded && contentRef.current) {
      setTimeout(() => {
        contentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
    }
  };

  const chevron = (
    <FaChevronDown className={clsx('w-3 h-3 transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90', chevronPosition === 'right' && 'ml-1')} />
  );

  return (
    <div className={className}>
      <button
        onClick={handleOpenChange}
        className={clsx('w-full flex items-center gap-2 p-2 rounded hover:bg-bg-tertiary-strong transition-colors', buttonClassName)}
      >
        {chevronPosition === 'left' && chevron}
        {title}
        {chevronPosition === 'right' && chevron}
      </button>
      <div
        ref={contentRef}
        className={clsx(
          'overflow-hidden transition-all duration-200',
          isOpen
            ? clsx(
                noMaxHeight ? '' : 'max-h-screen',
                'opacity-100 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth',
              )
            : 'max-h-0 opacity-0',
        )}
      >
        {children}
        {showCollapseButton && isOpen && (
          <div className="my-2 flex justify-center">
            <button
              onClick={handleOpenChange}
              className="flex items-center gap-1.5 px-2 py-1 bg-bg-tertiary-strong hover:bg-bg-fourth rounded opacity-80 hover:opacity-100 transition-colors text-xs"
            >
              <FaChevronDown className="w-2 h-2 rotate-180" />
              {t('common.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
