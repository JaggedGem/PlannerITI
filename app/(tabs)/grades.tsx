import { StyleSheet, View, Text, TouchableOpacity, FlatList, RefreshControl, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, DeviceEventEmitter, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from '@/hooks/useTranslation';
import React from 'react';
import { 
  fetchStudentInfo, 
  parseStudentGradesData, 
  StudentGrades, 
  StudentInfo,
  SemesterGrades, 
  GradeSubject,
  Exam
} from '@/services/gradesService';

// Types for local grades
type GradeCategory = 'exam' | 'test' | 'homework' | 'project' | 'other';
type SortOption = 'date' | 'grade' | 'category';
type ViewMode = 'grades' | 'exams';

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
const IDNP_UPDATE_EVENT = 'idnp_updated';

// Number of days before data is considered stale
const STALE_DATA_DAYS = 7;

// Interface for storing grades data with timestamp
interface StoredGradesData {
  html: string;
  timestamp: number;
}

/**
 * Determine the current semester based on the date
 * 1st semester: September 1 - December 19
 * 2nd semester: December 20 - August 31
 */
const getCurrentSemester = (): number => {
  const currentDate = new Date();
  const month = currentDate.getMonth(); // 0-11 (Jan-Dec)
  const day = currentDate.getDate();
  
  // First semester: Sept 1 - Dec 19
  if ((month === 8 && day >= 1) || // September
      month === 9 || // October
      month === 10 || // November
      (month === 11 && day < 20)) { // December 1-19
    return 1;
  } else {
    // Second semester: Dec 20 - Aug 31
    return 2;
  }
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
  semesterNumber // Add semester number to make subjects unique across semesters
}: { 
  subject: GradeSubject, 
  expanded: boolean,
  onToggle: () => void,
  semesterNumber: number 
}) => {
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
        <Text style={styles.subjectName}>{subject.name}</Text>
        <View style={styles.subjectHeaderRight}>
          {subject.displayedAverage && (
            <Text style={[
              styles.averageGrade,
              parseFloat(subject.displayedAverage) < 5 && styles.failingGrade
            ]}>
              {subject.displayedAverage}
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
          <View style={styles.gradesGrid}>
            {subject.grades.map((grade, index) => {
              const gradeColor = getGradeColor(grade);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.gradeItem, 
                    { backgroundColor: gradeColor }
                  ]}
                >
                  <Text style={styles.gradeText}>{grade}</Text>
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
  exams
}: { 
  exams: Exam[] 
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
  
  // Add state for selected semester - initialize with current semester if it exists in the data
  const [selectedSemester, setSelectedSemester] = useState<number | null>(() => {
    // Check if the current semester exists in the exams data
    const hasSemester = exams.some(exam => exam.semester === currentSemesterNumber);
    return hasSemester ? currentSemesterNumber : null;
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

// Main Grades component
const GradesScreen = ({ 
  idnp, 
  responseHtml, 
  lastUpdated,
  onRefresh 
}: { 
  idnp: string, 
  responseHtml: string,
  lastUpdated: number | null,
  onRefresh: () => Promise<void>
}) => {
  const { t } = useTranslation();

  // Helper function to format semester label
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester
      .replace('{{year}}', year.toString())
      .replace('{{semester}}', semesterInYear.toString());
  };

  // Parse HTML data
  const studentGrades = useMemo(() => {
    try {
      const result = parseStudentGradesData(responseHtml);
      return result;
    } catch (error) {
      return null;
    }
  }, [responseHtml]);
  
  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grades');
  const [activeSemesterIndex, setActiveSemesterIndex] = useState(
    studentGrades?.currentSemester 
      ? studentGrades.currentGrades.findIndex(s => s.semester === studentGrades.currentSemester) 
      : 0
  );
  
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
      // Get the current semester based on date
      const currentSemester = getCurrentSemester();
      
      // Create an object with only current semester expanded
      const initialExpandedState: Record<number, boolean> = {};
      studentGrades.currentGrades.forEach(semester => {
        // Only expand the current semester
        initialExpandedState[semester.semester] = semester.semester === currentSemester;
      });
      setExpandedSemesters(initialExpandedState);
    }
  }, [studentGrades?.currentGrades]);

  // Get current semester data
  const currentSemesterData = useMemo(() => {
    if (!studentGrades || studentGrades.currentGrades.length === 0) {
      return null;
    }
    
    return studentGrades.currentGrades[
      activeSemesterIndex >= 0 && activeSemesterIndex < studentGrades.currentGrades.length 
        ? activeSemesterIndex 
        : 0
    ];
  }, [studentGrades, activeSemesterIndex]);

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

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);
  
  // Style modifier for text components when refreshing
  const textOpacity = { opacity: refreshing ? 0.5 : 1 };
  
  // Format last updated date
  const lastUpdatedFormatted = useMemo(() => {
    if (!lastUpdated) return 'Never';
    
    const date = new Date(lastUpdated);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, [lastUpdated]);
  
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
    <SafeAreaView style={styles.container}>
      {/* Header with student info and refresh button */}
      <View style={[styles.headerContainer, refreshing && { opacity: 0.7 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.studentName, textOpacity]}>
            {studentGrades.studentInfo.firstName} {studentGrades.studentInfo.name}
          </Text>
          <Text style={[styles.studentDetails, textOpacity]}>
            {studentGrades.studentInfo.group} | {studentGrades.studentInfo.specialization}
          </Text>
        </View>
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
                  {semester.subjects.map((subject, subjectIndex) => (
                    <SubjectCard
                      key={`subject-${semester.semester}-${subject.name}-${subjectIndex}`}
                      subject={subject}
                      expanded={!!expandedSubjects[`${semester.semester}-${subject.name}`]}
                      onToggle={() => toggleSubject(subject.name, semester.semester)}
                      semesterNumber={semester.semester}
                    />
                  ))}
                  
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
        <ExamsView exams={studentGrades.exams} />
      )}

      {/* Overlay the content with a semi-transparent loading indicator when refreshing */}
      {refreshing && (
        <View style={styles.refreshOverlay}>
          <ActivityIndicator size="large" color="#2C3DCD" />
          <Text style={styles.refreshingText}>{t('grades').refreshing}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// Main container component to handle state and loading
export default function Grades() {
  // Fix: Use a ref to prevent duplicate API requests
  const fetchingRef = useRef(false);
  const { t } = useTranslation();

  const [idnp, setIdnp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [responseHtml, setResponseHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Helper function to format semester label - added to fix reference error
  const formatSemesterLabel = (semesterNumber: number) => {
    const year = Math.ceil(semesterNumber / 2);
    const semesterInYear = semesterNumber % 2 === 0 ? 2 : 1;
    return t('grades').semesters.yearSemester
      .replace('{{year}}', year.toString())
      .replace('{{semester}}', semesterInYear.toString());
  };

  useEffect(() => {
    // Load stored IDNP and cached grades data
    const loadStoredData = async () => {
      try {
        const savedIdnp = await AsyncStorage.getItem(IDNP_KEY);
        
        if (savedIdnp) {
          setIdnp(savedIdnp);
          
          // Try to load cached grades data
          const gradesDataJson = await AsyncStorage.getItem(GRADES_DATA_KEY);
          if (gradesDataJson) {
            const gradesData: StoredGradesData = JSON.parse(gradesDataJson);
            setResponseHtml(gradesData.html);
            setLastUpdated(gradesData.timestamp);
          }
          
          // Load last updated timestamp
          const timestamp = await AsyncStorage.getItem(GRADES_TIMESTAMP_KEY);
          if (timestamp) {
            setLastUpdated(parseInt(timestamp, 10));
          }
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setIsLoading(false);
      }
    };

    // Listen for IDNP clear events and reset state
    const subscription = DeviceEventEmitter.addListener(IDNP_UPDATE_EVENT, (newIdnp: string | null) => {
      setIdnp(newIdnp);
      if (!newIdnp) {
        setResponseHtml('');
        setLastUpdated(null);
      }
    });

    loadStoredData();

    return () => {
      subscription.remove();
    };
  }, []);

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
      
      // Store the grades HTML and timestamp for offline access
      const gradesData: StoredGradesData = {
        html: htmlResponse,
        timestamp: timestamp
      };
      await AsyncStorage.setItem(GRADES_DATA_KEY, JSON.stringify(gradesData));
      
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
        setErrorMessage(`${t('grades').networkErrorCache} ${new Date(lastUpdated || 0).toLocaleDateString()}`);
        
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
  }, [responseHtml, lastUpdated]);

  const handleSaveIdnp = useCallback((newIdnp: string, shouldSave: boolean) => {
    // Don't proceed if already fetching
    if (fetchingRef.current) return;
    
    // Set the IDNP first to show loading screen
    setIdnp(newIdnp);
    
    // Then fetch the data
    fetchStudentData(newIdnp);
  }, [fetchStudentData]);

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
  }, []);

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

  // Error notification at the top if there was a network error but we're showing cached data
  const errorNotification = errorMessage && responseHtml ? (
    <ErrorNotification message={errorMessage} />
  ) : null;

  // If we have IDNP and response HTML, show the grades screen
  return (
    <>
      {errorNotification}
      <GradesScreen 
        idnp={idnp!}
        responseHtml={responseHtml} 
        lastUpdated={lastUpdated}
        onRefresh={async () => {
          if (idnp) {
            await fetchStudentData(idnp);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b26',
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
    backgroundColor: '#232433',
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
  },
  modalContent: {
    backgroundColor: '#1a1b26',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
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
  },
  input: {
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#1a1b26',
    padding: 20,
  },
  idnpContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#232433',
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
    backgroundColor: '#1a1b26',
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
    backgroundColor: '#1a1b26',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    textAlign: 'center',
  },
  loadingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232433',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  // Error styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1b26',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
  subjectName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  subjectHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  averageGrade: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
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
  },
  gradeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
    backgroundColor: '#232433',
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
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
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
    backgroundColor: '#1a1b26',
    padding: 20,
  },
});