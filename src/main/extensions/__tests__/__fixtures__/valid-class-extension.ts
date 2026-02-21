import { Extension, ExtensionMetadata } from '@common/extensions/types';

export default class TestExtension implements Extension {
  static metadata: ExtensionMetadata = {
    name: 'test-extension',
    version: '1.0.0',
    description: 'A test extension',
    author: 'Test Author',
  };

  onLoad?(): void {
    console.log('Extension loaded');
  }
}
