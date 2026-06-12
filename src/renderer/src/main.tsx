import './main.css';

import ReactDOM from 'react-dom/client';

import App from './App';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
