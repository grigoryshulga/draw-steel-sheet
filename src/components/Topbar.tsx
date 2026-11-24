import { useLocale } from "../i18n/locale";
import { Button } from "./ui";
import "./Topbar.css";

export function BootError({ message }: { message: string }) {
  const { t } = useLocale();
  return (
    <main className="boot-error" id="main-content" role="alert">
      <h1>{t("Не удалось подключиться к листу", "Couldn’t connect to the sheet")}</h1>
      <p className="muted">
        {t("Не удалось загрузить героев. Проверьте подключение и попробуйте ещё раз.", "Couldn’t load your heroes. Check your connection and try again.")}
      </p>
      <Button onClick={() => window.location.reload()} variant="primary">
        {t("Попробовать снова", "Try again")}
      </Button>
      <section className="boot-error-details">
        <h3>{t("Подробности ошибки", "Error details")}</h3>
        <p className="mono small">{message}</p>
      </section>
    </main>
  );
}

export function LoadingScreen({
  label,
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="loading-screen" role="status">
      <div className="loading-screen-content">
        <span className="loading-screen-orbit" aria-hidden="true" />
        <strong>{label ?? t("Загрузка героя", "Loading hero")}</strong>
        <span className="loading-screen-hint">{hint ?? t("Загружаем нужные данные", "Loading game data")}</span>
      </div>
    </div>
  );
}
