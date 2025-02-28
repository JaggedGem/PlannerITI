import { StyleSheet, View, Text, TouchableOpacity, FlatList, RefreshControl, Modal, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator, DeviceEventEmitter } from 'react-native';
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
import { WebView } from 'react-native-webview';
import { fetchStudentInfo } from '@/services/gradesService';

// Types for grades
type GradeCategory = 'exam' | 'test' | 'homework' | 'project' | 'other';
type SortOption = 'date' | 'grade' | 'category';

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

// HTML Response component
const HtmlResponseView = ({ html }: { html: string }) => (
  <View style={styles.htmlContainer}>
    <WebView
      source={{ html }}
      style={styles.webView}
    />
  </View>
);

// Main Grades component
const GradesScreen = ({ idnp, responseHtml }: { idnp: string, responseHtml: string }) => {
  const { t } = useTranslation();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  
  // Form state
  const [subject, setSubject] = useState('');
  const [gradeValue, setGradeValue] = useState('');
  const [category, setCategory] = useState<GradeCategory>('test');
  const [date, setDate] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Calculate average grade
  const average = useMemo(() => {
    if (grades.length === 0) return 0;
    const sum = grades.reduce((acc, grade) => acc + grade.value, 0);
    return (sum / grades.length).toFixed(2);
  }, [grades]);

  // Get color for category
  const getCategoryColor = (category: GradeCategory): [string, string] => {
    switch (category) {
      case 'exam':
        return ['#FF6B6B', '#FF8787'];
      case 'test':
        return ['#4D96FF', '#6BA6FF'];
      case 'homework':
        return ['#6BCB77', '#82D98C'];
      case 'project':
        return ['#9B89B3', '#B39ECC'];
      default:
        return ['#FFB562', '#FFCC8B'];
    }
  };

  // Sort grades
  const sortedGrades = useMemo(() => {
    return [...grades].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.date.getTime() - a.date.getTime();
        case 'grade':
          return b.value - a.value;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return 0;
      }
    });
  }, [grades, sortBy]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Add API call here to fetch grades
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setSubject('');
    setGradeValue('');
    setCategory('test');
    setDate(new Date());
    setNotes('');
    setEditingGrade(null);
  }, []);

  // Handle save grade
  const handleSaveGrade = useCallback(() => {
    if (!subject || !gradeValue) return;

    const gradeData: Grade = {
      id: editingGrade?.id || Date.now().toString(),
      subject,
      value: parseFloat(gradeValue),
      category,
      date,
      notes: notes.trim() || undefined,
    };

    if (editingGrade) {
      setGrades(prev => prev.map(g => g.id === editingGrade.id ? gradeData : g));
    } else {
      setGrades(prev => [...prev, gradeData]);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAddModal(false);
    resetForm();
  }, [subject, gradeValue, category, date, notes, editingGrade]);

  // Handle edit grade
  const handleEditGrade = useCallback((grade: Grade) => {
    setEditingGrade(grade);
    setSubject(grade.subject);
    setGradeValue(grade.value.toString());
    setCategory(grade.category);
    setDate(grade.date);
    setNotes(grade.notes || '');
    setShowAddModal(true);
  }, []);

  // Handle delete grade
  const handleDeleteGrade = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setGrades(prev => prev.filter(g => g.id !== id));
  }, []);

  // Render grade item
  const renderGradeItem = useCallback(({ item, index }: { item: Grade, index: number }) => {
    const colors = getCategoryColor(item.category);
    
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 100).springify()}
        layout={Layout.springify()}
        style={styles.gradeCard}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={styles.gradeHeader}>
            <Text style={styles.subject}>{item.subject}</Text>
            <Text style={styles.gradeValue}>{item.value}</Text>
          </View>
          
          <View style={styles.gradeDetails}>
            <Text style={styles.category}>
              {t('grades').categories[item.category]}
            </Text>
            <Text style={styles.date}>
              {item.date.toLocaleDateString()}
            </Text>
          </View>

          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => handleEditGrade(item)}
              style={styles.actionButton}
            >
              <MaterialIcons name="edit" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteGrade(item.id)}
              style={styles.actionButton}
            >
              <MaterialIcons name="delete" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  }, [t, handleEditGrade, handleDeleteGrade]);

  return (
    <SafeAreaView style={styles.container}>
      {/* HTML Response on top */}
      <HtmlResponseView html={responseHtml} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('grades').title}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Average Grade Card */}
      <Animated.View
        entering={FadeInUp.springify()}
        style={styles.averageCard}
      >
        <Text style={styles.averageLabel}>{t('grades').average}</Text>
        <Text style={styles.averageValue}>{average}</Text>
      </Animated.View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        {(['date', 'grade', 'category'] as SortOption[]).map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.sortButton,
              sortBy === option && styles.sortButtonActive
            ]}
            onPress={() => setSortBy(option)}
          >
            <Text style={[
              styles.sortButtonText,
              sortBy === option && styles.sortButtonTextActive
            ]}>
              {t('grades').sortOptions[option]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grades List */}
      <FlatList
        data={sortedGrades}
        renderItem={renderGradeItem}
        keyExtractor={item => item.id}
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
          <Text style={styles.emptyText}>{t('grades').noGrades}</Text>
        )}
      />

      {/* Add/Edit Grade Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingGrade ? t('grades').edit : t('grades').add}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {/* Subject Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('grades').form.subject}</Text>
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder={t('grades').form.subject}
                  placeholderTextColor="#8A8A8D"
                />
              </View>

              {/* Grade Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('grades').form.grade}</Text>
                <TextInput
                  style={styles.input}
                  value={gradeValue}
                  onChangeText={setGradeValue}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor="#8A8A8D"
                />
              </View>

              {/* Category Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('grades').form.category}</Text>
                <View style={styles.categoryContainer}>
                  {(['exam', 'test', 'homework', 'project', 'other'] as GradeCategory[]).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryButton,
                        category === cat && styles.categoryButtonActive
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text style={[
                        styles.categoryButtonText,
                        category === cat && styles.categoryButtonTextActive
                      ]}>
                        {t('grades').categories[cat]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Selection */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('grades').form.date}</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {date.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Notes Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('grades').form.notes}</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('grades').form.notes}
                  placeholderTextColor="#8A8A8D"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveGrade}
              >
                <Text style={styles.saveButtonText}>
                  {t('grades').form.save}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setDate(selectedDate);
          }}
        />
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
      
      // Fetch student info - this handles both login and info retrieval
      const htmlResponse = await fetchStudentInfo(studentIdnp);
      
      if (!htmlResponse || htmlResponse.trim() === '') {
        throw new Error('Empty response received');
      }
      
      // If we got here, the fetch was successful
      setResponseHtml(htmlResponse);

      // Save the IDNP since it was successful
      await AsyncStorage.setItem(IDNP_KEY, studentIdnp);
      
      // Notify other components of the IDNP update
      DeviceEventEmitter.emit(IDNP_UPDATE_EVENT, studentIdnp);
      
    } catch (error) {
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
  // HTML response styles
  htmlContainer: {
    width: '100%',
    height: '50%', // Take half of the screen
    backgroundColor: 'white',
  },
  webView: {
    flex: 1,
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
});