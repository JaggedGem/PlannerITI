import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeColor } from '../../hooks/useThemeColor';
import authService from '../../services/authService';
import { StatusBar } from 'expo-status-bar';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const { t } = useTranslation();
  const inputBackground = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const showCustomAlert = (message: string) => {
    setAlertMessage(message);
    setShowAlert(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showCustomAlert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await authService.login(email, password);
      router.replace('/(tabs)/schedule');
    } catch (error) {
      showCustomAlert(t('auth').login.error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleSkip = () => {
    router.replace('/(tabs)/schedule');
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t('auth').login.title}</ThemedText>
          <ThemedText style={styles.subtitle}>{t('auth').optional.message}</ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={24} color={textColor} style={styles.icon} />
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
              placeholder={t('auth').login.email}
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={24} color={textColor} style={styles.icon} />
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
              placeholder={t('auth').login.password}
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
          >
            <ThemedText style={{ color: tintColor }}>
              {t('auth').login.forgotPassword}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? t('loading') : t('auth').login.submit}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.skipButton]}
            onPress={handleSkip}
          >
            <ThemedText style={styles.skipButtonText}>
              {t('auth').optional.skip}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText>{t('auth').login.noAccount} </ThemedText>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <ThemedText style={{ color: "#2C3DCD" }}>
                  {t('auth').login.signupLink}
                </ThemedText>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>

      {/* Custom Alert Modal */}
      <Modal
        visible={showAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor }]}>
            <ThemedText style={styles.alertTitle}>Alert</ThemedText>
            <ThemedText style={styles.alertMessage}>{alertMessage}</ThemedText>
            <TouchableOpacity 
              style={[styles.alertButton, { backgroundColor: '#2C3DCD' }]} 
              onPress={() => setShowAlert(false)}
            >
              <ThemedText style={styles.alertButtonText}>OK</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2C3DCD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2C3DCD',
  },
  skipButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3DCD',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  alertMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButton: {
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 20,
  },
  alertButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});