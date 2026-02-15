import { ElementType, useRef, useState } from 'react';
import { MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { Tooltip } from '@/components/ui/Tooltip';
import { useClickOutside } from '@/hooks/useClickOutside';

export type ItemConfig<T extends string = string> = {
  value: T;
  icon: ElementType;
  labelKey: string;
  tooltipKey?: string;
};

type PopupPlacement = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const getPopupPositionClasses = (placement: PopupPlacement): string => {
  switch (placement) {
    case 'top-left':
      return 'bottom-full mb-1 left-0';
    case 'top-right':
      return 'bottom-full mb-1 right-0';
    case 'bottom-left':
      return 'top-full mt-1 left-0';
    case 'bottom-right':
      return 'top-full mt-1 right-0';
  }
};

type Props<T extends string = string> = {
  items: ItemConfig<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
  popupPlacement?: PopupPlacement;
  minWidth?: number;
  iconOnly?: boolean;
};

export const ItemSelector = <T extends string = string>({
  items,
  selectedValue,
  onChange,
  className = '',
  disabled = false,
  popupPlacement = 'top-left',
  minWidth = 150,
  iconOnly = false,
}: Props<T>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleItemSelect = (value: T) => {
    onChange(value);
    setIsOpen(false);
  };

  const selectedItem = items.find((item) => item.value === selectedValue);
  if (!selectedItem) {
    return null;
  }

  const SelectedIcon = selectedItem.icon;
  const popupPositionClasses = getPopupPositionClasses(popupPlacement);

  const renderItem = (item: ItemConfig<T>) => {
    const Icon = item.icon;
    const tooltipContent = item.tooltipKey ? t(item.tooltipKey) : undefined;
    const itemElement = (
      <button
        key={item.value}
        onClick={() => handleItemSelect(item.value)}
        className={`w-full px-3 py-1.5 text-left hover:bg-bg-tertiary transition-colors duration-200 text-xs flex items-center gap-2
        ${item.value === selectedValue ? 'text-text-primary font-semibold bg-bg-tertiary' : 'text-text-tertiary'}`}
      >
        <Icon className="w-4 h-4" />
        {t(item.labelKey)}
      </button>
    );

    if (tooltipContent) {
      return (
        <Tooltip key={item.value} content={tooltipContent} side="right">
          {itemElement}
        </Tooltip>
      );
    }

    return itemElement;
  };

  return (
    <div className={`relative flex items-center gap-1.5 ${className}`} ref={containerRef}>
      <button
        onClick={toggleOpen}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 bg-bg-secondary text-text-tertiary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-xs border-border-default border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <SelectedIcon className="w-4 h-4" />
        {!iconOnly && <span className="mb-[-2px] ml-1 text-2xs">{t(selectedItem.labelKey)}</span>}
        {isOpen ? <MdKeyboardArrowUp className="w-4 h-4 ml-0.5" /> : <MdKeyboardArrowDown className="w-4 h-4 ml-0.5" />}
      </button>

      {isOpen && (
        <div
          className={`absolute ${popupPositionClasses} bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-10 min-w-[${minWidth}px]`}
        >
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );
};
