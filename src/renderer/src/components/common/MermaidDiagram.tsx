import { useEffect, useRef, useState } from 'react';
import { detectType, load, mount, type Mounted } from 'pele/lazy';
import { CgSpinner } from 'react-icons/cg';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

type Props = {
  code: string;
  className?: string;
  isComplete?: boolean;
};

export const MermaidDiagram = ({ code, className, isComplete = true }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<Mounted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const observer = new MutationObserver(() => diagramRef.current?.refresh());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      diagramRef.current?.destroy();
      diagramRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const renderDiagram = async () => {
      try {
        let type: ReturnType<typeof detectType> = null;
        try {
          type = detectType(code);
        } catch {
          // Let mount display syntax errors while retaining the last valid diagram.
        }
        await load(type);
        if (cancelled || !containerRef.current) {
          return;
        }

        const options = {
          fontSize: 14,
          images: false,
          links: false,
          autoDirection: false,
          zoom: {
            labels: {
              zoomIn: t('mermaid.zoomIn'),
              zoomOut: t('mermaid.zoomOut'),
              reset: t('mermaid.resetZoom'),
            },
          },
        };

        if (diagramRef.current) {
          diagramRef.current.update(code.trim(), options);
        } else {
          diagramRef.current = mount(containerRef.current, code.trim(), options);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  return (
    <div className={clsx('mermaid-diagram min-w-0 w-full p-4 rounded-md', className)} data-streaming={!isComplete || undefined}>
      {isLoading && (
        <div className="flex items-center justify-center p-6 text-text-muted">
          <CgSpinner className="w-6 h-6 animate-spin text-text-primary" />
        </div>
      )}
      <div ref={containerRef} className="min-w-0 w-full overflow-x-auto" />
      {error && isComplete && (
        <div className="p-4 bg-bg-error-light text-text-error rounded-md" role="alert">
          <p className="text-xs">{t('mermaid.renderFailed')}</p>
          <pre className="text-xs mt-1 overflow-auto">{error}</pre>
        </div>
      )}
    </div>
  );
};
