import { useEffect, useState } from "react";
import type { Locale } from "./locale";

/** Load optional English display data only in the locale that uses it. */
export function useLocalizedData<T>(locale: Locale, load: () => Promise<T>) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    if (locale !== "en" || value) return;
    let active = true;
    load().then(data => { if (active) setValue(data); }, () => { /* Source labels remain readable offline. */ });
    return () => { active = false; };
  }, [locale, load, value]);
  return locale === "en" ? value : undefined;
}
