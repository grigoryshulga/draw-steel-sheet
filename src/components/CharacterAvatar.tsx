import { useState } from "react";
import { initials } from "../lib/utils";

/**
 * Аватар героя: фотография портрета, а без неё — инициалы.
 * Ошибка загрузки картинки возвращает инициалы, а не пустое место.
 */
export function CharacterAvatar({
  name,
  url,
  className = "",
  alt = "",
}: {
  name: string;
  url?: string;
  className?: string;
  alt?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;
  return (
    <span className={`char-avatar${className ? ` ${className}` : ""}`}>
      {showImage ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(url ?? null)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}
