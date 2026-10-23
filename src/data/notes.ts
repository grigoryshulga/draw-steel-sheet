import type { NoteSectionKey, NoteSections } from "../types";

export const NOTE_SECTIONS: {
  key: NoteSectionKey;
  label: string;
  placeholder: string;
}[] = [
  {
    key: "story",
    label: "Сюжет",
    placeholder: "Что происходит в истории, к чему стремится герой…",
  },
  {
    key: "contacts",
    label: "Связи",
    placeholder: "Кто помогает, кому нельзя доверять, кто чего ждёт…",
  },
  {
    key: "debts",
    label: "Долги",
    placeholder: "Что герой обещал, кому и что будет, если не выполнит…",
  },
  {
    key: "secrets",
    label: "Тайны",
    placeholder: "Что скрывает герой, что удалось выяснить…",
  },
  {
    key: "misc",
    label: "Разное",
    placeholder: "Всё остальное, что важно запомнить…",
  },
];

export function emptyNotes(): NoteSections {
  return { story: "", contacts: "", debts: "", secrets: "", misc: "" };
}
