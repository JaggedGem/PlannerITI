import { translations } from '@/constants/Translations';

import { parseStudentGradesData } from './gradesService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

it.each(['en', 'ro', 'ru'] as const)(
  'translates demo data parsed from the same cached response in %s',
  (language) => {
    const data = parseStudentGradesData('<planneriti-placeholder-grades />', language);
    const text = translations[language].demoGrades;
    expect(data.studentInfo.status).toBe(text.status);
    expect(data.studentInfo.specialization).toBe(text.specialization);
    expect(data.currentGrades[0].subjects.map((subject) => subject.name)).toEqual([
      text.mathematics,
      text.programming,
      text.english,
      text.databases,
    ]);
  },
);

it('uses empty subject collections for missing semester data rather than English messages as subject names', () => {
  const data = parseStudentGradesData('<html></html>', 'ro');
  expect(data.currentGrades).toHaveLength(2);
  expect(data.currentGrades.every((semester) => semester.subjects.length === 0)).toBe(true);
});
