import { libraryQueryString } from '../libraryQuery';

it('builds the list query with only the filters in use', () => {
  expect(libraryQueryString({ q: '恩典 Grace', dateFrom: '2026-10-01', page: 2 }))
    .toBe('?q=%E6%81%A9%E5%85%B8%20Grace&date_from=2026-10-01&page=2&limit=20');
  expect(libraryQueryString({})).toBe('?page=1&limit=20');
});
