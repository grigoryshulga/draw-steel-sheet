import { Icon } from "./Icons";
import "./LibraryHeader.css";

/** Общая шапка библиотеки правил: название страницы и необязательное описание. */
export function LibraryHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="library-head">
      <div className="library-head-text">
        <h1 className="page-title">
          <Icon name="book" size={26} />
          {title}
        </h1>
        {description && <p className="muted">{description}</p>}
      </div>
    </header>
  );
}
