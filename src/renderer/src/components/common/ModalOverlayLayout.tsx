import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IoMdClose } from 'react-icons/io';

import { IconButton } from './IconButton';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export const ModalOverlayLayout = ({ title, onClose, children }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="absolute inset-0 bg-bg-primary-light z-50 flex flex-col overflow-hidden">
      <div className="flex items-center border-b-2 border-border-default justify-between bg-gradient-to-b from-bg-primary to-bg-primary-light min-h-[40px] pl-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-md uppercase font-medium text-text-primary">{title}</h2>
        </div>
        <IconButton
          icon={<IoMdClose className="h-5 w-5 text-text-secondary" />}
          onClick={onClose}
          tooltip={t('common.close')}
          className="px-4 py-2 hover:text-text-secondary hover:bg-bg-tertiary-emphasis transition-colors duration-200"
        />
      </div>
      {children}
    </div>
  );
};
