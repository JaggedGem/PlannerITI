export const normalizeSubjectName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export interface SemanticPreference {
  hue: number;
  strength: number;
}

// Exact normalized aliases. Deliberately leave ambiguous institution names (e.g. Pv)
// and physical education unclassified rather than matching "fiz" inside any name.
export const SUBJECT_ASSOCIATIONS = [
  { hue: 260, strength: 1, aliases: ['Matematica', 'Matem', 'Mat', 'Math', 'Mathematics'] },
  { hue: 145, strength: 1, aliases: ['Biologia', 'Biologie', 'Bio', 'Biology'] },
  { hue: 305, strength: 1, aliases: ['Chimia', 'Chimie', 'Chim', 'Chemistry'] },
  { hue: 50, strength: 1, aliases: ['Fizica', 'Fiz', 'Physics'] },
  { hue: 80, strength: 0.85, aliases: ['Istoria', 'Istorie', 'History'] },
  { hue: 120, strength: 0.85, aliases: ['Geografia', 'Geografie', 'Geography'] },
  {
    hue: 210,
    strength: 1,
    aliases: ['Informatica', 'Informatics', 'Inform', 'Info', 'Computer Science', 'Computing'],
  },
  {
    hue: 10,
    strength: 0.9,
    aliases: [
      'Literature',
      'Literatura',
      'Limba si literatura romana',
      'Limba romana',
      'L.rom',
      'L.romana',
    ],
  },
] as const;

const aliases = new Map<string, SemanticPreference>();
for (const { hue, strength, aliases: names } of SUBJECT_ASSOCIATIONS) {
  for (const name of names) aliases.set(normalizeSubjectName(name), { hue, strength });
}

export const semanticPreference = (name: string): SemanticPreference | undefined =>
  aliases.get(normalizeSubjectName(name));

/** Prefer the upstream subject ID. Older CEITI payloads expose only the name. */
export function subjectColorId(subject: { name?: string; _id?: string; id?: string }): string {
  const id = subject._id || subject.id;
  if (typeof id === 'string' && id.trim()) return `id:${id.trim()}`;
  return `name:${(subject.name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()}`;
}
