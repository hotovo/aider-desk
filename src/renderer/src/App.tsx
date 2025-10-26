import '@/themes/themes.scss';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { THEMES } from '@common/types';

import { useResponsive } from '@/hooks/useResponsive';
import { Onboarding } from '@/pages/Onboarding';
import { Home } from '@/pages/Home';
import { ContextMenuProvider, useContextMenu } from '@/contexts/ContextMenuContext';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';
import '@/i18n';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { ApiProvider } from '@/contexts/ApiContext';
import { ModelProviderProvider } from '@/contexts/ModelProviderContext';

const ThemeAndFontManager = () => {
  const { theme, font = 'Sono', fontSize = 16 } = useSettings();

  useEffect(() => {
    // Remove all theme classes first
    const themeClasses = THEMES.map((name) => `theme-${name}`);
    document.body.classList.remove(...themeClasses);

    // Add the current theme class, default to dark
    const newTheme = theme && THEMES.includes(theme) ? theme : 'dark';
    document.body.classList.add(`theme-${newTheme}`);

    document.documentElement.style.setProperty('--font-family', `"${font}", monospace`);
    document.documentElement.style.setProperty('font-size', `${fontSize}px`);
    document.documentElement.style.setProperty('font-variation-settings', '"MONO" 1');
  }, [font, theme, fontSize]);

  return null;
};

const AnimatedRoutes = () => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const { settings } = useSettings();
  const { isMobile: _isMobile, isTablet: _isTablet, isDesktop: _isDesktop } = useResponsive();
  useContextMenu();

  useEffect(() => {
    if (settings?.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [i18n, settings]);

  return (
    <div className="absolute inset-0">
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
    setTimeout(() => {
      setIsVisible(true);
    }, 100);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: isVisible ? 1 : 0 }} transition={{ duration: 0.5, ease: 'easeIn' }}>
      <Router>
        <ApiProvider>
          <ModelProviderProvider>
            <SettingsProvider>
              <ContextMenuProvider>
                <ThemeAndFontManager />
                <AnimatedRoutes />
                <ToastContainer />
              </ContextMenuProvider>
            </SettingsProvider>
          </ModelProviderProvider>
        </ApiProvider>
      </Router>
    </motion.div>
  );
};

export default App;
