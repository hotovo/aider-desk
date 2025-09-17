import { toast } from 'react-toastify';

import type { ToastOptions } from 'react-toastify';

const baseOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progressStyle: {
    backgroundColor: 'var(--color-bg-tertiary)',
    color: 'var(--color-bg-tertiary)',
  },
  style: {
    backgroundColor: 'var(--color-bg-secondary-light)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-dark-light-strong)',
    borderRadius: '0.375rem',
    fontFamily: '"Sono", monospace',
    fontSize: '0.75rem',
  },
  icon: false,
};

const getOptions = (): ToastOptions => ({
  ...baseOptions,
});

export const showSuccessNotification = (message: string) => {
  const options = getOptions();
  toast.success(message, {
    ...options,
    style: {
      ...options.style,
      color: 'var(--color-text-primary)',
    },
  });
};

export const showErrorNotification = (message: string) => {
  const options = getOptions();
  toast.error(message, {
    ...options,
    style: {
      ...options.style,
      color: 'var(--color-error)',
    },
  });
};

export const showInfoNotification = (message: string) => {
  const options = getOptions();
  toast.info(message, {
    ...options,
    style: {
      ...options.style,
      color: 'var(--color-text-primary)',
    },
  });
};

export const showWarningNotification = (message: string) => {
  const options = getOptions();
  toast.warn(message, {
    ...options,
    style: {
      ...options.style,
      backgroundColor: 'var(--color-bg-primary-light-strong)',
      color: 'var(--color-warning-light)',
    },
  });
};
