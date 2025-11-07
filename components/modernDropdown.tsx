import { Ionicons } from "@expo/vector-icons";
import React, { memo, useEffect, useState, useCallback } from "react";
import { 
  Pressable, 
  View, 
  Text, 
  Platform, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TextInput,
  ActivityIndicator,
  TouchableOpacity 
} from "react-native";
import * as Haptics from 'expo-haptics';
import { Modal } from "react-native";
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  Layout,
  useAnimatedStyle,
  withTiming,
  withSequence,
  useSharedValue
} from 'react-native-reanimated';

export type SegmentItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  isCustom?: boolean;
  isSelected?: boolean;
  isCustomPeriod?: boolean;
  badge?: string;
  rightComponent?: React.ReactNode;
  leftComponent?: React.ReactNode;
  metadata?: any;
};

export type Category = {
  id: string;
  title: string;
  data: SegmentItem[];
  emptyMessage?: string;
};

export type Tab = {
  id: string;
  label: string;
  categories?: Category[];
  items?: SegmentItem[];
  emptyMessage?: string;
  renderCustomContent?: () => React.ReactNode;
  rightComponent?: React.ReactNode;
  hasOwnSearchBar?: boolean;
};

export type SearchBarPosition = 'top' | 'above-content' | 'within-tabs';

export type ModernDropdownProps = {
  title: string;
  isVisible: boolean;
  onClose: () => void;
  
  // Single list mode
  items?: SegmentItem[];
  selectedItemId?: string;
  onSelectItem?: (item: SegmentItem) => void;
  
  // Category mode
  categories?: Category[];
  
  // Tab mode
  tabs?: Tab[];
  selectedTabId?: string;
  onTabChange?: (tabId: string) => void;
  
  // Search options
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchBarPosition?: SearchBarPosition;
  onSearch?: (text: string) => void;
  
  // Loading state
  isLoading?: boolean;
  loadingText?: string;
  
  // Empty states
  emptyResultsMessage?: string;
  
  // Styling and behavior
  maxHeight?: number;
  maxOptions?: number;
  disableScroll?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
  
  // Additional content
  headerRightComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
  
  // Actions
  onAction?: (actionId: string, data?: any) => void;
  
  // New option for individual search bars per tab
  searchPerTab?: boolean;
};

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const ModernDropdown = memo((props: ModernDropdownProps) => {
  const {
    title,
    isVisible, 
    onClose, 
    items,
    selectedItemId,
    onSelectItem,
    categories,
    tabs,
    selectedTabId,
    onTabChange,
    showSearch = false,
    searchPlaceholder = "Search",
    searchBarPosition = 'top',
    searchPerTab = false,
    onSearch,
    isLoading = false,
    loadingText = "Loading...",
    emptyResultsMessage = "No results found",
    maxHeight,
    maxOptions,
    disableScroll = false,
    animationType = 'fade',
    headerRightComponent,
    footerComponent,
    onAction
  } = props;
  
  // Local state
  const [searchText, setSearchText] = useState('');
  const [filteredItems, setFilteredItems] = useState<SegmentItem[]>(items || []);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>(categories || []);
  const [filteredTabs, setFilteredTabs] = useState<Tab[]>(tabs || []);
  const [activeTabId, setActiveTabId] = useState<string>(selectedTabId || (tabs && tabs.length > 0 ? tabs[0].id : ''));
  const [itemPress, setItemPress] = useState<string | null>(null);
  
  // Animation values
  const buttonScale = useSharedValue(1);
  
    const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  
  // Filter items based on search text
  useEffect(() => {
    // Filter items if in single list mode
    if (items) {
      if (searchText) {
        const filtered = items.filter(item => 
          item.label.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredItems(filtered);
      } else {
        setFilteredItems(items);
      }
    }
    
    // Filter categories if in category mode
    if (categories) {
      if (searchText) {
        const filtered = categories.map(category => ({
          ...category,
          data: category.data.filter(item => 
            item.label.toLowerCase().includes(searchText.toLowerCase())
          )
        })).filter(category => category.data.length > 0);
        setFilteredCategories(filtered);
      } else {
        setFilteredCategories(categories);
      }
    }
    
    // Filter tabs if in tab mode
    if (tabs) {
      if (searchText) {
        const filtered = tabs.map(tab => {
          // Check if tab has categories
          if (tab.categories) {
            const filteredCategories = tab.categories.map(category => ({
              ...category,
              data: category.data.filter(item => 
                item.label.toLowerCase().includes(searchText.toLowerCase())
              )
            })).filter(category => category.data.length > 0);
            
            return {
              ...tab,
              categories: filteredCategories
            };
          }
          
          // Check if tab has direct items
          if (tab.items) {
            const filteredItems = tab.items.filter(item => 
              item.label.toLowerCase().includes(searchText.toLowerCase())
            );
            
            return {
              ...tab,
              items: filteredItems
            };
          }
          
          return tab;
        });
        
        setFilteredTabs(filtered);
      } else {
        setFilteredTabs(tabs);
      }
    }
    
    // Call external search handler if provided
    if (onSearch) {
      onSearch(searchText);
    }
  }, [searchText, items, categories, tabs]);
  
  // Update active tab when selectedTabId changes
  useEffect(() => {
    if (selectedTabId) {
      setActiveTabId(selectedTabId);
    }
  }, [selectedTabId]);
  
  // Reset search when modal opens or closes
  useEffect(() => {
    if (!isVisible) {
      setSearchText('');
    }
  }, [isVisible]);
  
  // Calculate dynamic max height based on screen size and content
  const calculateMaxHeight = (): number => {
    // If a fixed height is provided, use it
    if (maxHeight) return maxHeight;
    
    // Otherwise, use 60% of screen height as the fixed default height
    return screenHeight * 0.6;
  };

  // Handle item selection
  const handleSelectItem = (item: SegmentItem) => {
      // Trigger haptic feedback
      Haptics.selectionAsync();
    
    // Animate the pressed item
    setItemPress(item.id);
    setTimeout(() => setItemPress(null), 300);
    
    // Animate button scale
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );
    
    // Call the selection callback
    if (onSelectItem) {
      onSelectItem(item);
    }
  };
  
  // Handle tab change
  const handleTabChange = (tabId: string) => {
    // Trigger haptic feedback
    Haptics.selectionAsync();
    
    // Set active tab
    setActiveTabId(tabId);
    
    // Call the tab change callback
    if (onTabChange) {
      onTabChange(tabId);
    }
  };
  
  // Handle action
  const handleAction = (actionId: string, data?: any) => {
    if (onAction) {
      onAction(actionId, data);
    }
  };
  
  // Render a single item
  const renderItem = (item: SegmentItem, index: number, categoryId?: string) => {
    const isSelected = item.isSelected || item.id === selectedItemId;
    
    return (
      <AnimatedTouchableOpacity
        key={`item-${item.id}`}
        style={[
          styles.itemContainer,
          isSelected && styles.itemContainerSelected,
          item.isCustomPeriod && { borderLeftWidth: 4, borderLeftColor: item.color || '#3478F6' }
        ]}
        onPress={() => handleSelectItem(item)}
        activeOpacity={0.7}
        layout={Layout.springify()}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemLeftContent}>
            {item.leftComponent}
            {item.icon}
            <View style={styles.itemTextContainer}>
                  <Text 
                    style={[
                  styles.itemText,
                  isSelected && styles.itemTextSelected,
                  item.icon ? styles.itemTextWithIcon : undefined
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {item.label}
              </Text>
              
              {/* Custom badge/label */}
              {(item.badge || item.isCustom || item.isCustomPeriod) && (
                <View style={[
                  styles.badge, 
                  { backgroundColor: item.color || '#3478F6' }
                ]}>
                  <Text style={styles.badgeText}>
                    {item.badge || (item.isCustomPeriod ? 'Period' : 'Custom')}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.itemRightContent}>
            {item.rightComponent}
            {isSelected && (
              <Ionicons name="checkmark-circle" size={22} color="#3478F6" />
                )}
              </View>
        </View>
      </AnimatedTouchableOpacity>
    );
  };
  
  // Render category with items
  const renderCategory = (category: Category, categoryIndex: number) => {
    return (
      <Animated.View 
        key={`category-${category.id}`}
        style={styles.categoryContainer}
        entering={FadeIn.delay(categoryIndex * 50).duration(200)}
        layout={Layout.springify()}
      >
        {/* Category Header */}
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>{category.title}</Text>
        </View>
        
        {/* Category Items */}
        {category.data.length > 0 ? (
          <View>
            {category.data.map((item, itemIndex) => (
              <React.Fragment key={`category-item-${item.id}`}>
                {itemIndex > 0 && <View style={styles.separator} />}
                {renderItem(item, itemIndex, category.id)}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {category.emptyMessage || emptyResultsMessage}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };
  
  // Render tabs
  const renderTabs = () => {
    if (!tabs || tabs.length === 0) return null;
    
    const currentTab = filteredTabs.find(tab => tab.id === activeTabId);
    
    return (
      <>
        {/* Tab Bar */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}
          >
            {filteredTabs.map((tab, index) => (
              <TouchableOpacity
                key={`tab-${tab.id}`}
                style={[
                  styles.tabButton,
                  activeTabId === tab.id && styles.tabButtonActive
                ]}
                onPress={() => handleTabChange(tab.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    activeTabId === tab.id && styles.tabButtonTextActive
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.rightComponent}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Tab Content */}
        <Animated.View 
          style={styles.tabContent}
          key={`tab-content-${activeTabId}`}
          entering={FadeIn.duration(200)}
        >
          {/* Tab's own search bar if enabled */}
          {(searchPerTab || currentTab?.hasOwnSearchBar) && (
            renderSearchBar()
          )}
          
          {/* Custom content if provided */}
          {currentTab?.renderCustomContent && currentTab.renderCustomContent()}
          
          {/* Items if present */}
          {currentTab?.items && currentTab.items.length > 0 ? (
            currentTab.items.map((item, index) => (
              <React.Fragment key={`tab-item-${item.id}`}>
                {index > 0 && <View style={styles.separator} />}
                {renderItem(item, index)}
              </React.Fragment>
            ))
          ) : currentTab?.items && currentTab.items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {currentTab.emptyMessage || emptyResultsMessage}
              </Text>
            </View>
          ) : null}
          
          {/* Categories if present */}
          {currentTab?.categories && currentTab.categories.length > 0 ? (
            <View style={styles.categoriesWrapper}>
              {currentTab.categories.map((category, index) => (
                <React.Fragment key={`tab-category-${category.id}`}>
                  {index > 0 && <View style={styles.categorySeparator} />}
                  {renderCategory(category, index)}
                </React.Fragment>
              ))}
            </View>
          ) : currentTab?.categories && currentTab.categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {currentTab.emptyMessage || emptyResultsMessage}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </>
    );
  };
  
  // Render search bar
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={16} color="#8A8A8D" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#8A8A8D"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchText.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={16} color="#8A8A8D" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  
  // Render loading state
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" color="#3478F6" />
      <Text style={styles.loadingText}>{loadingText}</Text>
    </View>
  );
  
  // Render empty state
  const renderEmpty = (message: string = emptyResultsMessage) => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
  
  // Render main content based on data type
  const renderContent = () => {
    // Show loading state
    if (isLoading) {
      return renderLoading();
    }
    
    // Tabs mode
    if (tabs && tabs.length > 0) {
      return renderTabs();
    }
    
    // Categories mode
    if (categories && categories.length > 0) {
      if (filteredCategories.length === 0) {
        return renderEmpty();
      }
      
      return (
        <View style={styles.categoriesWrapper}>
          {filteredCategories.map((category, index) => (
            <React.Fragment key={`category-${category.id}`}>
              {index > 0 && <View style={styles.categorySeparator} />}
              {renderCategory(category, index)}
            </React.Fragment>
          ))}
        </View>
      );
    }
    
    // Single list mode
    if (items) {
      if (filteredItems.length === 0) {
        return renderEmpty();
      }
      
      return filteredItems.map((item, index) => (
        <React.Fragment key={`item-${item.id}`}>
          {index > 0 && <View style={styles.separator} />}
          {renderItem(item, index)}
        </React.Fragment>
      ));
    }
    
    return null;
  };
  
  // Determine if we need to use ScrollView
  const needsScrollView = !disableScroll && (
    (items && items.length > 5) ||
    (categories && categories.length > 0) ||
    (tabs && tabs.length > 0)
  );
  
  // Determine modal animation type
  const modalAnimationType = animationType === 'none' ? undefined : animationType;
  
  // Calculate fixed modal style
  const dropdownStyle = {
    ...styles.dropdownContainer,
    height: calculateMaxHeight(), // Changed from maxHeight to a fixed height
  };
  
  // Use a view directly instead of Modal component
  return (
    isVisible ? (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'flex-end',
          zIndex: 9999,
          elevation: 9999
        }}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={onClose}
        >
          <Animated.View 
            style={[dropdownStyle, { marginBottom: 0 }]}
            entering={animationType === 'slide' ? SlideInDown.springify() : FadeIn.duration(200)}
          >
            {/* Header */}
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>{title}</Text>
            <View style={styles.headerRightContainer}>
              {headerRightComponent}
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#8A8A8D" />
              </Pressable>
            </View>
          </View>
          
          {/* Search bar at top position - only show if not using per-tab search */}
          {showSearch && searchBarPosition === 'top' && !searchPerTab && renderSearchBar()}
          
          {/* Tabs with search bar inside */}
          {showSearch && searchBarPosition === 'within-tabs' && tabs && (
            <View style={styles.tabsWithSearchContainer}>
              {renderSearchBar()}
              {renderTabs()}
            </View>
          )}
          
          {/* Main content */}
            {needsScrollView ? (
              <ScrollView 
                showsVerticalScrollIndicator={true}
                bounces={false}
                style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContentContainer}
              keyboardShouldPersistTaps="handled"
            >
              {/* Search bar above content */}
              {showSearch && searchBarPosition === 'above-content' && renderSearchBar()}
              
              {/* Main content */}
              {renderContent()}
              
              {/* Footer */}
              {footerComponent && (
                <View style={styles.footerContainer}>
                  {footerComponent}
                </View>
              )}
              </ScrollView>
            ) : (
            <View style={styles.contentContainer}>
              {/* Search bar above content */}
              {showSearch && searchBarPosition === 'above-content' && renderSearchBar()}
              
              {/* Main content */}
              {renderContent()}
              
              {/* Footer */}
              {footerComponent && (
                <View style={styles.footerContainer}>
                  {footerComponent}
                </View>
            )}
          </View>
          )}
        </Animated.View>
        </Pressable>
      </View>
    ) : null
  );
});

const styles = StyleSheet.create({
  // Modal container styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
    },
    dropdownContainer: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 9999,
        zIndex: 10000,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        marginBottom: 0,
    },
    scrollContainer: {
        flexGrow: 0,
    },
  scrollContentContainer: {
    paddingBottom: 16,
  },
  contentContainer: {
    paddingBottom: 16,
  },
  
  // Header styles
    dropdownHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2C2C2E',
    },
    dropdownTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#8A8A8D',
    },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
    closeButton: {
        padding: 4,
    },
  
  // Search bar styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    height: 40,
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  
  // Tabs styles
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
    paddingVertical: 8,
  },
  tabsScrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  tabButtonActive: {
    backgroundColor: '#2C3DCD20',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tabButtonTextActive: {
    color: '#3478F6',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  tabsWithSearchContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  
  // Category styles
  categoriesWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryContainer: {
    marginVertical: 4,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  categoryHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#242426',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8D',
    textTransform: 'uppercase',
  },
  categorySeparator: {
    height: 8,
    backgroundColor: '#121214',
  },
  
  // Item styles
  itemContainer: {
    paddingVertical: 12,
        paddingHorizontal: 20,
    },
  itemContainerSelected: {
        backgroundColor: '#2C3DCD20',
    },
  itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
  itemLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTextContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    flex: 1,
    },
  itemText: {
    fontSize: 16,
        color: '#FFFFFF',
    flex: 1,
    },
  itemTextSelected: {
        color: '#3478F6',
        fontWeight: '600',
    },
  itemTextWithIcon: {
        marginLeft: 12,
    },
  itemRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Badge styles
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#3478F6',
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // Separator
    separator: {
        height: 0.5,
        backgroundColor: '#2C2C2E',
        marginHorizontal: 16,
    },
  
  // Loading and empty states
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#8A8A8D',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8A8A8D',
    textAlign: 'center',
  },
  
  // Footer
  footerContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    marginTop: 8,
  },
});

export { ModernDropdown };

