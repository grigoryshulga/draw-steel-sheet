import { Button } from "./ui";

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
      <details className="boot-error-details">
        <summary>Подробности ошибки</summary>
        <p className="mono small">{message}</p>
      </details>
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
