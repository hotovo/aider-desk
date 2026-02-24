import { ExtensionApi } from '@common/extensions';

export default class ExtensionWithoutMetadata implements ExtensionApi {
  onLoad?(): void {
    console.log('Loaded');
  }
}
