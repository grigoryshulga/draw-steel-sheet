import { useEffect, useState } from "react";
import type { GlossaryEntry } from "../../rules/consumer-data";
import { loadGlossaryDefinitions } from "../../rules/consumer-library";
import { useLocale, useRuleLanguage } from "../../i18n/locale";
import { RuleMarkdown } from "./RuleMarkdown";

let definitions: Record<string, string> | undefined;
let pending: Promise<Record<string, string>> | undefined;
function getDefinitions() {
  if (!pending) pending = loadGlossaryDefinitions().then(result => (definitions = result), error => { pending = undefined; throw error; });
  return pending;
}

export function GlossaryDefinition({ entry }: { entry: GlossaryEntry }) {
  const { locale, t } = useLocale();
  const [dictionary, setDictionary] = useState(definitions);
  const [error, setError] = useState(false);
  const { language, available } = useRuleLanguage(entry.id, entry.hasEnglishDefinition);
  useEffect(() => {
    if (language !== "en" || !available || dictionary) return;
    let active = true;
    setError(false);
    getDefinitions().then(value => { if (active) setDictionary(value); }, () => { if (active) setError(true); });
    return () => { active = false; };
  }, [language, available, dictionary]);
  return <>
    {!available && locale === "en" && <p className="muted" role="note">English description unavailable; Russian text follows.</p>}
    {language === "en" && dictionary && !dictionary[entry.id] && <p className="muted" role="note">English description unavailable; Russian text follows.</p>}
    {language === "en" && available && !dictionary
      ? <p className="muted" role={error ? "alert" : "status"}>{error ? t("Не удалось загрузить оригинал.", "Could not load the original.") : t("Загружаем оригинал…", "Loading original…")}</p>
      : <RuleMarkdown sourceLocale={language} text={language === "en" ? dictionary?.[entry.id] || entry.markdown : entry.markdown} className="rule-text catalog-glossary-def" />}
  </>;
}
