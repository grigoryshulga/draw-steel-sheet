import { Fragment } from "react";
import "./LanguageSwitch.css";
import { useLocale, type Locale } from "../i18n/locale";
import { Button } from "./ui";

/** Always label the destination in its own language, including on first visit. */
export function SiteLanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const next = locale === "ru" ? "en" : "ru";
  const label = next === "en" ? "Switch site to English" : "Переключить сайт на русский";
  return <Button variant="ghost" size="sm" lang={next} aria-label={label} title={label}
    onClick={() => setLocale(next)}>{next.toUpperCase()}</Button>;
}

/** A single quiet control in the article header. The selected language is
 * visible and announced even when the surrounding site uses another language. */
export function ArticleLanguageSwitch({ language, setLanguage }: {
  language: Locale;
  setLanguage: (value: Locale) => void;
}) {
  const { t } = useLocale();
  return <span className="article-language" role="group" aria-label={t("Язык статьи", "Article language")}>
    {(["ru", "en"] as const).map(option => (
      <Fragment key={option}>
        {option === "en" && <span className="article-language-separator" aria-hidden="true">/</span>}
        <button type="button" lang={option} aria-label={option === "ru" ? "Русский" : "English"}
          aria-pressed={language === option}
          onClick={event => { event.stopPropagation(); setLanguage(option); }}>
          {option.toUpperCase()}
        </button>
      </Fragment>
    ))}
  </span>;
}
