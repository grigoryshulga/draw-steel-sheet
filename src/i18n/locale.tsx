import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "ru" | "en";
export const LOCALE_KEY = "draw-steel.locale";

export function resolveLocale(search: string, saved: string | null): Locale {
  const explicit = new URLSearchParams(search).get("lang");
  if (explicit === "ru" || explicit === "en") return explicit;
  return saved === "en" ? "en" : "ru";
}

export function readLocale(): Locale {
  if (typeof window === "undefined") return "ru";
  let saved: string | null = null;
  try { saved = window.localStorage.getItem(LOCALE_KEY); } catch { /* Storage can be disabled. */ }
  return resolveLocale(window.location.search, saved);
}

const russian = (ru: string, _en: string) => ru;
const english = (_ru: string, en: string) => en;
const LocaleContext = createContext({
  locale: "ru" as Locale,
  setLocale: (_locale: Locale) => {},
  t: russian,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrent] = useState(readLocale);
  const setLocale = useCallback((next: Locale) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(window.history.state, "", url);
    try { window.localStorage.setItem(LOCALE_KEY, next); } catch { /* The URL retains the choice. */ }
    setCurrent(next);
  }, []);
  useEffect(() => {
    const restore = () => setCurrent(readLocale());
    window.addEventListener("popstate", restore);
    window.addEventListener("storage", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("storage", restore);
    };
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: locale === "ru" ? russian : english }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

const ArticleLanguageContext = createContext<Locale | null>(null);

export function ArticleLanguageScope({ language, children }: { language: Locale; children: ReactNode }) {
  return <ArticleLanguageContext.Provider value={language}>{children}</ArticleLanguageContext.Provider>;
}

export const useArticleLocale = () => useContext(ArticleLanguageContext);

export function useArticleText() {
  const { locale } = useLocale();
  const language = useArticleLocale() ?? locale;
  return language === "en" ? english : russian;
}

/** The reader can change a single open article. Opening another rule or
 * changing the site preference resets that choice, without writing a save. */
export function useArticleLanguage(id: string, available: boolean) {
  const { locale } = useLocale();
  const inherited = useArticleLocale();
  const initial = inherited ?? locale;
  const [choice, setChoice] = useState({ id, initial, language: initial });
  if (choice.id !== id || choice.initial !== initial) {
    setChoice({ id, initial, language: initial });
  }
  return {
    language: available ? inherited ?? choice.language : "ru" as Locale,
    available,
    setLanguage: (language: Locale) => setChoice({ id, initial, language }),
  };
}

export function useRuleLanguage(id: string, original?: string | boolean | null) {
  return useArticleLanguage(id, typeof original === "string" ? Boolean(original.trim()) : Boolean(original));
}
