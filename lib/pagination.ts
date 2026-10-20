export const CHEFS_PER_PAGE = 12;

export function paginate<T>(items: readonly T[], rawPage: string, perPage = CHEFS_PER_PAGE) {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const parsed = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Math.max(1, Math.min(pageCount, Number.isSafeInteger(parsed) ? parsed : 1));
  const start = (page - 1) * perPage;
  return { page, pageCount, start, items: items.slice(start, start + perPage) };
}

export function chefPageUrl(filters: Record<string, string>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "page") params.set(key, value);
  if (page > 1) params.set("page", String(page));
  return `/chefs${params.size ? `?${params}` : ""}#chef-results`;
}
