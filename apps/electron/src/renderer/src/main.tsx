/**
 * Electron Renderer Entry Point
 *
 * This imports and renders the main App from @aider-desk/ui package.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@aider-desk/ui';

// Import styles from UI package
import '@aider-desk/ui/fonts';
import '@aider-desk/ui/styles';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
