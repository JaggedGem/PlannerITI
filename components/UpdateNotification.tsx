import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/hooks/useTranslation';

type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error';

export default function UpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('checking');
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Only check for updates in production mode
    if (!__DEV__) {
      checkForUpdates();
    }
  }, []);

  // Check if an update is available
  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking');
      const update = await Updates.checkForUpdateAsync();
      
      // If an update is available, show the modal
      if (update.isAvailable) {
        setUpdateStatus('available');
        setModalVisible(true);
        // Vibrate to notify user
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setUpdateStatus('not-available');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      setUpdateStatus('error');
    }
  };

  // Function to download and apply the update
  const downloadUpdate = async () => {
    try {
      setUpdateStatus('downloading');
      
      // Download the update
      await Updates.fetchUpdateAsync();
      
      // If we get here, the download was successful
      setUpdateStatus('ready');
      
      // Vibrate to notify user that update is ready
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error downloading update:', error);
      setUpdateStatus('error');
    }
  };

  // Function to restart the app to apply the update
  const applyUpdate = () => {
    // Vibrate to notify user
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    // Close the modal and restart
    setModalVisible(false);
    Updates.reloadAsync();
  };

  // Function to dismiss the modal
  const dismissModal = () => {
    setModalVisible(false);
    
    // Small haptic feedback
    Haptics.selectionAsync();
  };

  // Don't render anything if no update is available
  if (updateStatus === 'not-available' || updateStatus === 'checking' || __DEV__) {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={dismissModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {updateStatus === 'error' 
                ? t('update').errorTitle 
                : updateStatus === 'ready'
                  ? t('update').readyTitle
                  : t('update').availableTitle}
            </Text>
            {updateStatus !== 'downloading' && (
              <TouchableOpacity onPress={dismissModal}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.messageContainer}>
            <MaterialIcons 
              name={
                updateStatus === 'error' 
                  ? "error-outline" 
                  : updateStatus === 'downloading'
                    ? "cloud-download"
                    : updateStatus === 'ready'
                      ? "system-update-alt"
                      : "system-update"
              } 
              size={40} 
              color={updateStatus === 'error' ? "#FF6B6B" : "#2C3DCD"} 
              style={styles.icon}
            />
            <Text style={styles.message}>
              {updateStatus === 'error' 
                ? t('update').errorMessage 
                : updateStatus === 'downloading'
                  ? t('update').downloadingMessage
                  : updateStatus === 'ready'
                    ? t('update').readyMessage
                    : t('update').availableMessage}
            </Text>
          </View>

          {updateStatus === 'downloading' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2C3DCD" />
              <Text style={styles.loadingText}>{t('update').downloading}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            {updateStatus === 'available' && (
              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={downloadUpdate}
              >
                <Text style={styles.updateButtonText}>{t('update').downloadButton}</Text>
              </TouchableOpacity>
            )}

            {updateStatus === 'ready' && (
              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={applyUpdate}
              >
                <Text style={styles.updateButtonText}>{t('update').restartButton}</Text>
              </TouchableOpacity>
            )}

            {updateStatus === 'error' && (
              <TouchableOpacity
                style={[styles.button, styles.updateButton]}
                onPress={checkForUpdates}
              >
                <Text style={styles.updateButtonText}>{t('update').retryButton}</Text>
              </TouchableOpacity>
            )}

            {(updateStatus === 'available' || updateStatus === 'error') && (
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={dismissModal}
              >
                <Text style={styles.cancelButtonText}>{t('update').laterButton}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1b26',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
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
  messageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    marginBottom: 15,
  },
  message: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
  },
  buttonContainer: {
    marginTop: 10,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  updateButton: {
    backgroundColor: '#2C3DCD',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
});