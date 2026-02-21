import { Extension } from '@common/extensions/types';

export default class ExtensionWithoutMetadata implements Extension {
  onLoad?(): void {
    console.log('Loaded');
  }
}
