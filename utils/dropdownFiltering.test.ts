import { filterDropdownCategories, filterDropdownItems } from './dropdownFiltering';

it('keeps original items when there is no search', () => {
  const items = [{ label: 'Math', id: 'one' }];
  expect(filterDropdownItems(items, '')).toBe(items);
});

it('filters case-insensitively while preserving item metadata and input', () => {
  const items = [
    { label: 'Math', id: 'one', metadata: { extra: true } },
    { label: 'Biology', id: 'two' },
  ];
  expect(filterDropdownItems(items, 'mat')).toEqual([items[0]]);
  expect(items).toHaveLength(2);
});

it('removes empty categories without mutating their data', () => {
  const categories = [
    { id: 'one', data: [{ label: 'Math' }] },
    { id: 'two', data: [{ label: 'Biology' }] },
  ];
  expect(filterDropdownCategories(categories, 'math')).toEqual([categories[0]]);
  expect(categories[1].data).toHaveLength(1);
});
