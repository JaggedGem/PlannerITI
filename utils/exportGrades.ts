import { Alert } from 'react-native';

import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Colors } from '@/constants/Colors';
import { Translation } from '@/constants/Translations';
import { GradeSubject, SemesterGrades, StudentGrades } from '@/services/gradesService';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]|'/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });

const parseNumericGrade = (grade: string): number => {
  const normalized = grade.replace(',', '.').trim();
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
};

const getGradeColor = (grade: string): string => {
  const normalized = grade.trim().toLowerCase();
  if (normalized === 'a') return Colors.dark.overlayAbsenceUnexcused65;
  if (normalized === 'm') return Colors.dark.overlayAbsenceExcused65;
  const numericGrade = parseNumericGrade(grade);
  if (Number.isNaN(numericGrade)) return Colors.dark.overlayPrimaryStrong50;
  if (numericGrade < 5) return Colors.dark.overlayFail50;
  if (numericGrade >= 9) return Colors.dark.overlaySuccess50;
  if (numericGrade >= 7) return Colors.dark.overlayGood50;
  return Colors.dark.overlayPrimaryStrong50;
};

const getPdfGradeTextColor = (grade: string): string => {
  const normalized = grade.trim().toLowerCase();
  if (normalized === 'a' || normalized === 'm') return Colors.dark.white;

  const numericGrade = parseNumericGrade(grade);
  if (Number.isNaN(numericGrade)) return Colors.dark.white;
  if (numericGrade >= 7) return '#11181C';
  return Colors.dark.white;
};

const getCurrentSemester = (): number => {
  const currentDate = new Date();
  const month = currentDate.getMonth();

  if (
    (month === 8 && currentDate.getDate() >= 1) ||
    month === 9 ||
    month === 10 ||
    month === 11 ||
    (month === 0 && currentDate.getDate() < 10)
  ) {
    return 1;
  }

  return 2;
};

const resolveAbsoluteSemesterNumber = (
  semesterNumber: number,
  options?: {
    studentYearNumber?: number;
    currentSemester?: number;
    semesters?: SemesterGrades[];
  },
): number => {
  if (semesterNumber > 2) return semesterNumber;

  const studentYearNumber = options?.studentYearNumber ?? 1;
  const currentSemester = options?.currentSemester;
  const semesterNumbers = options?.semesters?.map((semester) => semester.semester) ?? [];
  const hasOnlyRelativeSemesters =
    semesterNumbers.length > 0 && semesterNumbers.every((value) => value >= 1 && value <= 2);
  const shouldMapRelativeSemesters =
    hasOnlyRelativeSemesters && (studentYearNumber > 1 || (currentSemester ?? 0) > 2);

  if (!shouldMapRelativeSemesters) {
    return semesterNumber;
  }

  if (currentSemester && currentSemester > 2) {
    const activeSemesterInYear = currentSemester % 2 === 0 ? 2 : 1;
    const baseOffset = currentSemester - activeSemesterInYear;
    return baseOffset + semesterNumber;
  }

  return (studentYearNumber - 1) * 2 + semesterNumber;
};

const formatSemesterYearLabel = (
  yearSemesterTemplate: string,
  semesterNumber: number,
  options?: {
    studentYearNumber?: number;
    currentSemester?: number;
    semesters?: SemesterGrades[];
  },
): string => {
  const absoluteSemester = resolveAbsoluteSemesterNumber(semesterNumber, options);
  const year = Math.ceil(absoluteSemester / 2);
  const semesterInYear = absoluteSemester % 2 === 0 ? 2 : 1;

  return yearSemesterTemplate
    .replace('{{year}}', year.toString())
    .replace('{{semester}}', semesterInYear.toString());
};

export interface ExportGradesPdfParams {
  studentGrades: StudentGrades;
  t: <K extends keyof Translation>(key: K) => Translation[K];
  formatFullDate: (date: Date, withTime: boolean) => string;
}

export const exportGradesPdf = async ({
  studentGrades,
  t,
  formatFullDate,
}: ExportGradesPdfParams): Promise<void> => {
  const { studentInfo, currentGrades } = studentGrades;
  const allSubjects = currentGrades.flatMap((semester: SemesterGrades) => semester.subjects);
  const subjectAverages = allSubjects
    .map((subject: GradeSubject) => subject.finalAverage ?? subject.average)
    .filter(
      (value: number | undefined): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );
  const overallAverage =
    subjectAverages.length > 0
      ? (
          subjectAverages.reduce((sum: number, value: number) => sum + value, 0) /
          subjectAverages.length
        ).toFixed(2)
      : '-';
  const impactedSubjects = allSubjects.filter(
    (subject: GradeSubject) => subject.appliedExamGrade !== undefined || !!subject.appliedExamType,
  ).length;
  const totalGrades = allSubjects.reduce(
    (sum: number, subject: GradeSubject) => sum + subject.grades.length,
    0,
  );
  const now = new Date();
  const generatedOn = formatFullDate(now, true);

  const html = buildPdfHtml({
    studentGrades,
    t,
    generatedOn,
    studentInfo,
    currentGrades,
    allSubjects,
    overallAverage,
    impactedSubjects,
    totalGrades,
  });

  try {
    const pdf = await Print.printToFileAsync({ html });
    const sharingAvailable = await Sharing.isAvailableAsync();

    if (!sharingAvailable) {
      Alert.alert(t('grades').pdf.shareTitle, t('grades').pdf.shareMessage);
      return;
    }

    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle: t('grades').pdf.shareTitle,
      UTI: 'com.adobe.pdf',
    });

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(t('grades').pdf.errorTitle, t('grades').pdf.errorMessage);
  }
};

interface BuildPdfHtmlParams {
  studentGrades: StudentGrades;
  t: <K extends keyof Translation>(key: K) => Translation[K];
  generatedOn: string;
  studentInfo: StudentGrades['studentInfo'];
  currentGrades: SemesterGrades[];
  allSubjects: GradeSubject[];
  overallAverage: string;
  impactedSubjects: number;
  totalGrades: number;
}

const buildPdfHtml = ({
  studentGrades,
  t,
  generatedOn,
  studentInfo,
  currentGrades,
  allSubjects,
  overallAverage,
  totalGrades,
}: BuildPdfHtmlParams): string => {
  const currentSemesterLabel = studentGrades.currentSemester
    ? formatSemesterYearLabel(t('grades').semesters.yearSemester, studentGrades.currentSemester, {
        studentYearNumber: studentInfo.yearNumber,
        currentSemester: studentGrades.currentSemester,
        semesters: currentGrades,
      })
    : studentInfo.yearNumber
      ? formatSemesterYearLabel(
          t('grades').semesters.yearSemester,
          (studentInfo.yearNumber - 1) * 2 + getCurrentSemester(),
          {
            studentYearNumber: studentInfo.yearNumber,
          },
        )
      : null;

  const buildSemesterLabel = (semesterNumber: number) =>
    formatSemesterYearLabel(t('grades').semesters.yearSemester, semesterNumber, {
      studentYearNumber: studentInfo.yearNumber,
      currentSemester: studentGrades.currentSemester,
      semesters: currentGrades,
    });

  const headerCells = `
    <tr>
      <td class="label">${escapeHtml(t('grades').pdf.totalSemesters)}</td>
      <td class="value">${currentGrades.length}</td>
      <td class="label">${escapeHtml(t('grades').pdf.totalSubjects)}</td>
      <td class="value">${allSubjects.length}</td>
    </tr>
    <tr>
      <td class="label">${escapeHtml(t('grades').average)}</td>
      <td class="value">${escapeHtml(overallAverage)}</td>
      <td class="label">${escapeHtml(t('grades').pdf.totalGrades)}</td>
      <td class="value">${totalGrades}</td>
    </tr>
  `;

  const semesterSections = currentGrades
    .map((semester: SemesterGrades) => {
      const semesterAverage = semester.subjects
        .map((subject: GradeSubject) => subject.finalAverage ?? subject.average)
        .filter(
          (value: number | undefined): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        );
      const semesterAverageValue =
        semesterAverage.length > 0
          ? (
              semesterAverage.reduce((sum: number, value: number) => sum + value, 0) /
              semesterAverage.length
            ).toFixed(2)
          : '-';

      const subjectRows = semester.subjects
        .map((subject: GradeSubject) => {
          const displayedAverage = subject.finalDisplayedAverage || subject.displayedAverage || '-';
          const baseAverage = subject.baseDisplayedAverage || subject.displayedAverage || '-';
          const isExamImpact = !!subject.appliedExamType;
          const appliedExamGrade =
            typeof subject.appliedExamGrade === 'number' &&
            Number.isFinite(subject.appliedExamGrade)
              ? subject.appliedExamGrade.toFixed(2)
              : '';
          const impactLabel = subject.appliedExamType
            ? (() => {
                const typeKey = subject.appliedExamType?.toLowerCase() || '';
                if (typeKey.includes('teza') || typeKey.includes('thesis'))
                  return escapeHtml(t('grades').subjects.thesis);
                if (typeKey.includes('examen') || typeKey.includes('exam'))
                  return escapeHtml(t('grades').subjects.exam);
                return escapeHtml(subject.appliedExamType);
              })()
            : '';

          const gradeCells = subject.grades
            .map((grade: string) => {
              const bgColor = getGradeColor(grade);
              const textColor = getPdfGradeTextColor(grade);
              return `<td class="grade-cell" style="background:${escapeHtml(bgColor)};color:${escapeHtml(textColor)};">${escapeHtml(grade)}</td>`;
            })
            .join('');

          return `
          <tr class="subject-row">
            <td class="subject-name">${escapeHtml(subject.name)}</td>
            <td class="subject-average">${escapeHtml(displayedAverage)}</td>
            <td class="subject-base">${escapeHtml(baseAverage)}</td>
            <td class="subject-grades">
              <table class="grades-table"><tr>${gradeCells || `<td class="no-grades">${escapeHtml(t('grades').noGrades)}</td>`}</tr></table>
            </td>
            <td class="subject-exam">${isExamImpact ? `${escapeHtml(impactLabel)} ${appliedExamGrade ? `(${escapeHtml(appliedExamGrade)})` : ''}` : '-'}</td>
          </tr>`;
        })
        .join('');

      return `
      <tr><td colspan="5" class="semester-spacer"></td></tr>
      <tr class="semester-header-row">
        <td colspan="3" class="semester-title">${escapeHtml(buildSemesterLabel(semester.semester))}</td>
        <td colspan="2" class="semester-avg">${escapeHtml(t('grades').average)}: ${escapeHtml(semesterAverageValue)}</td>
      </tr>
      ${subjectRows}`;
    })
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(t('grades').pdf.exportTitle)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        color: #11181C;
        padding: 20px;
      }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 4px 6px; }

      .student-name { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
      .student-meta { font-size: 12px; color: #666; margin-bottom: 8px; }
      .generated-on { font-size: 9px; color: #999; text-align: center; margin-top: 12px; }

      .header-table { margin-bottom: 12px; }
      .header-table td.label { color: #666; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 25%; }
      .header-table td.value { font-weight: 700; font-size: 12px; width: 25%; }

      .semester-header-row td {
        background: #2c3dcd;
        color: #fff;
        font-weight: 700;
        font-size: 12px;
        padding: 6px 8px;
      }
      .semester-header-row td.semester-avg { text-align: right; }
      .semester-spacer td { padding: 2px; }

      .subject-row td { border-bottom: 1px solid #e0e0e0; padding: 6px 8px; vertical-align: top; }
      .subject-row:nth-child(even) td { background: #f7f8fc; }
      .subject-name { font-weight: 700; width: 30%; }
      .subject-average { font-weight: 700; text-align: center; width: 10%; }
      .subject-base { text-align: center; width: 10%; color: #666; }
      .subject-grades { width: 35%; }
      .subject-exam { width: 15%; text-align: center; font-size: 10px; }

      .grades-table { width: auto; }
      .grades-table td { padding: 1px; }
      .grade-cell {
        display: inline-block;
        min-width: 22px;
        text-align: center;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 800;
        margin: 1px;
      }
      .no-grades { font-size: 10px; color: #999; }

      .header-row td {
        background: #f0f0f5;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #666;
      }
    </style>
  </head>
  <body>
    <p class="student-name">${escapeHtml(`${studentInfo.firstName} ${studentInfo.name}`.trim())}</p>
    <p class="student-meta">${escapeHtml(studentInfo.group)}${studentInfo.specialization ? ` • ${escapeHtml(studentInfo.specialization)}` : ''}${currentSemesterLabel ? ` • ${escapeHtml(currentSemesterLabel)}` : ''}</p>

    <table class="header-table">
      ${headerCells}
    </table>

    <table>
      <tr class="header-row">
        <td style="width:30%">${escapeHtml(t('grades').form.subject)}</td>
        <td style="width:10%">${escapeHtml(t('grades').average)}</td>
        <td style="width:10%">${escapeHtml(t('grades').subjects.withoutExam)}</td>
        <td style="width:35%">${escapeHtml(t('grades').pdf.totalGrades)}</td>
        <td style="width:15%">${escapeHtml(t('grades').pdf.impactedSubjects)}</td>
      </tr>
      ${semesterSections}
    </table>

    <p class="generated-on">${escapeHtml(t('grades').pdf.generatedOn)} ${escapeHtml(generatedOn)}</p>
  </body>
</html>`;
};
