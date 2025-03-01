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

const IDNP_KEY = '@planner_idnp';
const IDNP_UPDATE_EVENT = 'idnp_updated';

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
      setError('IDNP must be exactly 13 digits');
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
              Connecting to the CEITI server. This might take some time, please be patient...
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
            {isSubmitting ? 'Connecting...' : t('grades').idnp.continue}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// Loading screen component
const LoadingScreen = ({ message = 'Loading...' }: { message?: string }) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2C3DCD" />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

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

  const toggleDropdown = () => {
    setIsOpen(prev => !prev);
    Haptics.selectionAsync();
  };

  const selectSemester = (index: number) => {
    onSemesterChange(index);
    setIsOpen(false);
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.semesterDropdownContainer}>
      <TouchableOpacity
        style={styles.semesterDropdownButton}
        onPress={toggleDropdown}
      >
        <Text style={styles.semesterDropdownButtonText}>
          {`Semester ${semesters[activeSemester]?.semester || 'I'}`}
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
                {`Semester ${semester.semester}`}
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
  onToggle 
}: { 
  subject: GradeSubject, 
  expanded: boolean,
  onToggle: () => void 
}) => {
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
          <Text style={styles.averageGrade}>
            {subject.displayedAverage || 
             (subject.average ? subject.average.toFixed(2) : "-")}
          </Text>
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
            {subject.grades.map((grade, index) => (
              <View 
                key={index} 
                style={[
                  styles.gradeItem, 
                  !isNaN(parseFloat(grade.replace(',', '.'))) && 
                  parseFloat(grade.replace(',', '.')) < 5 && 
                  styles.gradeItemFailing
                ]}
              >
                <Text style={styles.gradeText}>{grade}</Text>
              </View>
            ))}
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
  // Add state for selected semester
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Get unique semesters from exams
  const semesters = useMemo(() => {
    const uniqueSemesters = Array.from(
      new Set(exams.map(exam => exam.semester))
    ).sort((a, b) => a - b);
    
    return uniqueSemesters;
  }, [exams]);

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

  if (exams.length === 0) {
    return <Text style={styles.emptyText}>No exams data available</Text>;
  }

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
              ? `Semester ${selectedSemester}` 
              : "All Semesters"}
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
                All Semesters
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
                  {`Semester ${semester}`}
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
                <Text style={styles.examSubject}>{exam.name}</Text>
                <View style={styles.examDetails}>
                  <Text style={styles.examSemester}>Semester {exam.semester}</Text>
                  <Text style={styles.examGrade}>{exam.grade}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        ))}
        
        {Object.keys(examsByType).length === 0 && (
          <Text style={styles.emptyText}>
            {selectedSemester !== null 
              ? `No exams for Semester ${selectedSemester}` 
              : "No exams data available"}
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
          {t('grades').categories.exam}s
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

// Main Grades component
const GradesScreen = ({ idnp, responseHtml }: { idnp: string, responseHtml: string }) => {
  const { t } = useTranslation();

  // Parse HTML data
  const studentGrades = useMemo(() => {
    try {
      console.log("Attempting to parse HTML of length:", responseHtml?.length);
      const result = parseStudentGradesData(responseHtml);
      console.log("Successfully parsed student grades data:", 
        result?.studentInfo?.firstName, 
        result?.studentInfo?.name,
        "Semesters:", result?.currentGrades?.length
      );
      return result;
    } catch (error) {
      console.error("Error parsing grades data in component:", error);
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
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Log when component renders
  console.log("GradesScreen rendering", 
    "Has data:", !!studentGrades,
    "View mode:", viewMode, 
    "Active semester:", activeSemesterIndex
  );

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

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Re-fetch data could be implemented here
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);
  
  // Toggle subject expand/collapse
  const toggleSubject = useCallback((subjectName: string) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectName]: !prev[subjectName]
    }));
    
    // Add haptic feedback when expanding/collapsing
    Haptics.selectionAsync();
  }, []);

  // If no data, show loading or error
  if (!studentGrades) {
    console.log("No student grades data available, showing error screen");
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorMessage}>
          Unable to parse the student data. Please try again later.
        </Text>
      </View>
    );
  }

  // Log student info
  console.log("Rendering with student data:", 
    studentGrades.studentInfo.firstName,
    studentGrades.studentInfo.name,
    "Subjects:", currentSemesterData?.subjects?.length || 0
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Student Info */}
      <StudentInfoHeader studentInfo={studentGrades.studentInfo} />
      
      {/* Tab Switcher */}
      <ViewModeSwitcher 
        activeMode={viewMode}
        onModeChange={setViewMode}
      />
      
      {viewMode === 'grades' ? (
        <>
          {/* Semester Dropdown */}
          {studentGrades.currentGrades.length > 1 && (
            <SemesterDropdown
              semesters={studentGrades.currentGrades}
              activeSemester={activeSemesterIndex}
              onSemesterChange={setActiveSemesterIndex}
            />
          )}

          {/* Average Grade Card */}
          {semesterAverage && (
            <Animated.View
              entering={FadeInUp.springify()}
              style={styles.averageCard}
            >
              <Text style={styles.averageLabel}>Semester Average</Text>
              <Text style={styles.averageValue}>{semesterAverage}</Text>
              
              {currentSemesterData?.absences && (
                <View style={styles.absencesContainer}>
                  <Text style={styles.absencesLabel}>
                    Absences: <Text style={styles.absencesValue}>{currentSemesterData.absences.total}</Text>
                    {' '}(Unexcused: <Text style={styles.absencesUnexcused}>
                      {currentSemesterData.absences.unexcused}
                    </Text>)
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Subjects List */}
          <FlatList
            data={currentSemesterData?.subjects || []}
            renderItem={({ item, index }) => (
              <Animated.View
                entering={FadeInUp.delay(index * 100).springify()}
              >
                <SubjectCard
                  subject={item}
                  expanded={!!expandedSubjects[item.name]}
                  onToggle={() => toggleSubject(item.name)}
                />
              </Animated.View>
            )}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#2C3DCD"
              />
            }
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>No grades data available</Text>
            )}
          />
        </>
      ) : (
        <ExamsView exams={studentGrades.exams} />
      )}
    </SafeAreaView>
  );
};

// Main container component to handle state and loading
export default function Grades() {
  // Fix: Use a ref to prevent duplicate API requests
  const fetchingRef = useRef(false);

  const [idnp, setIdnp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [responseHtml, setResponseHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only load stored IDNP, but don't fetch data automatically
    const loadIdnp = async () => {
      try {
        const savedIdnp = await AsyncStorage.getItem(IDNP_KEY);
        if (savedIdnp) {
          setIdnp(savedIdnp);
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
      }
    });

    loadIdnp();

    return () => {
      subscription.remove();
    };
  }, []);

  const fetchStudentData = useCallback(async (studentIdnp: string) => {
    // Prevent duplicate requests using ref
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    setIsFetching(true);
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Clear any previous response
      setResponseHtml('');
      
      console.log("Fetching student info for IDNP:", studentIdnp);
      // Fetch student info - this handles both login and info retrieval
      const htmlResponse = await fetchStudentInfo(studentIdnp);
      
      if (!htmlResponse || htmlResponse.trim() === '') {
        console.error("Received empty HTML response");
        throw new Error('Empty response received');
      }
      
      console.log("Received HTML response of length:", htmlResponse.length);
      // If we got here, the fetch was successful
      setResponseHtml(htmlResponse);
      console.log("Set response HTML state:", htmlResponse.substring(0, 100) + "...");

      // Save the IDNP since it was successful
      await AsyncStorage.setItem(IDNP_KEY, studentIdnp);
      
      // Notify other components of the IDNP update
      DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, studentIdnp);
      
    } catch (error) {
      console.error("Error fetching student data:", error);
      // Clear the IDNP and show error
      await AsyncStorage.removeItem(IDNP_KEY);
      setIdnp(null);
      setErrorMessage('Unable to retrieve data. Please check your IDNP and try again.');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
      fetchingRef.current = false;
    }
  }, []);

  const handleSaveIdnp = useCallback((newIdnp: string, shouldSave: boolean) => {
    // Don't proceed if already fetching
    if (fetchingRef.current) return;
    
    // Set the IDNP first to show loading screen
    setIdnp(newIdnp);
    
    // Then fetch the data
    fetchStudentData(newIdnp);
  }, [fetchStudentData]);

  // Handle initial fetch of data if IDNP is already set
  useEffect(() => {
    // When idnp changes from null to a value and there's no HTML loaded yet,
    // fetch the data, but only once
    if (idnp && !responseHtml && !fetchingRef.current && !errorMessage) {
      fetchStudentData(idnp);
    }
  }, [idnp, responseHtml, errorMessage, fetchStudentData]);

  if (isLoading && isFetching) {
    return <LoadingScreen message="Connecting to CEITI server. This might take some time, please be patient..." />;
  }

  // Show IDNP screen if no IDNP or there was an error
  if (!idnp || errorMessage) {
    return <IDNPScreen 
      onSave={handleSaveIdnp} 
      errorMessage={errorMessage || undefined} 
      isSubmitting={isFetching}
    />;
  }

  // If we have IDNP and response HTML, show the grades screen
  return <GradesScreen idnp={idnp} responseHtml={responseHtml} />;
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
});