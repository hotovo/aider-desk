import { READONLY_EXTENSION_UI } from '@/constants';
import { Store } from '@/store';

export const isReadonlyExtensionUiEnabled = (store: Store): boolean => {
  if (READONLY_EXTENSION_UI === 'true') {
    return true;
  }
  if (READONLY_EXTENSION_UI === 'false') {
    return false;
  }
  return store.getSettings().server.readonlyExtensionUi ?? true;
};
