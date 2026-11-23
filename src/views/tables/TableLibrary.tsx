import { useState } from "react";
import { Button, Card, TextInput } from "../../components/ui";
import { Icon } from "../../components/Icons";
import type { DirectorTemplate } from "../../lib/tables/types";
import { SCENE_TEMPLATE_DROP } from "../../lib/tables/board";

export function TableLibrary({ templates, disabled, onAdd, onDelete, onStart, acceptedIds, kind = "scene" }: {
  templates: DirectorTemplate[];
  disabled: boolean;
  onAdd: (template: DirectorTemplate) => void;
  onDelete?: (template: DirectorTemplate) => void;
  onStart?: (template: DirectorTemplate) => void;
  kind?: "scene" | "item";
  acceptedIds?: ReadonlySet<string>;
}) {
  const [userCollapsed, setUserCollapsed] = useState<boolean>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const scenes = kind === "scene";
  const available = templates.filter((t) => t.kind === kind && (scenes ? t.scene : t.item));
  const collapsed = scenes && (userCollapsed ?? available.length === 0);
  const needle = query.trim().toLocaleLowerCase("ru");
  const matches = available.filter((t) => t.name.toLocaleLowerCase("ru").includes(needle));
  const pages = scenes ? Math.max(1, Math.ceil(matches.length / 6)) : 1;
  const current = Math.min(page, pages - 1);
  const visible = scenes ? matches.slice(current * 6, (current + 1) * 6) : matches;
  return <aside className={`${scenes ? "scene-library" : "table-item-templates"}${collapsed ? " is-collapsed" : ""}`}
    aria-label={scenes ? "Библиотека сцен" : "Заготовки предметов"}>
    {scenes && <div className="scene-library-heading">
      {!collapsed && <h2>Библиотека сцен</h2>}
      <Button iconOnly icon={collapsed ? "library" : "chevron-right"} variant="ghost" size="sm" aria-expanded={!collapsed} onClick={() => setUserCollapsed(!collapsed)}>
        {collapsed ? "Развернуть библиотеку сцен" : "Свернуть библиотеку сцен"}
      </Button>
    </div>}
    {!collapsed && <>
      <label className="scene-library-search">
        <Icon name="search" size={18} />
        <TextInput type="search" aria-label="Поиск в библиотеке" placeholder={kind === "scene" ? "Найти сцену" : "Найти предмет"} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
      </label>
      <div className="scene-library-results">
        {visible.map((t) => <Card key={t.id} className={scenes ? undefined : "table-item-template"}
          draggable={!!onStart && !disabled} onDragStart={(event) => {
            event.dataTransfer.setData(SCENE_TEMPLATE_DROP, t.id);
            event.dataTransfer.effectAllowed = "copy";
          }}>
          <h3>{t.name}</h3>
          {acceptedIds?.has(t.id) && <span className="table-template-accepted"><Icon name="check" size={14} /> Получен на этом столе</span>}
          <div className="table-actions">
            {onStart && <Button size="sm" iconOnly icon="play" disabled={disabled} onClick={() => onStart(t)}>{`Запустить: ${t.name}`}</Button>}
            <Button size="sm" icon="plus" disabled={disabled} onClick={() => onAdd(t)}>{kind === "scene" ? "К столу" : "Использовать"}</Button>
            {onDelete && <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => onDelete(t)} aria-label={`Удалить заготовку: ${t.name}`}>Удалить заготовку</Button>}
          </div>
        </Card>)}
        {!matches.length && <p className="muted">
          {needle ? "Ничего не найдено" : scenes
            ? "Сохраните сцену кнопкой «В библиотеку», чтобы использовать её на других столах."
            : "Заготовок пока нет. Сохраните предмет кнопкой «Сохранить заготовку» при создании предложения."}
        </p>}
      </div>
      {pages > 1 && <nav className="scene-library-pagination" aria-label="Страницы библиотеки">
        <Button size="sm" icon="chevron-left" iconOnly disabled={current === 0} onClick={() => setPage(current - 1)}>Предыдущая страница</Button>
        <span>{current + 1} / {pages}</span>
        <Button size="sm" icon="chevron-right" iconOnly disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Следующая страница</Button>
      </nav>}
    </>}
  </aside>;
}
