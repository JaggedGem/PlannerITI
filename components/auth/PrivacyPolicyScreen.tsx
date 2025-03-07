import React from 'react';
import { ScrollView, StyleSheet, Platform, StatusBar, Linking, Text } from 'react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeColor } from '@/hooks/useThemeColor';

const renderContent = (content: string, textColor: string) => {
  const parts = content.split(/(<link>.*?<\/link>)/);
  return (
    <Text style={[styles.text, { color: textColor }]}>
      {parts.map((part, index) => {
        if (part.startsWith('<link>') && part.endsWith('</link>')) {
          const email = part.replace(/<\/?link>/g, '');
          return (
            <Text
              key={index}
              style={styles.link}
              onPress={() => Linking.openURL(`mailto:${email}`)}
            >
              {email}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};

export function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const policy = t('privacyPolicy');
  const textColor = useThemeColor({}, 'text');

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <ThemedText style={styles.title}>{policy.title}</ThemedText>
        
        {Object.entries(policy.sections).map(([key, section], index) => (
          <React.Fragment key={key}>
            <ThemedText style={styles.heading}>{`${index + 1}. ${section.title}`}</ThemedText>
            {Array.isArray(section.content) ? (
              section.content.map((item, index) => (
                <ThemedText key={index} style={styles.text}>
                  {`- ${item}${index < section.content.length - 1 ? '\n\n' : ''}`}
                </ThemedText>
              ))
            ) : (
              renderContent(section.content, textColor)
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2C3DCD',
    textDecorationLine: 'underline',
  },
});