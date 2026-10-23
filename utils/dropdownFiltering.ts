// Structural types let the dropdown retain richer item metadata without coupling filtering to UI.
export const filterDropdownItems = <T extends { label: string }>(items: T[], query: string): T[] =>
  query ? items.filter((item) => item.label.toLowerCase().includes(query)) : items;

export const filterDropdownCategories = <T extends { data: { label: string }[] }>(
  categories: T[],
  query: string,
): T[] =>
  query
    ? categories
        .map((category) => ({ ...category, data: filterDropdownItems(category.data, query) }))
        .filter((category) => category.data.length > 0)
    : categories;
