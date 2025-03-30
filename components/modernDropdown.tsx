import { Ionicons } from "@expo/vector-icons";
import React, { memo, useEffect, useState } from "react";
import { Pressable, View, Text, Platform, StyleSheet, ScrollView, Dimensions } from "react-native";
import * as Haptics from 'expo-haptics';
import { Modal } from "react-native";

type SegmentItem = {
  label: string;
  icon?: React.ReactNode;
};

const ModernDropdown = memo(({
    title,
    isVisible, 
    onClose, 
    segments, 
    selectedIndex, 
    onSelect,
    maxOptions,
    disableScroll = false,
    maxHeight,
    }: { 
    title: string;
    isVisible: boolean;
    onClose: () => void;
    segments: (string | SegmentItem)[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    maxOptions?: number;
    disableScroll?: boolean;
    maxHeight?: number;
  }) => {
  
    const [contentHeight, setContentHeight] = useState(0);
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate smart max height based on screen size and number of options
    const calculateMaxHeight = () => {
      // Default option height (including padding) + separator
      const optionHeight = 56; 
      const headerHeight = 60;
      const maxScreenPercentage = 0.7; // Maximum percentage of screen height
      
      let calculatedHeight;
      
      if (maxOptions && segments.length > maxOptions) {
        calculatedHeight = headerHeight + (optionHeight * maxOptions);
      } else {
        calculatedHeight = headerHeight + (optionHeight * segments.length);
      }
      
      // Ensure dropdown doesn't exceed max screen percentage
      const maxAllowedHeight = screenHeight * maxScreenPercentage;
      calculatedHeight = Math.min(calculatedHeight, maxAllowedHeight);
      
      // Use explicitly provided maxHeight if available
      return maxHeight || calculatedHeight;
    };

    const handleSelect = (index: number) => {
      // Trigger haptic feedback
      Haptics.selectionAsync();
      onSelect(index);
      onClose();
    };

    const getSegmentLabel = (segment: string | SegmentItem): string => {
      return typeof segment === 'string' ? segment : segment.label;
    };

    const getSegmentIcon = (segment: string | SegmentItem): React.ReactNode | null => {
      return typeof segment === 'string' ? null : segment.icon || null;
    };
    
    const needsScrollView = !disableScroll && (
      (maxOptions && segments.length > maxOptions) || 
      segments.length > 5
    );
    
    const dropdownStyle = {
      ...styles.dropdownContainer,
      maxHeight: calculateMaxHeight(),
    };

    const renderOptions = () => (
      <>
        {segments.map((segment, index) => (
          <View key={typeof segment === 'string' ? segment : segment.label}>
            {index > 0 && <View style={styles.separator} />}
            <Pressable
              style={({ pressed }) => [
                styles.dropdownItem,
                selectedIndex === index && styles.dropdownItemSelected,
                pressed && styles.dropdownItemPressed
              ]}
              onPress={() => handleSelect(index)}
            >
              <View style={styles.dropdownItemContent}>
                <View style={styles.dropdownItemLeftContent}>
                  {getSegmentIcon(segment)}
                  <Text 
                    style={[
                      styles.dropdownItemText,
                      selectedIndex === index && styles.dropdownItemTextSelected,
                      getSegmentIcon(segment) ? styles.dropdownItemTextWithIcon : undefined
                    ]}
                  >
                    {getSegmentLabel(segment)}
                  </Text>
                </View>
                {selectedIndex === index && (
                  <Ionicons name="checkmark" size={20} color="#3478F6" />
                )}
              </View>
            </Pressable>
          </View>
        ))}
      </>
    );
  
    return (
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={onClose}
        >
          <View style={dropdownStyle}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{title}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#8A8A8D" />
              </Pressable>
            </View>
            
            {needsScrollView ? (
              <ScrollView 
                showsVerticalScrollIndicator={true}
                bounces={false}
                style={styles.scrollContainer}
              >
                {renderOptions()}
              </ScrollView>
            ) : (
              renderOptions()
            )}
          </View>
        </Pressable>
      </Modal>
    );
  });


const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    dropdownContainer: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    scrollContainer: {
        flexGrow: 0,
    },
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2C2C2E',
    },
    dropdownTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#8A8A8D',
    },
    closeButton: {
        padding: 4,
    },
    dropdownItem: {
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    dropdownItemPressed: {
        backgroundColor: '#2C2C2E',
    },
    dropdownItemSelected: {
        backgroundColor: '#2C3DCD20',
    },
    dropdownItemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownItemLeftContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dropdownItemText: {
        fontSize: 17,
        color: '#FFFFFF',
    },
    dropdownItemTextSelected: {
        color: '#3478F6',
        fontWeight: '600',
    },
    dropdownItemTextWithIcon: {
        marginLeft: 12,
    },
    separator: {
        height: 0.5,
        backgroundColor: '#2C2C2E',
        marginHorizontal: 16,
    },
});

export { ModernDropdown };

