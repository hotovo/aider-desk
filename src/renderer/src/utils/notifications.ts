import { toast } from 'react-toastify';

import type { ToastOptions } from 'react-toastify';

const getBaseStyle = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  return {
    backgroundColor: computedStyle.getPropertyValue('--theme-background-tertiary').trim() || '#2a2c3f',
    color: computedStyle.getPropertyValue('--theme-foreground-primary').trim() || '#f1f3f5',
    border: `1px solid ${computedStyle.getPropertyValue('--theme-border-primary').trim() || '#343a40'}`,
    borderRadius: '0.375rem',
    fontFamily: '"Sono", monospace',
    fontSize: '0.75rem',
  };
};

const getProgressStyle = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  const bgColor = computedStyle.getPropertyValue('--theme-background-input').trim() || '#333652';
  return {
    backgroundColor: bgColor,
    color: bgColor,
  };
};

const baseOptions: ToastOptions = {
  position: 'bottom-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progressStyle: getProgressStyle(),
  style: getBaseStyle(),
  icon: false,
};

const getOptions = (): ToastOptions => ({
  ...baseOptions,
  theme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
  style: getBaseStyle(),
  progressStyle: getProgressStyle(),
});

const getThemedColor = (fallback: string) => {
  const computedStyle = getComputedStyle(document.documentElement);
  return computedStyle.getPropertyValue('--theme-foreground-primary').trim() || fallback;
};

const getThemedErrorColor = () => {
  const computedStyle = getComputedStyle(document.documentElement);
  return computedStyle.getPropertyValue('--theme-foreground-error').trim() || '#e16b6b';
};

export const showSuccessNotification = (message: string) => {
  const options = getOptions();
  toast.success(message, {
    ...options,
    style: {
      ...options.style,
      color: getThemedColor('#e9ecef'),
    },
  });
};

export const showErrorNotification = (message: string) => {
  const options = getOptions();
  toast.error(message, {
    ...options,
    style: {
      ...options.style,
      color: getThemedErrorColor(),
    },
  });
};

export const showInfoNotification = (message: string) => {
  const options = getOptions();
  toast.info(message, {
    ...options,
    style: {
      ...options.style,
      color: getThemedColor('#f1f3f5'),
    },
  });
};

export const showWarningNotification = (message: string) => {
  const options = getOptions();
  const computedStyle = getComputedStyle(document.documentElement);
  toast.warn(message, {
    ...options,
    style: {
      ...options.style,
      backgroundColor: computedStyle.getPropertyValue('--theme-background-secondary').trim() || '#212529',
      color: '#fed7aa', // Keep orange for warning text
    },
  });
};
