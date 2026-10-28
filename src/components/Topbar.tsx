import { Button } from "./ui";

export function BootError({ message }: { message: string }) {
  return (
    <div className="boot-error">
      <h1>Не удалось подключиться к листу</h1>
      <p className="muted">
        Не удалось загрузить героев. Проверьте подключение и попробуйте ещё раз.
      </p>
      <Button onClick={() => window.location.reload()} variant="primary">
        Попробовать снова
      </Button>
      <p className="mono small" style={{ marginTop: 14 }}>
        {message}
      </p>
    </div>
  );
}

export function LoadingScreen({
  label = "Загрузка героя",
}: {
  label?: string;
}) {
  return (
    <div className="loading-screen" role="status">
      {label}
    </div>
  );
}
