import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { scheduleService, SubGroupType, Language, Group } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';
import { MaterialIcons } from '@expo/vector-icons';

const languages = {
  en: 'English',
  ro: 'Română'
};

const groups: SubGroupType[] = ['Subgroup 1', 'Subgroup 2'];

export default function Settings() {
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const { t } = useTranslation();

  // Load settings and groups
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });

    const fetchGroups = async () => {
      try {
        setIsLoading(true);
        const groups = await scheduleService.getGroups();
        setGroupsList(groups);
      } catch (err) {
        setError('Failed to load groups. Please check your connection.');
        console.error('Error fetching groups:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
    
    return () => unsubscribe();
  }, []);

  const handleLanguageChange = (language: Language) => {
    scheduleService.updateSettings({ language });
  };

  const handleGroupChange = (group: SubGroupType) => {
    scheduleService.updateSettings({ group });
  };

  const handleGroupSelection = (group: Group) => {
    scheduleService.updateSettings({ 
      selectedGroupId: group._id,
      selectedGroupName: group.name
    });
    setShowGroupModal(false);
  };

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity
      style={[
        styles.groupItem,
        settings.selectedGroupId === item._id && styles.selectedGroupItem
      ]}
      onPress={() => handleGroupSelection(item)}
    >
      <Text style={[
        styles.groupItemText,
        settings.selectedGroupId === item._id && styles.selectedOptionText
      ]}>
        {item.name}
      </Text>
      {item.diriginte && (
        <Text style={[
          styles.teacherText,
          settings.selectedGroupId === item._id && styles.selectedTeacherText
        ]}>
          {item.diriginte.name}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Class Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Class</Text>
        <TouchableOpacity
          style={styles.classSelector}
          onPress={() => setShowGroupModal(true)}
        >
          <View style={styles.classSelectorContent}>
            <Text style={styles.selectedClassName}>
              {settings.selectedGroupName || 'Select a class'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color="#8A8A8D" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Language Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings').language}</Text>
        <View style={styles.optionsContainer}>
          {(Object.keys(languages) as Language[]).map(lang => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.optionButton,
                settings.language === lang && styles.selectedOption
              ]}
              onPress={() => handleLanguageChange(lang)}
            >
              <Text style={[
                styles.optionText,
                settings.language === lang && styles.selectedOptionText
              ]}>
                {languages[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Subgroup Selection Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings').group}</Text>
        <View style={styles.optionsContainer}>
          {groups.map(group => (
            <TouchableOpacity
              key={group}
              style={[
                styles.optionButton,
                settings.group === group && styles.selectedOption
              ]}
              onPress={() => handleGroupChange(group)}
            >
              <Text style={[
                styles.optionText,
                settings.group === group && styles.selectedOptionText
              ]}>
                {group === 'Subgroup 1' ? t('subgroup').group1 : t('subgroup').group2}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Groups Selection Modal */}
      <Modal
        visible={showGroupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Class</Text>
              <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3478F6" />
                <Text style={styles.loadingText}>Loading classes...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <FlatList
                data={groupsList}
                renderItem={renderGroupItem}
                keyExtractor={item => item._id}
                style={styles.groupsList}
                contentContainerStyle={styles.groupsListContent}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1b26',
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#3478F6',
  },
  optionText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedOptionText: {
    color: 'white',
  },
  classSelector: {
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
  },
  classSelectorContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedClassName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2b36',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  groupsList: {
    width: '100%',
  },
  groupsListContent: {
    paddingBottom: 20,
  },
  groupItem: {
    backgroundColor: '#232433',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  selectedGroupItem: {
    backgroundColor: '#3478F6',
  },
  groupItemText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  teacherText: {
    color: '#8A8A8D',
    fontSize: 14,
    marginTop: 4,
  },
  selectedTeacherText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    color: '#8A8A8D',
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 30,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    textAlign: 'center',
    fontSize: 16,
  },
});