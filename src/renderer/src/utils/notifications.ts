import { toast } from 'react-toastify';

import type { ToastOptions } from 'react-toastify';

const baseOptions: ToastOptions = {
  position: 'bottom-right',
  autoClose: 3000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progressStyle: {
    backgroundColor: '#333652', // neutral-700 from tailwind.config.js
    color: '#333652',
  },
  style: {
    backgroundColor: '#222431',
    color: '#f1f3f5',
    border: '1px solid #343a40',
    borderRadius: '0.375rem',
    fontFamily: '"Sono", monospace',
    fontSize: '0.75rem',
  },
  icon: false,
};

const getOptions = (): ToastOptions => ({
  ...baseOptions,
  theme: document.body.classList.contains('theme-light') ? 'light' : 'dark',
});

export const showSuccessNotification = (message: string) => {
  const options = getOptions();
  toast.success(message, {
    ...options,
    style: {
      ...options.style,
      color: '#e9ecef',
    },
  });
};

export const showErrorNotification = (message: string) => {
  const options = getOptions();
  toast.error(message, {
    ...options,
    style: {
      ...options.style,
      color: '#dd7171',
    },
  });
};

export const showInfoNotification = (message: string) => {
  const options = getOptions();
  toast.info(message, {
    ...options,
    style: {
      ...options.style,
      color: '#dee2e6',
    },
  });
};

export const showWarningNotification = (message: string) => {
  const options = getOptions();
  toast.warn(message, {
    ...options,
    style: {
      ...options.style,
      backgroundColor: '#212529',
      color: '#fed7aa',
    },
  });
};
