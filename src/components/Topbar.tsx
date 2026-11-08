import { Button } from "./ui";
import "./Topbar.css";

export function BootError({ message }: { message: string }) {
  return (
    <main className="boot-error" id="main-content" role="alert">
      <h1>Не удалось подключиться к листу</h1>
      <p className="muted">
        Не удалось загрузить героев. Проверьте подключение и попробуйте ещё раз.
      </p>
      <Button onClick={() => window.location.reload()} variant="primary">
        Попробовать снова
      </Button>
      <section className="boot-error-details">
        <h3>Подробности ошибки</h3>
        <p className="mono small">{message}</p>
      </section>
    </main>
  );
}

export function LoadingScreen({
  label = "Загрузка героя",
  hint = "Загружаем нужные данные",
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div className="loading-screen" role="status">
      <div className="loading-screen-content">
        <span className="loading-screen-orbit" aria-hidden="true" />
        <strong>{label}</strong>
        <span className="loading-screen-hint">{hint}</span>
      </div>
    </div>
  );
}
