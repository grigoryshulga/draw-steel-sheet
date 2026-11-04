/** Правила подготовки портрета: маленький файл, WebP и ширина не больше 600 px. */

export const AVATAR_MAX_SOURCE_BYTES = 512 * 1024;
export const AVATAR_MAX_WIDTH = 600;
/** Ограничение высоты для очень вытянутых картинок: портрет не должен быть гигантским. */
export const AVATAR_MAX_HEIGHT = 900;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
/** Значение для `accept` у файлового поля. */
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(",");

/** Качество подбирается от лучшего к худшему, пока файл не станет меньше лимита. */
const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54] as const;

export interface AvatarFileFacts {
  type: string;
  size: number;
}

/** Проверяем файл до чтения: тип и исходный размер. Возвращает текст ошибки. */
export function validateAvatarFile(file: AvatarFileFacts): string | null {
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Подойдёт PNG, JPEG или WebP.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "Файл изображения пуст.";
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    return "Файл больше 512 КБ. Выберите изображение меньшего размера.";
  }
  return null;
}

/** Сохраняет пропорции и не увеличивает маленькие картинки. */
export function fitAvatarDimensions(
  width: number,
  height: number,
  maxWidth = AVATAR_MAX_WIDTH,
  maxHeight = AVATAR_MAX_HEIGHT,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Не удалось определить размер изображения.");
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

async function loadImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      image.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

/**
 * Готовит портрет к загрузке: уменьшает до 600 px по ширине и кодирует в WebP.
 * Результат всегда меньше исходного лимита 512 КБ при обычных фотографиях.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  const invalid = validateAvatarFile(file);
  if (invalid) throw new Error(invalid);

  const image = await loadImage(file);
  try {
    const { width, height } = fitAvatarDimensions(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не смог обработать изображение.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image.source, 0, 0, width, height);

    let fallback: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToWebp(canvas, quality);
      if (!blob) continue;
      if (blob.type !== "image/webp") {
        throw new Error("Браузер не поддерживает WebP. Обновите его и попробуйте снова.");
      }
      fallback = blob;
      if (blob.size <= AVATAR_MAX_SOURCE_BYTES) return blob;
    }
    if (fallback) return fallback;
    throw new Error("Не удалось сохранить изображение. Попробуйте другой файл.");
  } finally {
    image.release();
  }
}
