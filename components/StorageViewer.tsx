import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type StorageViewerProps = {
  visible: boolean;
  onClose: () => void;
  items: [string, string | null][];
};

export const StorageViewer = ({ visible, onClose, items }: StorageViewerProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Function to toggle item expansion
  const toggleItemExpansion = useCallback((key: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>AsyncStorage Contents</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <MaterialIcons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.list}>
            {items.map(([key, value]) => (
              <View key={key} style={styles.item}>
                <TouchableOpacity 
                  style={styles.itemHeader}
                  onPress={() => toggleItemExpansion(key)}
                >
                  <Text style={styles.itemKey}>{key}</Text>
                  <MaterialIcons 
                    name={expandedItems.has(key) ? "expand-less" : "expand-more"} 
                    size={18} 
                    color="white" 
                  />
                </TouchableOpacity>
                
                {value ? (
                  <View style={styles.valueContainer}>
                    <Text style={styles.itemValue} numberOfLines={expandedItems.has(key) ? undefined : 3}>
                      {value}
                    </Text>
                    {!expandedItems.has(key) && value.length > 150 && (
                      <Text style={styles.showMoreText}>Tap to expand</Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.nullValue}>null</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  list: {
    flex: 1,
  },
  item: {
    backgroundColor: '#232433',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemKey: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#42A5F5',
    flex: 1,
  },
  valueContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 4,
    padding: 8,
  },
  itemValue: {
    fontSize: 14,
    color: '#E0E0E0',
  },
  nullValue: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
  },
  showMoreText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
    textAlign: 'right',
    fontStyle: 'italic',
  },
}); 