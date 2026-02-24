import { Extension } from '@common/extensions';

export default class ExtensionWithoutMetadata implements Extension {
  onLoad?(): void {
    console.log('Loaded');
  }
}
