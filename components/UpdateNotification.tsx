import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Dimensions } from 'react-native';
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
    if (Updates.channel !== 'development') {
      checkForUpdates();
    } else {
      // In development, we don't show the notification
      setUpdateStatus('not-available');
    }
  }, []);

  // Check if an update is available
  const checkForUpdates = async () => {
    try {
      setUpdateStatus('checking');
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setUpdateStatus('available');
        setModalVisible(true);
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
      
      await Updates.fetchUpdateAsync();
      
      setUpdateStatus('ready');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error downloading update:', error);
      setUpdateStatus('error');
    }
  };

  // Function to restart the app to apply the update
  const applyUpdate = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setModalVisible(false);
    
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.error('Error reloading app:', error);
    }
  };

  // Function to dismiss the modal
  const dismissModal = () => {
    setModalVisible(false);
    
    // Small haptic feedback
    Haptics.selectionAsync();
  };

  // If no update or still checking, don't render anything
  if (updateStatus === 'not-available' || updateStatus === 'checking') {
    return null;
  }

  return (
    <View style={styles.container}>
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={dismissModal}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalView: {
    backgroundColor: '#1a1b26',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    minWidth: 280,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  icon: {
    marginBottom: 16,
  },
  message: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 16,
    width: '100%',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    minHeight: 52,
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
    fontWeight: '500',
  },
});