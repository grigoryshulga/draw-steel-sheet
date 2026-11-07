import type { CatalogBrowserEntry } from '../data/reference-catalog';
import { matchesLibraryQuery } from './library-utils';

export interface DirectorFilters {
  query: string;
  role: string;
  organization: string;
  keyword: string;
  size: string;
  minLevel: string;
  maxLevel: string;
  minEv: string;
  maxEv: string;
}
export const emptyDirectorFilters: DirectorFilters = {
  query: '', role: '', organization: '', keyword: '', size: '', minLevel: '', maxLevel: '', minEv: '', maxEv: '',
};

function inRange(value: number | undefined, min: string, max: string): boolean {
  if (!min && !max) return true;
  return value !== undefined && Number.isFinite(value) && (!min || value >= Number(min)) && (!max || value <= Number(max));
}

export function matchesDirectorFilters(entry: CatalogBrowserEntry, filters: DirectorFilters): boolean {
  const data = entry.director;
  if (!data) return true;
  return matchesLibraryQuery(filters.query, entry.search)
    && (!filters.role || data.role === filters.role)
    && (!filters.organization || data.organization === filters.organization)
    && (!filters.keyword || data.keywords?.includes(filters.keyword) === true)
    && (!filters.size || String(data.size) === filters.size)
    && inRange(data.level, filters.minLevel, filters.maxLevel)
    && inRange(data.ev !== undefined ? (data.section === 'terrain' ? Number.parseFloat(data.ev) : Number(data.ev)) : undefined, filters.minEv, filters.maxEv);
}
