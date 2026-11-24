export interface EnglishReference {
  links?: Record<string, string>;
  labels: Record<string, string>;
  summaries: Record<string, string>;
}

export async function loadEnglishReference(): Promise<EnglishReference> {
  return (await import("../generated/consumers/english-reference.json")).default;
}
export async function loadAncestrySignatures(): Promise<{ signatures: Record<string, string>; translatedTraits: Record<string, string> }> {
  return (await import("../generated/consumers/ancestry-signatures-en.json")).default;
}

type ClassOptions = Record<string, Record<string, { name: string; text: string }>>;
export async function loadBuilderOptions(): Promise<ClassOptions> {
  return (await import("../generated/consumers/builder-options-en.json")).default;
}

export async function loadGlossaryDefinitions(): Promise<Record<string, string>> {
  return (await import("../generated/consumers/glossary-en.json")).default;
}
