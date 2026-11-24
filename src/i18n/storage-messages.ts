import type { Locale } from "./locale";

// Errors can originate in the local API, Supabase adapter or offline queue.
// Preserve unrecognized server diagnostics for troubleshooting.
const messages: Record<string, string> = {
  "Локальный режим доступен только одному ведущему. Для совместной игры нужен Supabase": "Local mode supports a single Director. A Supabase connection is required for multiplayer.",
  "Аккаунт изменился. Откройте лист заново.": "The account changed. Reopen the sheet.",
  "В файле должны быть данные одного героя в формате JSON.": "The JSON file must contain one hero.",
  "В файле не указано имя героя.": "The file does not contain a hero name.",
  "Версия файла героя не поддерживается.": "This hero file version is unsupported.",
  "Войдите, чтобы сохранить портрет.": "Sign in to save the portrait.",
  "Герой уже изменён на сервере. Обе версии сохранены для выбора.": "The hero changed on the server. Both versions are available for you to choose from.",
  "Дождитесь завершения операции с героем": "Wait for the current hero operation to finish.",
  "Дождитесь завершения сохранения": "Wait for the save to finish.",
  "Документ персонажа повреждён": "The hero document is damaged.",
  "Изменения ожидают сети": "Your changes will sync when you are online.",
  "Конфликт больше не ожидает решения": "The conflict has already been resolved.",
  "Локальная копия повреждена": "The local copy is damaged.",
  "Не задан аккаунт локального хранилища": "No account was selected for local storage.",
  "Не удалось загрузить героя": "Could not load the hero.",
  "Не удалось импортировать": "Could not import the hero.",
  "Не удалось надёжно сохранить копию на устройстве. Не закрывайте лист; скачайте JSON.": "The device could not save a copy. Download the JSON before closing this sheet.",
  "Не удалось прочитать файл героя: проверьте формат JSON.": "Could not read the hero file. Check its JSON format.",
  "Не удалось скопировать": "Could not duplicate the hero.",
  "Не удалось удалить": "Could not delete the hero.",
  "Не удалось экспортировать": "Could not export the hero.",
  "Некорректный ответ о конфликте": "The server returned an invalid conflict response.",
  "Ошибка сохранения": "Save failed.",
  "Сервер вернул некорректный ответ": "The server returned an invalid response.",
  "Сервер вернул некорректный список героев": "The server returned an invalid hero list.",
  "Сервер не ответил вовремя. Повторите сохранение.": "The server timed out. Try saving again.",
  "Сервер не подтвердил версию героя": "The server did not confirm the hero version.",
  "Сервер не подтвердил сохранение героя": "The server did not confirm the save.",
  "Сервис недоступен": "The service is unavailable.",
  "Сначала сохраните текущего героя": "Save the current hero first.",
  "Требуется вход": "Sign in to continue.",
  "Файл героя слишком большой. Максимальный размер — 2 МиБ.": "The hero file exceeds the 2 MiB limit.",
  "Эта версия героя отсутствует": "This version of the hero is missing.",
  "Файл персонажа повреждён": "The hero file is damaged.",
  "Некорректный идентификатор персонажа": "Invalid hero ID.",
  "Персонаж не найден": "Hero not found.",
  "Ожидается объект персонажа": "The document must contain a hero.",
  "Идентификатор в документе не совпадает": "The document contains a different hero ID.",
  "Герой уже изменён на сервере": "The hero has changed on the server.",
  "Персонаж слишком большой": "The hero document is too large.",
  "Пустой файл портрета": "The portrait file is empty.",
  "Портрет больше 512 КБ": "The portrait exceeds the 512 KB limit.",
  "Поддерживается только WebP": "The portrait must be a WebP image.",
};

export function storageMessage(message: string, locale: Locale): string {
  if (locale === "ru") return message;
  return messages[message] ?? message.replace(/^Ошибка (\d{3})$/, "Request failed ($1)");
}
