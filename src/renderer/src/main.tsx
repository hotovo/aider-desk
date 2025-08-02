import './main.css';

import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/electron/renderer';

import App from './App';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [],
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
