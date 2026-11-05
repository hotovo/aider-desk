import { Component, ErrorInfo, ReactNode } from 'react';

import { AppCrashFallback } from '@/components/common/AppCrashFallback';
import { finishStartup } from '@/utils/startup';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    finishStartup();
    // eslint-disable-next-line no-console
    console.error('[App Error]', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <AppCrashFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
