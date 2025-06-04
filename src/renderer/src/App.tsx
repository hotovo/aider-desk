import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { Onboarding } from '@/pages/Onboarding';
import { Home } from '@/pages/Home';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';
import '@/i18n';
import { StyledTooltip } from '@/components/common/StyledTooltip';

const ThemeManager = () => {
  const { settings } = useSettings();

  useEffect(() => {
    const className = settings?.theme === 'light' ? 'theme-light' : 'theme-dark';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(className);
  }, [settings?.theme]);

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      const fontFamily = settings.fontFamily || 'Sono';
      const monospaceFontFamily = settings.monospaceFontFamily || 'Sono';
      
      root.style.setProperty('--font-family-sans', fontFamily);
      root.style.setProperty('--font-family-mono', monospaceFontFamily);
      
      console.log('Font settings applied:', { fontFamily, monospaceFontFamily });
    }
  }, [settings?.fontFamily, settings?.monospaceFontFamily]);

  return null;
};

const AnimatedRoutes = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { settings } = useSettings();

  useEffect(() => {
    if (settings?.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [i18n, settings]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <AnimatePresence initial={true}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, position: 'absolute', width: '100%', height: '100%' }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {settings && (
            <Routes location={location}>
              <Route path={ROUTES.Onboarding} element={<Onboarding />} />
              <Route path={ROUTES.Home} element={<Home />} />
              <Route path="/" element={settings.onboardingFinished ? <Navigate to={ROUTES.Home} replace /> : <Navigate to={ROUTES.Onboarding} replace />} />
            </Routes>
          )}
          <StyledTooltip id="global-tooltip-sm" />
          <StyledTooltip id="global-tooltip-md" maxWidth={600} />
          <StyledTooltip id="global-tooltip-lg" maxWidth="90%" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const App = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: isVisible ? 1 : 0 }} transition={{ duration: 0.5, ease: 'easeIn' }}>
      <Router>
        <SettingsProvider>
          <ThemeManager />
          <AnimatedRoutes />
          <ToastContainer />
        </SettingsProvider>
      </Router>
    </motion.div>
  );
};

export default App;
