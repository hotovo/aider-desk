import './main.css';

import ReactDOM from 'react-dom/client';

import App from './App';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { DevelopmentPerformanceCleanup } from '@/components/common/DevelopmentPerformanceCleanup';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppErrorBoundary>
    <App />
    {import.meta.env.DEV && <DevelopmentPerformanceCleanup />}
  </AppErrorBoundary>,
);

const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to register service worker:', error);
    });
  }
};

window.addEventListener('load', registerServiceWorker);
