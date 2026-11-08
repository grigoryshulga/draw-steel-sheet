import { useState } from "react";
import { Button, Card, TextInput } from "../../components/ui";
import { Icon } from "../../components/Icons";
import type { DirectorTemplate } from "../../lib/tables/types";

export function TableLibrary({ templates, disabled, onAdd, onDelete, kind = "scene" }: {
  templates: DirectorTemplate[];
  disabled: boolean;
  onAdd: (template: DirectorTemplate) => void;
  onDelete?: (template: DirectorTemplate) => void;
  kind?: "scene" | "item";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const matches = templates.filter((t) => t.kind === kind && (kind === "scene" ? t.scene : t.item) && t.name.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")));
  const pages = Math.max(1, Math.ceil(matches.length / 6));
  const current = Math.min(page, pages - 1);
  return <aside className={`scene-library${collapsed ? " is-collapsed" : ""}`} aria-label={kind === "scene" ? "Библиотека сцен" : "Библиотека предметов"}>
    <div className="scene-library-heading">
      {!collapsed && <h2>Библиотека</h2>}
      <Button iconOnly icon={collapsed ? "chevron-left" : "chevron-right"} variant="ghost" size="sm" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Развернуть библиотеку" : "Свернуть библиотеку"}</Button>
    </div>
    {collapsed ? <Icon name="library" size={20} /> : <>
      <label className="scene-library-search">
        <Icon name="search" size={18} />
        <TextInput type="search" aria-label="Поиск в библиотеке" placeholder={kind === "scene" ? "Найти сцену" : "Найти предмет"} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
      </label>
      <div className="scene-library-results">
        {matches.slice(current * 6, (current + 1) * 6).map((t) => <Card key={t.id}>
          <h3>{t.name}</h3>
          <div className="table-actions">
            <Button size="sm" icon="plus" disabled={disabled} onClick={() => onAdd(t)}>{kind === "scene" ? "К столу" : "Использовать"}</Button>
            {onDelete && <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => onDelete(t)} aria-label={`Удалить заготовку: ${t.name}`}>Удалить заготовку</Button>}
          </div>
        </Card>)}
        {!matches.length && <p className="muted">{query ? "Ничего не найдено" : "Библиотека пуста"}</p>}
      </div>
      {pages > 1 && <nav className="scene-library-pagination" aria-label="Страницы библиотеки">
        <Button size="sm" icon="chevron-left" iconOnly disabled={current === 0} onClick={() => setPage(current - 1)}>Предыдущая страница</Button>
        <span>{current + 1} / {pages}</span>
        <Button size="sm" icon="chevron-right" iconOnly disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Следующая страница</Button>
      </nav>}
    </>}
  </aside>;
}
