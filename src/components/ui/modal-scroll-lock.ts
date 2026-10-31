// Each body has its own lock: nested dialogs may close in any order.
const locks = new WeakMap<HTMLElement, { count: number; overflow: string }>();

export function lockModalScroll(body: HTMLElement): () => void {
  let lock = locks.get(body);
  if (!lock) {
    lock = { count: 0, overflow: body.style.overflow };
    locks.set(body, lock);
    body.style.overflow = "hidden";
  }
  lock.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count === 0) {
      body.style.overflow = lock.overflow;
      locks.delete(body);
    }
  };
}
