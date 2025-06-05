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
import { ContextMenu, useAiderDeskContextMenu } from '@/components/common/ContextMenu';

const ThemeManager = () => {
  const { settings } = useSettings();

  useEffect(() => {
    const className = settings?.theme === 'light' ? 'theme-light' : 'theme-dark';
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(className);
  }, [settings?.theme]);

  return null;
};

const AnimatedRoutes = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { settings } = useSettings();
  const { show } = useAiderDeskContextMenu();

  useEffect(() => {
    if (settings?.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [i18n, settings]);

  // Add context menu event listener
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      const target = event.target as HTMLElement;
      const targetIsEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const selectedText = window.getSelection()?.toString() || '';
      const hasSelectedText = selectedText.length > 0;

      // Only show the menu if there's at least one action available
      if (hasSelectedText || targetIsEditable) {
        show({
          event,
          props: {
            targetIsEditable,
            hasSelectedText,
          }
        });
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [show]);

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
          <ContextMenu />
        </SettingsProvider>
      </Router>
    </motion.div>
  );
};

export default App;
