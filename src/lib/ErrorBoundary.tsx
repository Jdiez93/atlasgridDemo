import { useAtlasStore } from '../store/useAtlasStore';
import { Component, type ErrorInfo, type ReactNode } from 'react';
interface Props {
  children: ReactNode;
  name: string;
  scene?: boolean;
}
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.scene) useAtlasStore.setState({ ready: true });
    console.error(`[AtlasGrid ${this.props.name}]`, error, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <div className={this.props.scene ? 'scene-fallback' : 'panel panel-error'}>
          <strong>{this.props.name} could not be displayed.</strong>
          <p>The simulation is still available. Reload this panel to retry.</p>
          <button className="button" onClick={() => this.setState({ failed: false })}>
            Retry
          </button>
        </div>
      );
    return this.props.children;
  }
}
