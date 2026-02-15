import { ApplicationAPI } from '@aider-desk/common/api';

import type { ElectronAPI } from '@electron-toolkit/preload';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
  }
}
