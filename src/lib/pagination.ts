export const RESULTS_PAGE_SIZE = 24;

/** Bounds shared by catalog and book search; indices remain zero-based. */
export function pageBounds(total: number, requestedPage: number, pageSize = RESULTS_PAGE_SIZE) {
  const size = Math.max(1, Math.floor(pageSize) || RESULTS_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(requestedPage) || 0));
  const start = page * size;
  return { page, pageCount, start, end: Math.min(total, start + size) };
}
