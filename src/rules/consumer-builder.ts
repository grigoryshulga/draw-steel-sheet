import builderJson from "../generated/consumers/builder.json";
import type { ConsumerBuilderProjection } from "./consumer-data";

/**
 * Данные конструктора персонажа из канонических сущностей. Единственный
 * потребитель `generated/consumers/builder.json`: состав, порядок и поля
 * записей совпадают с прежним скелетом конструктора, поэтому контракт
 * `BUILDER_DATA` не меняется.
 */
const projection = builderJson as ConsumerBuilderProjection;

/** `schemaVersion` — служебное поле проекции, а не часть контракта конструктора. */
export const CANONICAL_BUILDER_DATA: Omit<
  ConsumerBuilderProjection,
  "schemaVersion"
> = {
  ancestries: projection.ancestries,
  cultures: projection.cultures,
  careers: projection.careers,
  classes: projection.classes,
  complications: projection.complications,
};
