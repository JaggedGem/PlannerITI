import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';

export function PrivacyPolicyScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ThemedText style={styles.title}>Privacy Policy</ThemedText>
        
        <ThemedText style={styles.heading}>1. Data Collection and Use</ThemedText>
        <ThemedText style={styles.text}>
          We collect and process the following data:
          {'\n'}- Email address for account management and communication
          {'\n'}- IDNP (optional) for accessing your academic records
          {'\n'}- Schedule preferences and settings
        </ThemedText>

        <ThemedText style={styles.heading}>2. IDNP Security</ThemedText>
        <ThemedText style={styles.text}>
          When you provide your IDNP:
          {'\n'}- It is encrypted on your device before transmission
          {'\n'}- Our server receives only the encrypted version
          {'\n'}- The server adds additional encryption before storage
          {'\n'}- We never have access to your raw IDNP
        </ThemedText>

        <ThemedText style={styles.heading}>3. Password Security</ThemedText>
        <ThemedText style={styles.text}>
          Your password is:
          {'\n'}- Never stored in plain text
          {'\n'}- Salted and hashed on your device
          {'\n'}- Never transmitted in its original form
          {'\n'}- Stored using industry-standard encryption
        </ThemedText>

        <ThemedText style={styles.heading}>4. Data Storage</ThemedText>
        <ThemedText style={styles.text}>
          - Personal data is stored on secure servers in the European Union
          {'\n'}- Schedule data is cached locally for offline access
          {'\n'}- You can delete your account and all associated data at any time
        </ThemedText>

        <ThemedText style={styles.heading}>5. Third-Party Services</ThemedText>
        <ThemedText style={styles.text}>
          We integrate with:
          {'\n'}- CEITI's academic system for grade access
          {'\n'}- SendGrid for email communications
          {'\n'}
          {'\n'}These services only receive the minimum necessary information to provide their functions.
        </ThemedText>

        <ThemedText style={styles.heading}>6. Your Rights</ThemedText>
        <ThemedText style={styles.text}>
          You have the right to:
          {'\n'}- Access your personal data
          {'\n'}- Correct inaccurate data
          {'\n'}- Request data deletion
          {'\n'}- Export your data
          {'\n'}- Withdraw consent at any time
        </ThemedText>

        <ThemedText style={styles.heading}>7. Updates</ThemedText>
        <ThemedText style={styles.text}>
          This privacy policy may be updated occasionally. We will notify you of any significant changes.
        </ThemedText>

        <ThemedText style={styles.heading}>8. Contact</ThemedText>
        <ThemedText style={styles.text}>
          For privacy-related inquiries, contact us at privacy@planneriti.app
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollView: {
    flex: 1,
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
    marginBottom: 16,
  },
});