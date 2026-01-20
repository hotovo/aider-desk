import '@/themes/themes.scss';
import { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { THEMES } from '@common/types';

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
import { AgentsProvider } from '@/contexts/AgentsContext';
import { IconProvider } from '@/contexts/IconProvider';

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
      <div
        key={location.pathname}
        className="absolute inset-0 w-full h-full transition-opacity duration- ease-out"
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
      </div>
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
    <div className={`transition-opacity duration-200 ease-in ${isVisible ? 'opacity-1' : 'opacity-0'}`}>
      <Router>
        <ApiProvider>
          <IconProvider>
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
          </IconProvider>
        </ApiProvider>
      </Router>
    </div>
  );
};

export default App;
