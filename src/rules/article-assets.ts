// Keep article prose as standalone JSON, including tiny articles. The directory
// itself loads on first reading, so browsing the index needs neither URLs nor prose.
export const articleUrls = import.meta.glob<string>("../generated/rules/articles/*.json", {
  query: "?url&no-inline", import: "default", eager: true,
});
