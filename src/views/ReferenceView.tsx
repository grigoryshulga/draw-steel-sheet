import { lazy, Suspense } from "react";
import { LibraryHeader } from "../components/LibraryHeader";
import { useLibraryLocation } from "../lib/library-location";
import "./CodexView.css";
import "./ReferenceView.css";

const CatalogView = lazy(() =>
  import("./CatalogView").then((module) => ({ default: module.CatalogView })),
);
const ClassLandingView = lazy(() =>
  import("./ClassLandingView").then((module) => ({
    default: module.ClassLandingView,
  })),
);

/**
 * Справочник — единый каталог: все разделы открываются одной вкладкой и
 * карточками со списком слева и полным текстом справа. Отдельной страницей
 * остаётся только лендинг класса, потому что он собирает десять статей-уровней.
 */
export function ReferenceView() {
  const segments = useLibraryLocation();
  const section = segments[2] ?? "";
  const item = segments[3] ?? "";
  if (section === "class" && item) {
    const [slugPart] = item.split("#");
    if (slugPart)
      return <ClassLandingView slug={decodeURIComponent(slugPart)} />;
  }
  return (
    <div className="reference-view">
      <LibraryHeader title="Справочник" />
      <div className="reference-body">
        <Suspense fallback={<p className="muted">Загрузка справочника…</p>}>
          <CatalogView />
        </Suspense>
      </div>
    </div>
  );
}
