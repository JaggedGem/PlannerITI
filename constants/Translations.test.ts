import { translations } from './Translations';

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (!value || typeof value !== 'object') throw new Error(`Invalid translation at ${prefix}`);
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    ),
  );
}

const english = flatten(translations.en);
const placeholders = (value: string) =>
  [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();

it.each(['en', 'ro', 'ru'] as const)(
  'has complete nonempty messages and matching placeholders in %s',
  (language) => {
    const messages = flatten(translations[language]);
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
    for (const [key, message] of Object.entries(messages)) {
      expect({ key, nonempty: message.trim().length > 0 }).toEqual({ key, nonempty: true });
      expect({ key, placeholders: placeholders(message) }).toEqual({
        key,
        placeholders: placeholders(english[key]),
      });
      expect((message.match(/<link>/g) ?? []).length).toBe(
        (message.match(/<\/link>/g) ?? []).length,
      );
    }
    expect(translations[language].weekdays.short).toHaveLength(7);
    expect(translations[language].weekdays.long).toHaveLength(7);
    expect(translations[language].months).toHaveLength(12);
  },
);

it.each(['ro', 'ru'] as const)('does not leave English paragraphs in %s', (language) => {
  const untranslated = Object.entries(flatten(translations[language]))
    .filter(
      ([key, text]) =>
        text === english[key] &&
        text.split(/\s+/).length >= 4 &&
        /[a-zA-Z]{3}/.test(text.replace(/{{\w+}}/g, '')),
    )
    .map(([key]) => key);
  expect(untranslated).toEqual([]);
});
