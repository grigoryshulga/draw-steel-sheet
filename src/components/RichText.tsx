import { Fragment, type ReactNode } from "react";
import { CharacteristicGlyphText } from "./CharacteristicGlyph";

/** Текст с абзацами, переносами и маркированными списками. */
export function RichText({ text, className = "", characteristicGlyphs = false }: { text: string; className?: string; characteristicGlyphs?: boolean }) {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter((block) => block.trim());

  return (
    <div className={`rich-text ${className}`.trim()}>
      {blocks.map((block, index) => (
        <TextBlock key={index} text={block} characteristicGlyphs={characteristicGlyphs} />
      ))}
    </div>
  );
}

function TextBlock({ text, characteristicGlyphs }: { text: string; characteristicGlyphs: boolean }) {
  const lines = text.split("\n");
  const parts: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    parts.push(
      <p key={`p-${parts.length}`}>
        {paragraph.map((line, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {characteristicGlyphs ? <CharacteristicGlyphText text={line} /> : line}
          </Fragment>
        ))}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    parts.push(
      <ul key={`ul-${parts.length}`}>
        {list.map((item, index) => (
          <li key={index}>{characteristicGlyphs ? <CharacteristicGlyphText text={item} /> : item}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-•–]\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^[-•–]\s+/, ""));
    } else if (trimmed) {
      flushList();
      paragraph.push(trimmed);
    } else {
      flushParagraph();
      flushList();
    }
  }
  flushParagraph();
  flushList();

  return <>{parts}</>;
}
