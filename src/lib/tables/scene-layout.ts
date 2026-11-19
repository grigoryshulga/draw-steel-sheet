import { tableRepository } from "./repository";
import type { SceneLayout } from "./types";

export async function copySceneLayout(layout: SceneLayout | undefined, tableId: string) {
  if (!layout || layout.tableId === tableId) return layout;
  const ids = [...new Set([
    ...(layout.background ? [layout.background] : []),
    ...layout.materials.flatMap(material => material.kind === "image" ? [material.assetId] : []),
  ])];
  const copied = new Map(await Promise.all(ids.map(async id => {
    const url = await tableRepository.boardImageUrl(layout.tableId, id);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Не удалось скопировать изображение заготовки");
    const target = crypto.randomUUID();
    await tableRepository.uploadBoardImage(tableId, target, await response.blob());
    return [id, target] as const;
  })));
  return {
    ...layout, tableId,
    background: layout.background ? copied.get(layout.background)! : null,
    materials: layout.materials.map(material => material.kind === "image"
      ? { ...material, assetId: copied.get(material.assetId)! } : material),
  } satisfies SceneLayout;
}
