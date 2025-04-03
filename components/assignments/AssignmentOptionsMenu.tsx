import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface AssignmentOptionsMenuProps {
  isVisible: boolean;
  onClose: () => void;
  assignmentId: string;
  onDelete?: () => void;
  position?: { top: number; right: number };
}

export function AssignmentOptionsMenu({ 
  isVisible, 
  onClose, 
  assignmentId,
  onDelete,
  position = { top: 100, right: 20 }
}: AssignmentOptionsMenuProps) {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Calculate an appropriate position if none provided
  const menuPosition = useMemo(() => {
    // If position is valid, use it with slight adjustments if needed
    if (position.top > 0 && position.right > 0) {
      // Ensure the menu isn't positioned too close to the edges
      let top = position.top;
      const right = Math.min(position.right, screenWidth - 160); // Ensure menu is visible
      
      // Make sure the menu stays on screen
      if (top < 50) {
        top = 50; // Min top position
      } else if (top > screenHeight - 150) {
        top = screenHeight - 150; // Prevent going off bottom
      }
      
      return { top, right };
    }
    
    // Fallback default position (center-right of screen)
    return {
      top: screenHeight * 0.3, 
      right: 20
    };
  }, [position, screenHeight, screenWidth]);

  // Handle edit action
  const handleEdit = () => {
    onClose();
    router.push({
      pathname: '/edit-assignment',
      params: { id: assignmentId }
    } as any);
  };

  // If not visible, don't render anything
  if (!isVisible) {
    return null;
  }

  return (
    <Pressable 
      style={styles.overlay}
      onPress={onClose}
    >
      <Animated.View 
        entering={FadeIn.duration(150).springify().damping(20).mass(0.5)}
        exiting={FadeOut.duration(100)}
        style={[
          styles.menuContainer,
          {
            top: menuPosition.top,
            right: menuPosition.right,
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={handleEdit}
        >
          <Ionicons name="create-outline" size={18} color="#3478F6" />
          <Text style={styles.menuItemText}>{t('assignments').edit}</Text>
        </TouchableOpacity>
        
        {onDelete && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                onDelete();
                onClose();
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={[styles.menuItemText, styles.deleteText]}>{t('assignments').delete}</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    // Add small drop shadow at the top to simulate a pointer
    borderTopWidth: 1,
    borderTopColor: '#3A3A3A',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  deleteText: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#3A3A3A',
    marginHorizontal: 8,
  }
}); 