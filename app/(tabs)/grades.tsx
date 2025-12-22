import { StyleSheet, View, Text, TouchableOpacity, FlatList, RefreshControl, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, DeviceEventEmitter, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/hooks/useTranslation';
import { formatLocalizedDate } from '@/utils/dateLocalization';
import React from 'react';
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
  GRADES_REFRESH_END_EVENT
} from '@/services/gradesService';
// Import authService
import authService from '@/services/authService';

// Types for local grades
type GradeCategory = 'exam' | 'test' | 'homework' | 'project' | 'other';
type SortOption = 'date' | 'grade' | 'category';
type ViewMode = 'grades' | 'exams';

// Map of newly detected grades/exams keyed by semester-subject
type NewGradeHighlight = { gradeIndices: number[]; newExam?: boolean };
type NewGradeHighlightsMap = Record<string, NewGradeHighlight>;

interface Grade {
  id: string;
  subject: string;
  value: number;
  category: GradeCategory;
  date: Date;
  notes?: string;
}

// Constants for AsyncStorage keys
const IDNP_KEY = '@planner_idnp';
const GRADES_DATA_KEY = '@planner_grades_data';
const GRADES_TIMESTAMP_KEY = '@planner_grades_timestamp';
const IDNP_UPDATE_EVENT = 'IDNP_UPDATE';
// Define IDNP_SYNC_KEY locally or import if possible
const IDNP_SYNC_KEY = '@planner_idnp_sync';
const DEV_GRADE_TOGGLE_KEY = '@dev_grade_toggle_active';
const DEV_GRADE_TOGGLE_EVENT = 'dev_grade_toggle_event';
const GRADES_MANUAL_REFRESH_NUDGE = 'grades_manual_refresh_nudge';

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
  if ((month === 8 && day >= 1) || // September
      month === 9 || // October
      month === 10 || // November
      month === 11 || // December
      (month === 0 && day < 10)) { // January 1-9
    return 1;
  }

  // Second semester: Jan 10 - Aug 31
  return 2;
};

// Lightweight grade parser for local calculations
const parseNumericGrade = (grade: string): number => {
  const normalized = grade.replace(',', '.').trim();
  const value = parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
};

const cloneStudentGrades = (data: StudentGrades): StudentGrades => ({
  studentInfo: { ...data.studentInfo },
  currentGrades: data.currentGrades.map(semester => ({
    ...semester,
    subjects: semester.subjects.map(subject => ({
      ...subject,
      grades: [...subject.grades]
    }))
  })),
  exams: data.exams.map(exam => ({ ...exam })),
  annualGrades: data.annualGrades.map(grade => ({ ...grade })),
  currentSemester: data.currentSemester
});

const recalculateSubjectAverages = (subject: GradeSubject) => {
  const numericGrades = subject.grades
    .map(parseNumericGrade)
    .filter(g => !isNaN(g));

  if (numericGrades.length === 0) {
    subject.baseAverage = undefined;
    subject.baseDisplayedAverage = '-';
    subject.finalAverage = undefined;
    subject.finalDisplayedAverage = '-';
    subject.average = undefined;
    subject.displayedAverage = '-';
    return;
  }

  const baseAvg = numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length;
  const roundedBase = Math.floor(baseAvg * 100) / 100;
  subject.baseAverage = roundedBase;
  subject.baseDisplayedAverage = roundedBase.toFixed(2);

  const examGrade = subject.appliedExamGrade;
  const typeKey = subject.appliedExamType?.toLowerCase() || '';
  let finalAvg = roundedBase;

  if (examGrade !== undefined && !isNaN(examGrade)) {
    if (typeKey.includes('teza') || typeKey.includes('thesis')) {
      finalAvg = (roundedBase + examGrade) / 2;
    } else if (typeKey.includes('examen') || typeKey.includes('exam')) {
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
  const subjectRefs = clone.currentGrades.flatMap(semester =>
    semester.subjects.map(subject => ({ semester: semester.semester, subject }))
  );

  if (subjectRefs.length === 0) return clone;

  const targetCount = Math.min(count, subjectRefs.length);
  const selected = new Set<number>();
  while (selected.size < targetCount) {
    selected.add(Math.floor(Math.random() * subjectRefs.length));
  }

  selected.forEach(index => {
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

const computeNewGradeHighlights = (
  prevData: StudentGrades | null,
  nextData: StudentGrades | null
): NewGradeHighlightsMap => {
  if (!nextData) return {};
  const highlights: NewGradeHighlightsMap = {};

  nextData.currentGrades.forEach(nextSemester => {
    const prevSemester = prevData?.currentGrades.find(s => s.semester === nextSemester.semester);

    nextSemester.subjects.forEach(nextSubject => {
      const prevSubject = prevSemester?.subjects.find(s => s.name === nextSubject.name);
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
        highlights[key] = { gradeIndices: newIndices, newExam: examBecameAvailable };
      }
    });
  });

  return highlights;
};

// Separate the IDNPScreen into its own component to avoid conditional hook rendering
const IDNPScreen = ({ onSave, errorMessage, isSubmitting }: { 
  onSave: (idnp: string, shouldSave: boolean) => void, 
  errorMessage?: string,
  isSubmitting: boolean 
}) => {
  const [idnp, setIdnp] = useState('');
  const [error, setError] = useState(errorMessage || '');
  const { t } = useTranslation();

  useEffect(() => {
    if (errorMessage) {
      setError(errorMessage);
      // Vibrate to notify user of error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [errorMessage]);

  const handleSubmit = () => {
    if (!/^\d{13}$/.test(idnp)) {
      setError(t('grades').idnp.error);
      return;
    }
    
    setError('');
    
    // Let the parent component handle the API call
    onSave(idnp, true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.idnpContainer}
    >
      <View style={styles.idnpContent}>
        <Text style={styles.idnpTitle}>{t('grades').idnp.title}</Text>
        <Text style={styles.idnpDescription}>
          {t('grades').idnp.description}
        </Text>
        
        <TextInput
          style={[styles.idnpInput, error ? styles.idnpInputError : null]}
          value={idnp}
          onChangeText={(text) => {
            setIdnp(text.replace(/[^0-9]/g, ''));
            setError('');
          }}
          placeholder={t('grades').idnp.placeholder}
          placeholderTextColor="#8A8A8D"
          keyboardType="numeric"
          maxLength={13}
          editable={!isSubmitting}
        />
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.disclaimerText}>
          {t('grades').idnp.disclaimer}
        </Text>

        {isSubmitting ? (
          <View style={styles.loadingNotice}>
            <ActivityIndicator size="small" color="#2C3DCD" />
            <Text style={styles.loadingText}>
              {t('grades').semesters.connecting}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitButton, 
            (!/^\d{13}$/.test(idnp) || isSubmitting) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!/^\d{13}$/.test(idnp) || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? t('grades').semesters.connecting : t('grades').idnp.continue}
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
      <ActivityIndicator size="large" color="#2C3DCD" />
      <Text style={styles.loadingText}>{message || t('loading')}</Text>
    </View>
  );
};

// Replace the SemesterTabs component with a dropdown menu
const SemesterDropdown = ({ 
  semesters, 
  activeSemester, 
  onSemesterChange 
}: { 
  semesters: SemesterGrades[], 
  activeSemester: number,
  onSemesterChange: (index: number) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
    Haptics.selectionAsync();
  };

  const selectSemester = (index: number) => {
    onSemesterChange(index);
    setIsOpen(false);
    Haptics.selectionAsync();
  };

  // Helper function to format semester label
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester
      .replace('{{year}}', year.toString())
      .replace('{{semester}}', semesterInYear.toString());
  };

  return (
    <View style={styles.semesterDropdownContainer}>
      <TouchableOpacity
        style={styles.semesterDropdownButton}
        onPress={toggleDropdown}
      >
        <Text style={styles.semesterDropdownButtonText}>
          {formatSemesterLabel(semesters[activeSemester]?.semester || 1)}
        </Text>
        <MaterialIcons
          name={isOpen ? "arrow-drop-up" : "arrow-drop-down"}
          size={24}
          color="white"
        />
      </TouchableOpacity>

      {isOpen && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={styles.semesterDropdownMenu}
        >
          {semesters.map((semester, index) => (
            <TouchableOpacity
              key={`semester-${semester.semester}`}
              style={[
                styles.semesterDropdownItem,
                activeSemester === index && styles.semesterDropdownItemActive
              ]}
              onPress={() => selectSemester(index)}
            >
              <Text style={[
                styles.semesterDropdownItemText,
                activeSemester === index && styles.semesterDropdownItemTextActive
              ]}>
                {formatSemesterLabel(semester.semester)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
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
  hasNewExam
}: { 
  subject: GradeSubject, 
  expanded: boolean,
  onToggle: () => void,
  semesterNumber: number,
  newGradeIndices?: number[],
  hasNewExam?: boolean
}) => {
  const { t } = useTranslation();
  const displayedAverage = subject.finalDisplayedAverage || subject.displayedAverage;
  const baseAverage = subject.baseDisplayedAverage || subject.displayedAverage;
  const hasExamAdjustment = displayedAverage && baseAverage && displayedAverage !== baseAverage;

  // Determine if this subject received any fresh data
  const isRecentlyUpdated = (newGradeIndices && newGradeIndices.length > 0) || hasNewExam;

  // Calculate grade quality color
  const getGradeColor = (grade: string): string => {
    const numGrade = parseFloat(grade.replace(',', '.'));
    if (isNaN(numGrade)) return 'rgba(44, 61, 205, 0.5)'; // Default blue for non-numeric
    if (numGrade < 5) return 'rgba(255, 107, 107, 0.5)'; // Red for failing
    if (numGrade >= 9) return 'rgba(75, 181, 67, 0.5)';  // Green for excellent
    if (numGrade >= 7) return 'rgba(255, 184, 0, 0.5)';  // Orange for good
    return 'rgba(44, 61, 205, 0.5)';                     // Blue for average
  };

  return (
    <Animated.View
      layout={Layout.springify()}
      style={styles.subjectCard}
    >
      <TouchableOpacity 
        style={[styles.subjectHeader, subject.grades.length === 0 && styles.subjectHeaderEmpty]} 
        onPress={subject.grades.length > 0 ? onToggle : undefined}
        activeOpacity={subject.grades.length > 0 ? 0.7 : 1}
      >
        <View style={styles.subjectNameRow}>
          <Text style={styles.subjectName}>{subject.name}</Text>
        </View>
        <View style={styles.subjectHeaderRight}>
          {isRecentlyUpdated && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('grades').subjects.newBadge}</Text>
            </View>
          )}
          {displayedAverage && (
            <Text style={[
              styles.averageGrade,
              parseFloat(displayedAverage) < 5 && styles.failingGrade
            ]}>
              {displayedAverage}
            </Text>
          )}
          {subject.grades.length > 0 && (
            <MaterialIcons
              name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
              size={24}
              color="white"
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
                <Text style={styles.averagePillLabel}>{t('grades').subjects.finalAverage}</Text>
                <Text style={styles.averagePillValue}>
                  {subject.finalDisplayedAverage || subject.displayedAverage || '-'}
                </Text>
                {subject.appliedExamType && typeof subject.appliedExamGrade === 'number' && !isNaN(subject.appliedExamGrade) && (
                  <Text style={styles.averagePillMeta}>
                    {(() => {
                      const typeKey = subject.appliedExamType?.toLowerCase() || '';
                      const isTeza = typeKey.includes('teza') || typeKey.includes('thesis');
                      return isTeza ? t('grades').subjects.thesis : t('grades').subjects.exam;
                    })()} • {subject.appliedExamGrade.toFixed(2)}
                  </Text>
                )}
              </View>

              {baseAverage && (
                <View style={styles.averagePillSecondary}>
                  <Text style={styles.averagePillLabel}>{t('grades').subjects.withoutExam}</Text>
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
                    isNewGrade ? styles.newGradeItem : null
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
  studentInfo
}: { 
  exams: Exam[];
  studentInfo: StudentInfo;
}) => {
  const { t } = useTranslation();
  
  // Handle empty exams array
  if (!exams || exams.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{t('grades').subjects.noExams}</Text>
      </View>
    );
  }

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
  const [selectedSemester, setSelectedSemester] = useState<number | null>(() => {
    // Check if the student's current semester exists in the exams data
    const hasSemester = exams.some(exam => exam.semester === studentCurrentSemester);
    return hasSemester ? studentCurrentSemester : null;
  });
  
  const [isOpen, setIsOpen] = useState(false);

  // Get unique semesters from exams
  const semesters = useMemo(() => {
    const uniqueSemesters = Array.from(
      new Set(exams.map(exam => exam.semester))
    ).sort((a, b) => a - b);
    
    return uniqueSemesters;
  }, [exams]);

  // Helper function to convert semester number to year and semester
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester.replace('{{year}}', year.toString()).replace('{{semester}}', semesterInYear.toString());
  };

  // Filter exams by semester if one is selected
  const filteredExams = useMemo(() => {
    if (selectedSemester === null) {
      return exams;
    }
    return exams.filter(exam => exam.semester === selectedSemester);
  }, [exams, selectedSemester]);

  // Group exams by type
  const examsByType = useMemo(() => {
    const grouped: Record<string, Exam[]> = {};
    
    filteredExams.forEach(exam => {
      if (!grouped[exam.type]) {
        grouped[exam.type] = [];
      }
      grouped[exam.type].push(exam);
    });
    
    return grouped;
  }, [filteredExams]);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
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
            {selectedSemester !== null 
              ? formatSemesterLabel(selectedSemester)
              : t('grades').semesters.all}
          </Text>
          <MaterialIcons
            name={isOpen ? "arrow-drop-up" : "arrow-drop-down"}
            size={24}
            color="white"
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
                selectedSemester === null && styles.semesterDropdownItemActive
              ]}
              onPress={() => selectSemester(null)}
            >
              <Text style={[
                styles.semesterDropdownItemText,
                selectedSemester === null && styles.semesterDropdownItemTextActive
              ]}>
                {t('grades').semesters.all}
              </Text>
            </TouchableOpacity>
            
            {/* Options for individual semesters */}
            {semesters.map((semester) => (
              <TouchableOpacity
                key={`semester-${semester}`}
                style={[
                  styles.semesterDropdownItem,
                  selectedSemester === semester && styles.semesterDropdownItemActive
                ]}
                onPress={() => selectSemester(semester)}
              >
                <Text style={[
                  styles.semesterDropdownItemText,
                  selectedSemester === semester && styles.semesterDropdownItemTextActive
                ]}>
                  {formatSemesterLabel(semester)}
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </View>

      {/* Exams list */}
      <ScrollView style={styles.examsList}>
        {Object.entries(examsByType).map(([type, examList]) => (
          <View key={type} style={styles.examTypeSection}>
            <Text style={styles.examTypeTitle}>{type}</Text>
            {examList.map((exam, index) => (
              <Animated.View
                key={`${type}-${index}`}
                entering={FadeInUp.delay(index * 100).springify()}
                style={styles.examCard}
              >
                <View style={styles.examHeaderRow}>
                  <Text style={styles.examSubject}>{exam.name}</Text>
                </View>
                <View style={styles.examDetails}>
                  <Text style={styles.examSemester}>
                    {formatSemesterLabel(exam.semester)}
                  </Text>
                  {exam.isUpcoming ? (
                    <View style={styles.upcomingIndicatorContainer}>
                      <MaterialIcons name="schedule" size={18} color="#FFD700" />
                      <Text style={styles.upcomingIndicatorText}>
                        {t('grades').subjects.upcoming}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.examGrade}>{exam.grade}</Text>
                  )}
                </View>
              </Animated.View>
            ))}
          </View>
        ))}
        
        {Object.keys(examsByType).length === 0 && (
          <Text style={styles.emptyText}>
            {selectedSemester !== null 
              ? t('grades').semesters.noDataSemester.replace('{{semester}}', selectedSemester.toString())
              : t('grades').semesters.noData}
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

// Tab switcher component
const ViewModeSwitcher = ({
  activeMode,
  onModeChange
}: {
  activeMode: ViewMode,
  onModeChange: (mode: ViewMode) => void
}) => {
  const { t } = useTranslation();
  
  return (
    <View style={styles.viewModeSwitcher}>
      <TouchableOpacity
        style={[
          styles.modeTab,
          activeMode === 'grades' && styles.activeModeTab
        ]}
        onPress={() => onModeChange('grades')}
      >
        <Text style={[
          styles.modeTabText,
          activeMode === 'grades' && styles.activeModeTabText
        ]}>
          {t('grades').title}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.modeTab,
          activeMode === 'exams' && styles.activeModeTab
        ]}
        onPress={() => onModeChange('exams')}
      >
        <Text style={[
          styles.modeTabText,
          activeMode === 'exams' && styles.activeModeTabText
        ]}>
          {t('grades').categories.exam}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Student info header component
const StudentInfoHeader = ({ studentInfo }: { studentInfo: StudentInfo }) => (
  <View style={styles.studentInfoHeader}>
    <Text style={styles.studentName}>
      {studentInfo.firstName} {studentInfo.name}
    </Text>
    <Text style={styles.studentDetails}>
      {studentInfo.group} | {studentInfo.specialization}
    </Text>
  </View>
);

// Error notification component
const ErrorNotification = ({ message }: { message: string }) => (
  <Animated.View 
    entering={FadeInUp.springify()}
    style={styles.errorNotification}
  >
    <MaterialIcons name="error-outline" size={24} color="#FF6B6B" />
    <Text style={styles.errorNotificationText}>{message}</Text>
  </Animated.View>
);

/**
 * Finds a realistic combination of additional grades that will make the average close to the target.
 * Prioritizes grades that are achievable rather than just suggesting 10s.
 * @param currentGrades Array of current grades (1-10)
 * @param targetAverage The desired average to achieve
 * @returns Array of grades to add to reach target average
 */
const findGradesToReachAverage = (currentGrades: number[], targetAverage: number): number[] => {
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
    const variance = grades.reduce((sum, g) => sum + Math.pow(g - avg, 2), 0) / grades.length;
    
    // Count extreme grades (1-3 and 9-10)
    const extremeGrades = grades.filter(g => g <= 3 || g >= 9).length;
    
    // Penalize solutions with high variance or too many extreme grades
    return variance + (extremeGrades * 2) + (Math.abs(avgDiff) * 5);
  };

  // Recursive backtracking function
  const backtrack = (newGrades: number[], depth: number, maxDepth: number) => {
    // Calculate new average with these added grades
    const newSum = currentSum + newGrades.reduce((sum, grade) => sum + grade, 0);
    const newCount = currentCount + newGrades.length;
    const newAverage = newSum / newCount;
    const newDifference = Math.abs(targetAverage - newAverage);

    // Check if this is a valid solution (close enough to target)
    if (newDifference < 0.01) {
      // Calculate reasonableness score for this solution
      const score = calculateReasonablenessScore(newGrades, newDifference);
      
      // Update best solution if this one is more reasonable or closer to target
      if (score < lowestVariance || 
          (Math.abs(score - lowestVariance) < 0.01 && newDifference < closestDifference)) {
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
      gradeRange = Array.from({length: end - start + 1}, (_, i) => start + i);
    } else {
      // If we need to decrease average, start with grades around target and go down
      const start = Math.max(1, Math.floor(targetAverage) - 3);
      const end = Math.min(10, Math.ceil(targetAverage) + 1);
      gradeRange = Array.from({length: end - start + 1}, (_, i) => start + i);
    }
    
    // Prioritize grades closer to the target average
    gradeRange.sort((a, b) => Math.abs(a - targetAverage) - Math.abs(b - targetAverage));
    
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
  allSemesters  // Add this new parameter to access all semester data
}: { 
  isVisible: boolean, 
  onClose: () => void, 
  subjects: GradeSubject[],
  allSemesters: SemesterGrades[] 
}) => {
  const { t } = useTranslation();
  const [selectedSubject, setSelectedSubject] = useState<GradeSubject | null>(null);
  const [targetAverage, setTargetAverage] = useState('');
  const [calculatedGrades, setCalculatedGrades] = useState<number[]>([]);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [isAnnualCalculation, setIsAnnualCalculation] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Calculate grade quality color - same as used in SubjectCard
  const getGradeColor = (grade: string): string => {
    const numGrade = parseFloat(grade.replace(',', '.'));
    if (isNaN(numGrade)) return 'rgba(44, 61, 205, 0.5)'; // Default blue for non-numeric
    if (numGrade < 5) return 'rgba(255, 107, 107, 0.5)'; // Red for failing
    if (numGrade >= 9) return 'rgba(75, 181, 67, 0.5)';  // Green for excellent
    if (numGrade >= 7) return 'rgba(255, 184, 0, 0.5)';  // Orange for good
    return 'rgba(44, 61, 205, 0.5)';                     // Blue for average
  };
  
  // Reset state when modal is opened
  useEffect(() => {
    if (isVisible) {
      setSelectedSubject(subjects.length > 0 ? subjects[0] : null);
      setTargetAverage('');
      setCalculatedGrades([]);
      setHasCalculated(false);
      setIsAnnualCalculation(false);
    }
  }, [isVisible, subjects]);
  
  // Convert string grades to numbers
  const getNumericGrades = (subject: GradeSubject): number[] => {
    return subject.grades.map(g => parseFloat(g.replace(',', '.')))
                         .filter(g => !isNaN(g));
  };
  
  // Get all grades for the selected subject from all semesters
  const getAllGradesForSubject = (subjectName: string): number[] => {
    const allGrades: number[] = [];
    
    // Iterate through all semesters to find the subject
    allSemesters.forEach(semester => {
      const subjectInSemester = semester.subjects.find(s => s.name === subjectName);
      if (subjectInSemester) {
        const numericGrades = getNumericGrades(subjectInSemester);
        allGrades.push(...numericGrades);
      }
    });
    
    return allGrades;
  };
  
  // Calculate the current average of the selected subject
  const getCurrentAverage = (): string => {
    if (!selectedSubject) return '-';
    
    // Decide which grades to use based on calculation mode
    const numericGrades = isAnnualCalculation 
      ? getAllGradesForSubject(selectedSubject.name)
      : getNumericGrades(selectedSubject);
    
    if (numericGrades.length === 0) return '-';
    
    const sum = numericGrades.reduce((a, b) => a + b, 0);
    return (sum / numericGrades.length).toFixed(2);
  };
  
  // Handle calculation
  const handleCalculate = () => {
    if (!selectedSubject || !targetAverage) return;
    
    // Decide which grades to use based on calculation mode
    const numericGrades = isAnnualCalculation 
      ? getAllGradesForSubject(selectedSubject.name)
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
  const isSubjectInMultipleSemesters = (subjectName: string): boolean => {
    // Count how many semesters contain this subject
    let count = 0;
    allSemesters.forEach(semester => {
      if (semester.subjects.some(s => s.name === subjectName)) {
        count++;
      }
    });
    return count > 1;
  };
  
  // Get all current grades for the selected subject (for display)
  const getAllCurrentGrades = (): string[] => {
    if (!selectedSubject) return [];
    
    if (!isAnnualCalculation) {
      return selectedSubject.grades;
    }
    
    // Collect grades from all semesters for this subject
    const allGrades: string[] = [];
    allSemesters.forEach(semester => {
      const subjectInSemester = semester.subjects.find(s => s.name === selectedSubject.name);
      if (subjectInSemester) {
        allGrades.push(...subjectInSemester.grades);
      }
    });
    
    return allGrades;
  };
  
  // Determine if annual calculation option should be shown
  const showAnnualOption = useMemo(() => {
    return selectedSubject ? isSubjectInMultipleSemesters(selectedSubject.name) : false;
  }, [selectedSubject, allSemesters]);
  
  return (
    <Modal
      visible={isVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.calculatorModalContent, { height: '70%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('grades').calculator.title}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Subject Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('grades').calculator.selectSubject}</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {subjects.map((subject, index) => (
                    <React.Fragment key={`subject-option-${index}`}>
                      {index > 0 && (
                        <View style={styles.subjectSeparator} />
                      )}
                      <TouchableOpacity
                        style={[
                          styles.subjectOption,
                          selectedSubject?.name === subject.name && styles.subjectOptionSelected
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
                            selectedSubject?.name === subject.name && styles.subjectOptionTextSelected
                          ]} 
                          numberOfLines={1}
                        >
                          {subject.name}
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </ScrollView>
              </View>
            </View>
            
            {/* Annual vs Current Semester Toggle - only show if subject exists in multiple semesters */}
            {selectedSubject && showAnnualOption && (
              <View style={styles.formGroup}>
                <View style={styles.calculationTypeContainer}>
                  <Text style={styles.label}>
                    {t('grades').calculator.calculationType || "Calculation Type:"}
                  </Text>
                  <View style={styles.calculationToggle}>
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        !isAnnualCalculation && styles.toggleOptionActive
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
                          !isAnnualCalculation && styles.toggleOptionTextActive
                        ]}
                      >
                        {t('grades').calculator.semesterOnly || "Current Semester"}
                      </Text>
                    </TouchableOpacity>
                    
                    <View style={styles.toggleSeparator} />
                    
                    <TouchableOpacity
                      style={[
                        styles.toggleOption,
                        isAnnualCalculation && styles.toggleOptionActive
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
                          isAnnualCalculation && styles.toggleOptionTextActive
                        ]}
                      >
                        {t('grades').calculator.annualAverage || "Annual Average"}
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
                  {isAnnualCalculation 
                    ? (t('grades').calculator.allGrades || "All Grades") 
                    : t('grades').calculator.currentGrades}
                </Text>
                <View style={styles.currentGradesContainer}>
                  {getAllCurrentGrades().length > 0 ? (
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
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <Text style={styles.gradeText}>{grade}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{
                      color: '#8A8A8D',
                      fontSize: 14,
                      textAlign: 'center',
                      padding: 10,
                    }}>
                      {t('grades').calculator.noGrades}
                    </Text>
                  )}
                  
                  <View style={styles.currentAverageContainer}>
                    <Text style={styles.currentAverageLabel}>
                      {t('grades').calculator.currentAverage}:
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
              <Text style={styles.label}>{t('grades').calculator.targetAverage}</Text>
              <TextInput
                style={styles.input}
                value={targetAverage}
                onChangeText={setTargetAverage}
                placeholder="8.50"
                placeholderTextColor="#8A8A8D"
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            
            {/* Calculate Button */}
            <TouchableOpacity
              style={[
                styles.calculateButton,
                (!selectedSubject || !targetAverage) && styles.calculateButtonDisabled
              ]}
              onPress={handleCalculate}
              disabled={!selectedSubject || !targetAverage}
            >
              <Text style={styles.calculateButtonText}>
                {t('grades').calculator.calculate}
              </Text>
            </TouchableOpacity>
            
            {/* Results */}
            {hasCalculated && (
              <Animated.View 
                entering={FadeInUp.springify()}
                style={styles.resultsContainer}
              >
                <Text style={styles.resultsTitle}>
                  {calculatedGrades.length > 0 
                    ? t('grades').calculator.resultsTitle 
                    : t('grades').calculator.noSolution}
                </Text>
                
                {calculatedGrades.length > 0 ? (
                  <View style={styles.gradesGrid}>
                    {calculatedGrades.map((grade, index) => (
                      <View 
                        key={`result-grade-${index}`} 
                        style={{
                          backgroundColor: 'rgba(75, 181, 67, 0.5)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          minWidth: 40,
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <Text style={styles.gradeText}>{grade}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noSolutionText}>
                    {t('grades').calculator.alreadyAchieved}
                  </Text>
                )}
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Main Grades component
const GradesScreen = ({ 
  idnp, 
  studentGrades,
  lastUpdated,
  onRefresh,
  newHighlights
}: { 
  idnp: string, 
  studentGrades: StudentGrades | null,
  lastUpdated: number | null,
  onRefresh: () => Promise<void>,
  newHighlights: NewGradeHighlightsMap
}) => {
  const { t, currentLanguage } = useTranslation();
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [backgroundRefreshStart, setBackgroundRefreshStart] = useState<number | null>(null);
  const [backgroundJustUpdated, setBackgroundJustUpdated] = useState(false);

  // Animated dot opacities
  const dot1 = useSharedValue(0.25);
  const dot2 = useSharedValue(0.25);
  const dot3 = useSharedValue(0.25);

  useEffect(() => {
    if (isBackgroundRefreshing) {
      dot1.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.25, { duration: 600 })), -1, false);
      setTimeout(() => {
        dot2.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.25, { duration: 600 })), -1, false);
      }, 200);
      setTimeout(() => {
        dot3.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.25, { duration: 600 })), -1, false);
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
      setIsBackgroundRefreshing(true);
    }
  }, [idnp]);

  // Helper function to format semester label
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester
      .replace('{{year}}', year.toString())
      .replace('{{semester}}', semesterInYear.toString());
  };

  // Get current semester number based on date
  const currentSemesterNumber = useMemo(() => getCurrentSemester(), []);

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grades');
  const [activeSemesterIndex, setActiveSemesterIndex] = useState(
    studentGrades?.currentGrades
      ? studentGrades.currentGrades.findIndex(s => s.semester === currentSemesterNumber) 
      : 0
  );
  
  // Make sure activeSemesterIndex is valid
  useEffect(() => {
    if (studentGrades?.currentGrades) {
      // Find the index of the current semester
      const currentIndex = studentGrades.currentGrades.findIndex(
        s => s.semester === currentSemesterNumber
      );
      
      // If found, set it as active
      if (currentIndex >= 0) {
        setActiveSemesterIndex(currentIndex);
      }
    }
  }, [studentGrades, currentSemesterNumber]);
  
  // Grade calculator modal state
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  
  // Track expanded semester dropdowns and subjects
  const [expandedSemesters, setExpandedSemesters] = useState<Record<number, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Calculate if data is stale (older than STALE_DATA_DAYS)
  const isDataStale = useMemo(() => {
    if (!lastUpdated) return false;
    
    const now = Date.now();
    const daysDifference = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    
    return daysDifference >= STALE_DATA_DAYS;
  }, [lastUpdated]);

  // Initialize with only the current semester expanded
  useEffect(() => {
    if (studentGrades?.currentGrades?.length) {
      // Create an object with only current semester expanded
      const initialExpandedState: Record<number, boolean> = {};
      studentGrades.currentGrades.forEach(semester => {
        // Only expand the current semester
        initialExpandedState[semester.semester] = semester.semester === currentSemesterNumber;
      });
      setExpandedSemesters(initialExpandedState);
    }
  }, [studentGrades?.currentGrades, currentSemesterNumber]);

  // Listen to background refresh start/end events for anonymous indicator
  useEffect(() => {
    const startListener = DeviceEventEmitter.addListener(GRADES_REFRESH_START_EVENT, () => {
      setIsBackgroundRefreshing(true);
      setBackgroundJustUpdated(false);
      setBackgroundRefreshStart(Date.now());
    });
    const endListener = DeviceEventEmitter.addListener(GRADES_REFRESH_END_EVENT, (payload: any) => {
      setIsBackgroundRefreshing(false);
      setBackgroundRefreshStart(null);
      if (payload?.updated) {
        setBackgroundJustUpdated(true);
        // Fade out the updated state after a short period
        setTimeout(() => setBackgroundJustUpdated(false), 2500);
      }
    });
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

  // Kick off a background indicator when manual refresh invoked
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setIsBackgroundRefreshing(true);
    setBackgroundRefreshStart(Date.now());
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      // Actual end of background refresh will be when new cache event fires; set a safety timeout
      setTimeout(() => {
        if (isBackgroundRefreshing) {
          setIsBackgroundRefreshing(false);
          setBackgroundRefreshStart(null);
        }
      }, 8000);
    }
  }, [onRefresh, refreshing, isBackgroundRefreshing]);

  // Get current semester data
  const currentSemesterData = useMemo(() => {
    if (!studentGrades || studentGrades.currentGrades.length === 0) {
      return null;
    }
    
    // First try to find the current semester based on date
    const currentIndex = studentGrades.currentGrades.findIndex(
      s => s.semester === currentSemesterNumber
    );
    
    if (currentIndex >= 0) {
      return studentGrades.currentGrades[currentIndex];
    }
    
    // Fall back to the active index if current semester not found
    return studentGrades.currentGrades[
      activeSemesterIndex >= 0 && activeSemesterIndex < studentGrades.currentGrades.length 
        ? activeSemesterIndex 
        : 0
    ];
  }, [studentGrades, activeSemesterIndex, currentSemesterNumber]);

  // Calculate average grades for current semester
  const semesterAverage = useMemo(() => {
    if (!currentSemesterData) return null;
    
    const validAverages = currentSemesterData.subjects
      .map(subject => subject.average)
      .filter(avg => avg !== undefined) as number[];
    
    if (validAverages.length === 0) return null;
    
    const sum = validAverages.reduce((acc, val) => acc + val, 0);
    return (sum / validAverages.length).toFixed(2);
  }, [currentSemesterData]);

  // Calculate average for all semesters
  const allSemestersAverages = useMemo(() => {
    if (!studentGrades || studentGrades.currentGrades.length === 0) return [];
    
    return studentGrades.currentGrades.map(semester => {
      const validAverages = semester.subjects
        .map(subject => subject.average)
        .filter(avg => avg !== undefined) as number[];
        
      if (validAverages.length === 0) return null;
      
      const sum = validAverages.reduce((acc, val) => acc + val, 0);
      return {
        semester: semester.semester,
        average: (sum / validAverages.length).toFixed(2)
      };
    }).filter(item => item !== null);
  }, [studentGrades]);
  
  // Style modifier for text components when refreshing
  const textOpacity = { opacity: refreshing ? 0.5 : 1 };
  
  // Format last updated date
  const lastUpdatedFormatted = useMemo(() => {
    if (!lastUpdated) return t('grades').neverUpdated;
    
    const date = new Date(lastUpdated);
    return formatLocalizedDate(date, currentLanguage, true);
  }, [lastUpdated, currentLanguage]);
  
  // Toggle subject expand/collapse
  const toggleSubject = useCallback((subjectName: string, semesterNumber: number) => {
    const key = `${semesterNumber}-${subjectName}`;
    setExpandedSubjects(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // Add haptic feedback when expanding/collapsing
    Haptics.selectionAsync();
  }, []);
  
  // Toggle semester dropdown
  const toggleSemester = useCallback((semesterNumber: number) => {
    setExpandedSemesters(prev => ({
      ...prev,
      [semesterNumber]: !prev[semesterNumber]
    }));
    
    // Add haptic feedback when expanding/collapsing
    Haptics.selectionAsync();
  }, []);

  // If no data, show loading or error
  if (!studentGrades) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>{t('schedule').error}</Text>
        <Text style={styles.errorMessage}>
          {t('schedule').error}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with student info and buttons */}
      <View style={[styles.headerContainer, refreshing && { opacity: 0.7 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.studentName, textOpacity]}>
            {studentGrades.studentInfo.firstName} {studentGrades.studentInfo.name}
          </Text>
          <Text style={[styles.studentDetails, textOpacity]}>
            {studentGrades.studentInfo.group} | {studentGrades.studentInfo.specialization}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {currentSemesterData?.subjects && currentSemesterData.subjects.length > 0 && (
            <TouchableOpacity 
              style={styles.calculatorButton}
              onPress={() => {
                setCalculatorVisible(true);
                Haptics.selectionAsync();
              }}
              disabled={refreshing}
            >
              <MaterialIcons name="calculate" size={22} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <MaterialIcons 
              name="refresh" 
              size={24} 
              color="white" 
              style={[refreshing && styles.refreshingIcon]}
            />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Data staleness warning */}
      {isDataStale && (
        <Animated.View 
          entering={FadeInUp.springify()}
          style={[styles.warningBanner, refreshing && { opacity: 0.5 }]}
        >
          <MaterialIcons name="info-outline" size={24} color="#FFD700" />
          <Text style={[styles.warningText, textOpacity]}>
            {t('grades').lastUpdated} {lastUpdatedFormatted}. {t('grades').dataStale}
          </Text>
        </Animated.View>
      )}
      
      {/* Tab Switcher */}
      <ViewModeSwitcher 
        activeMode={viewMode}
        onModeChange={setViewMode}
      />
      
      {viewMode === 'grades' ? (
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
              <Text style={[styles.averageLabel, textOpacity]}>{t('grades').average}</Text>
              <Text style={[styles.averageValue, textOpacity]}>
                {(allSemestersAverages.reduce((acc, item) => acc + parseFloat(item!.average), 0) / allSemestersAverages.length).toFixed(2)}
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
                  {semester.semester === 1 
                    ? t('grades').semesters.semester.replace('{{semester}}', '1')
                    : semester.semester === 2 
                      ? t('grades').semesters.semester.replace('{{semester}}', '2')
                      : formatSemesterLabel(semester.semester)
                  }
                </Text>
                <View style={styles.semesterHeaderRight}>
                  {/* Display semester average if available */}
                  {allSemestersAverages[index] && (
                    <Text style={[styles.semesterAverageText, textOpacity]}>
                      {t('grades').average}: {allSemestersAverages[index]!.average}
                    </Text>
                  )}
                  <MaterialIcons
                    name={expandedSemesters[semester.semester] ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                    size={24}
                    color="white"
                    style={textOpacity}
                  />
                </View>
              </TouchableOpacity>

              {/* Semester content (subjects) when expanded */}
              {expandedSemesters[semester.semester] && (
                <Animated.View
                  entering={FadeInUp.springify()}
                  style={styles.semesterContent}
                >
                  {/* Semester average and absences */}
                  {allSemestersAverages[index] && (
                    <View style={[styles.semesterAverageCard, refreshing && { opacity: 0.7 }]}>
                      <Text style={[styles.averageLabel, textOpacity]}>{t('grades').average}</Text>
                      <Text style={[styles.averageValue, textOpacity]}>{allSemestersAverages[index]!.average}</Text>
                      
                      {/* Display absences if available */}
                      {semester.absences && (
                        <View style={styles.absencesContainer}>
                          <Text style={[styles.absencesLabel, textOpacity]}>
                            {t('grades').absences}: <Text style={[styles.absencesValue, textOpacity]}>{semester.absences.total}</Text>
                            {' '}({t('grades').unexcused}: <Text style={[styles.absencesUnexcused, textOpacity]}>
                              {semester.absences.unexcused}
                            </Text>)
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
                        expanded={!!expandedSubjects[`${semester.semester}-${subject.name}`]}
                        onToggle={() => toggleSubject(subject.name, semester.semester)}
                        semesterNumber={semester.semester}
                        newGradeIndices={highlight?.gradeIndices}
                        hasNewExam={highlight?.newExam}
                      />
                    );
                  })}
                  
                  {/* Empty state if no subjects */}
                  {semester.subjects.length === 0 && (
                    <Text style={[styles.emptyText, textOpacity]}>
                      {t('grades').subjects.noSubjects.replace('{{semester}}', semester.semester.toString())}
                    </Text>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          ))}

          {/* No data message if no semesters */}
          {studentGrades.currentGrades.length === 0 && (
            <Text style={[styles.emptyText, textOpacity]}>{t('grades').noGrades}</Text>
          )}
          
          {/* Last updated info at the bottom */}
          <Text style={[styles.lastUpdatedText, textOpacity]}>
            {t('grades').lastUpdated}: {lastUpdatedFormatted}
          </Text>
        </ScrollView>
      ) : (
        <ExamsView exams={studentGrades.exams} studentInfo={studentGrades.studentInfo} />
      )}

      {/* Grade Calculator Modal */}
      {currentSemesterData && (
        <GradeCalculatorModal
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
          <ActivityIndicator size="large" color="#2C3DCD" />
          <Text style={styles.refreshingText}>{t('grades').refreshing}</Text>
        </View>
      )}
      {/* Anonymous background refresh indicator (pulsing dots) */}
      {(isBackgroundRefreshing || backgroundJustUpdated) && (
        <View style={styles.backgroundIndicatorWrapper} pointerEvents="none">
          <View style={[styles.backgroundIndicatorPill, backgroundJustUpdated && styles.backgroundIndicatorUpdated]}>
            {!backgroundJustUpdated ? (
              <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, dotStyle1]} />
                <Animated.View style={[styles.dot, dotStyle2]} />
                <Animated.View style={[styles.dot, dotStyle3]} />
              </View>
            ) : (
              <Text style={styles.backgroundUpdatedText}>{t('grades').updatedLabel}</Text>
            )}
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
  const { t, currentLanguage } = useTranslation();

  const [idnp, setIdnp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [responseHtml, setResponseHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  // Prevent multiple initial cache hydrations overwriting fresh data
  const initialLoadDoneRef = useRef(false);
  const [displayGrades, setDisplayGrades] = useState<StudentGrades | null>(null);
  const [newHighlights, setNewHighlights] = useState<NewGradeHighlightsMap>({});
  const [devInjected, setDevInjected] = useState<boolean>(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const initialHydratedRef = useRef(false);
  const prevParsedRef = useRef<StudentGrades | null>(null);
  const lastHandledRefreshRef = useRef(-1);
  const prevResponseRef = useRef<string | null>(null);
  const baseParsedRef = useRef<StudentGrades | null>(null);

  // Helper function to format semester label - added to fix reference error
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester
      .replace('{{year}}', year.toString())
      .replace('{{semester}}', semesterInYear.toString());
  };

  // Load dev injection stage and listen for updates
  // Moved below after recomputeDisplayFromToggle definition

  useEffect(() => {
    // Load stored IDNP and cached grades data
    const loadStoredData = async () => {
      try {
        const savedIdnp = await AsyncStorage.getItem(IDNP_KEY);
        
        if (savedIdnp) {
          setIdnp(savedIdnp);
          
          // Try to load cached grades data (prefer the newer unified service cache if fresher)
          if (!responseHtml) { // Only hydrate if we don't already have data in state
            const legacyJson = await AsyncStorage.getItem(GRADES_DATA_KEY);
            let legacyData: StoredGradesData | null = null;
            if (legacyJson) {
              try { legacyData = JSON.parse(legacyJson); } catch { legacyData = null; }
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
              } else if (newTs === legacyTs && newCached.html !== legacyData.html) {
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
                  JSON.stringify({ html: newCached.html, timestamp: newCached.timestamp || Date.now() })
                );
                if (newCached.timestamp) {
                  await AsyncStorage.setItem(GRADES_TIMESTAMP_KEY, newCached.timestamp.toString());
                }
              } catch { /* silent */ }
            }

            // If we still have no explicit timestamp set (e.g., only legacy html stored earlier), attempt legacy timestamp key
            if (!lastUpdated && !chosenTimestamp) {
              const timestamp = await AsyncStorage.getItem(GRADES_TIMESTAMP_KEY);
              if (timestamp) {
                setLastUpdated(parseInt(timestamp, 10));
              }
            }
          }
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
      }
    };

    // Listen for IDNP clear events and reset state
    const subscription = DeviceEventEmitter.addListener(IDNP_UPDATE_EVENT, (newIdnp: string | null) => {
      setIdnp(newIdnp);
      if (!newIdnp) {
        setResponseHtml('');
        setLastUpdated(null);
        setErrorMessage(null);
        setDisplayGrades(null);
        setNewHighlights({});
        prevParsedRef.current = null;
        prevResponseRef.current = null;
        initialHydratedRef.current = false;
        lastHandledRefreshRef.current = -1;
      }
    });

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
      setRefreshNonce(n => n + 1);
      // Persist new unified cache to legacy keys so future single-source loads don't revert
      try {
        await AsyncStorage.setItem(GRADES_DATA_KEY, JSON.stringify({ html: updated.html, timestamp: updated.timestamp || Date.now() }));
        if (updated.timestamp) {
          await AsyncStorage.setItem(GRADES_TIMESTAMP_KEY, updated.timestamp.toString());
        }
      } catch (_) {}
    });

    return () => {
      subscription.remove();
      unsubscribeGrades();
    };
  }, [idnp]);

  // Re-parse grades when data or refresh marker changes and capture new items
  useEffect(() => {
    if (!responseHtml) return;

    const refreshChanged = responseHtml !== prevResponseRef.current || refreshNonce !== lastHandledRefreshRef.current;
    if (!refreshChanged) return;

    const baseParsed = parseStudentGradesData(responseHtml);
    baseParsedRef.current = baseParsed;

    const displayData = devInjected ? injectRandomGrades(baseParsed) : baseParsed;

    const prevParsed = prevParsedRef.current;

    // First hydration: avoid marking everything new unless devInjected adds items
    if (!initialHydratedRef.current) {
      const initialHighlights = devInjected
        ? computeNewGradeHighlights(baseParsed, displayData)
        : {};

      setDisplayGrades(displayData);
      setNewHighlights(initialHighlights);
      prevParsedRef.current = displayData;
      prevResponseRef.current = responseHtml;
      initialHydratedRef.current = true;
      lastHandledRefreshRef.current = refreshNonce;
      return;
    }

    setDisplayGrades(displayData);
    setNewHighlights(computeNewGradeHighlights(prevParsed, displayData));

    prevParsedRef.current = displayData;
    prevResponseRef.current = responseHtml;
    initialHydratedRef.current = true;
    lastHandledRefreshRef.current = refreshNonce;
  }, [responseHtml, refreshNonce, devInjected]);

  const fetchStudentData = useCallback(async (studentIdnp: string) => {
    // Prevent duplicate requests using ref
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    setIsFetching(true);
    setErrorMessage(null);
    
    try {
      // Fetch student info - this handles both login and info retrieval
      const htmlResponse = await fetchStudentInfo(studentIdnp);
      
      if (!htmlResponse || htmlResponse.trim() === '') {
        throw new Error('Empty response received');
      }
      
      // If we got here, the fetch was successful
      setResponseHtml(htmlResponse);

      // Save the IDNP since it was successful
      await AsyncStorage.setItem(IDNP_KEY, studentIdnp);
      
      // Save the timestamp of the fetch
      const timestamp = Date.now();
      setLastUpdated(timestamp);
      await AsyncStorage.setItem(GRADES_TIMESTAMP_KEY, timestamp.toString());
      
      // Store legacy cache
      await AsyncStorage.setItem(GRADES_DATA_KEY, JSON.stringify({ html: htmlResponse, timestamp }));
      // Also store via new caching layer for consistency & event emission (dedup automatic)
      try { await gradesDataService.store(studentIdnp, htmlResponse); } catch (_) {}

      setRefreshNonce(n => n + 1);
      
      // Notify other components of the IDNP update
      DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, studentIdnp);
      
      // Show success notification
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      // If this was a fresh login attempt, clear the IDNP
      if (!responseHtml) {
        await AsyncStorage.removeItem(IDNP_KEY);
        setIdnp(null);
        setErrorMessage(t('grades').networkError);
      } else {
        // If we have cached data, just show an error toast but keep the cached data
        setErrorMessage(`${t('grades').networkErrorCache} ${formatLocalizedDate(new Date(lastUpdated || 0), currentLanguage, false)}`);
        
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
  }, [responseHtml, lastUpdated, t]);

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

  const handleSaveIdnp = useCallback(async (newIdnp: string, shouldSave: boolean) => {
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
  }, [fetchStudentData]);

  const effectiveGrades = useMemo(() => {
    if (displayGrades) return displayGrades;
    if (!responseHtml) return null;
    try {
      return parseStudentGradesData(responseHtml);
    } catch (err) {
      return null;
    }
  }, [displayGrades, responseHtml]);

  const recomputeDisplayFromToggle = useCallback((active: boolean) => {
    const base = baseParsedRef.current || (responseHtml ? parseStudentGradesData(responseHtml) : null);
    if (!base) return;
    const nextDisplay = active ? injectRandomGrades(base) : base;
    const prev = prevParsedRef.current;
    setDisplayGrades(nextDisplay);
    setNewHighlights(prev ? computeNewGradeHighlights(prev, nextDisplay) : {});
    prevParsedRef.current = nextDisplay;
  }, [responseHtml]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEV_GRADE_TOGGLE_KEY);
        if (stored === 'true') {
          setDevInjected(true);
          recomputeDisplayFromToggle(true);
        }
      } catch (err) {
        // ignore
      }
    })();

    const toggleListener = DeviceEventEmitter.addListener(DEV_GRADE_TOGGLE_EVENT, (active: boolean) => {
      setDevInjected(active);
      recomputeDisplayFromToggle(active);
    });

    return () => {
      toggleListener.remove();
    };
  }, [recomputeDisplayFromToggle]);

  // Handle initial fetch of data if IDNP is already set but no cached data
  useEffect(() => {
    // When IDNP is set but no data is loaded yet, and we're not already fetching
    if (idnp && !responseHtml && !fetchingRef.current && !errorMessage) {
      // Only auto-fetch if we don't have any cached data
      AsyncStorage.getItem(GRADES_DATA_KEY).then(cached => {
        if (!cached) {
          fetchStudentData(idnp);
        }
      });
    }
  // Intentionally omitting fetchStudentData from dependencies to prevent re-fetch on responseHtml change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idnp, responseHtml, errorMessage]);

  if (isLoading && !responseHtml) {
    return <LoadingScreen message={t('schedule').loading} />;
  }

  if (isFetching && !responseHtml) {
    return <LoadingScreen message={t('grades').semesters.connecting} />;
  }

  // Show IDNP screen if no IDNP or there was an error with no cached data
  if ((!idnp || (errorMessage && !responseHtml))) {
    return <IDNPScreen 
      onSave={handleSaveIdnp} 
      errorMessage={errorMessage || undefined} 
      isSubmitting={isFetching}
    />;
  }

  // If we have IDNP and response HTML, show the grades screen
  return (
    <>
      {errorMessage && responseHtml && (
        <Animated.View 
          entering={FadeInUp.springify().delay(100)}
          style={[styles.errorNotification]}
        >
          <MaterialIcons name="error-outline" size={24} color="#FF6B6B" />
          <Text style={styles.errorNotificationText}>{errorMessage}</Text>
        </Animated.View>
      )}
      <GradesScreen 
        idnp={idnp!}
        studentGrades={effectiveGrades}
        lastUpdated={lastUpdated}
        newHighlights={newHighlights}
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
    backgroundColor: '#141414',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  addButton: {
    backgroundColor: '#2C3DCD',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  averageCard: {
    backgroundColor: '#1A1A1A',
    margin: 20,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  averageLabel: {
    color: '#8A8A8D',
    fontSize: 16,
    marginBottom: 8,
  },
  averageValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  sortContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sortButton: {
    flex: 1,
    backgroundColor: '#232433',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#2C3DCD',
  },
  sortButtonText: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  sortButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  list: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100, // Extra padding at the bottom for better scrolling
  },
  gradeCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientCard: {
    padding: 16,
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subject: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  gradeValue: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  gradeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  category: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  date: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  notes: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  emptyText: {
    color: '#8A8A8D',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    width: '100%',
  },
  calculatorModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '70%',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20, // Extra padding for iOS devices
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  form: {
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#232433',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#2C3DCD',
  },
  categoryButtonText: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  dateButton: {
    backgroundColor: '#232433',
    borderRadius: 12,
    padding: 16,
  },
  dateButtonText: {
    color: 'white',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  idnpContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 20,
  },
  idnpContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  idnpTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  idnpDescription: {
    color: '#8A8A8D',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  idnpInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 16,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  disclaimerText: {
    color: '#8A8A8D',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  submitButtonDisabled: {
    backgroundColor: '#8A8A8D',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  loadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232433',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  // Error styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 20,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorMessage: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  idnpInputError: {
    borderColor: '#FF6B6B',
    borderWidth: 1,
  },
  // New styles for semester dropdown
  semesterDropdownContainer: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  semesterDropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  semesterDropdownButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  semesterDropdownMenu: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginTop: 8,
    padding: 8,
  },
  semesterDropdownItem: {
    padding: 12,
    borderRadius: 8,
  },
  semesterDropdownItemActive: {
    backgroundColor: '#2C3DCD',
  },
  semesterDropdownItemText: {
    color: 'white',
    fontSize: 16,
  },
  semesterDropdownItemTextActive: {
    fontWeight: '600',
  },
  // New styles for subject cards
  subjectCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  subjectNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  subjectName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  newBadge: {
    backgroundColor: 'rgba(255, 209, 102, 0.15)',
    borderColor: '#FFD166',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 0,
    marginRight: 8,
    alignSelf: 'center',
  },
  newBadgeText: {
    color: '#FFD166',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subjectHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  averageGrade: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  gradesContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
  },
  gradesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeItem: {
    backgroundColor: 'rgba(44, 61, 205, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
    position: 'relative',
  },
  newGradeItem: {
    borderWidth: 1.5,
    borderColor: '#FFD166',
    backgroundColor: 'rgba(255, 209, 102, 0.18)',
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 0,
  },
  gradeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  gradePip: {
    position: 'absolute',
    top: 4,
    right: 6,
    color: '#FFD166',
    fontSize: 12,
    fontWeight: '700',
  },
  // New styles for exams view
  examsList: {
    flex: 1,
    padding: 20,
    paddingBottom: 100,
  },
  examTypeSection: {
    marginBottom: 24,
  },
  examTypeTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  examCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  examSubject: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  examDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examSemester: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  examGrade: {
    color: '#4D96FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // View mode switcher styles
  viewModeSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginVertical: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
  },
  modeTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  activeModeTab: {
    backgroundColor: '#2C3DCD',
  },
  modeTabText: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  activeModeTabText: {
    color: 'white',
    fontWeight: '600',
  },
  // Student info header styles
  studentInfoHeader: {
    padding: 20,
    paddingBottom: 12,
  },
  studentName: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  studentDetails: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 4,
  },
  // Absences styles
  absencesContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  absencesLabel: {
    color: '#8A8A8D',
    fontSize: 14,
  },
  absencesValue: {
    fontWeight: 'bold',
    color: 'white',
  },
  absencesUnexcused: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  subjectHeaderEmpty: {
    opacity: 0.5,
  },
  gradeItemFailing: {
    backgroundColor: 'rgba(255, 107, 107, 0.5)',
  },
  failingGrade: {
    color: '#FF6B6B',
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  semesterSection: {
    marginBottom: 16,
  },
  semesterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 20,
  },
  semesterTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  semesterHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  semesterAverageText: {
    color: 'white',
    fontSize: 14,
    marginRight: 8,
  },
  semesterContent: {
    marginTop: 8,
    marginHorizontal: 20,
  },
  semesterAverageCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  lastUpdatedText: {
    color: '#8A8A8D',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  refreshButton: {
    backgroundColor: '#2C3DCD',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  refreshingIcon: {
    transform: [{ rotate: '45deg' }],
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  errorNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1f2c',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 60,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorNotificationText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingText: {
    color: 'white',
    marginTop: 12,
    textAlign: 'center',
  },
  bottomRefreshBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  bottomRefreshBarTrack: {
    width: '60%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  bottomRefreshBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '40%',
    backgroundColor: '#2C3DCD',
    borderRadius: 2,
  },
  bottomRefreshBarText: {
    fontSize: 12,
    color: '#8A8A8D'
  },
  examHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  upcomingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  upcomingIndicatorText: {
    color: '#FFD700',
    fontSize: 12,
    marginLeft: 4,
  },
  upcomingExamGrade: {
    color: '#FFD700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141414',
    padding: 20,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#232433',
    borderRadius: 12,
    padding: 8,
  },
  subjectOption: {
    padding: 12,
    borderRadius: 8,
  },
  subjectOptionSelected: {
    backgroundColor: '#2C3DCD',
  },
  subjectOptionText: {
    color: 'white',
    fontSize: 16,
  },
  subjectOptionTextSelected: {
    fontWeight: '600',
  },
  currentGradesContainer: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#232433',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  calculatorGradeItem: {
    backgroundColor: 'rgba(44, 61, 205, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
    marginBottom: 8,
  },
  currentAverageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentAverageLabel: {
    color: 'white',
    fontSize: 16,
  },
  currentAverageValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  calculateButton: {
    backgroundColor: '#2C3DCD',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  calculateButtonDisabled: {
    backgroundColor: '#8A8A8D',
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#232433',
    borderRadius: 12,
  },
  resultsTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  resultGradeItem: {
    backgroundColor: 'rgba(75, 181, 67, 0.5)',
  },
  noGradesText: {
    color: '#8A8A8D',
    fontSize: 14,
    textAlign: 'center',
    padding: 10,
  },
  noSolutionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  calculatorButton: {
    backgroundColor: '#2C3DCD',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#232433',
    marginHorizontal: 5,
    alignSelf: 'center',
  },
  calculationTypeContainer: {
    flexDirection: 'column',
    marginBottom: 10,
  },
  calculationToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#232433',
  },
  toggleOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#2C3DCD',
  },
  toggleOptionText: {
    color: '#8A8A8D',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  toggleSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#232433',
    marginHorizontal: 5,
    alignSelf: 'center',
  },
  // Anonymous background refresh indicator
  backgroundIndicatorWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  backgroundIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 70,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2C3DCD',
    opacity: 0.25,
  },
  dotDelay1: {},
  dotDelay2: {},
  backgroundIndicatorUpdated: {
    backgroundColor: 'rgba(44, 205, 93, 0.15)',
  },
  backgroundUpdatedText: {
    color: '#ACEFBF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  averageSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  averagePillPrimary: {
    flexGrow: 1,
    backgroundColor: 'rgba(44, 61, 205, 0.2)',
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  averagePillSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    minWidth: 140,
  },
  averagePillLabel: {
    color: '#8A8A8D',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  averagePillValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  averagePillMeta: {
    color: '#B7C6FF',
    fontSize: 12,
    marginTop: 4,
  },
});