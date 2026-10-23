import {
  useEffect,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";

type MenuKeyboardOptions = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
};

export function useMenuKeyboard({
  open,
  setOpen,
  menuRef,
  triggerRef,
}: MenuKeyboardOptions) {
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
    );
    items?.[0]?.focus();
  }, [open, menuRef]);

  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)',
      ) ?? [],
    );
    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown")
      nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  };
}
