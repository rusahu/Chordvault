import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { locale } from '../../test/i18nMock';

const root = resolve(__dirname, '../..');
const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path);
  return /\.tsx?$/.test(entry.name) ? [readFileSync(path, 'utf8')] : [];
});
const used = new Set(sources(root).flatMap(code => [...code.matchAll(/\bt(?:Replace)?\('([\w]+\.[\w.]+)'/g)].map(m => m[1])));
// tag.* keys are looked up from the tag name at runtime (lib/tagName.ts)
const isDynamic = (key: string) => key.startsWith('tag.');

it('defines every key the app asks for', () => {
  expect([...used].filter(key => !(key in locale))).toEqual([]);
});

it('has no keys the app never asks for', () => {
  expect(Object.keys(locale).filter(key => !used.has(key) && !isDynamic(key))).toEqual([]);
});
