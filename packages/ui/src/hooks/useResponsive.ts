import { useState, useEffect } from 'react';
import { debounce } from 'lodash';

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < BREAKPOINTS.mobile);
      setIsTablet(width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet);
      setIsDesktop(width >= BREAKPOINTS.tablet);
    };

    checkScreenSize();
    const debouncedCheckScreenSize = debounce(checkScreenSize, 150);
    window.addEventListener('resize', debouncedCheckScreenSize);
    return () => window.removeEventListener('resize', debouncedCheckScreenSize);
  }, []);

  return { isMobile, isTablet, isDesktop };
};
