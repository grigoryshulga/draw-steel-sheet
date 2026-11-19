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
  showInitials = true,
}: {
  name: string;
  url?: string;
  className?: string;
  alt?: string;
  showInitials?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(url) && failedUrl !== url;
  if (!showImage && !showInitials) return null;
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
