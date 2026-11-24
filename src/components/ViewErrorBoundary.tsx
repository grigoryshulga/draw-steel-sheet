import { useLocale } from "../i18n/locale";
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
    return <ViewErrorMessage onRetry={() => this.setState({ failed: false })}
      onExport={this.props.onExport} onClose={this.props.onClose} />;
  }
}

function ViewErrorMessage({ onRetry, onExport, onClose }: {
  onRetry: () => void;
  onExport?: () => void;
  onClose?: () => void;
}) {
  const { t } = useLocale();
  const fallback = (
    <section className="view-error" role="alert">
      {!onClose && <h1>{t("Не удалось открыть раздел", "Couldn’t open this section")}</h1>}
      <p>
        {t("Проверьте подключение. Если повторная попытка не помогла, обновите страницу.", "Check your connection and try again. If the problem persists, reload the page.")}
      </p>
      <div className="hstack wrap">
        <Button
          variant="primary"
          onClick={onRetry}
        >
          {t("Попробовать снова", "Try again")}
        </Button>
        <Button onClick={() => window.location.reload()}>
          {t("Обновить страницу", "Reload page")}
        </Button>
        {onExport && (
          <Button icon="download" onClick={onExport}>
            {t("Скачать копию героя", "Download hero backup")}
          </Button>
        )}
      </div>
    </section>
  );
  return onClose ? (
    <Modal
      open
      title={t("Не удалось открыть конструктор", "Couldn’t open the hero builder")}
      onClose={onClose}
    >
      {fallback}
    </Modal>
  ) : (
    fallback
  );
}
