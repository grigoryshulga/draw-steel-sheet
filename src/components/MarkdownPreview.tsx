import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./MarkdownPreview.css";

const plugins = [remarkGfm];

/** CommonMark + GFM for authored notes, without rule-specific transforms. */
export const MarkdownPreview = memo(function MarkdownPreview({ text, images = true }: { text: string; images?: boolean }) {
  return <div className="markdown-preview">
    <Markdown remarkPlugins={plugins} disallowedElements={images ? undefined : ["img"]}>{text}</Markdown>
  </div>;
});
