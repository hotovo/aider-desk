import { Component, ErrorInfo, ReactNode } from 'react';

type Props = {
  extensionId: string;
  componentId: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ExtensionUIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[Extension UI Error] ${this.props.extensionId}/${this.props.componentId}:`, error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-1 px-2 py-0.5 text-xs text-text-error rounded">
          <span className="truncate">
            Error in {this.props.extensionId}/{this.props.componentId}
          </span>
        </div>
      );
    }

    return this.props.children;
  }
}
