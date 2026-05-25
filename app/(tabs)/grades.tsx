import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
  Keyboard,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ScrollView as GestureHandlerScrollView,
  NativeViewGestureHandler,
} from "react-native-gesture-handler";
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { MaterialIcons } from "@react-native-vector-icons/material-icons";
import Animated, {
  FadeInUp,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "@/hooks/useTranslation";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import {
  fetchStudentInfo,
  parseStudentGradesData,
  StudentGrades,
  StudentInfo,
  SemesterGrades,
  GradeSubject,
  Exam,
  gradesDataService,
  GRADES_REFRESH_START_EVENT,
  GRADES_REFRESH_END_EVENT,
} from "@/services/gradesService";
import { secureStorageService } from "@/services/secureStorageService";
import {
  scheduleService,
  ExamScheduleEvent,
  ThesisScheduleEvent,
  SpecialScheduleResponse,
} from "@/services/scheduleService";
import {
  eventMatchesSelectedSubgroup,
  formatExamTimeLabel,
  formatThesisTimeLabel,
} from "@/utils/specialScheduleUtils";
import { Colors } from "@/constants/Colors";
import { BottomModalPortal } from "@/components/BottomModalPortal";
import { runWhenIdle } from "@/utils/runWhenIdle";

// Types for local grades
type ViewMode = "grades" | "exams";

// Map of newly detected grades/exams keyed by semester-subject
type NewGradeHighlight = { gradeIndices: number[]; newExam?: boolean };
type NewGradeHighlightsMap = Record<string, NewGradeHighlight>;
type OfficialAssessmentEvent =
  | (ExamScheduleEvent & { type: "exam" })
  | (ThesisScheduleEvent & { type: "thesis" });

interface OfficialScheduleState {
  thesis: SpecialScheduleResponse | null;
  exam: SpecialScheduleResponse | null;
  loading: boolean;
}

// Constants for AsyncStorage keys
const GRADES_DATA_KEY = "@planner_grades_data";
const GRADES_TIMESTAMP_KEY = "@planner_grades_timestamp";
const IDNP_UPDATE_EVENT = "IDNP_UPDATE";
const DEV_GRADE_TOGGLE_KEY = "@dev_grade_toggle_active";
const DEV_GRADE_TOGGLE_EVENT = "dev_grade_toggle_event";
const GRADES_HIGHLIGHTS_KEY_PREFIX = "@planner_grades_new_highlights_";

// Number of days before data is considered stale
const STALE_DATA_DAYS = 7;

// Interface for storing grades data with timestamp
interface StoredGradesData {
  html: string;
  timestamp: number;
}

/**
 * Determine the current semester based on the date
 * 1st semester: September 1 - January 9
 * 2nd semester: January 10 - August 31
 */
const getCurrentSemester = (): number => {
  const currentDate = new Date();
  const month = currentDate.getMonth(); // 0-11 (Jan-Dec)
  const day = currentDate.getDate();

  // First semester: Sept 1 - Jan 9
  if (
    (month === 8 && day >= 1) || // September
    month === 9 || // October
    month === 10 || // November
    month === 11 || // December
    (month === 0 && day < 10)
  ) {
    // January 1-9
    return 1;
  }

  // Second semester: Jan 10 - Aug 31
  return 2;
};

// Lightweight grade parser for local calculations
const parseNumericGrade = (grade: string): number => {
  const normalized = grade.replace(",", ".").trim();
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
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
  const semesterNumbers =
    options?.semesters?.map((semester) => semester.semester) ?? [];
  const hasOnlyRelativeSemesters =
    semesterNumbers.length > 0 &&
    semesterNumbers.every((value) => value >= 1 && value <= 2);
  const shouldMapRelativeSemesters =
    hasOnlyRelativeSemesters &&
    (studentYearNumber > 1 || (currentSemester ?? 0) > 2);

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
  const absoluteSemester = resolveAbsoluteSemesterNumber(
    semesterNumber,
    options,
  );
  const year = Math.ceil(absoluteSemester / 2);
  const semesterInYear = absoluteSemester % 2 === 0 ? 2 : 1;

  return yearSemesterTemplate
    .replace("{{year}}", year.toString())
    .replace("{{semester}}", semesterInYear.toString());
};

const getGradeColor = (grade: string): string => {
  const normalized = grade.trim().toLowerCase();
  if (normalized === "a") return Colors.dark.overlayAbsenceUnexcused65;
  if (normalized === "m") return Colors.dark.overlayAbsenceExcused65;
  const numericGrade = parseNumericGrade(grade);
  if (Number.isNaN(numericGrade)) return Colors.dark.overlayPrimaryStrong50;
  if (numericGrade < 5) return Colors.dark.overlayFail50;
  if (numericGrade >= 9) return Colors.dark.overlaySuccess50;
  if (numericGrade >= 7) return Colors.dark.overlayGood50;
  return Colors.dark.overlayPrimaryStrong50;
};

const getPdfGradeTextColor = (grade: string): string => {
  const normalized = grade.trim().toLowerCase();
  if (normalized === "a" || normalized === "m") return Colors.dark.white;

  const numericGrade = parseNumericGrade(grade);
  if (Number.isNaN(numericGrade)) return Colors.dark.white;
  if (numericGrade >= 7) return "#11181C";
  return Colors.dark.white;
};

const GRADES_MODAL_COLORS = {
  surface: Colors.dark.backgroundTertiary,
  border: Colors.dark.border,
  textPrimary: Colors.dark.text,
  textSecondary: Colors.dark.mutedText,
  accent: Colors.dark.primaryStrong,
  accentDisabled: Colors.dark.borderStrong,
  successChip: Colors.dark.overlaySuccess15,
} as const;

const cloneStudentGrades = (data: StudentGrades): StudentGrades => ({
  studentInfo: { ...data.studentInfo },
  currentGrades: data.currentGrades.map((semester) => ({
    ...semester,
    subjects: semester.subjects.map((subject) => ({
      ...subject,
      grades: [...subject.grades],
    })),
  })),
  exams: data.exams.map((exam) => ({ ...exam })),
  annualGrades: data.annualGrades.map((grade) => ({ ...grade })),
  currentSemester: data.currentSemester,
});

const parseEventDate = (date: string): Date => new Date(`${date}T00:00:00`);

const parseTimeToMinutes = (time?: string | null): number => {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes))
    return Number.MAX_SAFE_INTEGER;
  return hours * 60 + minutes;
};

const normalizeAssessmentText = (value: string): string => {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Expand common short forms used in schedules/grade portals.
  const expanded = normalized
    .replace(/\bl\.\s*/g, "limba ")
    .replace(/\blimba\b/g, "limba")
    .replace(/\bl engleza\b/g, "limba engleza")
    .replace(/\bl romana\b/g, "limba romana")
    .replace(/\bl franceza\b/g, "limba franceza")
    .replace(/\bl germana\b/g, "limba germana")
    .replace(/\binf\.?\b/g, "informatica")
    .replace(/\bmat\.?\b/g, "matematica")
    .replace(/\bfiz\.?\b/g, "fizica")
    .replace(/\bchim\.?\b/g, "chimie")
    .replace(/\bist\.?\b/g, "istorie")
    .replace(/\bgeo\.?\b/g, "geografie")
    .replace(/\bsec\.?\b/g, "securitate")
    .replace(/\btehn\.?\b/g, "tehnologii")
    .replace(/\bcomunic\.?\b/g, "comunicare")
    .replace(/\bimpliment\.?\b/g, "implementare");

  return expanded
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const ASSESSMENT_STOPWORDS = new Set([
  "de",
  "si",
  "la",
  "pe",
  "cu",
  "in",
  "din",
  "the",
  "and",
  "of",
]);

const tokenizeAssessmentText = (value: string): string[] =>
  normalizeAssessmentText(value).split(" ").filter(Boolean);

const buildAssessmentAcronym = (tokens: string[]): string => {
  const letters = tokens
    .filter((token) => !ASSESSMENT_STOPWORDS.has(token) && token.length > 1)
    .map((token) => token[0])
    .join("");

  return letters.length >= 2 ? letters : "";
};

const computeLevenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previousRow = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const currentRow = new Array<number>(right.length + 1);

  for (let rowIndex = 1; rowIndex <= left.length; rowIndex++) {
    currentRow[0] = rowIndex;

    for (let columnIndex = 1; columnIndex <= right.length; columnIndex++) {
      const cost = left[rowIndex - 1] === right[columnIndex - 1] ? 0 : 1;
      currentRow[columnIndex] = Math.min(
        previousRow[columnIndex] + 1,
        currentRow[columnIndex - 1] + 1,
        previousRow[columnIndex - 1] + cost,
      );
    }

    for (let columnIndex = 0; columnIndex <= right.length; columnIndex++) {
      previousRow[columnIndex] = currentRow[columnIndex];
    }
  }

  return previousRow[right.length];
};

const scoreAssessmentTokenMatch = (
  leftToken: string,
  rightToken: string,
): number => {
  if (leftToken === rightToken) return 1;
  if (leftToken.length < 3 || rightToken.length < 3) return 0;

  if (leftToken.startsWith(rightToken) || rightToken.startsWith(leftToken)) {
    const shorterLength = Math.min(leftToken.length, rightToken.length);
    const longerLength = Math.max(leftToken.length, rightToken.length);
    return shorterLength / longerLength >= 0.6 ? 0.9 : 0.75;
  }

  if (
    Math.abs(leftToken.length - rightToken.length) <= 2 &&
    Math.max(leftToken.length, rightToken.length) >= 6 &&
    computeLevenshteinDistance(leftToken, rightToken) <= 1
  ) {
    return 0.82;
  }

  if (leftToken.slice(0, 4) === rightToken.slice(0, 4)) {
    return 0.7;
  }

  return 0;
};

const scoreFuzzyTokenOverlap = (
  leftTokens: string[],
  rightTokens: string[],
): number => {
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const consumedRightIndexes = new Set<number>();
  let totalScore = 0;

  leftTokens.forEach((leftToken) => {
    let bestScore = 0;
    let bestIndex = -1;

    rightTokens.forEach((rightToken, rightIndex) => {
      if (consumedRightIndexes.has(rightIndex)) return;
      const score = scoreAssessmentTokenMatch(leftToken, rightToken);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = rightIndex;
      }
    });

    if (bestIndex >= 0) {
      consumedRightIndexes.add(bestIndex);
      totalScore += bestScore;
    }
  });

  return totalScore / Math.max(leftTokens.length, rightTokens.length);
};

const scoreAssessmentTextMatch = (left: string, right: string): number => {
  const a = normalizeAssessmentText(left);
  const b = normalizeAssessmentText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const leftTokens = tokenizeAssessmentText(left);
  const rightTokens = tokenizeAssessmentText(right);
  const tokenIntersection = leftTokens.filter((token) =>
    rightTokens.includes(token),
  ).length;
  const tokenUnion = new Set<string>([...leftTokens, ...rightTokens]).size || 1;

  let score = tokenIntersection / tokenUnion;
  score = Math.max(
    score,
    scoreFuzzyTokenOverlap(leftTokens, rightTokens),
    scoreFuzzyTokenOverlap(rightTokens, leftTokens),
  );

  const leftAcronym = buildAssessmentAcronym(leftTokens);
  const rightAcronym = buildAssessmentAcronym(rightTokens);
  if (
    (leftAcronym && rightTokens.includes(leftAcronym)) ||
    (rightAcronym && leftTokens.includes(rightAcronym)) ||
    (leftAcronym && rightAcronym && leftAcronym === rightAcronym)
  ) {
    score = Math.max(score, 0.9);
  }

  if (a.includes(b) || b.includes(a)) {
    score = Math.max(score, 0.7);
  }

  if (
    leftTokens[0] &&
    rightTokens[0] &&
    scoreAssessmentTokenMatch(leftTokens[0], rightTokens[0]) >= 0.9
  ) {
    score = Math.min(1, score + 0.05);
  }

  return Math.max(0, Math.min(1, score));
};

const normalizeExamType = (type: string): "exam" | "thesis" | "other" => {
  const key = normalizeAssessmentText(type);
  if (key.includes("teza") || key.includes("thesis")) return "thesis";
  if (key.includes("examen") || key.includes("exam")) return "exam";
  return "other";
};

const formatOfficialEventSummary = (
  event: OfficialAssessmentEvent,
  roomLabel: string,
): string => {
  const eventDate = parseEventDate(event.date);
  const dateLabel =
    Number.isFinite(eventDate.getTime()) ?
      `${String(eventDate.getDate()).padStart(2, "0")}.${String(eventDate.getMonth() + 1).padStart(2, "0")}`
    : event.date;

  const thesisTime =
    event.type === "thesis" ? formatThesisTimeLabel(event) : "";
  const thesisPeriod =
    event.type === "thesis" && event.period ? `P${event.period}` : "";
  const timingLabel =
    event.type === "exam" ?
      formatExamTimeLabel(event)
    : thesisTime || thesisPeriod;
  const room = event.room ? `${roomLabel} ${event.room}` : "";
  const subgroup = event.subgroup ? `${event.subgroup}` : "";

  return [dateLabel, timingLabel, room, subgroup].filter(Boolean).join(" • ");
};

const buildExamToOfficialEventMap = (
  exams: Exam[],
  officialEvents: OfficialAssessmentEvent[],
  currentSemester: number,
): Map<Exam, OfficialAssessmentEvent> => {
  const matches = new Map<Exam, OfficialAssessmentEvent>();
  if (exams.length === 0 || officialEvents.length === 0) return matches;

  const candidates: {
    exam: Exam;
    event: OfficialAssessmentEvent;
    totalScore: number;
    subjectScore: number;
    eventDateMs: number;
  }[] = [];

  exams.forEach((exam) => {
    // Official special schedules are session-scoped; avoid cross-semester binding.
    if (exam.semester !== currentSemester) return;

    const normalizedType = normalizeExamType(exam.type);
    const typedEvents =
      normalizedType === "other" ? officialEvents : (
        officialEvents.filter((event) => event.type === normalizedType)
      );
    if (typedEvents.length === 0) return;

    typedEvents.forEach((event) => {
      const subjectScore = scoreAssessmentTextMatch(exam.name, event.subject);
      const minimumSubjectScore = normalizedType === "other" ? 0.58 : 0.3;
      if (subjectScore < minimumSubjectScore) return;

      const eventDateMs = parseEventDate(event.date).getTime();
      const isFutureEvent =
        Number.isFinite(eventDateMs) &&
        eventDateMs >= Date.now() - 12 * 60 * 60 * 1000;
      const dateBonus =
        exam.isUpcoming ?
          isFutureEvent ? 0.12
          : -0.12
        : 0;

      candidates.push({
        exam,
        event,
        totalScore: subjectScore + dateBonus,
        subjectScore,
        eventDateMs:
          Number.isFinite(eventDateMs) ? eventDateMs : Number.MAX_SAFE_INTEGER,
      });
    });
  });

  candidates.sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (right.subjectScore !== left.subjectScore) {
      return right.subjectScore - left.subjectScore;
    }
    return left.eventDateMs - right.eventDateMs;
  });

  const matchedExams = new Set<Exam>();
  const matchedEvents = new Set<OfficialAssessmentEvent>();

  candidates.forEach((candidate) => {
    if (
      matchedExams.has(candidate.exam) ||
      matchedEvents.has(candidate.event)
    ) {
      return;
    }

    matchedExams.add(candidate.exam);
    matchedEvents.add(candidate.event);
    matches.set(candidate.exam, candidate.event);
  });

  return matches;
};

const recalculateSubjectAverages = (subject: GradeSubject) => {
  const numericGrades = subject.grades
    .map(parseNumericGrade)
    .filter((g) => !isNaN(g));

  if (numericGrades.length === 0) {
    subject.baseAverage = undefined;
    subject.baseDisplayedAverage = "-";
    subject.finalAverage = undefined;
    subject.finalDisplayedAverage = "-";
    subject.average = undefined;
    subject.displayedAverage = "-";
    return;
  }

  const baseAvg =
    numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length;
  const roundedBase = Math.floor(baseAvg * 100) / 100;
  subject.baseAverage = roundedBase;
  subject.baseDisplayedAverage = roundedBase.toFixed(2);

  const examGrade = subject.appliedExamGrade;
  const typeKey = subject.appliedExamType?.toLowerCase() || "";
  let finalAvg = roundedBase;

  if (examGrade !== undefined && !isNaN(examGrade)) {
    if (typeKey.includes("teza") || typeKey.includes("thesis")) {
      finalAvg = (roundedBase + examGrade) / 2;
    } else if (typeKey.includes("examen") || typeKey.includes("exam")) {
      finalAvg = roundedBase * 0.6 + examGrade * 0.4;
    }
  }

  const roundedFinal = Math.floor(finalAvg * 100) / 100;
  subject.finalAverage = roundedFinal;
  subject.finalDisplayedAverage = roundedFinal.toFixed(2);
  subject.average = roundedFinal;
  subject.displayedAverage = subject.finalDisplayedAverage;
};

const injectRandomGrades = (data: StudentGrades, count = 5): StudentGrades => {
  const clone = cloneStudentGrades(data);
  const subjectRefs = clone.currentGrades.flatMap((semester) =>
    semester.subjects.map((subject) => ({
      semester: semester.semester,
      subject,
    })),
  );

  if (subjectRefs.length === 0) return clone;

  const targetCount = Math.min(count, subjectRefs.length);
  const selected = new Set<number>();
  while (selected.size < targetCount) {
    selected.add(Math.floor(Math.random() * subjectRefs.length));
  }

  selected.forEach((index) => {
    const { subject } = subjectRefs[index];
    const randomGrade = (Math.floor(Math.random() * 10) + 1).toString();
    subject.grades = [...subject.grades, randomGrade];
    recalculateSubjectAverages(subject);
  });

  return clone;
};

const buildGradeCountMap = (grades: string[]): Record<string, number> => {
  return grades.reduce<Record<string, number>>((acc, grade) => {
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});
};

const getHighlightsStorageKey = (idnp: string): string =>
  `${GRADES_HIGHLIGHTS_KEY_PREFIX}${idnp}`;

const mergeNewGradeHighlights = (
  existing: NewGradeHighlightsMap,
  fresh: NewGradeHighlightsMap,
): NewGradeHighlightsMap => {
  const merged: NewGradeHighlightsMap = { ...existing };

  Object.entries(fresh).forEach(([key, highlight]) => {
    const prev = merged[key];
    if (!prev) {
      merged[key] = {
        gradeIndices: [...highlight.gradeIndices],
        newExam: !!highlight.newExam,
      };
      return;
    }

    const combinedIndices = Array.from(
      new Set([
        ...(prev.gradeIndices || []),
        ...(highlight.gradeIndices || []),
      ]),
    ).sort((a, b) => a - b);

    merged[key] = {
      gradeIndices: combinedIndices,
      newExam: !!prev.newExam || !!highlight.newExam,
    };
  });

  return merged;
};

const parseStoredHighlights = (raw: string | null): NewGradeHighlightsMap => {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      { gradeIndices?: unknown; newExam?: unknown }
    >;
    const normalized: NewGradeHighlightsMap = {};

    Object.entries(parsed).forEach(([key, value]) => {
      const indices =
        Array.isArray(value?.gradeIndices) ?
          value.gradeIndices.filter(
            (item): item is number =>
              typeof item === "number" && Number.isInteger(item) && item >= 0,
          )
        : [];
      const hasExam =
        typeof value?.newExam === "boolean" ? value.newExam : false;

      if (indices.length > 0 || hasExam) {
        normalized[key] = {
          gradeIndices: Array.from(new Set(indices)).sort((a, b) => a - b),
          newExam: hasExam,
        };
      }
    });

    return normalized;
  } catch {
    return {};
  }
};

const computeNewGradeHighlights = (
  prevData: StudentGrades | null,
  nextData: StudentGrades | null,
): NewGradeHighlightsMap => {
  if (!nextData) return {};
  const highlights: NewGradeHighlightsMap = {};

  nextData.currentGrades.forEach((nextSemester) => {
    const prevSemester = prevData?.currentGrades.find(
      (s) => s.semester === nextSemester.semester,
    );

    nextSemester.subjects.forEach((nextSubject) => {
      const prevSubject = prevSemester?.subjects.find(
        (s) => s.name === nextSubject.name,
      );
      const prevCounts = buildGradeCountMap(prevSubject?.grades || []);
      const remaining = { ...prevCounts };
      const newIndices: number[] = [];

      nextSubject.grades.forEach((grade, index) => {
        if (remaining[grade] && remaining[grade] > 0) {
          remaining[grade] -= 1;
        } else {
          newIndices.push(index);
        }
      });

      const examBecameAvailable =
        nextSubject.appliedExamGrade !== undefined &&
        (prevSubject?.appliedExamGrade === undefined ||
          prevSubject.appliedExamGrade !== nextSubject.appliedExamGrade);

      if (newIndices.length || examBecameAvailable) {
        const key = `${nextSemester.semester}::${nextSubject.name}`;
        highlights[key] = {
          gradeIndices: newIndices,
          newExam: examBecameAvailable,
        };
      }
    });
  });

  return highlights;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]|'/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });

// Separate the IDNPScreen into its own component to avoid conditional hook rendering
const IDNPScreen = ({
  onSave,
  errorMessage,
  isSubmitting,
}: {
  onSave: (idnp: string, shouldSave: boolean) => void;
  errorMessage?: string;
  isSubmitting: boolean;
}) => {
  const [idnp, setIdnp] = useState("");
  const [error, setError] = useState(errorMessage || "");
  const { t } = useTranslation();

  useEffect(() => {
    if (!errorMessage) return;

    const idleTask = runWhenIdle(() => {
      setError(errorMessage);
    });
    // Vibrate to notify user of error
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    return () => {
      idleTask.cancel();
    };
  }, [errorMessage]);

  const handleSubmit = () => {
    if (!/^\d{13}$/.test(idnp)) {
      setError(t("grades").idnp.error);
      return;
    }

    setError("");

    // Let the parent component handle the API call
    onSave(idnp, true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.idnpContainer}
    >
      <View style={styles.idnpContent}>
        <Text style={styles.idnpTitle}>{t("grades").idnp.title}</Text>
        <Text style={styles.idnpDescription}>
          {t("grades").idnp.description}
        </Text>

        <TextInput
          style={[styles.idnpInput, error ? styles.idnpInputError : null]}
          value={idnp}
          onChangeText={(text) => {
            setIdnp(text.replace(/[^0-9]/g, ""));
            setError("");
          }}
          placeholder={t("grades").idnp.placeholder}
          placeholderTextColor={Colors.dark.neutral500}
          keyboardType='numeric'
          maxLength={13}
          editable={!isSubmitting}
        />

        {error ?
          <Text style={styles.errorText}>{error}</Text>
        : null}

        <Text style={styles.disclaimerText}>{t("grades").idnp.disclaimer}</Text>

        {isSubmitting ?
          <View style={styles.loadingNotice}>
            <ActivityIndicator size='small' color={Colors.dark.primaryStrong} />
            <Text style={styles.loadingText}>
              {t("grades").semesters.connecting}
            </Text>
          </View>
        : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!/^\d{13}$/.test(idnp) || isSubmitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!/^\d{13}$/.test(idnp) || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ?
              t("grades").semesters.connecting
            : t("grades").idnp.continue}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// Loading screen component
const LoadingScreen = ({ message }: { message?: string }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size='large' color={Colors.dark.primaryStrong} />
      <Text style={styles.loadingText}>{message || t("loading")}</Text>
    </View>
  );
};

// Subject card component with expandable grades
const SubjectCard = ({
  subject,
  expanded,
  onToggle,
  semesterNumber, // Add semester number to make subjects unique across semesters
  newGradeIndices,
  hasNewExam,
}: {
  subject: GradeSubject;
  expanded: boolean;
  onToggle: () => void;
  semesterNumber: number;
  newGradeIndices?: number[];
  hasNewExam?: boolean;
}) => {
  const { t } = useTranslation();
  const displayedAverage =
    subject.finalDisplayedAverage || subject.displayedAverage;
  const baseAverage = subject.baseDisplayedAverage || subject.displayedAverage;
  const hasExamAdjustment =
    displayedAverage && baseAverage && displayedAverage !== baseAverage;

  // Determine if this subject received any fresh data
  const isRecentlyUpdated =
    (newGradeIndices && newGradeIndices.length > 0) || hasNewExam;

  return (
    <Animated.View layout={Layout.springify()} style={styles.subjectCard}>
      <TouchableOpacity
        style={[
          styles.subjectHeader,
          subject.grades.length === 0 && styles.subjectHeaderEmpty,
        ]}
        onPress={subject.grades.length > 0 ? onToggle : undefined}
        activeOpacity={subject.grades.length > 0 ? 0.7 : 1}
      >
        <View style={styles.subjectNameRow}>
          <Text style={styles.subjectName}>{subject.name}</Text>
        </View>
        <View style={styles.subjectHeaderRight}>
          {isRecentlyUpdated && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>
                {t("grades").subjects.newBadge}
              </Text>
            </View>
          )}
          {displayedAverage && (
            <Text
              style={[
                styles.averageGrade,
                parseFloat(displayedAverage) < 5 && styles.failingGrade,
              ]}
            >
              {displayedAverage}
            </Text>
          )}
          {subject.grades.length > 0 && (
            <MaterialIcons
              name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color={Colors.dark.white}
            />
          )}
        </View>
      </TouchableOpacity>

      {expanded && subject.grades.length > 0 && (
        <Animated.View
          entering={FadeInUp.springify()}
          style={styles.gradesContainer}
        >
          {hasExamAdjustment && (
            <View style={styles.averageSummaryRow}>
              <View style={styles.averagePillPrimary}>
                <Text style={styles.averagePillLabel}>
                  {t("grades").subjects.finalAverage}
                </Text>
                <Text style={styles.averagePillValue}>
                  {subject.finalDisplayedAverage ||
                    subject.displayedAverage ||
                    "-"}
                </Text>
                {subject.appliedExamType &&
                  typeof subject.appliedExamGrade === "number" &&
                  !isNaN(subject.appliedExamGrade) && (
                    <Text style={styles.averagePillMeta}>
                      {(() => {
                        const typeKey =
                          subject.appliedExamType?.toLowerCase() || "";
                        const isTeza =
                          typeKey.includes("teza") ||
                          typeKey.includes("thesis");
                        return isTeza ?
                            t("grades").subjects.thesis
                          : t("grades").subjects.exam;
                      })()}{" "}
                      • {subject.appliedExamGrade.toFixed(2)}
                    </Text>
                  )}
              </View>

              {baseAverage && (
                <View style={styles.averagePillSecondary}>
                  <Text style={styles.averagePillLabel}>
                    {t("grades").subjects.withoutExam}
                  </Text>
                  <Text style={styles.averagePillValue}>{baseAverage}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.gradesGrid}>
            {subject.grades.map((grade, index) => {
              const gradeColor = getGradeColor(grade);
              const isNewGrade = newGradeIndices?.includes(index);
              return (
                <View
                  key={index}
                  style={[
                    styles.gradeItem,
                    { backgroundColor: gradeColor },
                    isNewGrade ? styles.newGradeItem : null,
                  ]}
                >
                  <Text style={styles.gradeText}>{grade}</Text>
                  {isNewGrade && <Text style={styles.gradePip}>*</Text>}
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// Exams component with semester filtering
const ExamsView = ({
  exams,
  studentInfo,
  officialSchedule,
  selectedSubgroup,
}: {
  exams: Exam[];
  studentInfo: StudentInfo;
  officialSchedule: OfficialScheduleState;
  selectedSubgroup: "Subgroup 1" | "Subgroup 2";
}) => {
  const { t } = useTranslation();
  const safeExams = useMemo(() => exams ?? [], [exams]);

  // Get current semester based on date
  const currentSemesterNumber = getCurrentSemester();

  // Calculate the correct semester based on student's year and current calendar semester
  // Year 1 Semester 1 = 1, Year 1 Semester 2 = 2, Year 2 Semester 1 = 3, Year 2 Semester 2 = 4, etc.
  const calculateStudentSemester = (): number => {
    const yearNumber = studentInfo.yearNumber || 1; // Default to year 1 if not available
    const calendarSemester = currentSemesterNumber; // 1 or 2
    return (yearNumber - 1) * 2 + calendarSemester;
  };

  const studentCurrentSemester = calculateStudentSemester();

  // Add state for selected semester - initialize with calculated student semester if it exists in the data
  const [selectedSemester, setSelectedSemester] = useState<number | null>(
    () => {
      // Check if the student's current semester exists in the exams data
      const hasSemester = safeExams.some(
        (exam) => exam.semester === studentCurrentSemester,
      );
      return hasSemester ? studentCurrentSemester : null;
    },
  );

  const [isOpen, setIsOpen] = useState(false);

  // Get unique semesters from exams
  const semesters = useMemo(() => {
    const uniqueSemesters = Array.from(
      new Set(safeExams.map((exam) => exam.semester)),
    ).sort((a, b) => a - b);

    return uniqueSemesters;
  }, [safeExams]);

  // Helper function to convert semester number to year and semester
  const formatSemesterLabel = (semesterNumber: number) =>
    formatSemesterYearLabel(
      t("grades").semesters.yearSemester,
      semesterNumber,
      {
        studentYearNumber: studentInfo.yearNumber,
        currentSemester: studentCurrentSemester,
      },
    );

  // Filter exams by semester if one is selected
  const filteredExams = useMemo(() => {
    if (selectedSemester === null) {
      return safeExams;
    }
    return safeExams.filter((exam) => exam.semester === selectedSemester);
  }, [safeExams, selectedSemester]);

  // Group exams by type
  const examsByType = useMemo(() => {
    const grouped: Record<string, Exam[]> = {};

    filteredExams.forEach((exam) => {
      if (!grouped[exam.type]) {
        grouped[exam.type] = [];
      }
      grouped[exam.type].push(exam);
    });

    return grouped;
  }, [filteredExams]);

  const officialEvents = useMemo(() => {
    const thesisEvents = (officialSchedule.thesis?.events || []).filter(
      (event): event is ThesisScheduleEvent =>
        event.type === "thesis" &&
        eventMatchesSelectedSubgroup(event.subgroup, selectedSubgroup),
    );
    const examEvents = (officialSchedule.exam?.events || []).filter(
      (event): event is ExamScheduleEvent =>
        event.type === "exam" &&
        eventMatchesSelectedSubgroup(event.subgroup, selectedSubgroup),
    );

    return [...examEvents, ...thesisEvents]
      .map(
        (event): OfficialAssessmentEvent =>
          event.type === "exam" ?
            { ...event, type: "exam" }
          : { ...event, type: "thesis" },
      )
      .sort((left, right) => {
        if (left.date !== right.date)
          return left.date.localeCompare(right.date);
        const leftTime =
          left.type === "exam" ?
            parseTimeToMinutes(left.time)
          : parseTimeToMinutes(left.startTime || left.endTime);
        const rightTime =
          right.type === "exam" ?
            parseTimeToMinutes(right.time)
          : parseTimeToMinutes(right.startTime || right.endTime);
        return leftTime - rightTime;
      });
  }, [
    officialSchedule.exam?.events,
    officialSchedule.thesis?.events,
    selectedSubgroup,
  ]);

  const officialMatchesByExam = useMemo(
    () =>
      buildExamToOfficialEventMap(
        filteredExams,
        officialEvents,
        studentCurrentSemester,
      ),
    [filteredExams, officialEvents, studentCurrentSemester],
  );

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    Haptics.selectionAsync();
  };

  // Select semester
  const selectSemester = (semester: number | null) => {
    setSelectedSemester(semester);
    setIsOpen(false);
    Haptics.selectionAsync();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Semester selector */}
      <View style={styles.semesterDropdownContainer}>
        <TouchableOpacity
          style={styles.semesterDropdownButton}
          onPress={toggleDropdown}
        >
          <Text style={styles.semesterDropdownButtonText}>
            {selectedSemester !== null ?
              formatSemesterLabel(selectedSemester)
            : t("grades").semesters.all}
          </Text>
          <MaterialIcons
            name={isOpen ? "arrow-drop-up" : "arrow-drop-down"}
            size={24}
            color={Colors.dark.white}
          />
        </TouchableOpacity>

        {isOpen && (
          <Animated.View
            entering={FadeInUp.duration(200)}
            style={styles.semesterDropdownMenu}
          >
            {/* Option to show all semesters */}
            <TouchableOpacity
              style={[
                styles.semesterDropdownItem,
                selectedSemester === null && styles.semesterDropdownItemActive,
              ]}
              onPress={() => selectSemester(null)}
            >
              <Text
                style={[
                  styles.semesterDropdownItemText,
                  selectedSemester === null &&
                    styles.semesterDropdownItemTextActive,
                ]}
              >
                {t("grades").semesters.all}
              </Text>
            </TouchableOpacity>

            {/* Options for individual semesters */}
            {semesters.map((semester) => (
              <TouchableOpacity
                key={`semester-${semester}`}
                style={[
                  styles.semesterDropdownItem,
                  selectedSemester === semester &&
                    styles.semesterDropdownItemActive,
                ]}
                onPress={() => selectSemester(semester)}
              >
                <Text
                  style={[
                    styles.semesterDropdownItemText,
                    selectedSemester === semester &&
                      styles.semesterDropdownItemTextActive,
                  ]}
                >
                  {formatSemesterLabel(semester)}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </View>

      {/* Exams list */}
      <ScrollView
        style={styles.examsList}
        contentContainerStyle={styles.examsListContent}
      >
        {Object.entries(examsByType).map(([type, examList]) => (
          <View key={type} style={styles.examTypeSection}>
            {examList.map((exam, index) => {
              const normalizedType = normalizeExamType(exam.type);
              const officialMatch = officialMatchesByExam.get(exam) || null;
              const officialSummary =
                officialMatch ?
                  formatOfficialEventSummary(officialMatch, t("schedule").room)
                : "";

              return (
                <Animated.View
                  key={`${type}-${index}`}
                  entering={FadeInUp.delay(index * 80).springify()}
                  style={[
                    styles.examCard,
                    normalizedType === "thesis" && styles.examCardThesis,
                    normalizedType === "exam" && styles.examCardExamVariant,
                  ]}
                >
                  <View style={styles.examHeaderRow}>
                    <Text style={styles.examSubject} numberOfLines={2}>
                      {exam.name}
                    </Text>
                    <View
                      style={[
                        styles.examTypePill,
                        normalizedType === "thesis" &&
                          styles.examTypePillThesis,
                        normalizedType === "exam" &&
                          styles.examTypePillExamVariant,
                        normalizedType === "other" && styles.examTypePillOther,
                      ]}
                    >
                      <Text style={styles.examTypePillText}>{exam.type}</Text>
                    </View>
                  </View>
                  <View style={styles.examDetails}>
                    <Text style={styles.examSemester}>
                      {formatSemesterLabel(exam.semester)}
                    </Text>
                    {!exam.isUpcoming ?
                      <Text
                        style={[
                          styles.examGrade,
                          normalizedType === "thesis" && styles.examGradeThesis,
                          normalizedType === "exam" && styles.examGradeExam,
                        ]}
                      >
                        {exam.grade}
                      </Text>
                    : <Text style={styles.upcomingExamGrade}>TBD</Text>}
                  </View>
                  {exam.isUpcoming && (
                    <View
                      style={[
                        styles.upcomingIndicatorContainer,
                        officialSummary &&
                          styles.upcomingIndicatorContainerInfo,
                      ]}
                    >
                      <MaterialIcons
                        name={officialSummary ? "event-note" : "schedule"}
                        size={16}
                        color={
                          officialSummary ?
                            Colors.dark.accentBlueLight
                          : Colors.dark.lightOrange
                        }
                      />
                      <Text
                        style={[
                          styles.upcomingIndicatorText,
                          officialSummary ?
                            styles.upcomingIndicatorInfoText
                          : styles.upcomingIndicatorDefaultText,
                        ]}
                      >
                        {officialSummary || t("grades").subjects.upcoming}
                      </Text>
                    </View>
                  )}
                  {officialSummary && !exam.isUpcoming && (
                    <Text style={styles.examOfficialMeta}>
                      {officialSummary}
                    </Text>
                  )}
                </Animated.View>
              );
            })}
          </View>
        ))}

        {Object.keys(examsByType).length === 0 && (
          <Text style={styles.emptyText}>
            {selectedSemester !== null ?
              t("grades").semesters.noDataSemester.replace(
                "{{semester}}",
                selectedSemester.toString(),
              )
            : t("grades").semesters.noData}
          </Text>
        )}

        {/* Official schedule section
              {officialEvents.length > 0 && (
                <View style={styles.officialSectionContainer}>
                  <View style={styles.officialSectionHeader}>
                    <Text style={styles.sectionTitle}>{t('grades').subjects.officialSchedule}</Text>
                  </View>
                  {(() => {
                    const sortedByDate: Record<string, OfficialAssessmentEvent[]> = {};
                    officialEvents.forEach(event => {
                      if (!sortedByDate[event.date]) sortedByDate[event.date] = [];
                      sortedByDate[event.date].push(event);
                    });

                    return Object.entries(sortedByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, events], dateIdx) => {
                      const eventDate = parseEventDate(date);
                      const dateLabel = Number.isFinite(eventDate.getTime())
                        ? formatFullDate(eventDate, false)
                        : date;

                      return (
                        <View key={`official-${date}`} style={styles.officialDateGroup}>
                          <Text style={styles.officialDateTitle}>{dateLabel}</Text>
                          {events.map((event, eventIdx) => {
                            const timeLabel = event.type === 'exam'
                              ? formatExamTimeLabel(event)
                              : formatThesisTimeLabel(event);
                            const room = event.room ? `${t('schedule').room} ${event.room}` : '';
                            const subgroup = event.subgroup ? `${event.subgroup}` : '';
                            const meta = [timeLabel, room, subgroup, event.teacher].filter(Boolean).join(' \u2022 ');

                            return (
                              <Animated.View
                                key={`official-${date}-${eventIdx}`}
                                entering={FadeInUp.delay((dateIdx * 3 + eventIdx) * 60).springify()}
                                style={[
                                  styles.officialEventCard,
                                  event.type === 'exam' ? styles.officialEventCardExam : styles.officialEventCardThesis,
                                ]}
                              >
                                <View style={styles.officialEventHeader}>
                                  <View style={[
                                    styles.officialEventTypePill,
                                    event.type === 'exam' ? styles.officialEventTypePillExam : styles.officialEventTypePillThesis,
                                  ]}>
                                    <Text style={styles.officialEventTypeText}>
                                      {event.type === 'exam' ? t('grades').subjects.exam : t('grades').subjects.thesis}
                                    </Text>
                                  </View>
                                  {event.subgroup ? (
                                    <Text style={styles.officialEventSubgroup}>{event.subgroup}</Text>
                                  ) : null}
                                </View>
                                <Text style={styles.officialEventSubject}>{event.subject}</Text>
                                {meta ? <Text style={styles.officialEventMeta} numberOfLines={2}>{meta}</Text> : null}
                              </Animated.View>
                            );
                          })}
                        </View>
                      );
                    });
                  })()}
                </View>
              )} */}

        {/* {officialEvents.length === 0 && Object.keys(examsByType).length > 0 && officialSchedule.thesis !== null && officialSchedule.exam !== null && (
                <View style={styles.officialSectionContainer}>
                  <Text style={styles.sectionTitle}>{t('grades').subjects.officialSchedule}</Text>
                  <Text style={styles.noOfficialDataText}>{t('grades').subjects.noOfficialExams}</Text>
                </View>
              )} */}
      </ScrollView>
    </View>
  );
};

// Tab switcher component
const ViewModeSwitcher = ({
  activeMode,
  onModeChange,
}: {
  activeMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.viewModeSwitcher}>
      <TouchableOpacity
        style={[
          styles.modeTab,
          activeMode === "grades" && styles.activeModeTab,
        ]}
        onPress={() => onModeChange("grades")}
      >
        <Text
          style={[
            styles.modeTabText,
            activeMode === "grades" && styles.activeModeTabText,
          ]}
        >
          {t("grades").title}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeTab, activeMode === "exams" && styles.activeModeTab]}
        onPress={() => onModeChange("exams")}
      >
        <Text
          style={[
            styles.modeTabText,
            activeMode === "exams" && styles.activeModeTabText,
          ]}
        >
          {t("grades").categories.exam}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Finds a realistic combination of additional grades that will make the average close to the target.
 * Prioritizes grades that are achievable rather than just suggesting 10s.
 * @param currentGrades Array of current grades (1-10)
 * @param targetAverage The desired average to achieve
 * @returns Array of grades to add to reach target average
 */
const findGradesToReachAverage = (
  currentGrades: number[],
  targetAverage: number,
): number[] => {
  // Handle edge cases
  if (!currentGrades.length) {
    return [Math.round(targetAverage)]; // If no current grades, just return the target as a single grade
  }

  // Calculate current sum and count
  const currentSum = currentGrades.reduce((sum, grade) => sum + grade, 0);
  const currentCount = currentGrades.length;
  const currentAverage = currentSum / currentCount;

  // If we've already reached the target average, return empty array
  if (Math.abs(currentAverage - targetAverage) < 0.01) {
    return [];
  }

  // Initialize variables for finding the best solution
  let bestSolution: number[] = [];
  let lowestVariance = Number.MAX_VALUE;
  let closestDifference = Math.abs(targetAverage - currentAverage);

  // Calculate the "reasonableness" score of a solution (lower is better)
  const calculateReasonablenessScore = (grades: number[], avgDiff: number) => {
    // Calculate variance as a measure of how spread out the grades are
    const avg = grades.reduce((sum, g) => sum + g, 0) / grades.length;
    const variance =
      grades.reduce((sum, g) => sum + Math.pow(g - avg, 2), 0) / grades.length;

    // Count extreme grades (1-3 and 9-10)
    const extremeGrades = grades.filter((g) => g <= 3 || g >= 9).length;

    // Penalize solutions with high variance or too many extreme grades
    return variance + extremeGrades * 2 + Math.abs(avgDiff) * 5;
  };

  // Recursive backtracking function
  const backtrack = (newGrades: number[], depth: number, maxDepth: number) => {
    // Calculate new average with these added grades
    const newSum =
      currentSum + newGrades.reduce((sum, grade) => sum + grade, 0);
    const newCount = currentCount + newGrades.length;
    const newAverage = newSum / newCount;
    const newDifference = Math.abs(targetAverage - newAverage);

    // Check if this is a valid solution (close enough to target)
    if (newDifference < 0.01) {
      // Calculate reasonableness score for this solution
      const score = calculateReasonablenessScore(newGrades, newDifference);

      // Update best solution if this one is more reasonable or closer to target
      if (
        score < lowestVariance ||
        (Math.abs(score - lowestVariance) < 0.01 &&
          newDifference < closestDifference)
      ) {
        lowestVariance = score;
        closestDifference = newDifference;
        bestSolution = [...newGrades];
      }
    }

    // Base case: if we've reached maximum depth
    if (depth >= maxDepth) {
      return;
    }

    // Get range of grades to try based on target average
    let gradeRange: number[];

    if (targetAverage > currentAverage) {
      // If we need to increase average, start with grades around target and go up
      const start = Math.max(1, Math.floor(targetAverage) - 1);
      const end = Math.min(10, Math.ceil(targetAverage) + 3);
      gradeRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      // If we need to decrease average, start with grades around target and go down
      const start = Math.max(1, Math.floor(targetAverage) - 3);
      const end = Math.min(10, Math.ceil(targetAverage) + 1);
      gradeRange = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    // Prioritize grades closer to the target average
    gradeRange.sort(
      (a, b) => Math.abs(a - targetAverage) - Math.abs(b - targetAverage),
    );

    // Try adding each possible grade
    for (const grade of gradeRange) {
      // Check if this grade would move us in the right direction
      const newAvgWithGrade = (newSum + grade) / (newCount + 1);
      const newDiffWithGrade = Math.abs(targetAverage - newAvgWithGrade);
      const currentDiff = Math.abs(targetAverage - newAverage);

      // Only add if it moves us closer to target or if we're within reasonable range
      if (newDiffWithGrade <= currentDiff || newDiffWithGrade < 0.5) {
        newGrades.push(grade);
        backtrack(newGrades, depth + 1, maxDepth);
        newGrades.pop(); // Backtrack
      }
    }
  };

  // Try with an increasing number of grades (1-5)
  for (let maxDepth = 1; maxDepth <= 5; maxDepth++) {
    backtrack([], 0, maxDepth);

    // If we found a reasonable solution, return it
    if (bestSolution.length > 0 && bestSolution.length <= maxDepth) {
      return bestSolution;
    }
  }

  return bestSolution;
};

// Grade Calculator Modal component
const GradeCalculatorModal = ({
  isVisible,
  onClose,
  subjects,
  allSemesters, // Add this new parameter to access all semester data
}: {
  isVisible: boolean;
  onClose: () => void;
  subjects: GradeSubject[];
  allSemesters: SemesterGrades[];
}) => {
  const { t } = useTranslation();
  const [selectedSubject, setSelectedSubject] = useState<GradeSubject | null>(
    subjects.length > 0 ? subjects[0] : null,
  );
  const [targetAverage, setTargetAverage] = useState("");
  const [calculatedGrades, setCalculatedGrades] = useState<number[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [isAnnualCalculation, setIsAnnualCalculation] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Convert string grades to numbers
  const getNumericGrades = (subject: GradeSubject): number[] => {
    return subject.grades
      .map((g) => parseFloat(g.replace(",", ".")))
      .filter((g) => !isNaN(g));
  };

  // Get all grades for the selected subject from all semesters
  const getAllGradesForSubject = (subjectName: string): number[] => {
    const allGrades: number[] = [];

    // Iterate through all semesters to find the subject
    allSemesters.forEach((semester) => {
      const subjectInSemester = semester.subjects.find(
        (s) => s.name === subjectName,
      );
      if (subjectInSemester) {
        const numericGrades = getNumericGrades(subjectInSemester);
        allGrades.push(...numericGrades);
      }
    });

    return allGrades;
  };

  // Calculate the current average of the selected subject
  const getCurrentAverage = (): string => {
    if (!selectedSubject) return "-";

    // Decide which grades to use based on calculation mode
    const numericGrades =
      isAnnualCalculation ?
        getAllGradesForSubject(selectedSubject.name)
      : getNumericGrades(selectedSubject);

    if (numericGrades.length === 0) return "-";

    const sum = numericGrades.reduce((a, b) => a + b, 0);
    return (sum / numericGrades.length).toFixed(2);
  };

  // Handle calculation
  const handleCalculate = () => {
    if (!selectedSubject || !targetAverage) return;

    // Decide which grades to use based on calculation mode
    const numericGrades =
      isAnnualCalculation ?
        getAllGradesForSubject(selectedSubject.name)
      : getNumericGrades(selectedSubject);

    const target = parseFloat(targetAverage);

    if (isNaN(target) || target < 1 || target > 10) {
      // Invalid target average
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    const result = findGradesToReachAverage(numericGrades, target);
    setCalculatedGrades(result);
    setHasCalculated(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Scroll to the bottom to show results after a short delay
    // to ensure the results are rendered
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  // Check if the selected subject exists in multiple semesters
  const isSubjectInMultipleSemesters = useCallback(
    (subjectName: string): boolean => {
      // Count how many semesters contain this subject
      let count = 0;
      allSemesters.forEach((semester) => {
        if (semester.subjects.some((s) => s.name === subjectName)) {
          count++;
        }
      });
      return count > 1;
    },
    [allSemesters],
  );

  // Get all current grades for the selected subject (for display)
  const getAllCurrentGrades = (): string[] => {
    if (!selectedSubject) return [];

    if (!isAnnualCalculation) {
      return selectedSubject.grades;
    }

    // Collect grades from all semesters for this subject
    const allGrades: string[] = [];
    allSemesters.forEach((semester) => {
      const subjectInSemester = semester.subjects.find(
        (s) => s.name === selectedSubject.name,
      );
      if (subjectInSemester) {
        allGrades.push(...subjectInSemester.grades);
      }
    });

    return allGrades;
  };

  // Determine if annual calculation option should be shown
  const showAnnualOption = useMemo(() => {
    return selectedSubject ?
        isSubjectInMultipleSemesters(selectedSubject.name)
      : false;
  }, [selectedSubject, isSubjectInMultipleSemesters]);

  return (
    <BottomModalPortal
      isVisible={isVisible}
      onClose={onClose}
      contentContainerStyle={styles.calculatorSheetContent}
    >
      <BottomSheetScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode='on-drag'
      >
        {/* Subject Selection */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>
            {t("grades").calculator.selectSubject}
          </Text>
          <View style={styles.pickerContainer}>
            <NativeViewGestureHandler disallowInterruption={true}>
              <GestureHandlerScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {subjects.map((subject, index) => (
                  <React.Fragment key={`subject-option-${index}`}>
                    {index > 0 && <View style={styles.subjectSeparator} />}
                    <TouchableOpacity
                      style={[
                        styles.subjectOption,
                        selectedSubject?.name === subject.name &&
                          styles.subjectOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedSubject(subject);
                        setHasCalculated(false);
                        setIsAnnualCalculation(false);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text
                        style={[
                          styles.subjectOptionText,
                          selectedSubject?.name === subject.name &&
                            styles.subjectOptionTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {subject.name}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </GestureHandlerScrollView>
            </NativeViewGestureHandler>
          </View>
        </View>

        {/* Annual vs Current Semester Toggle - only show if subject exists in multiple semesters */}
        {selectedSubject && showAnnualOption && (
          <View style={styles.formGroup}>
            <View style={styles.calculationTypeContainer}>
              <Text style={styles.label}>
                {t("grades").calculator.calculationType || "Calculation Type:"}
              </Text>
              <View style={styles.calculationToggle}>
                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    !isAnnualCalculation && styles.toggleOptionActive,
                  ]}
                  onPress={() => {
                    setIsAnnualCalculation(false);
                    setHasCalculated(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.toggleOptionText,
                      !isAnnualCalculation && styles.toggleOptionTextActive,
                    ]}
                  >
                    {t("grades").calculator.semesterOnly || "Current Semester"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.toggleSeparator} />

                <TouchableOpacity
                  style={[
                    styles.toggleOption,
                    isAnnualCalculation && styles.toggleOptionActive,
                  ]}
                  onPress={() => {
                    setIsAnnualCalculation(true);
                    setHasCalculated(false);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text
                    style={[
                      styles.toggleOptionText,
                      isAnnualCalculation && styles.toggleOptionTextActive,
                    ]}
                  >
                    {t("grades").calculator.annualAverage || "Annual Average"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Current Grades Display */}
        {selectedSubject && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {isAnnualCalculation ?
                t("grades").calculator.allGrades || "All Grades"
              : t("grades").calculator.currentGrades}
            </Text>
            <View style={styles.currentGradesContainer}>
              {getAllCurrentGrades().length > 0 ?
                <View style={styles.gradesGrid}>
                  {getAllCurrentGrades().map((grade, index) => (
                    <View
                      key={`current-grade-${index}`}
                      style={{
                        backgroundColor: getGradeColor(grade),
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        minWidth: 40,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Text style={styles.gradeText}>{grade}</Text>
                    </View>
                  ))}
                </View>
              : <Text
                  style={{
                    color: GRADES_MODAL_COLORS.textSecondary,
                    fontSize: 14,
                    textAlign: "center",
                    padding: 10,
                  }}
                >
                  {t("grades").calculator.noGrades}
                </Text>
              }

              <View style={styles.currentAverageContainer}>
                <Text style={styles.currentAverageLabel}>
                  {t("grades").calculator.currentAverage}:
                </Text>
                <Text style={styles.currentAverageValue}>
                  {getCurrentAverage()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Target Average Input */}
        <View style={[styles.formGroup, { marginBottom: 20 }]}>
          <Text style={styles.label}>
            {t("grades").calculator.targetAverage}
          </Text>
          <TextInput
            style={styles.input}
            value={targetAverage}
            onChangeText={setTargetAverage}
            placeholder='8.50'
            placeholderTextColor={GRADES_MODAL_COLORS.textSecondary}
            keyboardType='numeric'
            maxLength={4}
          />
        </View>

        {/* Calculate Button */}
        <TouchableOpacity
          style={[
            styles.calculateButton,
            (!selectedSubject || !targetAverage) &&
              styles.calculateButtonDisabled,
          ]}
          onPress={handleCalculate}
          disabled={!selectedSubject || !targetAverage}
        >
          <Text style={styles.calculateButtonText}>
            {t("grades").calculator.calculate}
          </Text>
        </TouchableOpacity>

        {/* Results */}
        {hasCalculated && (
          <Animated.View
            entering={FadeInUp.springify()}
            style={styles.resultsContainer}
          >
            <Text style={styles.resultsTitle}>
              {calculatedGrades.length > 0 ?
                t("grades").calculator.resultsTitle
              : t("grades").calculator.noSolution}
            </Text>

            {calculatedGrades.length > 0 ?
              <View style={styles.gradesGrid}>
                {calculatedGrades.map((grade, index) => (
                  <View
                    key={`result-grade-${index}`}
                    style={{
                      backgroundColor: GRADES_MODAL_COLORS.successChip,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      minWidth: 40,
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={styles.gradeText}>{grade}</Text>
                  </View>
                ))}
              </View>
            : <Text style={styles.noSolutionText}>
                {t("grades").calculator.alreadyAchieved}
              </Text>
            }
          </Animated.View>
        )}
      </BottomSheetScrollView>
    </BottomModalPortal>
  );
};

// Main Grades component
const GradesScreen = ({
  idnp,
  studentGrades,
  lastUpdated,
  onRefresh,
  newHighlights,
  onAcknowledgeHighlight,
}: {
  idnp: string;
  studentGrades: StudentGrades | null;
  lastUpdated: number | null;
  onRefresh: () => Promise<void>;
  newHighlights: NewGradeHighlightsMap;
  onAcknowledgeHighlight: (semesterNumber: number, subjectName: string) => void;
}) => {
  const { t, formatFullDate } = useTranslation();
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(() =>
    gradesDataService.isRefreshing(idnp),
  );
  const [backgroundJustUpdated, setBackgroundJustUpdated] = useState(false);

  // Animated dot opacities
  const dot1 = useSharedValue(0.25);
  const dot2 = useSharedValue(0.25);
  const dot3 = useSharedValue(0.25);

  useEffect(() => {
    if (isBackgroundRefreshing) {
      dot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.25, { duration: 600 }),
        ),
        -1,
        false,
      );
      setTimeout(() => {
        dot2.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600 }),
            withTiming(0.25, { duration: 600 }),
          ),
          -1,
          false,
        );
      }, 200);
      setTimeout(() => {
        dot3.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 600 }),
            withTiming(0.25, { duration: 600 }),
          ),
          -1,
          false,
        );
      }, 400);
    } else {
      dot1.value = 0.25;
      dot2.value = 0.25;
      dot3.value = 0.25;
    }
  }, [isBackgroundRefreshing, dot1, dot2, dot3]);

  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  // If a silent refresh already started before this screen mounted, show dots immediately
  useEffect(() => {
    if (gradesDataService.isRefreshing(idnp)) {
      const idleTask = runWhenIdle(() => {
        setIsBackgroundRefreshing(true);
      });
      return () => idleTask.cancel();
    }
  }, [idnp]);

  // Format semester labels with support for relative 1/2 semester numbering.
  const formatSemesterLabel = (semesterNumber: number) =>
    formatSemesterYearLabel(
      t("grades").semesters.yearSemester,
      semesterNumber,
      {
        studentYearNumber: studentGrades?.studentInfo.yearNumber,
        currentSemester: studentGrades?.currentSemester,
        semesters: studentGrades?.currentGrades,
      },
    );

  // Get current semester number based on date
  const currentSemesterNumber = useMemo(() => getCurrentSemester(), []);

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grades");
  const [selectedSubgroup, setSelectedSubgroup] = useState<
    "Subgroup 1" | "Subgroup 2"
  >(scheduleService.getSettings().group);
  const [officialSchedule, setOfficialSchedule] =
    useState<OfficialScheduleState>({
      thesis: null,
      exam: null,
      loading: false,
    });

  // Grade calculator modal state
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  const [calculatorSession, setCalculatorSession] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Track expanded semester dropdowns and subjects
  const [expandedSemesters, setExpandedSemesters] = useState<
    Record<number, boolean>
  >({});
  const [expandedSubjects, setExpandedSubjects] = useState<
    Record<string, boolean>
  >({});
  const [staleCheckTimestamp, setStaleCheckTimestamp] = useState(() =>
    Date.now(),
  );

  // Calculate if data is stale (older than STALE_DATA_DAYS)
  const isDataStale = useMemo(() => {
    if (!lastUpdated) return false;

    const daysDifference =
      (staleCheckTimestamp - lastUpdated) / (1000 * 60 * 60 * 24);

    return daysDifference >= STALE_DATA_DAYS;
  }, [lastUpdated, staleCheckTimestamp]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStaleCheckTimestamp(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Listen to background refresh start/end events for anonymous indicator
  useEffect(() => {
    const startListener = DeviceEventEmitter.addListener(
      GRADES_REFRESH_START_EVENT,
      () => {
        setIsBackgroundRefreshing(true);
        setBackgroundJustUpdated(false);
      },
    );
    const endListener = DeviceEventEmitter.addListener(
      GRADES_REFRESH_END_EVENT,
      (payload: any) => {
        setIsBackgroundRefreshing(false);
        if (payload?.updated) {
          setBackgroundJustUpdated(true);
          // Fade out the updated state after a short period
          setTimeout(() => setBackgroundJustUpdated(false), 2500);
        }
      },
    );
    const sub = gradesDataService.subscribe(() => {
      // Data updated event also clears spinner if missed
      setIsBackgroundRefreshing(false);
    });
    return () => {
      startListener.remove();
      endListener.remove();
      sub();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSelectedSubgroup(scheduleService.getSettings().group);
    });
    return () => unsubscribe();
  }, []);

  const loadCachedOfficialSchedule = useCallback(async () => {
    const fallbackGroup = scheduleService.getSettings().selectedGroupName;
    const groupName = String(
      studentGrades?.studentInfo.group || fallbackGroup || "",
    ).trim();

    if (!groupName) {
      setOfficialSchedule((prev) => ({
        ...prev,
        thesis: null,
        exam: null,
        loading: false,
      }));
      return;
    }

    setOfficialSchedule((prev) => ({ ...prev, loading: true }));
    try {
      const [thesis, exam] = await Promise.all([
        scheduleService.getCachedSpecialSchedule("thesis", groupName),
        scheduleService.getCachedSpecialSchedule("exam", groupName),
      ]);

      setOfficialSchedule({
        thesis,
        exam,
        loading: false,
      });
    } catch {
      setOfficialSchedule((prev) => ({
        ...prev,
        thesis:
          prev.thesis ||
          scheduleService.buildUnavailableSpecialSchedule(
            "thesis",
            groupName,
            "cache_read_failed",
            "Unable to load cached thesis schedule",
          ),
        exam:
          prev.exam ||
          scheduleService.buildUnavailableSpecialSchedule(
            "exam",
            groupName,
            "cache_read_failed",
            "Unable to load cached exam schedule",
          ),
        loading: false,
      }));
    }
  }, [studentGrades?.studentInfo.group]);

  useEffect(() => {
    let isCancelled = false;

    const idleTask = runWhenIdle(() => {
      void loadCachedOfficialSchedule();

      // Also trigger a background network refresh when viewing exams
      if (viewMode === "exams") {
        const groupName = String(
          studentGrades?.studentInfo.group ||
            scheduleService.getSettings().selectedGroupName ||
            "",
        ).trim();
        if (groupName) {
          void scheduleService
            .getExamAndThesisSchedule(groupName)
            .then(({ thesis, exam }) => {
              if (isCancelled) return;
              setOfficialSchedule({
                thesis,
                exam,
                loading: false,
              });
            })
            .catch(() => {});
        }
      }
    });

    return () => {
      isCancelled = true;
      idleTask.cancel();
    };
  }, [viewMode, loadCachedOfficialSchedule, studentGrades?.studentInfo.group]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setIsBackgroundRefreshing(true);
    try {
      await Promise.all([onRefresh(), loadCachedOfficialSchedule()]);
    } finally {
      setRefreshing(false);
      // Actual end of background refresh will be when new cache event fires; set a safety timeout
      setTimeout(() => {
        if (isBackgroundRefreshing) {
          setIsBackgroundRefreshing(false);
        }
      }, 8000);
    }
  }, [
    onRefresh,
    refreshing,
    isBackgroundRefreshing,
    loadCachedOfficialSchedule,
  ]);

  // Get current semester data
  const currentSemesterData = useMemo(() => {
    if (!studentGrades || studentGrades.currentGrades.length === 0) {
      return null;
    }

    // First try to find the current semester based on date
    const currentIndex = studentGrades.currentGrades.findIndex(
      (s) => s.semester === currentSemesterNumber,
    );

    if (currentIndex >= 0) {
      return studentGrades.currentGrades[currentIndex];
    }

    return studentGrades.currentGrades[0];
  }, [studentGrades, currentSemesterNumber]);

  // Calculate average for all semesters
  const allSemestersAverages = useMemo(() => {
    if (!studentGrades || studentGrades.currentGrades.length === 0) return [];

    return studentGrades.currentGrades
      .map((semester) => {
        const validAverages = semester.subjects
          .map((subject) => subject.average)
          .filter((avg) => avg !== undefined) as number[];

        if (validAverages.length === 0) return null;

        const sum = validAverages.reduce((acc, val) => acc + val, 0);
        return {
          semester: semester.semester,
          average: (sum / validAverages.length).toFixed(2),
        };
      })
      .filter((item) => item !== null);
  }, [studentGrades]);

  // Style modifier for text components when refreshing
  const textOpacity = { opacity: refreshing ? 0.5 : 1 };

  // Format last updated date
  const lastUpdatedFormatted = useMemo(() => {
    if (!lastUpdated) return t("grades").neverUpdated;

    const date = new Date(lastUpdated);
    return formatFullDate(date, true);
  }, [lastUpdated, formatFullDate, t]);

  const exportableSubjects = useMemo(() => {
    if (!studentGrades) return [];
    return studentGrades.currentGrades.flatMap(
      (semester: SemesterGrades) => semester.subjects,
    );
  }, [studentGrades]);

  const hasExportableGrades = exportableSubjects.length > 0;

  const handleExportGradesPdf = useCallback(async () => {
    const gradesData = studentGrades;

    if (!gradesData || !hasExportableGrades) {
      Alert.alert(t("grades").pdf.errorTitle, t("grades").noGrades);
      return;
    }

    setIsExportingPdf(true);

    try {
      const { studentInfo, currentGrades } = gradesData;
      const allSubjects = currentGrades.flatMap(
        (semester: SemesterGrades) => semester.subjects,
      );
      const subjectAverages = allSubjects
        .map((subject: GradeSubject) => subject.finalAverage ?? subject.average)
        .filter(
          (value: number | undefined): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );
      const overallAverage =
        subjectAverages.length > 0 ?
          (
            subjectAverages.reduce(
              (sum: number, value: number) => sum + value,
              0,
            ) / subjectAverages.length
          ).toFixed(2)
        : "-";
      const impactedSubjects = allSubjects.filter(
        (subject: GradeSubject) =>
          subject.appliedExamGrade !== undefined || !!subject.appliedExamType,
      ).length;
      const totalGrades = allSubjects.reduce(
        (sum: number, subject: GradeSubject) => sum + subject.grades.length,
        0,
      );
      const now = new Date();
      const generatedOn = formatFullDate(now, true);
      const buildSemesterLabel = (semesterNumber: number) =>
        formatSemesterYearLabel(
          t("grades").semesters.yearSemester,
          semesterNumber,
          {
            studentYearNumber: studentInfo.yearNumber,
            currentSemester: gradesData.currentSemester,
            semesters: currentGrades,
          },
        );
      const currentSemesterLabel =
        gradesData.currentSemester ?
          buildSemesterLabel(gradesData.currentSemester)
        : studentInfo.yearNumber ?
          formatSemesterYearLabel(
            t("grades").semesters.yearSemester,
            (studentInfo.yearNumber - 1) * 2 + getCurrentSemester(),
            {
              studentYearNumber: studentInfo.yearNumber,
            },
          )
        : null;

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${escapeHtml(t("grades").pdf.exportTitle)}</title>
            <style>
              @page {
                size: A4;
                margin: 14mm 12mm;
              }

              :root {
                color-scheme: light;
                --surface: #ffffff;
                --surface-soft: #f3f4f7;
                --border: #d8dde8;
                --text: #11181c;
                --muted: #666666;
                --accent: #2c3dcd;
                --accent-soft: rgba(77, 150, 255, 0.14);
                --success-soft: rgba(44, 205, 93, 0.15);
              }

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                color: var(--text);
                background: #fff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.32;
                font-size: 12px;
              }

              .page {
                padding: 0;
              }

              .header {
                border: 1px solid var(--border);
                border-left: 4px solid var(--accent);
                border-radius: 10px;
                padding: 10px 12px;
                margin-bottom: 0;
              }

              .eyebrow {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--muted);
                margin-bottom: 2px;
              }

              .title {
                margin: 0;
                font-size: 18px;
                line-height: 1.2;
              }

              .subhead {
                margin: 4px 0 0;
                font-size: 12px;
                color: var(--muted);
              }

              .meta-row {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
              }

              .meta-chip {
                border: 1px solid var(--border);
                border-radius: 999px;
                padding: 4px 8px;
                font-size: 10px;
                color: var(--muted);
                background: #fff;
              }

              .summary-note {
                margin-top: 3px;
                color: var(--muted);
                font-size: 10px;
              }

              .semester-card {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 8px 10px;
                margin-top: 8px;
                break-inside: auto;
                page-break-inside: auto;
              }

              .semester-head {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 8px;
                margin-bottom: 6px;
              }

              .semester-name {
                margin: 0;
                font-size: 13px;
                font-weight: 800;
              }

              .semester-average {
                font-size: 11px;
                font-weight: 700;
                color: var(--accent);
                text-align: right;
              }

              .subject-card {
                border: 1px solid var(--border);
                border-radius: 8px;
                padding: 7px 8px;
                margin-top: 6px;
                background: var(--surface);
              }

              .subject-head {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                align-items: flex-start;
              }

              .subject-name {
                margin: 0;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.25;
              }

              .subject-average {
                flex-shrink: 0;
                border-radius: 999px;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 800;
                color: var(--accent);
                background: var(--accent-soft);
              }

              .subject-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 6px;
              }

              .chip {
                border-radius: 999px;
                padding: 2px 8px;
                font-size: 10px;
                font-weight: 700;
                line-height: 1.2;
                border: 1px solid transparent;
              }

              .chip-neutral {
                background: var(--surface-soft);
                color: var(--text);
              }

              .chip-accent {
                background: var(--accent-soft);
                color: var(--accent);
              }

              .chip-success {
                background: var(--success-soft);
                color: #0f8c3d;
              }

              .grade-row {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 6px;
              }

              .grade-pill {
                min-width: 24px;
                text-align: center;
                border-radius: 6px;
                padding: 3px 7px;
                font-size: 10px;
                font-weight: 800;
                border: 1px solid rgba(0, 0, 0, 0.05);
              }

              .impact-card {
                margin-top: 6px;
                border-radius: 8px;
                padding: 6px 8px;
                border: 1px solid var(--border);
                border-left: 3px solid var(--accent);
                background: #f9fbff;
              }

              .impact-label {
                font-size: 9px;
                font-weight: 800;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--accent);
              }

              .impact-text {
                margin-top: 2px;
                font-size: 11px;
                color: var(--text);
              }

              .impact-subtext {
                margin-top: 2px;
                font-size: 10px;
                color: var(--muted);
              }

              .footer {
                margin-top: 10px;
                color: var(--muted);
                font-size: 9px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="page">
              <section class="header">
                <div class="eyebrow">${escapeHtml(t("grades").pdf.exportTitle)}</div>
                <h1 class="title">${escapeHtml(`${studentInfo.firstName} ${studentInfo.name}`.trim())}</h1>
                <p class="subhead">${escapeHtml(studentInfo.group)}${studentInfo.specialization ? ` • ${escapeHtml(studentInfo.specialization)}` : ""}</p>
                <div class="meta-row">
                  ${currentSemesterLabel ? `<div class="meta-chip">${escapeHtml(currentSemesterLabel)}</div>` : ""}
                  <div class="meta-chip">${escapeHtml(t("grades").pdf.generatedOn)} ${escapeHtml(generatedOn)}</div>
                  <div class="meta-chip">${escapeHtml(t("grades").pdf.totalSemesters)}: ${currentGrades.length}</div>
                  <div class="meta-chip">${escapeHtml(t("grades").pdf.totalSubjects)}: ${allSubjects.length}</div>
                  <div class="meta-chip">${escapeHtml(t("grades").average)}: ${escapeHtml(overallAverage)}</div>
                  <div class="meta-chip">${escapeHtml(t("grades").pdf.totalGrades)}: ${totalGrades}</div>
                  <div class="meta-chip">${escapeHtml(t("grades").pdf.impactedSubjects)}: ${impactedSubjects}</div>
                </div>
              </section>

              ${currentGrades
                .map((semester: SemesterGrades) => {
                  const semesterAverage = semester.subjects
                    .map(
                      (subject: GradeSubject) =>
                        subject.finalAverage ?? subject.average,
                    )
                    .filter(
                      (value: number | undefined): value is number =>
                        typeof value === "number" && Number.isFinite(value),
                    );
                  const semesterAverageValue =
                    semesterAverage.length > 0 ?
                      (
                        semesterAverage.reduce(
                          (sum: number, value: number) => sum + value,
                          0,
                        ) / semesterAverage.length
                      ).toFixed(2)
                    : "-";

                  return `
                  <section class="semester-card">
                    <div class="semester-head">
                      <div>
                        <h3 class="semester-name">${escapeHtml(buildSemesterLabel(semester.semester))}</h3>
                        <div class="summary-note">${escapeHtml(studentInfo.group)}${studentInfo.specialization ? ` • ${escapeHtml(studentInfo.specialization)}` : ""}</div>
                      </div>
                      <div class="semester-average">
                        ${escapeHtml(t("grades").average)}<br />${escapeHtml(semesterAverageValue)}
                      </div>
                    </div>

                    ${semester.subjects
                      .map((subject: GradeSubject) => {
                        const displayedAverage =
                          subject.finalDisplayedAverage ||
                          subject.displayedAverage ||
                          "-";
                        const baseAverage =
                          subject.baseDisplayedAverage ||
                          subject.displayedAverage ||
                          "-";
                        const isExamImpact = !!subject.appliedExamType;
                        const appliedExamGrade =
                          (
                            typeof subject.appliedExamGrade === "number" &&
                            Number.isFinite(subject.appliedExamGrade)
                          ) ?
                            subject.appliedExamGrade.toFixed(2)
                          : "";
                        const impactLabel =
                          subject.appliedExamType ?
                            (() => {
                              const typeKey =
                                subject.appliedExamType?.toLowerCase() || "";
                              if (
                                typeKey.includes("teza") ||
                                typeKey.includes("thesis")
                              )
                                return escapeHtml(t("grades").subjects.thesis);
                              if (
                                typeKey.includes("examen") ||
                                typeKey.includes("exam")
                              )
                                return escapeHtml(t("grades").subjects.exam);
                              return escapeHtml(subject.appliedExamType);
                            })()
                          : "";

                        return `
                        <article class="subject-card">
                          <div class="subject-head">
                            <h4 class="subject-name">${escapeHtml(subject.name)}</h4>
                            <div class="subject-average">${escapeHtml(displayedAverage)}</div>
                          </div>

                          <div class="subject-meta">
                            <span class="chip chip-neutral">${escapeHtml(t("grades").form.subject)}</span>
                            <span class="chip chip-accent">${escapeHtml(t("grades").average)}: ${escapeHtml(baseAverage)}</span>
                            ${subject.finalDisplayedAverage && subject.finalDisplayedAverage !== baseAverage ? `<span class="chip chip-success">${escapeHtml(t("grades").subjects.finalAverage)}: ${escapeHtml(subject.finalDisplayedAverage)}</span>` : ""}
                            <span class="chip chip-neutral">${escapeHtml(t("grades").pdf.totalGrades)}: ${subject.grades.length}</span>
                          </div>

                          <div class="grade-row">
                            ${
                              subject.grades.length > 0 ?
                                subject.grades
                                  .map((grade: string) => {
                                    const gradeColor = getGradeColor(grade);
                                    const gradeTextColor =
                                      getPdfGradeTextColor(grade);
                                    return `<span class="grade-pill" style="background:${escapeHtml(gradeColor)};color:${escapeHtml(gradeTextColor)};">${escapeHtml(grade)}</span>`;
                                  })
                                  .join("")
                              : `<span class="chip chip-neutral">${escapeHtml(t("grades").noGrades)}</span>`
                            }
                          </div>

                          ${
                            isExamImpact ?
                              `
                            <div class="impact-card">
                              <div class="impact-label">${escapeHtml(t("grades").pdf.impactedSubjects)}</div>
                              <div class="impact-text">${impactLabel} ${appliedExamGrade ? `• ${escapeHtml(appliedExamGrade)}` : ""}</div>
                              <div class="impact-subtext">${escapeHtml(t("grades").subjects.withoutExam)}: ${escapeHtml(baseAverage)} • ${escapeHtml(t("grades").subjects.finalAverage)}: ${escapeHtml(displayedAverage)}</div>
                            </div>
                          `
                            : ""
                          }
                        </article>
                      `;
                      })
                      .join("")}
                  </section>
                `;
                })
                .join("")}

              <div class="footer">${escapeHtml(t("grades").pdf.generatedOn)} ${escapeHtml(generatedOn)}</div>
            </div>
          </body>
        </html>
      `;

      const pdf = await Print.printToFileAsync({ html });
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(t("grades").pdf.shareTitle, t("grades").pdf.shareMessage);
        return;
      }

      await Sharing.shareAsync(pdf.uri, {
        mimeType: "application/pdf",
        dialogTitle: t("grades").pdf.shareTitle,
        UTI: "com.adobe.pdf",
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("grades").pdf.errorTitle, t("grades").pdf.errorMessage);
    } finally {
      setIsExportingPdf(false);
    }
  }, [studentGrades, formatFullDate, hasExportableGrades, t]);

  // Toggle subject expand/collapse
  const toggleSubject = useCallback(
    (subjectName: string, semesterNumber: number) => {
      const key = `${semesterNumber}-${subjectName}`;
      setExpandedSubjects((prev) => {
        const nextExpanded = !prev[key];
        if (nextExpanded) {
          onAcknowledgeHighlight(semesterNumber, subjectName);
        }
        return {
          ...prev,
          [key]: nextExpanded,
        };
      });

      // Add haptic feedback when expanding/collapsing
      Haptics.selectionAsync();
    },
    [onAcknowledgeHighlight],
  );

  // Toggle semester dropdown
  const toggleSemester = useCallback((semesterNumber: number) => {
    setExpandedSemesters((prev) => ({
      ...prev,
      [semesterNumber]: !prev[semesterNumber],
    }));

    // Add haptic feedback when expanding/collapsing
    Haptics.selectionAsync();
  }, []);

  const isSemesterExpanded = useCallback(
    (semesterNumber: number) =>
      expandedSemesters[semesterNumber] ??
      semesterNumber === currentSemesterNumber,
    [expandedSemesters, currentSemesterNumber],
  );

  // If no data, show loading or error
  if (!studentGrades) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t("schedule").error}</Text>
        <Text style={styles.errorMessage}>{t("schedule").error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header with student info and buttons */}
      <View style={[styles.headerContainer, refreshing && { opacity: 0.7 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.studentName, textOpacity]}>
            {studentGrades.studentInfo.firstName}{" "}
            {studentGrades.studentInfo.name}
          </Text>
          <Text style={[styles.studentDetails, textOpacity]}>
            {studentGrades.studentInfo.group} |{" "}
            {studentGrades.studentInfo.specialization}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {currentSemesterData?.subjects &&
            currentSemesterData.subjects.length > 0 && (
              <TouchableOpacity
                style={styles.calculatorButton}
                onPress={() => {
                  setCalculatorSession((prev) => prev + 1);
                  setCalculatorVisible(true);
                  Haptics.selectionAsync();
                }}
                disabled={refreshing}
              >
                <MaterialIcons
                  name='calculate'
                  size={22}
                  color={Colors.dark.white}
                />
              </TouchableOpacity>
            )}
          <View style={styles.headerActionColumn}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <MaterialIcons
                name='refresh'
                size={24}
                color={Colors.dark.white}
                style={[refreshing && styles.refreshingIcon]}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exportIconButton,
                (!hasExportableGrades || isExportingPdf) &&
                  styles.exportIconButtonDisabled,
              ]}
              onPress={handleExportGradesPdf}
              disabled={!hasExportableGrades || isExportingPdf}
              activeOpacity={0.85}
            >
              {isExportingPdf ?
                <ActivityIndicator size='small' color={Colors.dark.white} />
              : <MaterialIcons
                  name='picture-as-pdf'
                  size={20}
                  color={Colors.dark.white}
                />
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Data staleness warning */}
      {isDataStale && (
        <Animated.View
          entering={FadeInUp.springify()}
          style={[styles.warningBanner, refreshing && { opacity: 0.5 }]}
        >
          <MaterialIcons
            name='info-outline'
            size={24}
            color={Colors.dark.warningGold}
          />
          <Text style={[styles.warningText, textOpacity]}>
            {t("grades").lastUpdated} {lastUpdatedFormatted}.{" "}
            {t("grades").dataStale}
          </Text>
        </Animated.View>
      )}

      {/* Tab Switcher */}
      <ViewModeSwitcher activeMode={viewMode} onModeChange={setViewMode} />

      {viewMode === "grades" ?
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollViewContent}
        >
          {/* Overall Average Card if there are multiple semesters */}
          {allSemestersAverages.length > 1 && (
            <Animated.View
              entering={FadeInUp.springify()}
              style={[styles.averageCard, refreshing && { opacity: 0.7 }]}
            >
              <Text style={[styles.averageLabel, textOpacity]}>
                {t("grades").average}
              </Text>
              <Text style={[styles.averageValue, textOpacity]}>
                {(
                  allSemestersAverages.reduce(
                    (acc, item) => acc + parseFloat(item!.average),
                    0,
                  ) / allSemestersAverages.length
                ).toFixed(2)}
              </Text>
            </Animated.View>
          )}

          {/* Render each semester as a collapsible section */}
          {studentGrades.currentGrades.map((semester, index) => (
            <Animated.View
              key={`semester-${semester.semester}`}
              entering={FadeInUp.delay(index * 100).springify()}
              style={[styles.semesterSection, refreshing && { opacity: 0.7 }]}
            >
              {/* Semester header with toggle */}
              <TouchableOpacity
                style={styles.semesterHeader}
                onPress={() => toggleSemester(semester.semester)}
                disabled={refreshing}
              >
                <Text style={[styles.semesterTitle, textOpacity]}>
                  {formatSemesterLabel(semester.semester)}
                </Text>
                <View style={styles.semesterHeaderRight}>
                  {/* Display semester average if available */}
                  {allSemestersAverages[index] && (
                    <Text style={[styles.semesterAverageText, textOpacity]}>
                      {t("grades").average}:{" "}
                      {allSemestersAverages[index]!.average}
                    </Text>
                  )}
                  <MaterialIcons
                    name={
                      isSemesterExpanded(semester.semester) ?
                        "keyboard-arrow-up"
                      : "keyboard-arrow-down"
                    }
                    size={24}
                    color={Colors.dark.white}
                    style={textOpacity}
                  />
                </View>
              </TouchableOpacity>

              {/* Semester content (subjects) when expanded */}
              {isSemesterExpanded(semester.semester) && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={styles.semesterContent}
                >
                  {/* Semester average and absences */}
                  {allSemestersAverages[index] && (
                    <View
                      style={[
                        styles.semesterAverageCard,
                        refreshing && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.averageLabel, textOpacity]}>
                        {t("grades").average}
                      </Text>
                      <Text style={[styles.averageValue, textOpacity]}>
                        {allSemestersAverages[index]!.average}
                      </Text>

                      {/* Display absences if available */}
                      {semester.absences && (
                        <View style={styles.absencesContainer}>
                          <Text style={[styles.absencesLabel, textOpacity]}>
                            {t("grades").absences}:{" "}
                            <Text style={[styles.absencesValue, textOpacity]}>
                              {semester.absences.total}
                            </Text>{" "}
                            ({t("grades").unexcused}:{" "}
                            <Text
                              style={[styles.absencesUnexcused, textOpacity]}
                            >
                              {semester.absences.unexcused}
                            </Text>
                            )
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Subject list for this semester */}
                  {semester.subjects.map((subject, subjectIndex) => {
                    const subjectKey = `${semester.semester}::${subject.name}`;
                    const highlight = newHighlights[subjectKey];
                    return (
                      <SubjectCard
                        key={`subject-${semester.semester}-${subject.name}-${subjectIndex}`}
                        subject={subject}
                        expanded={
                          !!expandedSubjects[
                            `${semester.semester}-${subject.name}`
                          ]
                        }
                        onToggle={() =>
                          toggleSubject(subject.name, semester.semester)
                        }
                        semesterNumber={semester.semester}
                        newGradeIndices={highlight?.gradeIndices}
                        hasNewExam={highlight?.newExam}
                      />
                    );
                  })}

                  {/* Empty state if no subjects */}
                  {semester.subjects.length === 0 && (
                    <Text style={[styles.emptyText, textOpacity]}>
                      {t("grades").subjects.noSubjects.replace(
                        "{{semester}}",
                        semester.semester.toString(),
                      )}
                    </Text>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          ))}

          {/* No data message if no semesters */}
          {studentGrades.currentGrades.length === 0 && (
            <Text style={[styles.emptyText, textOpacity]}>
              {t("grades").noGrades}
            </Text>
          )}

          {/* Last updated info at the bottom */}
          <Text style={[styles.lastUpdatedText, textOpacity]}>
            {t("grades").lastUpdated}: {lastUpdatedFormatted}
          </Text>
        </ScrollView>
      : <ExamsView
          exams={studentGrades.exams}
          studentInfo={studentGrades.studentInfo}
          officialSchedule={officialSchedule}
          selectedSubgroup={selectedSubgroup}
        />
      }

      {/* Grade Calculator Modal */}
      {currentSemesterData && (
        <GradeCalculatorModal
          key={`grade-calculator-${calculatorSession}`}
          isVisible={calculatorVisible}
          onClose={() => setCalculatorVisible(false)}
          subjects={currentSemesterData.subjects}
          allSemesters={studentGrades.currentGrades}
        />
      )}

      {/* Overlay the content with a semi-transparent loading indicator when refreshing */}
      {/* Overlay only for initial/explicit pull refresh; background uses subtle bar */}
      {refreshing && (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator size='large' color={Colors.dark.primaryStrong} />
          <Text style={styles.refreshingText}>{t("grades").refreshing}</Text>
        </View>
      )}
      {/* Anonymous background refresh indicator (pulsing dots) */}
      {(isBackgroundRefreshing || backgroundJustUpdated) && (
        <View style={styles.backgroundIndicatorWrapper} pointerEvents='none'>
          <View
            style={[
              styles.backgroundIndicatorPill,
              backgroundJustUpdated && styles.backgroundIndicatorUpdated,
            ]}
          >
            {!backgroundJustUpdated ?
              <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, dotStyle1]} />
                <Animated.View style={[styles.dot, dotStyle2]} />
                <Animated.View style={[styles.dot, dotStyle3]} />
              </View>
            : <Text style={styles.backgroundUpdatedText}>
                {t("grades").updatedLabel}
              </Text>
            }
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// Main container component to handle state and loading
export default function Grades() {
  // Fix: Use a ref to prevent duplicate API requests
  const fetchingRef = useRef(false);
  const { t, formatFullDate } = useTranslation();

  const [idnp, setIdnp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [responseHtml, setResponseHtml] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  // Prevent multiple initial cache hydrations overwriting fresh data
  const initialLoadDoneRef = useRef(false);
  const [displayGrades, setDisplayGrades] = useState<StudentGrades | null>(
    null,
  );
  const [newHighlights, setNewHighlights] = useState<NewGradeHighlightsMap>({});
  const [devInjected, setDevInjected] = useState<boolean>(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const initialHydratedRef = useRef(false);
  const prevParsedRef = useRef<StudentGrades | null>(null);
  const lastHandledRefreshRef = useRef(-1);
  const prevResponseRef = useRef<string | null>(null);
  const baseParsedRef = useRef<StudentGrades | null>(null);

  const persistHighlights = useCallback(
    async (targetIdnp: string | null, highlights: NewGradeHighlightsMap) => {
      if (!targetIdnp) return;
      try {
        await AsyncStorage.setItem(
          getHighlightsStorageKey(targetIdnp),
          JSON.stringify(highlights),
        );
      } catch {
        // Silent storage failure; highlighting still works in-memory.
      }
    },
    [],
  );

  const acknowledgeHighlight = useCallback(
    (semesterNumber: number, subjectName: string) => {
      const highlightKey = `${semesterNumber}::${subjectName}`;
      setNewHighlights((prev) => {
        if (!prev[highlightKey]) return prev;
        const next = { ...prev };
        delete next[highlightKey];
        void persistHighlights(idnp, next);
        return next;
      });
    },
    [idnp, persistHighlights],
  );

  // Load dev injection stage and listen for updates
  // Moved below after recomputeDisplayFromToggle definition

  useEffect(() => {
    // Load stored IDNP and cached grades data
    const loadStoredData = async () => {
      try {
        const savedIdnp = await secureStorageService.getIdnp();

        if (savedIdnp) {
          setIdnp(savedIdnp);

          const storedHighlightsRaw = await AsyncStorage.getItem(
            getHighlightsStorageKey(savedIdnp),
          );
          setNewHighlights(parseStoredHighlights(storedHighlightsRaw));

          // Try to load cached grades data (prefer the newer unified service cache if fresher)
          if (!responseHtml) {
            // Only hydrate if we don't already have data in state
            const legacyJson = await AsyncStorage.getItem(GRADES_DATA_KEY);
            let legacyData: StoredGradesData | null = null;
            if (legacyJson) {
              try {
                legacyData = JSON.parse(legacyJson);
              } catch {
                legacyData = null;
              }
            }
            const newCached = await gradesDataService.getCached(savedIdnp);

            // Decide which cache to use
            let chosenHtml: string | null = null;
            let chosenTimestamp: number | null = null;

            if (legacyData && newCached) {
              const legacyTs = legacyData.timestamp || 0;
              const newTs = newCached.timestamp || 0;
              if (newTs > legacyTs) {
                // New cache is fresher
                chosenHtml = newCached.html;
                chosenTimestamp = newTs || Date.now();
              } else if (
                newTs === legacyTs &&
                newCached.html !== legacyData.html
              ) {
                // Same timestamp (or missing) but different content – prefer new cache to avoid stale reversion
                chosenHtml = newCached.html;
                chosenTimestamp = newTs || legacyTs || Date.now();
              } else {
                // Legacy is equal or newer
                chosenHtml = legacyData.html;
                chosenTimestamp = legacyData.timestamp;
              }
            } else if (newCached) {
              chosenHtml = newCached.html;
              chosenTimestamp = newCached.timestamp || null;
            } else if (legacyData) {
              chosenHtml = legacyData.html;
              chosenTimestamp = legacyData.timestamp;
            }

            if (chosenHtml) {
              setResponseHtml(chosenHtml);
              if (chosenTimestamp) setLastUpdated(chosenTimestamp);
            }

            // Mirror unified (new) cache back to legacy keys if we selected newCached so future loads stay in sync
            if (newCached && chosenHtml === newCached.html) {
              try {
                await AsyncStorage.setItem(
                  GRADES_DATA_KEY,
                  JSON.stringify({
                    html: newCached.html,
                    timestamp: newCached.timestamp || Date.now(),
                  }),
                );
                if (newCached.timestamp) {
                  await AsyncStorage.setItem(
                    GRADES_TIMESTAMP_KEY,
                    newCached.timestamp.toString(),
                  );
                }
              } catch {
                /* silent */
              }
            }

            // If we still have no explicit timestamp set (e.g., only legacy html stored earlier), attempt legacy timestamp key
            if (!lastUpdated && !chosenTimestamp) {
              const timestamp =
                await AsyncStorage.getItem(GRADES_TIMESTAMP_KEY);
              if (timestamp) {
                setLastUpdated(parseInt(timestamp, 10));
              }
            }
          }
        } else {
          setNewHighlights({});
        }
      } catch {
        // Silently handle error
      } finally {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      }
    };

    // Listen for IDNP clear events and reset state
    const subscription = DeviceEventEmitter.addListener(
      IDNP_UPDATE_EVENT,
      (newIdnp: string | null) => {
        setIdnp(newIdnp);
        if (!newIdnp) {
          setResponseHtml("");
          setLastUpdated(null);
          setErrorMessage(null);
          setDisplayGrades(null);
          setNewHighlights({});
          prevParsedRef.current = null;
          prevResponseRef.current = null;
          initialHydratedRef.current = false;
          lastHandledRefreshRef.current = -1;
        }
      },
    );

    loadStoredData();

    // Load cached only; do NOT trigger another network refresh here (App already did at startup)
    if (!initialLoadDoneRef.current) {
      (async () => {
        if (idnp && !responseHtml) {
          const cached = await gradesDataService.getCached(idnp);
          if (cached) {
            setResponseHtml(cached.html);
            setLastUpdated(cached.timestamp || null);
          }
        }
      })();
    }

    const unsubscribeGrades = gradesDataService.subscribe(async () => {
      if (!idnp) return;
      const updated = await gradesDataService.getCached(idnp);
      if (!updated) return;
      const isDifferent = updated.html !== responseHtml;
      if (isDifferent) {
        setResponseHtml(updated.html);
      }
      if (updated.timestamp && updated.timestamp !== lastUpdated) {
        setLastUpdated(updated.timestamp);
      }
      setRefreshNonce((n) => n + 1);
      // Persist new unified cache to legacy keys so future single-source loads don't revert
      try {
        await AsyncStorage.setItem(
          GRADES_DATA_KEY,
          JSON.stringify({
            html: updated.html,
            timestamp: updated.timestamp || Date.now(),
          }),
        );
        if (updated.timestamp) {
          await AsyncStorage.setItem(
            GRADES_TIMESTAMP_KEY,
            updated.timestamp.toString(),
          );
        }
      } catch {}
    });

    return () => {
      subscription.remove();
      unsubscribeGrades();
    };
  }, [idnp, lastUpdated, responseHtml]);

  // Re-parse grades when data or refresh marker changes and capture new items
  useEffect(() => {
    if (!responseHtml) return;

    const refreshChanged =
      responseHtml !== prevResponseRef.current ||
      refreshNonce !== lastHandledRefreshRef.current;
    if (!refreshChanged) return;

    const baseParsed = parseStudentGradesData(responseHtml);
    baseParsedRef.current = baseParsed;

    const displayData =
      devInjected ? injectRandomGrades(baseParsed) : baseParsed;

    const prevParsed = prevParsedRef.current;

    // First hydration: avoid marking everything new unless devInjected adds items
    if (!initialHydratedRef.current) {
      const initialHighlights =
        devInjected ? computeNewGradeHighlights(baseParsed, displayData) : {};

      setDisplayGrades(displayData);
      setNewHighlights((prev) => {
        const merged = mergeNewGradeHighlights(prev, initialHighlights);
        void persistHighlights(idnp, merged);
        return merged;
      });
      prevParsedRef.current = displayData;
      prevResponseRef.current = responseHtml;
      initialHydratedRef.current = true;
      lastHandledRefreshRef.current = refreshNonce;
      return;
    }

    setDisplayGrades(displayData);
    setNewHighlights((prev) => {
      const freshHighlights = computeNewGradeHighlights(
        prevParsed,
        displayData,
      );
      const merged = mergeNewGradeHighlights(prev, freshHighlights);
      void persistHighlights(idnp, merged);
      return merged;
    });

    prevParsedRef.current = displayData;
    prevResponseRef.current = responseHtml;
    initialHydratedRef.current = true;
    lastHandledRefreshRef.current = refreshNonce;
  }, [responseHtml, refreshNonce, devInjected, idnp, persistHighlights]);

  const fetchStudentData = useCallback(
    async (studentIdnp: string) => {
      // Prevent duplicate requests using ref
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      setIsFetching(true);
      setErrorMessage(null);

      try {
        // Fetch student info - this handles both login and info retrieval
        const htmlResponse = await fetchStudentInfo(studentIdnp);

        if (!htmlResponse || htmlResponse.trim() === "") {
          throw new Error("Empty response received");
        }

        // If we got here, the fetch was successful
        setResponseHtml(htmlResponse);

        // Save the IDNP since it was successful
        await secureStorageService.setIdnp(studentIdnp);

        // Save the timestamp of the fetch
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        await AsyncStorage.setItem(GRADES_TIMESTAMP_KEY, timestamp.toString());

        // Store legacy cache
        await AsyncStorage.setItem(
          GRADES_DATA_KEY,
          JSON.stringify({ html: htmlResponse, timestamp }),
        );
        // Also store via new caching layer for consistency & event emission (dedup automatic)
        try {
          await gradesDataService.store(studentIdnp, htmlResponse);
        } catch {}

        setRefreshNonce((n) => n + 1);

        // Notify other components of the IDNP update
        DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, studentIdnp);

        // Show success notification
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // If this was a fresh login attempt, clear the IDNP
        if (!responseHtml) {
          await secureStorageService.clearIdnp();
          setIdnp(null);
          setErrorMessage(t("grades").networkError);
        } else {
          // If we have cached data, just show an error toast but keep the cached data
          setErrorMessage(
            `${t("grades").networkErrorCache} ${formatFullDate(new Date(lastUpdated || 0), false)}`,
          );

          // Error notification
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

          // Clear the error after a few seconds if we're showing cached data
          setTimeout(() => {
            setErrorMessage(null);
          }, 3000);
        }
      } finally {
        setIsFetching(false);
        fetchingRef.current = false;
      }
    },
    [responseHtml, lastUpdated, t, formatFullDate],
  );

  // Function to sync IDNP to server - Temporarily disabled - To be implemented later
  /* const syncIdnpToServer = async (idnpToSync: string) => {
    try {
      // Use the authService method to encrypt and sync
      // Assuming 'idnp' is the key for storing this data type
      await authService.encryptAndSyncData('idnp', idnpToSync);
    } catch (error) {
      console.error('Failed to sync IDNP to server:', error);
      // Handle sync error silently or show a non-blocking notification
    }
  }; */

  const handleSaveIdnp = useCallback(
    async (newIdnp: string, shouldSave: boolean) => {
      // Don't proceed if already fetching
      if (fetchingRef.current) return;

      // Set the IDNP first to show loading screen
      setIdnp(newIdnp);

      // Check if sync is enabled - Temporarily disabled
      /* try {
      const syncSetting = await AsyncStorage.getItem(IDNP_SYNC_KEY);
      const isSyncEnabled = syncSetting !== 'false'; // Sync is enabled by default or if set to 'true'

      if (isSyncEnabled) {
        // Call the sync function *before* fetching student data
        await syncIdnpToServer(newIdnp);
      }
    } catch (error) {
      console.error('Error checking IDNP sync setting:', error);
      // Proceed even if checking the setting fails? Or handle differently?
      // For now, we'll log the error and continue.
    } */

      // Then fetch the data
      fetchStudentData(newIdnp);
    },
    [fetchStudentData],
  );

  const effectiveGrades = useMemo(() => {
    if (displayGrades) return displayGrades;
    if (!responseHtml) return null;
    try {
      return parseStudentGradesData(responseHtml);
    } catch {
      return null;
    }
  }, [displayGrades, responseHtml]);

  const recomputeDisplayFromToggle = useCallback(
    (active: boolean) => {
      const base =
        baseParsedRef.current ||
        (responseHtml ? parseStudentGradesData(responseHtml) : null);
      if (!base) return;
      const nextDisplay = active ? injectRandomGrades(base) : base;
      const prev = prevParsedRef.current;
      setDisplayGrades(nextDisplay);
      setNewHighlights((previousHighlights) => {
        const freshHighlights =
          prev ? computeNewGradeHighlights(prev, nextDisplay) : {};
        const merged = mergeNewGradeHighlights(
          previousHighlights,
          freshHighlights,
        );
        void persistHighlights(idnp, merged);
        return merged;
      });
      prevParsedRef.current = nextDisplay;
    },
    [responseHtml, idnp, persistHighlights],
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEV_GRADE_TOGGLE_KEY);
        if (stored === "true") {
          setDevInjected(true);
          recomputeDisplayFromToggle(true);
        }
      } catch {
        // ignore
      }
    })();

    const toggleListener = DeviceEventEmitter.addListener(
      DEV_GRADE_TOGGLE_EVENT,
      (active: boolean) => {
        setDevInjected(active);
        recomputeDisplayFromToggle(active);
      },
    );

    return () => {
      toggleListener.remove();
    };
  }, [recomputeDisplayFromToggle]);

  // Handle initial fetch of data if IDNP is already set but no cached data
  useEffect(() => {
    // When IDNP is set but no data is loaded yet, and we're not already fetching
    if (idnp && !responseHtml && !fetchingRef.current && !errorMessage) {
      // Only auto-fetch if we don't have any cached data
      AsyncStorage.getItem(GRADES_DATA_KEY).then((cached) => {
        if (!cached) {
          fetchStudentData(idnp);
        }
      });
    }
    // Intentionally omitting fetchStudentData from dependencies to prevent re-fetch on responseHtml change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idnp, responseHtml, errorMessage]);

  if (isLoading && !responseHtml) {
    return <LoadingScreen message={t("schedule").loading} />;
  }

  if (isFetching && !responseHtml) {
    return <LoadingScreen message={t("grades").semesters.connecting} />;
  }

  // Show IDNP screen if no IDNP or there was an error with no cached data
  if (!idnp || (errorMessage && !responseHtml)) {
    return (
      <IDNPScreen
        onSave={handleSaveIdnp}
        errorMessage={errorMessage || undefined}
        isSubmitting={isFetching}
      />
    );
  }

  // If we have IDNP and response HTML, show the grades screen
  return (
    <>
      {errorMessage && responseHtml && (
        <Animated.View
          entering={FadeInUp.springify().delay(100)}
          style={[styles.errorNotification]}
        >
          <MaterialIcons
            name='error-outline'
            size={24}
            color={Colors.dark.lightPink}
          />
          <Text style={styles.errorNotificationText}>{errorMessage}</Text>
        </Animated.View>
      )}
      <GradesScreen
        idnp={idnp!}
        studentGrades={effectiveGrades}
        lastUpdated={lastUpdated}
        newHighlights={newHighlights}
        onAcknowledgeHighlight={acknowledgeHighlight}
        onRefresh={async () => {
          if (idnp) {
            // Check sync setting before refreshing - Temporarily disabled
            /* try {
              const syncSetting = await AsyncStorage.getItem(IDNP_SYNC_KEY);
              const isSyncEnabled = syncSetting !== 'false';
              if (isSyncEnabled) {
                // Re-sync IDNP on manual refresh if needed
                await syncIdnpToServer(idnp);
              }
            } catch (error) {
              console.error('Error checking IDNP sync setting on refresh:', error);
            } */
            await fetchStudentData(idnp); // This sets state when fresh HTML arrives
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.dark.white,
  },
  addButton: {
    backgroundColor: Colors.dark.primaryStrong,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  averageCard: {
    backgroundColor: Colors.dark.surfaceSecondary,
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  averageLabel: {
    color: Colors.dark.neutral500,
    fontSize: 16,
    marginBottom: 8,
  },
  averageValue: {
    color: Colors.dark.white,
    fontSize: 32,
    fontWeight: "bold",
  },
  sortContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sortButton: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceRaisedAlt,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  sortButtonActive: {
    backgroundColor: Colors.dark.primaryStrong,
  },
  sortButtonText: {
    color: Colors.dark.neutral500,
    fontSize: 14,
  },
  sortButtonTextActive: {
    color: Colors.dark.white,
    fontWeight: "600",
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100, // Extra padding at the bottom for better scrolling
  },
  gradeCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientCard: {
    padding: 16,
  },
  gradeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subject: {
    color: Colors.dark.white,
    fontSize: 18,
    fontWeight: "600",
  },
  gradeValue: {
    color: Colors.dark.white,
    fontSize: 24,
    fontWeight: "bold",
  },
  gradeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  category: {
    color: Colors.dark.overlayWhite90,
    fontSize: 14,
  },
  date: {
    color: Colors.dark.overlayWhite90,
    fontSize: 14,
  },
  notes: {
    color: Colors.dark.overlayWhite80,
    fontSize: 14,
    marginBottom: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  emptyText: {
    color: Colors.dark.neutral500,
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  calculatorSheetContent: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
  },
  form: {
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: GRADES_MODAL_COLORS.surface,
    borderWidth: 1,
    borderColor: GRADES_MODAL_COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: GRADES_MODAL_COLORS.textPrimary,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: "top",
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryButton: {
    backgroundColor: Colors.dark.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  categoryButtonActive: {
    backgroundColor: Colors.dark.primaryStrong,
  },
  categoryButtonText: {
    color: Colors.dark.neutral500,
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: Colors.dark.white,
    fontWeight: "600",
  },
  dateButton: {
    backgroundColor: Colors.dark.surfaceRaisedAlt,
    borderRadius: 12,
    padding: 16,
  },
  dateButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: Colors.dark.primaryStrong,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  saveButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  idnpContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundTertiary,
    padding: 20,
  },
  idnpContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  idnpTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.dark.white,
    marginBottom: 16,
  },
  idnpDescription: {
    color: Colors.dark.neutral500,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  idnpInput: {
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    color: Colors.dark.white,
    fontSize: 16,
    width: "100%",
    marginBottom: 16,
  },
  errorText: {
    color: Colors.dark.lightPink,
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  disclaimerText: {
    color: Colors.dark.neutral500,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: Colors.dark.primaryStrong,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  submitButtonDisabled: {
    backgroundColor: Colors.dark.neutral500,
  },
  submitButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  loadingText: {
    color: Colors.dark.white,
    marginTop: 12,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  loadingNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceRaisedAlt,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  // Error styles
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundTertiary,
    padding: 20,
  },
  errorTitle: {
    color: Colors.dark.lightPink,
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  errorMessage: {
    color: Colors.dark.white,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.dark.primaryStrong,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  idnpInputError: {
    borderColor: Colors.dark.lightPink,
    borderWidth: 1,
  },
  // New styles for semester dropdown
  semesterDropdownContainer: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  semesterDropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  semesterDropdownButtonText: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  semesterDropdownMenu: {
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
  },
  semesterDropdownItem: {
    padding: 12,
    borderRadius: 8,
  },
  semesterDropdownItemActive: {
    backgroundColor: Colors.dark.primaryStrong,
  },
  semesterDropdownItemText: {
    color: Colors.dark.white,
    fontSize: 16,
  },
  semesterDropdownItemTextActive: {
    fontWeight: "600",
  },
  // New styles for subject cards
  subjectCard: {
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  subjectNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  subjectName: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  newBadge: {
    backgroundColor: Colors.dark.overlayAmber15,
    borderColor: Colors.dark.lightYellow,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 0,
    marginRight: 8,
    alignSelf: "center",
  },
  newBadgeText: {
    color: Colors.dark.lightYellow,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subjectHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  averageGrade: {
    color: Colors.dark.white,
    fontSize: 18,
    fontWeight: "600",
  },
  gradesContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.overlayWhite10,
    padding: 16,
  },
  gradesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gradeItem: {
    backgroundColor: Colors.dark.overlayPrimaryStrong50,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
    position: "relative",
  },
  newGradeItem: {
    borderWidth: 1.5,
    borderColor: Colors.dark.lightYellow,
    backgroundColor: Colors.dark.overlayAmber18,
    shadowColor: Colors.dark.lightYellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 0,
  },
  gradeText: {
    color: Colors.dark.white,
    fontSize: 14,
    fontWeight: "500",
  },
  gradePip: {
    position: "absolute",
    top: 4,
    right: 6,
    color: Colors.dark.lightYellow,
    fontSize: 12,
    fontWeight: "700",
  },
  // New styles for exams view
  examsList: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    color: Colors.dark.offWhite,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  examTypeSection: {
    marginBottom: 8,
  },
  examTypeTitle: {
    display: "none",
  },
  examCard: {
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  examSubject: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 0,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 8,
    lineHeight: 21,
  },
  examDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  examSemester: {
    color: Colors.dark.neutral500,
    fontSize: 14,
  },
  examGrade: {
    color: Colors.dark.accentBlue,
    fontSize: 18,
    fontWeight: "bold",
  },
  examCardThesis: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.examCardBorder,
  },
  examCardExamVariant: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.examCardBorderAlt,
  },
  examTypePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.dark.overlayGray20,
    marginLeft: 8,
    flexShrink: 0,
    alignSelf: "flex-start",
  },
  examTypePillThesis: {
    backgroundColor: Colors.dark.overlayAccentBlue20,
  },
  examTypePillExamVariant: {
    backgroundColor: Colors.dark.overlayOrange20,
  },
  examTypePillOther: {
    backgroundColor: Colors.dark.overlayGray15,
  },
  examTypePillText: {
    color: Colors.dark.examTypePillText,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  examGradeThesis: {
    color: Colors.dark.examGradeThesis,
  },
  examGradeExam: {
    color: Colors.dark.examGradeExam,
  },
  examsListContent: {
    paddingBottom: 100,
  },
  officialSectionContainer: {
    marginTop: 16,
  },
  noOfficialDataText: {
    color: Colors.dark.neutral500,
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  officialSectionHeader: {
    marginTop: 8,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  officialSectionSubtitle: {
    color: Colors.dark.neutral500,
    fontSize: 12,
    marginTop: 4,
  },
  officialRefreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dark.officialRefreshSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.overlayAccentBlue35,
  },
  officialLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  officialLoadingText: {
    color: Colors.dark.neutral500,
    fontSize: 13,
  },
  officialDateGroup: {
    marginBottom: 16,
  },
  officialDateTitle: {
    color: Colors.dark.officialDateTitle,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  officialEventCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  officialEventCardExam: {
    backgroundColor: Colors.dark.overlayOrange08,
    borderColor: Colors.dark.overlayOrange28,
  },
  officialEventCardThesis: {
    backgroundColor: Colors.dark.overlayAccentBlue10,
    borderColor: Colors.dark.overlayAccentBlue30,
  },
  officialEventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  officialEventTypePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  officialEventTypePillExam: {
    backgroundColor: Colors.dark.overlayOrange20,
  },
  officialEventTypePillThesis: {
    backgroundColor: Colors.dark.overlayAccentBlue25,
  },
  officialEventTypeText: {
    color: Colors.dark.white,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  officialEventSubgroup: {
    color: Colors.dark.officialEventSubgroup,
    fontSize: 11,
    fontWeight: "600",
  },
  officialEventSubject: {
    color: Colors.dark.white,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  officialEventMeta: {
    color: Colors.dark.officialEventMeta,
    fontSize: 13,
    lineHeight: 18,
  },
  // View mode switcher styles
  viewModeSwitcher: {
    flexDirection: "row",
    justifyContent: "center",
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  activeModeTab: {
    backgroundColor: Colors.dark.primaryStrong,
  },
  modeTabText: {
    color: Colors.dark.neutral500,
    fontSize: 14,
    fontWeight: "500",
  },
  activeModeTabText: {
    color: Colors.dark.white,
    fontWeight: "600",
  },
  // Student info header styles
  studentInfoHeader: {
    padding: 20,
    paddingBottom: 12,
  },
  studentName: {
    color: Colors.dark.white,
    fontSize: 22,
    fontWeight: "bold",
  },
  studentDetails: {
    color: Colors.dark.neutral500,
    fontSize: 14,
    marginTop: 4,
  },
  // Absences styles
  absencesContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.overlayWhite10,
    paddingTop: 10,
    width: "100%",
    alignItems: "center",
  },
  absencesLabel: {
    color: Colors.dark.neutral500,
    fontSize: 14,
  },
  absencesValue: {
    fontWeight: "bold",
    color: Colors.dark.white,
  },
  absencesUnexcused: {
    color: Colors.dark.lightPink,
    fontWeight: "bold",
  },
  subjectHeaderEmpty: {
    opacity: 0.5,
  },
  gradeItemFailing: {
    backgroundColor: Colors.dark.overlayFail50,
  },
  failingGrade: {
    color: Colors.dark.lightPink,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  semesterSection: {
    marginBottom: 16,
  },
  semesterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  semesterTitle: {
    color: Colors.dark.white,
    fontSize: 16,
    fontWeight: "600",
  },
  semesterHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  semesterAverageText: {
    color: Colors.dark.white,
    fontSize: 14,
    marginRight: 8,
  },
  semesterContent: {
    marginTop: 8,
    marginHorizontal: 20,
  },
  semesterAverageCard: {
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  lastUpdatedText: {
    color: Colors.dark.neutral500,
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  refreshButton: {
    backgroundColor: Colors.dark.primaryStrong,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    elevation: 2,
    shadowColor: Colors.dark.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  refreshingIcon: {
    transform: [{ rotate: "45deg" }],
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.overlayGold10,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  warningText: {
    color: Colors.dark.warningGold,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorNotification: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.errorBannerSurface,
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 60,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    shadowColor: Colors.dark.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorNotificationText: {
    color: Colors.dark.lightPink,
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  refreshOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.dark.overlayBlack50,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshingText: {
    color: Colors.dark.white,
    marginTop: 12,
    textAlign: "center",
  },
  bottomRefreshBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bottomRefreshBarTrack: {
    width: "60%",
    height: 4,
    backgroundColor: Colors.dark.overlayWhite10,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  bottomRefreshBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "40%",
    backgroundColor: Colors.dark.primaryStrong,
    borderRadius: 2,
  },
  bottomRefreshBarText: {
    fontSize: 12,
    color: Colors.dark.neutral500,
  },
  examHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  upcomingIndicatorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.dark.overlayOrange12,
    borderWidth: 1,
    borderColor: Colors.dark.overlayOrange30,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  upcomingIndicatorContainerInfo: {
    backgroundColor: Colors.dark.overlayAccentBlue12,
    borderColor: Colors.dark.overlayAccentBlue30,
  },
  upcomingIndicatorText: {
    fontSize: 12,
    flex: 1,
    flexWrap: "wrap",
    lineHeight: 16,
  },
  upcomingIndicatorDefaultText: {
    color: Colors.dark.lightOrange,
  },
  upcomingIndicatorInfoText: {
    color: Colors.dark.accentBlueLight,
  },
  examOfficialMeta: {
    marginTop: 8,
    color: Colors.dark.officialMeta,
    fontSize: 12,
    lineHeight: 16,
  },
  upcomingExamGrade: {
    color: Colors.dark.lightOrange,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundTertiary,
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: GRADES_MODAL_COLORS.surface,
    borderWidth: 1,
    borderColor: GRADES_MODAL_COLORS.border,
    borderRadius: 12,
    padding: 8,
  },
  subjectOption: {
    padding: 12,
    borderRadius: 8,
  },
  subjectOptionSelected: {
    backgroundColor: GRADES_MODAL_COLORS.accent,
  },
  subjectOptionText: {
    color: GRADES_MODAL_COLORS.textSecondary,
    fontSize: 16,
  },
  subjectOptionTextSelected: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontWeight: "600",
  },
  currentGradesContainer: {
    backgroundColor: GRADES_MODAL_COLORS.surface,
    borderWidth: 1,
    borderColor: GRADES_MODAL_COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  calculatorGradeItem: {
    backgroundColor: Colors.dark.overlayPrimaryStrong50,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: "center",
    marginBottom: 8,
  },
  currentAverageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: GRADES_MODAL_COLORS.border,
  },
  currentAverageLabel: {
    color: GRADES_MODAL_COLORS.textSecondary,
    fontSize: 16,
  },
  currentAverageValue: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  calculateButton: {
    backgroundColor: GRADES_MODAL_COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "100%",
  },
  calculateButtonDisabled: {
    backgroundColor: GRADES_MODAL_COLORS.accentDisabled,
  },
  calculateButtonText: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  resultsContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: GRADES_MODAL_COLORS.surface,
    borderWidth: 1,
    borderColor: GRADES_MODAL_COLORS.border,
    borderRadius: 12,
  },
  resultsTitle: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  resultGradeItem: {
    backgroundColor: Colors.dark.overlaySuccess50,
  },
  noGradesText: {
    color: GRADES_MODAL_COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    padding: 10,
  },
  noSolutionText: {
    color: GRADES_MODAL_COLORS.textSecondary,
    fontSize: 16,
    textAlign: "center",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerActionColumn: {
    gap: 8,
  },
  calculatorButton: {
    backgroundColor: Colors.dark.primaryStrong,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  exportIconButton: {
    backgroundColor: Colors.dark.primaryStrong,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  exportIconButtonDisabled: {
    opacity: 0.55,
  },
  subjectSeparator: {
    width: 1,
    height: 24,
    backgroundColor: GRADES_MODAL_COLORS.border,
    marginHorizontal: 5,
    alignSelf: "center",
  },
  calculationTypeContainer: {
    flexDirection: "column",
    marginBottom: 10,
  },
  calculationToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: GRADES_MODAL_COLORS.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: GRADES_MODAL_COLORS.border,
  },
  toggleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  toggleOptionActive: {
    backgroundColor: GRADES_MODAL_COLORS.accent,
  },
  toggleOptionText: {
    color: GRADES_MODAL_COLORS.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  toggleOptionTextActive: {
    color: GRADES_MODAL_COLORS.textPrimary,
    fontWeight: "600",
  },
  toggleSeparator: {
    width: 1,
    height: 24,
    backgroundColor: GRADES_MODAL_COLORS.border,
    marginHorizontal: 5,
    alignSelf: "center",
  },
  // Anonymous background refresh indicator
  backgroundIndicatorWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  backgroundIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.dark.overlayWhite08,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.primaryStrong,
    opacity: 0.25,
  },
  dotDelay1: {},
  dotDelay2: {},
  backgroundIndicatorUpdated: {
    backgroundColor: Colors.dark.overlaySuccess15,
  },
  backgroundUpdatedText: {
    color: Colors.dark.successTintText,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  averageSummaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  averagePillPrimary: {
    flexGrow: 1,
    backgroundColor: Colors.dark.overlayPrimaryStrong20,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  averagePillSecondary: {
    backgroundColor: Colors.dark.overlayWhite05,
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  averagePillLabel: {
    color: Colors.dark.neutral500,
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  averagePillValue: {
    color: Colors.dark.white,
    fontSize: 20,
    fontWeight: "700",
  },
  averagePillMeta: {
    color: Colors.dark.primarySoftText,
    fontSize: 12,
    marginTop: 4,
  },
});
