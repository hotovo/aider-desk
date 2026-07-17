import { useTranslation } from 'react-i18next';

import { MessageImages } from './MessageImages';

import type { ToolResultImage } from './utils';

type Props = {
  images: ToolResultImage[];
};

export const ToolResultImages = ({ images }: Props) => {
  const { t } = useTranslation();

  if (images.length === 0) {
    return null;
  }

  const dataUrls = images.map((image) => `data:${image.mediaType};base64,${image.data}`);

  return (
    <div className="mt-2">
      <div className="text-text-secondary text-xs font-semibold mb-1">{t('toolMessage.images', { count: images.length })}</div>
      <MessageImages
        images={dataUrls}
        altPrefix="Tool result image"
        thumbnailClassName="max-h-40 max-w-[200px] rounded-md border border-border-dark-light cursor-pointer hover:opacity-80 transition-opacity object-contain"
      />
    </div>
  );
};
