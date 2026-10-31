import kitsJson from "../generated/consumers/kits.json";
import type { ConsumerKit, ConsumerKitProjection } from "./consumer-data";

/**
 * Комплекты из канонических сущностей `kit`. Единственный потребитель
 * `generated/consumers/kits.json`: остальные модули получают данные через
 * `src/data/kits.ts`, поэтому проекция не расползается по бандлу.
 */
const projection = kitsJson as ConsumerKitProjection;

export const CANONICAL_KITS: ConsumerKit[] = projection.kits;
