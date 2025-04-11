import React, { useEffect, useState } from 'react';
import { StyleSheet, Animated, TouchableOpacity, Platform, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, router } from 'expo-router';
import { useThemeColor } from '../hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthContext } from '@/components/auth/AuthContext';

const LOGIN_DISMISSED_KEY = '@login_notification_dismissed';

export default function LoginNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-100)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;
  const overlayAnim = React.useRef(new Animated.Value(0)).current;
  const backgroundColor = useThemeColor({}, 'background');
  const accentColor = useThemeColor({}, 'tint');
  const darkMode = useThemeColor({}, 'background') === '#1a1b26';
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    checkDismissedStatus();
  }, []);

  // Add effect to hide notification when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && isVisible) {
      // Hide the notification if user is authenticated
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
        setShowOverlay(false);
      });
    }
  }, [isAuthenticated, isVisible]);

  const checkDismissedStatus = async () => {
    try {
      // Don't show notification if user is already authenticated
      if (isAuthenticated) {
        return;
      }
      
      const dismissed = await AsyncStorage.getItem(LOGIN_DISMISSED_KEY);
      if (dismissed !== 'true') {
        setIsVisible(true);
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
      }
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(LOGIN_DISMISSED_KEY, 'true');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        setShowOverlay(false);
      });
    } catch (error) {
      console.error('Error saving notification status:', error);
    }
  };

  const handleSignIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowOverlay(true);
    
    // Animate the overlay
    Animated.sequence([
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Dismiss the notification
      handleDismiss();
      // Navigate to settings tab
      router.push('/(tabs)/settings');
    });
  };

  if (!isVisible && !showOverlay) return null;

  return (
    <>
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
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              },
              android: {
                elevation: 8,
              },
            }),
          },
        ]}
      >
        <LinearGradient
          colors={darkMode ? 
            ['#2C3DCD', '#1a1b26'] : 
            ['#4C63E9', '#2C3DCD']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="lock" size={28} color="#fff" />
          </View>
          <ThemedView style={styles.content}>
            <ThemedText style={styles.title}>{t('loginPromo').stayConnected}</ThemedText>
            <ThemedText style={styles.message}>
              {t('loginPromo').body}
            </ThemedText>
            <TouchableOpacity 
              onPress={handleSignIn}
              style={styles.button}
            >
              <LinearGradient
                colors={darkMode ? 
                  ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)'] : 
                  ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <ThemedText style={styles.buttonText}>{t('loginPromo').getStarted}</ThemedText>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleDismiss} 
              style={styles.dismissButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ThemedText style={styles.dismissText}>
                {t('loginPromo').dismiss}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </LinearGradient>
      </Animated.View>

      {showOverlay && (
        <Animated.View 
          style={[
            styles.overlay,
            {
              opacity: overlayAnim
            }
          ]}
        >
          <View style={styles.settingsHighlight}>
            <Text style={styles.signInText}>Sign in to your account</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#fff" />
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: Platform.OS === 'ios' ? 80 : 40, // Increased top margin to avoid status bar
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 1000,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    zIndex: 999,
  },
  settingsHighlight: {
    position: 'absolute',
    bottom: 90, // Position above tab bar
    left: 20,
    right: 20,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2C3DCD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    flexDirection: 'row',
    gap: 8,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});