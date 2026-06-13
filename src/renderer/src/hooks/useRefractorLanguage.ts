import { useCallback, useEffect, useState } from 'react';

import { refractor } from '@/utils/highlighter';
import { getLangLoader } from '@/utils/refractor-languages';

const registeredLangs = new Set<string>();

export const useRefractorLanguage = (language: string): boolean => {
  const [registeredVersion, setRegisteredVersion] = useState(0);
  const increment = useCallback(() => setRegisteredVersion((v) => v + 1), []);
  const isRegistered = refractor.registered(language);

  useEffect(() => {
    if (refractor.registered(language)) {
      return;
    }

    if (registeredLangs.has(language)) {
      return;
    }

    const loader = getLangLoader(language);
    if (!loader) {
      return;
    }

    let cancelled = false;
    registeredLangs.add(language);

    void loader().then((mod) => {
      if (cancelled) {
        return;
      }
      try {
        if (!refractor.registered(mod.default.displayName)) {
          refractor.register(mod.default);
        }
        if (mod.default.aliases) {
          for (const alias of mod.default.aliases) {
            registeredLangs.add(alias);
          }
        }
        increment();
      } catch {
        // Registration may fail if the grammar has unmet dependencies
      }
    });

    return () => {
      cancelled = true;
    };
  }, [language, increment]);

  // Suppress the unused variable warning — registeredVersion is the re-render trigger
  void registeredVersion;

  return isRegistered;
};
