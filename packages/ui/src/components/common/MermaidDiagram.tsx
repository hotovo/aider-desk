import { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import { CgSpinner } from 'react-icons/cg';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
});

type Props = {
  code: string;
  className?: string;
};

export const MermaidDiagram = ({ code, className = '' }: Props) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const diagramId = useId();

  useEffect(() => {
    const renderDiagram = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { svg } = await mermaid.render(diagramId, code.trim());
        setSvg(svg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        setIsLoading(false);
      }
    };

    void renderDiagram();
  }, [code, diagramId]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-10 text-text-muted rounded-md ${className}`}>
        <CgSpinner className="w-6 h-6 animate-spin text-text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-bg-error-light text-text-error rounded-md ${className}`}>
        <p className="text-xs">Failed to render diagram:</p>
        <pre className="text-xs mt-1 overflow-auto">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return null;
  }

  return <div className={`flex justify-center p-4 overflow-x-auto rounded-md ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
};
