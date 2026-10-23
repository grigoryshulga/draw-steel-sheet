import { Component, type ReactNode } from "react";
import { Button, Modal } from "./ui";

export class ViewErrorBoundary extends Component<
  {
    children: ReactNode;
    onExport?: () => void;
    onClose?: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const fallback = (
      <section className="view-error" role="alert">
        {!this.props.onClose && <h1>Не удалось открыть раздел</h1>}
        <p>
          Проверьте подключение. Если повторная попытка не помогла, обновите страницу.
        </p>
        <div className="hstack wrap">
          <Button
            variant="primary"
            onClick={() => this.setState({ failed: false })}
          >
            Попробовать снова
          </Button>
          <Button onClick={() => window.location.reload()}>
            Обновить страницу
          </Button>
          {this.props.onExport && (
            <Button icon="download" onClick={this.props.onExport}>
              Скачать копию героя
            </Button>
          )}
        </div>
      </section>
    );
    return this.props.onClose ? (
      <Modal
        open
        title="Не удалось открыть конструктор"
        onClose={this.props.onClose}
      >
        {fallback}
      </Modal>
    ) : (
      fallback
    );
  }
}
