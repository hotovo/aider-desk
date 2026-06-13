import { useEffect, useRef, useState } from 'react';

type ReactIconsMap = Record<string, Record<string, unknown>>;

const ICON_PACK_KEYS = [
  'Fi',
  'Fa',
  'Md',
  'Ai',
  'Bi',
  'Bs',
  'Cg',
  'Di',
  'Fc',
  'Gi',
  'Go',
  'Gr',
  'Hi',
  'Im',
  'Io',
  'Io5',
  'Ri',
  'Si',
  'Tb',
  'Ti',
  'Vsc',
  'Wi',
] as const;

export const iconPackStubs: ReactIconsMap = Object.fromEntries(ICON_PACK_KEYS.map((key) => [key, {}]));

let iconsCache: ReactIconsMap | null = null;
let iconsLoading: Promise<ReactIconsMap> | null = null;

export const loadReactIcons = (): Promise<ReactIconsMap> => {
  if (iconsCache) {
    return Promise.resolve(iconsCache);
  }
  if (iconsLoading) {
    return iconsLoading;
  }

  iconsLoading = Promise.all([
    import('react-icons/fi'),
    import('react-icons/fa'),
    import('react-icons/md'),
    import('react-icons/ai'),
    import('react-icons/bi'),
    import('react-icons/bs'),
    import('react-icons/cg'),
    import('react-icons/di'),
    import('react-icons/fc'),
    import('react-icons/gi'),
    import('react-icons/go'),
    import('react-icons/gr'),
    import('react-icons/hi'),
    import('react-icons/im'),
    import('react-icons/io'),
    import('react-icons/io5'),
    import('react-icons/ri'),
    import('react-icons/si'),
    import('react-icons/tb'),
    import('react-icons/ti'),
    import('react-icons/vsc'),
    import('react-icons/wi'),
  ]).then(([Fi, Fa, Md, Ai, Bi, Bs, Cg, Di, Fc, Gi, Go, Gr, Hi, Im, Io, Io5, Ri, Si, Tb, Ti, Vsc, Wi]) => {
    iconsCache = {
      Fi,
      Fa,
      Md,
      Ai,
      Bi,
      Bs,
      Cg,
      Di,
      Fc,
      Gi,
      Go,
      Gr,
      Hi,
      Im,
      Io,
      Io5,
      Ri,
      Si,
      Tb,
      Ti,
      Vsc,
      Wi,
    };
    return iconsCache;
  });

  return iconsLoading;
};

export const useReactIcons = (): ReactIconsMap | null => {
  const [icons, setIcons] = useState<ReactIconsMap | null>(iconsCache);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (iconsCache) {
      return;
    }
    void loadReactIcons().then((loaded) => {
      if (mountedRef.current) {
        setIcons(loaded);
      }
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return icons;
};
