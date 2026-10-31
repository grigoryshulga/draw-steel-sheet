import libraryJson from "../generated/consumers/library.json";
import type {
  CatalogEntry,
  ConsumerLibraryProjection,
  GlossaryEntry,
} from "./consumer-data";

/**
 * Каталог сокровищ/титулов/проектов и глоссарий из канонических статей.
 * Единственный потребитель `generated/consumers/library.json`: импорт этого
 * модуля не подтягивает карточки способностей.
 */
const projection = libraryJson as ConsumerLibraryProjection;

export const CANONICAL_CATALOG: CatalogEntry[] = projection.catalog;
export const CANONICAL_GLOSSARY: GlossaryEntry[] = projection.glossary;
