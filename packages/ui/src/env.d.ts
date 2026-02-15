/// <reference types="vite/client" />

import { ApplicationAPI } from '@aider-desk/common/api';

declare global {
  interface Window {
    api: ApplicationAPI;
  }
}

export {};
