import { useEffect, useRef, useState } from "react";

/** Show a fading edge only while more scrollable content remains. */
export function useScrollFade() {
  const ref = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setMore(node.scrollHeight - node.clientHeight - node.scrollTop > 2);
    const resize = new ResizeObserver(update);
    resize.observe(node);
    const mutations = new MutationObserver(update);
    mutations.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => { resize.disconnect(); mutations.disconnect(); node.removeEventListener("scroll", update); };
  });
  return { ref, more };
}
