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

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { t } = useTranslation();
  const inputBackground = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const showCustomAlert = (title: string, message: string, success = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setIsSuccess(success);
    setShowAlert(true);
  };

  const handleResetPassword = async () => {
    if (!email) {
      showCustomAlert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      showCustomAlert(
        t('auth').forgotPassword.success,
        t('auth').verifyEmail.message,
        true
      );
    } catch (error) {
      showCustomAlert('Error', t('auth').forgotPassword.error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertConfirm = () => {
    setShowAlert(false);
    if (isSuccess) {
      router.replace('/auth');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>{t('auth').forgotPassword.title}</ThemedText>
          <ThemedText style={styles.subtitle}>{t('auth').verifyEmail.message}</ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={24} color={textColor} style={styles.icon} />
            <TextInput
              style={[styles.input, { backgroundColor: inputBackground, color: textColor }]}
              placeholder={t('auth').forgotPassword.email}
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>
              {loading ? t('loading') : t('auth').forgotPassword.submit}
            </ThemedText>
          </TouchableOpacity>


          <View style={styles.backButton}>
            <Link href="/auth" asChild>
              <TouchableOpacity>
                <ThemedText style={{ color: "#2C3DCD" }}>
                  {t('auth').forgotPassword.backToLogin}
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
    marginBottom: 40,
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
  backButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
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