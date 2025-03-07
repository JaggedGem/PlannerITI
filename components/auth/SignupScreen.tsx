import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Platform, Modal } from 'react-native';
import { Link, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useTranslation } from '../../hooks/useTranslation';
import { useThemeColor } from '../../hooks/useThemeColor';
import authService from '../../services/authService';
import { StatusBar } from 'expo-status-bar';

export function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const { t } = useTranslation();
  const inputBackground = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const showCustomAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setShowAlert(true);
  };

  const validateForm = () => {
    if (!email || !password || !confirmPassword) {
      showCustomAlert('Error', t('auth').signup.emptyFields);
      return false;
    }

    if (password !== confirmPassword) {
      showCustomAlert('Error', t('auth').signup.passwordMismatch);
      return false;
    }

    if (!acceptedPrivacy) {
      showCustomAlert('Error', t('auth').signup.acceptPrivacy);
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.signup(email, password, confirmPassword);
      showCustomAlert(
        t('auth').signup.success,
        t('auth').verifyEmail.message
      );
    } catch (error) {
      showCustomAlert('Error', t('auth').signup.error);
    } finally {
      setLoading(false);
    }
  };

  const openPrivacyPolicy = () => {
    router.push('/privacy-policy');
  };

  const handleAlertConfirm = () => {
    setShowAlert(false);
    if (alertTitle === t('auth').signup.success) {
      router.replace('/auth');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t('auth').signup.title}</ThemedText>
          <ThemedText style={styles.subtitle}>{t('auth').optional.message}</ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={24} color={textColor} style={styles.icon} />
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
              placeholder={t('auth').signup.email}
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
              placeholder={t('auth').signup.password}
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={24} color={textColor} style={styles.icon} />
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
              placeholder={t('auth').signup.confirmPassword}
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity 
            style={styles.privacyRow} 
            onPress={() => setAcceptedPrivacy(!acceptedPrivacy)}
          >
            <MaterialIcons
              name={acceptedPrivacy ? "check-box" : "check-box-outline-blank"}
              size={24}
              color="#2C3DCD"
            />
            <ThemedText style={styles.privacyText}>
              {t('auth').signup.privacyAccept}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.privacyLink}
            onPress={openPrivacyPolicy}
          >
            <ThemedText style={[styles.privacyLinkText, { color: "#2C3DCD" }]}>
              {t('auth').signup.privacyPolicyLink}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? t('loading') : t('auth').signup.submit}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.footer}>
            <ThemedText>{t('auth').signup.hasAccount} </ThemedText>
            <Link href="/auth" asChild>
              <TouchableOpacity>
                <ThemedText style={{ color: "#2C3DCD" }}>
                {t('auth').signup.loginLink}
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
            <ThemedText style={styles.alertTitle}>{alertTitle}</ThemedText>
            <ThemedText style={styles.alertMessage}>{alertMessage}</ThemedText>
            <TouchableOpacity 
              style={[styles.alertButton, { backgroundColor: '#2C3DCD' }]} 
              onPress={handleAlertConfirm}
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
    justifyContent: 'center',
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
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
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  privacyText: {
    marginLeft: 10,
  },
  privacyLink: {
    marginBottom: 20,
  },
  privacyLinkText: {
    textDecorationLine: 'underline',
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