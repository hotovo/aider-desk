import type { TFunction } from 'i18next';

export const formatHumanReadable = (t: TFunction, value: number): string => {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(1) + t('common.suffix.billion');
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(1) + t('common.suffix.million');
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(1) + t('common.suffix.thousand');
  }
  return value.toString();
};
