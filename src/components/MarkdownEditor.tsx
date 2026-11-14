import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Button, Field, Modal, Select, TextInput } from "./ui";
import type { IconName } from "./Icons";
import { MarkdownPreview } from "./MarkdownPreview";
import { markdownExtensions, validEditorUrl } from "./markdown/extensions";
import "./MarkdownEditor.css";

type ToolKey = "bold" | "italic" | "strike" | "bulletList" | "orderedList" | "taskList" | "blockquote" | "code" | "codeBlock" | "table" | "rule";
const TOOLS: { key: ToolKey; label: string; icon: IconName }[] = [
  { key: "bold", label: "Жирный текст (Ctrl+B)", icon: "bold" },
  { key: "italic", label: "Курсив (Ctrl+I)", icon: "italic" },
  { key: "strike", label: "Зачёркнутый текст", icon: "strikethrough" },
  { key: "bulletList", label: "Маркированный список", icon: "list" },
  { key: "orderedList", label: "Нумерованный список", icon: "list-ordered" },
  { key: "taskList", label: "Список задач", icon: "list-check" },
  { key: "blockquote", label: "Цитата", icon: "quote" },
  { key: "code", label: "Код в строке", icon: "code" },
  { key: "codeBlock", label: "Блок кода", icon: "code-block" },
  { key: "table", label: "Вставить таблицу", icon: "table" },
  { key: "rule", label: "Горизонтальная линия", icon: "separator" },
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Render tools in a shared host; null hides them, undefined keeps them inline. */
  toolbarContainer?: HTMLElement | null;
  onFocus?: () => void;
}

/** One editable visual document, with Markdown used only at the storage boundary. */
export function MarkdownEditor({ value, onChange, placeholder = "Начните писать…", className = "", disabled = false, readOnly = false, required = false, toolbarContainer, onFocus, "aria-label": label = "Текст Markdown" }: MarkdownEditorProps) {
  const lastValue = useRef(value);
  const [inserting, setInserting] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [needsLabel, setNeedsLabel] = useState(false);
  const editable = !disabled && !readOnly;
  const extensions = useMemo(() => markdownExtensions(placeholder), [placeholder]);
  const editor: Editor | null = useEditor({
    extensions,
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable,
    onFocus: () => onFocus?.(),
    editorProps: {
      attributes: {
        role: "textbox", "aria-label": label, "aria-multiline": "true",
        "aria-required": String(required), "aria-readonly": String(!editable),
        "aria-disabled": String(disabled), class: "markdown-preview markdown-editor-document", spellcheck: "true",
      },
      handleKeyDown: (_view, event): boolean => {
        if (editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          openInsert("link");
          return true;
        }
        return false;
      },
      handlePaste: (_view, event): boolean => {
        const clipboard = event.clipboardData;
        if (!clipboard || clipboard.getData("text/html")) return false;
        const text = clipboard.getData("text/plain");
        if (!text) return false;
        event.preventDefault();
        return editor?.commands.insertContent(text, { contentType: "markdown" }) ?? false;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      if (markdown === lastValue.current) return;
      lastValue.current = markdown;
      onChange(markdown);
    },
  });
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    active: Object.fromEntries(TOOLS.map(tool => [tool.key, current.isActive(tool.key)])),
    heading: [1, 2, 3, 4, 5, 6].find(level => current.isActive("heading", { level })) ?? 0,
    link: current.isActive("link"), table: current.isActive("table"),
    undo: current.can().undo(), redo: current.can().redo(),
  } : null });

  useEffect(() => {
    if (!editor || lastValue.current === value) return;
    editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    lastValue.current = value;
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(editable, false); }, [editor, editable]);

  const command = (key: ToolKey) => {
    if (!editor || !editable) return;
    const chain = editor.chain().focus();
    switch (key) {
      case "bold": chain.toggleBold().run(); break;
      case "italic": chain.toggleItalic().run(); break;
      case "strike": chain.toggleStrike().run(); break;
      case "bulletList": chain.toggleBulletList().run(); break;
      case "orderedList": chain.toggleOrderedList().run(); break;
      case "taskList": chain.toggleTaskList().run(); break;
      case "blockquote": chain.toggleBlockquote().run(); break;
      case "code": chain.toggleCode().run(); break;
      case "codeBlock": chain.toggleCodeBlock().run(); break;
      case "table": chain.insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(); break;
      case "rule": chain.setHorizontalRule().run(); break;
    }
  };
  const openInsert = (kind: "link" | "image") => {
    if (!editor) return;
    setNeedsLabel(editor.state.selection.empty && !editor.isActive("link"));
    setDescription(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " "));
    setUrl(kind === "link" ? editor.getAttributes("link").href ?? "" : "");
    setInserting(kind);
  };
  const insert = () => {
    if (!editor || !editable || !inserting || !validEditorUrl(url, inserting === "image")) return;
    if (inserting === "image") editor.chain().focus().setImage({ src: url.trim(), alt: description }).run();
    else if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: description.trim() || url.trim(), marks: [{ type: "link", attrs: { href: url.trim() } }] }).run();
    } else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    setInserting(null);
  };
  const unavailable = !editor || !editable;

  const toolbar = <div className="markdown-editor-toolbar" role="group" aria-label={`Форматирование текста: ${label}`} onMouseDown={event => {
      if ((event.target as HTMLElement).closest("button")) event.preventDefault();
    }}>
      <Button icon="undo" iconOnly size="sm" variant="ghost" disabled={unavailable || !state?.undo} onClick={() => editor?.chain().focus().undo().run()}>Отменить ввод (Ctrl+Z)</Button>
      <Button icon="redo" iconOnly size="sm" variant="ghost" disabled={unavailable || !state?.redo} onClick={() => editor?.chain().focus().redo().run()}>Повторить ввод (Ctrl+Shift+Z)</Button>
      <Select className="markdown-editor-heading" aria-label="Стиль текста" value={state?.heading ?? 0} disabled={unavailable} onChange={event => {
        const level = Number(event.target.value) as 1 | 2 | 3 | 4 | 5 | 6;
        if (level) editor?.chain().focus().setHeading({ level }).run();
        else editor?.chain().focus().setParagraph().run();
      }}>
        <option value={0}>Обычный текст</option>
        {[1, 2, 3, 4, 5, 6].map(level => <option key={level} value={level}>Заголовок {level}</option>)}
      </Select>
      {TOOLS.map(tool => <Button key={tool.key} icon={tool.icon} iconOnly size="sm" variant="ghost" title={tool.label} aria-pressed={tool.key === "rule" || tool.key === "table" ? undefined : state?.active[tool.key] ?? false} disabled={unavailable} onClick={() => command(tool.key)}>{tool.label}</Button>)}
      <Button icon="link" iconOnly size="sm" variant="ghost" disabled={unavailable} aria-pressed={state?.link ?? false} onClick={() => openInsert("link")}>Добавить или изменить ссылку (Ctrl+K)</Button>
      {state?.link && <Button icon="close" iconOnly size="sm" variant="ghost" disabled={unavailable} onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}>Убрать ссылку</Button>}
      <Button icon="image" iconOnly size="sm" variant="ghost" disabled={unavailable} onClick={() => openInsert("image")}>Изображение по ссылке</Button>
      {state?.table && <span className="markdown-editor-table-tools">
        <Button size="sm" disabled={unavailable} onClick={() => editor?.chain().focus().addRowAfter().run()}>+ Строка</Button>
        <Button size="sm" disabled={unavailable} onClick={() => editor?.chain().focus().addColumnAfter().run()}>+ Столбец</Button>
        <Button size="sm" icon="trash" iconOnly disabled={unavailable} onClick={() => editor?.chain().focus().deleteTable().run()}>Удалить таблицу</Button>
      </span>}
    </div>;

  return <div className={`markdown-editor ${className}`.trim()}>
    {toolbarContainer === undefined ? toolbar : toolbarContainer && createPortal(toolbar, toolbarContainer)}
    {editor ? <EditorContent editor={editor} className="markdown-editor-content" /> : <div className="markdown-editor-loading" role="status" aria-label="Загрузка редактора"><MarkdownPreview text={value} /></div>}
    <Modal open={inserting !== null} title={inserting === "image" ? "Изображение" : "Ссылка"} onClose={() => setInserting(null)} footer={<>
      {inserting === "link" && state?.link && <Button variant="ghost" onClick={() => { editor?.chain().focus().extendMarkRange("link").unsetLink().run(); setInserting(null); }}>Убрать ссылку</Button>}
      <span className="grow" /><Button onClick={() => setInserting(null)}>Отмена</Button>
      <Button variant="primary" disabled={unavailable || !validEditorUrl(url, inserting === "image")} onClick={insert}>Применить</Button>
    </>}>
      <Field label="Адрес"><TextInput autoFocus value={url} placeholder="https://…" onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); insert(); } }} /></Field>
      {(inserting === "image" || needsLabel) && <Field label={inserting === "image" ? "Описание изображения" : "Текст ссылки"}><TextInput value={description} onChange={event => setDescription(event.target.value)} /></Field>}
    </Modal>
  </div>;
}
