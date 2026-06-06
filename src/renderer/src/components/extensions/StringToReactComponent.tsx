import React, { useRef, useState, useEffect, type FC } from 'react';
import { transpileJsxString } from '@common/jsx-transpiler';

type SucraseOptions = {
  transforms?: Array<'jsx' | 'typescript' | 'imports' | 'flow' | 'react-hot-loader' | 'jest'>;
  production?: boolean;
  [key: string]: unknown;
};

export type StringToReactComponentProps = {
  data?: object;
  babelOptions?: SucraseOptions;
  children?: string;
};

const DEFAULT_SUCRASE_OPTIONS: SucraseOptions = {};

const createBlobUrl = (code: string): string => {
  const blob = new Blob([code], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

const loadModule = async (blobUrl: string, react: typeof React): Promise<FC> => {
  try {
    const module = await import(/* @vite-ignore */ blobUrl);
    return (module?.default || module)(react);
  } catch (error) {
    throw new Error(`StringToReactComponent: failed to load module - ${error}`);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const StringToReactComponent: FC<StringToReactComponentProps> = ({ data, babelOptions, children }) => {
  const [, rerender] = useState<object>({});
  const componentRef = useRef<FC | null>(null);
  const loadIdRef = useRef(0);
  const resolvedOptions = babelOptions ?? DEFAULT_SUCRASE_OPTIONS;
  // eslint-disable-next-line react-hooks/refs
  const Component = componentRef.current;

  useEffect(() => {
    if (!children) {
      componentRef.current = () => null;
      rerender({});
      return;
    }

    if (typeof children !== 'string') {
      throw new Error('StringToReactComponent: children must be a string');
    }

    const currentLoadId = ++loadIdRef.current;

    let blobUrl: string | undefined;
    try {
      const transpiled = transpileJsxString(children, resolvedOptions);
      blobUrl = createBlobUrl(transpiled);
      void loadModule(blobUrl, React).then((Component) => {
        if (typeof Component !== 'function') {
          throw new Error('StringToReactComponent: code inside the passed string must be a function');
        }
        if (currentLoadId === loadIdRef.current) {
          componentRef.current = Component;
          rerender({});
        }
      });
    } catch (error) {
      if (currentLoadId === loadIdRef.current) {
        throw error;
      }
    }
  }, [children, resolvedOptions]);

  // eslint-disable-next-line react-hooks/refs
  if (!Component) {
    return null;
  }

  return <Component {...data} />;
};

export default StringToReactComponent;
