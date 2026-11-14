import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";

/** All authored Markdown nodes have both a visual editor and a serializer. */
export function markdownExtensions(placeholder = "") {
  return [
    StarterKit.configure({
      underline: false,
      link: { openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } },
    }),
    Markdown.configure({ markedOptions: { gfm: true } }),
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { "data-type": "taskItem" },
      a11y: { checkboxLabel: (node, checked) => `${checked ? "Отметить как невыполненную" : "Отметить как выполненную"}: ${node.textContent || "Новая задача"}` },
    }),
    Image.configure({ HTMLAttributes: { loading: "lazy" } }),
    Placeholder.configure({ placeholder }),
  ];
}

export function validEditorUrl(value: string, image = false): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim(), "https://markdown.invalid/");
    return (image ? ["http:", "https:"] : ["http:", "https:", "mailto:", "tel:"]).includes(url.protocol);
  } catch {
    return false;
  }
}
