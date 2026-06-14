import '@/themes/themes.scss';
import { AnimatePresence, motion } from 'framer-motion';
import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { THEMES } from '@common/types';
import { IconContext } from 'react-icons';

import { Home } from '@/pages/Home';
import { Logs } from '@/pages/Logs';
import { ContextMenuProvider, useContextMenu } from '@/contexts/ContextMenuContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';
import '@/i18n';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ApiProvider, useApi } from '@/contexts/ApiContext';
import { ModelProviderProvider } from '@/contexts/ModelProviderContext';
import { AgentsProvider } from '@/contexts/AgentsContext';
import { ModalOverlayUrlViewer } from '@/components/common/ModalOverlayUrlViewer';
import { UpdatedFilesDiff } from '@/pages/UpdatedFilesDiff';
import { ExtensionsProvider } from '@/contexts/ExtensionsContext';
import { DiffsWorkerPoolProvider } from '@/contexts/DiffsWorkerPoolContext';
import { useSettingsStore } from '@/stores/settingsStore';

const Onboarding = lazy(() => import('@/pages/Onboarding').then((module) => ({ default: module.Onboarding })));

const ICON_CONTEXT_DEFAULT_VALUE: IconContext = {};

const ModalOverlayUrlHandler = () => {
  const [modalOverlayUrl, setModalOverlayUrl] = useState<string | null>(null);
  const api = useApi();

  useEffect(() => {
    return api.onModalOverlayUrl((data) => {
      setModalOverlayUrl(data.url);
    });
  }, [api]);

  if (!modalOverlayUrl) {
    return null;
  }

  return <ModalOverlayUrlViewer url={modalOverlayUrl} onClose={() => setModalOverlayUrl(null)} />;
};

const SettingsInitializer = () => {
  const api = useApi();

  useEffect(() => {
    void api.loadSettings().then((data) => {
      useSettingsStore.getState().setSettingsState(data);
    });

    return api.addSettingsUpdatedListener((data) => {
      useSettingsStore.getState().setSettingsState(data);
    });
  }, [api]);

  return null;
};

const ThemeAndFontManager = () => {
  const theme = useSettingsStore((state) => state.theme);
  const font = useSettingsStore((state) => state.font) ?? 'Sono';
  const fontSize = useSettingsStore((state) => state.fontSize) ?? 16;

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
  const settings = useSettingsStore((state) => state.settings);

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
              <Route
                path={ROUTES.Onboarding}
                element={
                  <Suspense fallback={null}>
                    <Onboarding />
                  </Suspense>
                }
              />
              <Route path={ROUTES.Home} element={<Home />} />
              <Route path={ROUTES.Logs} element={<Logs />} />
              <Route path={ROUTES.Diff} element={<UpdatedFilesDiff />} />
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
                <SettingsInitializer />
                <AgentsProvider>
                  <ContextMenuProvider>
                    <ExtensionsProvider>
                      <DiffsWorkerPoolProvider>
                        <ThemeAndFontManager />
                        <AnimatedRoutes />
                        <ToastContainer />
                        <ModalOverlayUrlHandler />
                      </DiffsWorkerPoolProvider>
                    </ExtensionsProvider>
                  </ContextMenuProvider>
                </AgentsProvider>
              </ModelProviderProvider>
            </IconContext.Provider>
          </ApiProvider>
        </TooltipProvider>
      </Router>
    </motion.div>
  );
};

export default App;
