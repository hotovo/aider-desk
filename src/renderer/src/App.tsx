import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';

import { Onboarding } from '@/pages/Onboarding';
import { Home } from '@/pages/Home';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import 'react-toastify/dist/ReactToastify.css';
import { ROUTES } from '@/utils/routes';

const AnimatedRoutes = () => {
  const location = useLocation();
  const { settings } = useSettings();

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
          <Routes location={location}>
            <Route path={ROUTES.Onboarding} element={<Onboarding />} />
            <Route path={ROUTES.Home} element={<Home />} />
            {settings && (
              <Route path="/" element={settings.onboardingFinished ? <Navigate to={ROUTES.Home} replace /> : <Navigate to={ROUTES.Onboarding} replace />} />
            )}
          </Routes>
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
          <AnimatedRoutes />
          <ToastContainer />
        </SettingsProvider>
      </Router>
    </motion.div>
  );
};

export default App;