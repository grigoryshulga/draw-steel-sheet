import { memo, useEffect, useState } from "react";
import { tableRepository } from "../../lib/tables/repository";

export const BoardImage = memo(function BoardImage({ tableId, assetId, label, background = false, onOpen }: {
  tableId: string;
  assetId: string;
  label: string;
  background?: boolean;
  onOpen?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void tableRepository.boardImageUrl(tableId, assetId).then(
      next => { if (active) setUrl(next); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [tableId, assetId, retry]);
  if (failed) {
    if (background) return null;
    return <button className="board-image-retry" type="button" onClick={event => {
      event.stopPropagation();
      setUrl("");
      setFailed(false);
      setRetry(value => value + 1);
    }}>Повторить загрузку изображения</button>;
  }
  if (!url) return null;
  const image = <img className={background ? "board-backdrop" : "board-image"}
    src={url} alt={onOpen ? "" : label} draggable={false} onError={() => setFailed(true)} />;
  return onOpen ? <button type="button" className="board-image-open" aria-label={label} onClick={onOpen}>{image}</button> : image;
});
