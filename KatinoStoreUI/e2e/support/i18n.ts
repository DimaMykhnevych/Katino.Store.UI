import * as fs from 'fs';
import * as path from 'path';

// Texts are checked against the app's own translations, so copy changes don't break the tests.
const dictionaries: Record<string, unknown> = {};

function dictionary(lang: string): unknown {
  if (!dictionaries[lang]) {
    const file = path.join(__dirname, '..', '..', 'src', 'assets', 'i18n', `${lang}.json`);
    dictionaries[lang] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  return dictionaries[lang];
}

export function t(key: string, params: Record<string, string | number> = {}, lang = 'ua'): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], dictionary(lang));
  if (typeof value !== 'string') {
    throw new Error(`Missing translation "${key}" in ${lang}.json`);
  }
  return value.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => String(params[name]));
}
