import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Pressable, 
  ScrollView,
  Linking,
  useColorScheme,
  Platform,
  Alert,
  DeviceEventEmitter
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { updateService, UpdateInfo } from '@/services/updateService';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  withSpring,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation value for button press
  const scale = useSharedValue(1);

  useEffect(() => {
    // Check for updates after a short delay to not impact startup
    const checkTimer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    // Set up periodic checks (once per day while app is open)
    const periodicCheck = setInterval(() => {
      checkForUpdates();
    }, 1000 * 60 * 60 * 24);

    // Listen for test update events (developer mode)
    const testUpdateListener = DeviceEventEmitter.addListener(
      'TEST_UPDATE_AVAILABLE',
      (testUpdate: UpdateInfo) => {
        setUpdateInfo(testUpdate);
        setIsVisible(true);
        
        // Minimal haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    );

    return () => {
      clearTimeout(checkTimer);
      clearInterval(periodicCheck);
      testUpdateListener.remove();
    };
  }, []);

  const checkForUpdates = async () => {
    try {
      const update = await updateService.checkForUpdate();
      if (update && update.isAvailable) {
        setUpdateInfo(update);
        setIsVisible(true);
        
        // Minimal haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleDownload = async () => {
    if (!updateInfo || !updateInfo.downloadUrl) {
      Alert.alert(
        'Download Not Available',
        'Please visit the releases page to download the update manually.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Releases', 
            onPress: () => Linking.openURL(updateInfo?.releaseUrl || '')
          }
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const supported = await Linking.canOpenURL(updateInfo.downloadUrl);
      if (supported) {
        await Linking.openURL(updateInfo.downloadUrl);
        handleDismiss();
      } else {
        Alert.alert('Error', 'Unable to open download link');
      }
    } catch (error) {
      console.error('Error opening download link:', error);
      Alert.alert('Error', 'Failed to open download link');
    }
  };

  const handleViewRelease = async () => {
    if (!updateInfo) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const supported = await Linking.canOpenURL(updateInfo.releaseUrl);
      if (supported) {
        await Linking.openURL(updateInfo.releaseUrl);
      }
    } catch (error) {
      console.error('Error opening release page:', error);
    }
  };

  const handleDismiss = async () => {
    if (!updateInfo) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Dismiss this version
    await updateService.dismissVersion(updateInfo.latestVersion);
    setIsVisible(false);
    
    // Clear update info after animation
    setTimeout(() => {
      setUpdateInfo(null);
    }, 500);
  };

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (!updateInfo) return null;

  // Simple markdown-like parsing for better readability
  const formatReleaseNotes = (notes: string): string => {
    return notes
      .replace(/^### (.+)$/gm, '\n$1\n')  // Headers
      .replace(/^## (.+)$/gm, '\n$1\n')
      .replace(/^# (.+)$/gm, '\n$1\n')
      .replace(/\*\*(.+?)\*\*/g, '$1')     // Bold
      .replace(/\*(.+?)\*/g, '$1')          // Italic
      .replace(/^[•\-\*] (.+)$/gm, '  • $1') // Bullets
      .trim();
  };

  const formattedNotes = formatReleaseNotes(updateInfo.releaseNotes);
  const publishedDate = format(new Date(updateInfo.publishedAt), 'MMM d, yyyy');

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <Animated.View 
        style={styles.overlay}
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
      >
        <Pressable 
          style={styles.backdrop} 
          onPress={handleDismiss}
        >
          <BlurView 
            intensity={20} 
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Pressable>

        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }
          ]}
          edges={['top', 'bottom']}
        >
          <Animated.View
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(200)}
            style={styles.contentContainer}
          >
            {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name="rocket" 
                  size={26} 
                  color="#FFFFFF" 
                />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  Update Available
                </Text>
                <Text style={styles.versionBadge}>
                  {updateInfo.latestVersion} • {updateService.getCurrentChannel()}
                </Text>
              </View>
            </View>
            <Pressable 
              onPress={handleDismiss}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              style={styles.closeButton}
            >
              <Ionicons 
                name="close" 
                size={22} 
                color={isDark ? '#8E8E93' : '#8E8E93'} 
              />
            </Pressable>
          </View>

          {/* Version Info */}
          <View style={[
            styles.versionInfo,
            { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
          ]}>
            <View style={styles.versionRow}>
              <View style={styles.versionItem}>
                <Text style={styles.versionLabel}>Current</Text>
                <Text style={[styles.versionNumber, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>
                  {updateInfo.currentVersion}
                </Text>
              </View>
              <Ionicons 
                name="arrow-forward" 
                size={20} 
                color={isDark ? '#3478F6' : '#007AFF'} 
                style={styles.arrowIcon}
              />
              <View style={styles.versionItem}>
                <Text style={styles.versionLabel}>Latest</Text>
                <Text style={[styles.versionNumber, styles.latestVersion]}>
                  {updateInfo.latestVersion}
                </Text>
              </View>
            </View>
            <Text style={styles.publishDate}>Released {publishedDate}</Text>
          </View>

          {/* Release Notes */}
          <View style={styles.releaseNotesContainer}>
            <View style={styles.releaseNotesHeader}>
              <Ionicons 
                name="document-text-outline" 
                size={16} 
                color={isDark ? '#8E8E93' : '#8E8E93'} 
              />
              <Text style={[styles.releaseNotesTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                What's New
              </Text>
            </View>
            <ScrollView 
              style={styles.releaseNotesScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.releaseNotes, { color: isDark ? '#E5E5EA' : '#3C3C43' }]}>
                {formattedNotes}
              </Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <AnimatedPressable
              style={[styles.button, styles.secondaryButton, animatedButtonStyle]}
              onPress={handleViewRelease}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Ionicons name="open-outline" size={18} color="#3478F6" />
              <Text style={styles.secondaryButtonText}>View Release</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.button, styles.primaryButton, animatedButtonStyle]}
              onPress={handleDownload}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            >
              <Ionicons name="download" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Download Update</Text>
            </AnimatedPressable>
          </View>

          {/* Dismiss Text */}
          <Pressable 
            onPress={handleDismiss}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            style={styles.dismissContainer}
          >
            <Text style={styles.dismissText}>Remind Me Later</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#2C3DCD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 2,
  },
  versionBadge: {
    fontSize: 12,
    color: '#2C3DCD',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  versionInfo: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  versionItem: {
    alignItems: 'center',
    flex: 1,
  },
  versionLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  versionNumber: {
    fontSize: 17,
    fontWeight: '600',
  },
  latestVersion: {
    color: '#2C3DCD',
    fontSize: 19,
    fontWeight: '700',
  },
  arrowIcon: {
    marginHorizontal: 12,
  },
  publishDate: {
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 2,
  },
  releaseNotesContainer: {
    flex: 1,
    marginBottom: 16,
  },
  releaseNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  releaseNotesTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  releaseNotesScroll: {
    flex: 1,
  },
  releaseNotes: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#2C3DCD',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(44, 61, 205, 0.1)',
    borderWidth: 1.5,
    borderColor: '#2C3DCD',
  },
  secondaryButtonText: {
    color: '#2C3DCD',
    fontSize: 15,
    fontWeight: '600',
  },
  dismissContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
});