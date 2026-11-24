import { useLocale } from "../../i18n/locale";
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
  const { t: tr } = useLocale();
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
    aria-label={scenes ? tr("Библиотека сцен", "Scene library") : tr("Заготовки предметов", "Item templates")}>
    {scenes && <div className="scene-library-heading">
      {!collapsed && <h2>{tr("Библиотека сцен", "Scene library")}</h2>}
      <Button iconOnly icon={collapsed ? "library" : "chevron-right"} variant="ghost" size="sm" aria-expanded={!collapsed} onClick={() => setUserCollapsed(!collapsed)}>
        {collapsed ? tr("Развернуть библиотеку сцен", "Expand scene library") : tr("Свернуть библиотеку сцен", "Collapse scene library")}
      </Button>
    </div>}
    {!collapsed && <>
      <label className="scene-library-search">
        <Icon name="search" size={18} />
        <TextInput type="search" aria-label={tr("Поиск в библиотеке", "Search library")} placeholder={kind === "scene" ? tr("Найти сцену", "Find a scene") : tr("Найти предмет", "Find an item")} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
      </label>
      <div className="scene-library-results">
        {visible.map((t) => <Card key={t.id} className={scenes ? undefined : "table-item-template"}
          draggable={!!onStart && !disabled} onDragStart={(event) => {
            event.dataTransfer.setData(SCENE_TEMPLATE_DROP, t.id);
            event.dataTransfer.effectAllowed = "copy";
          }}>
          <h3>{t.name}</h3>
          {acceptedIds?.has(t.id) && <span className="table-template-accepted"><Icon name="check" size={14} /> {tr("Получен на этом столе", "Received at this table")}</span>}
          <div className="table-actions">
            {onStart && <Button size="sm" iconOnly icon="play" disabled={disabled} onClick={() => onStart(t)}>{`${tr("Запустить", "Start")}: ${t.name}`}</Button>}
            <Button size="sm" icon="plus" disabled={disabled} onClick={() => onAdd(t)}>{kind === "scene" ? tr("К столу", "Add to table") : tr("Использовать", "Use")}</Button>
            {onDelete && <Button size="sm" variant="ghost" icon="trash" iconOnly onClick={() => onDelete(t)} aria-label={`${tr("Удалить заготовку", "Delete template")}: ${t.name}`}>{tr("Удалить заготовку", "Delete template")}</Button>}
          </div>
        </Card>)}
        {!matches.length && <p className="muted">
          {needle ? tr("Ничего не найдено", "Nothing found") : scenes
            ? tr("Сохраните сцену кнопкой «В библиотеку», чтобы использовать её на других столах.", "Save a scene to the library to use it at other tables.")
            : tr("Заготовок пока нет. Сохраните предмет кнопкой «Сохранить заготовку» при создании предложения.", "No templates yet. Save an item template while creating an offer.")}
        </p>}
      </div>
      {pages > 1 && <nav className="scene-library-pagination" aria-label={tr("Страницы библиотеки", "Library pages")}>
        <Button size="sm" icon="chevron-left" iconOnly disabled={current === 0} onClick={() => setPage(current - 1)}>{tr("Предыдущая страница", "Previous page")}</Button>
        <span>{current + 1} / {pages}</span>
        <Button size="sm" icon="chevron-right" iconOnly disabled={current === pages - 1} onClick={() => setPage(current + 1)}>{tr("Следующая страница", "Next page")}</Button>
      </nav>}
    </>}
  </aside>;
}
