import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Animated, 
  TouchableOpacity, 
  Platform, 
  View, 
  Text,
  Linking,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeColor } from '../hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { useTranslation } from '@/hooks/useTranslation';
import { githubUpdateService, UpdateInfo } from '@/services/githubUpdateService';

export default function GitHubUpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  
  const slideAnim = React.useRef(new Animated.Value(-100)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  
  const backgroundColor = useThemeColor({}, 'background');
  const darkMode = useThemeColor({}, 'background') === '#151718';
  const { t } = useTranslation();

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // Delay the check to not impact startup performance
      setTimeout(async () => {
        const info = await githubUpdateService.checkForUpdate();
        
        if (info.isAvailable && info.release) {
          setUpdateInfo(info);
          setIsVisible(true);
          animateIn();
        }
      }, 2000); // 2 second delay
    } catch (error) {
      console.error('Error checking for GitHub updates:', error);
    }
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
    ]).start();
  };

  const animateOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      callback?.();
    });
  };

  const handleDismiss = async () => {
    if (!updateInfo?.latestVersion) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await githubUpdateService.dismissUpdate(updateInfo.latestVersion);
    animateOut();
  };

  const handleUpdate = async () => {
    if (!updateInfo?.release) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Find APK asset in the release
    const apkAsset = updateInfo.release.assets.find(asset => 
      asset.name.toLowerCase().endsWith('.apk')
    );

    if (apkAsset) {
      // Open the download URL
      await Linking.openURL(apkAsset.browser_download_url);
    } else {
      // Fallback to release page
      await Linking.openURL(updateInfo.release.html_url);
    }

    // Dismiss after opening link
    handleDismiss();
  };

  const toggleReleaseNotes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReleaseNotes(!showReleaseNotes);
  };

  // Format release notes to be more readable
  const formatReleaseNotes = (body: string): string => {
    // Limit to first 300 characters and add ellipsis
    const maxLength = 300;
    if (body.length <= maxLength) return body;
    
    const truncated = body.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  };

  if (!isVisible || !updateInfo) return null;

  const isBeta = githubUpdateService.getAppVariant() === 'beta';
  const releaseNotes = updateInfo.release?.body || '';

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ],
          opacity: opacityAnim,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
            },
            android: {
              elevation: 12,
            },
          }),
        },
      ]}
    >
      <LinearGradient
        colors={darkMode ? 
          (isBeta ? ['#FF6B35', '#1a1b26'] : ['#4CAF50', '#1a1b26']) :
          (isBeta ? ['#FF8A65', '#FF6B35'] : ['#66BB6A', '#4CAF50'])}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={isBeta ? "science" : "system-update"} 
            size={28} 
            color="#fff" 
          />
        </View>
        
        <ThemedView style={styles.content}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {isBeta ? t('githubUpdate').betaVersion : t('githubUpdate').title}
            </ThemedText>
            <TouchableOpacity 
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.message}>
            {t('githubUpdate').newVersionAvailable}
          </ThemedText>

          <View style={styles.versionInfo}>
            <View style={styles.versionBadge}>
              <ThemedText style={styles.versionLabel}>
                {t('githubUpdate').currentVersion}
              </ThemedText>
              <ThemedText style={styles.versionNumber}>
                {updateInfo.currentVersion}
              </ThemedText>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="rgba(255,255,255,0.6)" />
            <View style={[styles.versionBadge, styles.latestBadge]}>
              <ThemedText style={styles.versionLabel}>
                {t('githubUpdate').latestVersion}
              </ThemedText>
              <ThemedText style={[styles.versionNumber, styles.latestVersion]}>
                {updateInfo.latestVersion}
              </ThemedText>
            </View>
          </View>

          {releaseNotes && (
            <View style={styles.releaseNotesContainer}>
              <TouchableOpacity 
                onPress={toggleReleaseNotes}
                style={styles.releaseNotesHeader}
              >
                <ThemedText style={styles.releaseNotesTitle}>
                  {t('githubUpdate').releaseNotes}
                </ThemedText>
                <MaterialIcons 
                  name={showReleaseNotes ? "expand-less" : "expand-more"} 
                  size={20} 
                  color="rgba(255,255,255,0.7)" 
                />
              </TouchableOpacity>
              
              {showReleaseNotes && (
                <ScrollView 
                  style={styles.releaseNotesScroll}
                  showsVerticalScrollIndicator={false}
                >
                  <ThemedText style={styles.releaseNotesText}>
                    {formatReleaseNotes(releaseNotes)}
                  </ThemedText>
                </ScrollView>
              )}
            </View>
          )}

          <TouchableOpacity 
            onPress={handleUpdate}
            style={styles.button}
          >
            <LinearGradient
              colors={darkMode ? 
                ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)'] : 
                ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <MaterialIcons name="download" size={20} color="#fff" />
              <ThemedText style={styles.buttonText}>
                {t('githubUpdate').updateNow}
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleDismiss} 
            style={styles.dismissButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ThemedText style={styles.dismissText}>
              {t('githubUpdate').dismiss}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: Platform.OS === 'ios' ? 80 : 40,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 1001, // Above LoginNotification (1000)
  },
  gradient: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingLeft: 76,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    lineHeight: 20,
  },
  versionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 8,
  },
  versionBadge: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  latestBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  versionLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  versionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  latestVersion: {
    fontWeight: '700',
  },
  releaseNotesContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  releaseNotesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  releaseNotesScroll: {
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  releaseNotesText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  button: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
});
