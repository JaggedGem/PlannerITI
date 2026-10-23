import { useSafeAreaInsets } from 'react-native-safe-area-context';

import React from 'react';

import { Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useTranslation } from '@/hooks/useTranslation';

import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';

const renderContent = (content: string, textColor: string, linkColor: string) => {
  const parts = content.split(/(<link>.*?<\/link>)/);
  return (
    <Text style={[styles.text, { color: textColor }]}>
      {parts.map((part, index) => {
        if (part.startsWith('<link>') && part.endsWith('</link>')) {
          const email = part.replace(/<\/?link>/g, '');
          return (
            <Text
              key={index}
              style={[styles.link, { color: linkColor }]}
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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const policy = t('privacyPolicy');
  const textColor = useThemeColor({}, 'text');
  const linkColor = useThemeColor({}, 'primaryStrong');

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        <ThemedText style={styles.title}>{policy.title}</ThemedText>

        {Object.entries(policy.sections).map(([key, section], index) => (
          <React.Fragment key={key}>
            <ThemedText style={styles.heading}>{`${index + 1}. ${section.title}`}</ThemedText>
            {Array.isArray(section.content)
              ? section.content.map((item, index) => (
                  <ThemedText key={index} style={styles.text}>
                    {`- ${item}${index < section.content.length - 1 ? '\n\n' : ''}`}
                  </ThemedText>
                ))
              : renderContent(section.content, textColor, linkColor)}
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
    textDecorationLine: 'underline',
  },
});
