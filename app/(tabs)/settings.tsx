import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { scheduleService, SubGroupType, Language } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';

const languages = {
  en: 'English',
  ro: 'Română'
};

const groups: SubGroupType[] = ['Subgroup 1', 'Subgroup 2'];

export default function Settings() {
  const [settings, setSettings] = useState(scheduleService.getSettings());
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

  const handleLanguageChange = (language: Language) => {
    scheduleService.updateSettings({ language });
  };

  const handleGroupChange = (group: SubGroupType) => {
    scheduleService.updateSettings({ group });
  };

  return (
    <SafeAreaView style={styles.container}>
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
});