import '@/themes/themes.scss';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { THEMES } from '@common/types';
import { IconContext } from 'react-icons';

import { Onboarding } from '@/pages/Onboarding';
import { Home } from '@/pages/Home';
import { ContextMenuProvider, useContextMenu } from '@/contexts/ContextMenuContext';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';
import '@/i18n';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ApiProvider } from '@/contexts/ApiContext';
import { ModelProviderProvider } from '@/contexts/ModelProviderContext';
import { AgentsProvider } from '@/contexts/AgentsContext';

const ICON_CONTEXT_DEFAULT_VALUE: IconContext = {};

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
          initial={{
            opacity: 0,
            position: 'absolute',
            width: '100%',
            height: '100%',
          }}
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
        <TooltipProvider>
          <ApiProvider>
            <IconContext.Provider value={ICON_CONTEXT_DEFAULT_VALUE}>
              <ModelProviderProvider>
                <SettingsProvider>
                  <AgentsProvider>
                    <ContextMenuProvider>
                      <ThemeAndFontManager />
                      <AnimatedRoutes />
                      <ToastContainer />
                    </ContextMenuProvider>
                  </AgentsProvider>
                </SettingsProvider>
              </ModelProviderProvider>
            </IconContext.Provider>
          </ApiProvider>
        </TooltipProvider>
      </Router>
    </motion.div>
  );
};

export default App;
