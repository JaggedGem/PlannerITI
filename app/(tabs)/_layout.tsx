import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@/hooks/useTranslation';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { HapticTab } from '@/components/HapticTab';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Custom tab bar label component with animation
interface AnimatedTabBarLabelProps {
  focused: boolean;
  color: string;
  children: React.ReactNode;
}

function AnimatedTabBarLabel({ focused, color, children }: AnimatedTabBarLabelProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(focused ? 1.1 : 1) }],
      opacity: withSpring(focused ? 1 : 0.8),
    };
  });

  return (
    <Animated.Text
      style={[
        {
          color,
          fontSize: 11,
          textAlign: 'center',
          marginTop: 2,
          height: 14,
          lineHeight: 14,
        },
        animatedStyle,
      ]}>
      {children}
    </Animated.Text>
  );
}

// Custom tab bar icon component with animation
interface AnimatedTabBarIconProps {
  focused: boolean;
  color: string;
  name: React.ComponentProps<typeof MaterialIcons>['name'];
}

function AnimatedTabBarIcon({ focused, color, name }: AnimatedTabBarIconProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(focused ? 1.2 : 1) }],
    };
  });

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(focused ? 20 : 0),
      opacity: withSpring(focused ? 1 : 0),
    };
  });

  return (
    <View style={{ alignItems: 'center', height: 40, justifyContent: 'center' }}>
      <Animated.View style={animatedStyle}>
        <MaterialIcons name={name} size={24} color={color} />
      </Animated.View>
      <Animated.View
        style={[
          {
            marginTop: 4,
            height: 3,
            borderRadius: 1.5,
            backgroundColor: color,
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  
  // Background color based on theme
  const backgroundColor = isDark ? '#141414' : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Full-screen background that extends under the tab bar */}
      <View style={[styles.fullScreenBackground, { backgroundColor }]} />
      
      {/* Corner filler for Android */}
      {Platform.OS === 'android' && (
        <View 
          style={[
            styles.tabBarFiller, 
            { backgroundColor: backgroundColor }
          ]} 
        />
      )}
      
      <Tabs
        initialRouteName="schedule"
        screenOptions={{
          tabBarActiveTintColor: isDark ? '#FFFFFF' : '#2C3DCD',
          tabBarInactiveTintColor: isDark ? '#8A8A8D' : '#687076',
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            height: 80,
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
            paddingTop: 10,
            backgroundColor: backgroundColor,
            borderTopWidth: 0,
            ...(Platform.OS === 'ios' 
              ? {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                } 
              : {
                  elevation: 8,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: backgroundColor,
                }
            ),
          },
          tabBarItemStyle: {
            paddingVertical: 4,
            height: 50,
            justifyContent: 'center',
          },
          tabBarLabelPosition: 'below-icon',
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabBarLabel focused={focused} color={color}>
              {children}
            </AnimatedTabBarLabel>
          ),
        }}
      >
        <Tabs.Screen
          name="schedule"
          options={{
            title: t('tabs').schedule,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon 
                focused={focused}
                color={color}
                name="calendar-month"
              />
            ),
            tabBarAccessibilityLabel: t('tabs').schedule,
          }}
        />
        <Tabs.Screen
          name="grades"
          options={{
            title: t('tabs').grades,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon 
                focused={focused}
                color={color}
                name="school"
              />
            ),
            tabBarAccessibilityLabel: t('tabs').grades,
          }}
        />
        <Tabs.Screen
          name="assignments"
          options={{
            title: t('tabs').assignments,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon 
                focused={focused}
                color={color}
                name="assignment"
              />
            ),
            tabBarAccessibilityLabel: t('tabs').assignments,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs').settings,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabBarIcon 
                focused={focused}
                color={color}
                name="settings"
              />
            ),
            tabBarAccessibilityLabel: t('tabs').settings,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // For Android, create a mask behind the tab bar to fill in the corners
  tabBarFiller: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 16, // Match the border radius
    backgroundColor: 'transparent',
  },
  fullScreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
