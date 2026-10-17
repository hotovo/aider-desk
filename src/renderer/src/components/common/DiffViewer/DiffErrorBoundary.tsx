import { Component, ErrorInfo, ReactNode } from 'react';

type State = {
  hasError: boolean;
  resetKeys: readonly unknown[];
};

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  resetKeys: readonly unknown[];
};

export class DiffErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKeys: props.resetKeys };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKeys.length !== state.resetKeys.length || props.resetKeys.some((key, index) => !Object.is(key, state.resetKeys[index]))) {
      return { hasError: false, resetKeys: props.resetKeys };
    }
    return null;
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Error rendering diff:', error, errorInfo);
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
