import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "../../components/Icons";
import { deleteAvatar, uploadAvatar } from "../../lib/api";
import {
  AVATAR_ACCEPT,
  prepareAvatar,
  validateAvatarFile,
} from "../../lib/avatar";
import { useApp } from "../../state/AppContext";
import "./Portrait.css";

/**
 * Редактируемый портрет в шапке листа. Пустой слот показывает силуэт и
 * кнопку-глиф; у загруженного портрета действия появляются на наведении.
 */
export function Portrait() {
  const { character, update, notify } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Одно и то же изображение можно выбрать повторно после ошибки.
    event.currentTarget.value = "";
    if (!file || busy) return;
    const invalid = validateAvatarFile(file);
    if (invalid) {
      notify(invalid, "error");
      return;
    }
    const targetId = character.id;
    setBusy(true);
    try {
      const image = await prepareAvatar(file);
      const avatar = await uploadAvatar(targetId, image);
      // Пока шла загрузка, герой мог смениться: чужой лист не трогаем.
      update((current) =>
        current.id === targetId ? { ...current, avatar } : current,
      );
      notify("Портрет обновлён", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось загрузить портрет",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (busy) return;
    const targetId = character.id;
    setBusy(true);
    try {
      await deleteAvatar(targetId);
      update((current) =>
        current.id === targetId ? { ...current, avatar: undefined } : current,
      );
      notify("Портрет удалён", "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Не удалось удалить портрет",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const avatar = character.avatar;
  const openPicker = () => inputRef.current?.click();
  const className = [
    "sheet-portrait",
    avatar ? "has-image" : "is-empty",
    busy ? "is-busy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} aria-busy={busy}>
      {avatar ? (
        <>
          <img src={avatar.url} alt={`Портрет: ${character.name}`} />
          <div className="sheet-portrait-actions">
            <button
              type="button"
              className="sheet-portrait-icon-btn"
              onClick={openPicker}
              disabled={busy}
              aria-label="Изменить портрет"
              title="Изменить портрет"
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              type="button"
              className="sheet-portrait-icon-btn is-danger"
              onClick={handleRemove}
              disabled={busy}
              aria-label="Удалить портрет"
              title="Удалить портрет"
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </>
      ) : (
        <>
          <svg
            className="sheet-portrait-silhouette"
            viewBox="0 0 120 160"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="60" cy="50" r="25" />
            <path d="M60 88c-27 0-46 17-50 44l-2 28h104l-2-28c-4-27-23-44-50-44Z" />
          </svg>
          <button
            type="button"
            className="sheet-portrait-upload"
            onClick={openPicker}
            disabled={busy}
            aria-label={busy ? "Загрузка портрета" : "Загрузить портрет"}
            title="Загрузить портрет"
          >
            <Icon name="upload" size={15} />
          </button>
        </>
      )}
      <input
        ref={inputRef}
        className="sheet-portrait-input"
        type="file"
        accept={AVATAR_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
    </div>
  );
}
