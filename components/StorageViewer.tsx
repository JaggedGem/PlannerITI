import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { BottomSheetScrollView } from '@expo/ui/community/bottom-sheet';
import { Colors } from '@/constants/Colors';
import { BottomModalPortal } from './BottomModalPortal';

type StorageViewerProps = {
    visible: boolean;
    onClose: () => void;
    items: [string, string | null][];
};

export const StorageViewer = ({
    visible,
    onClose,
    items,
}: StorageViewerProps) => {
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleItemExpansion = useCallback((key: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    return (
        <BottomModalPortal
            isVisible={visible}
            onClose={onClose}
            backgroundColor={Colors.dark.storageContainerBackground}
            snapPoints={['90%', '96%']}
            contentContainerStyle={styles.sheetContent}
        >
            <BottomSheetScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={true}
            >
                {items.map(([key, value]) => (
                    <View key={key} style={styles.item}>
                        <TouchableOpacity
                            style={styles.itemHeader}
                            onPress={() => toggleItemExpansion(key)}
                        >
                            <Text style={styles.itemKey}>{key}</Text>
                            <MaterialIcons
                                name={
                                    expandedItems.has(key) ?
                                        'expand-less'
                                    :   'expand-more'
                                }
                                size={18}
                                color={Colors.dark.white}
                            />
                        </TouchableOpacity>

                        {value ?
                            <View style={styles.valueContainer}>
                                <Text
                                    style={styles.itemValue}
                                    numberOfLines={
                                        expandedItems.has(key) ? undefined : 3
                                    }
                                >
                                    {value}
                                </Text>
                                {!expandedItems.has(key) &&
                                    value.length > 150 && (
                                        <Text style={styles.showMoreText}>
                                            Tap to expand
                                        </Text>
                                    )}
                            </View>
                        :   <Text style={styles.nullValue}>null</Text>}
                    </View>
                ))}
            </BottomSheetScrollView>
        </BottomModalPortal>
    );
};

const styles = StyleSheet.create({
    sheetContent: {
        height: '100%',
        paddingHorizontal: 12,
        paddingTop: 0,
        paddingBottom: 12,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 24,
    },
    item: {
        backgroundColor: Colors.dark.surfaceRaisedAlt,
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
        color: Colors.dark.randomColors[5],
        flex: 1,
    },
    valueContainer: {
        backgroundColor: Colors.dark.overlayBlack20,
        borderRadius: 4,
        padding: 8,
    },
    itemValue: {
        fontSize: 14,
        color: Colors.dark.neutral200,
    },
    nullValue: {
        fontSize: 14,
        color: Colors.dark.neutral400,
        fontStyle: 'italic',
    },
    showMoreText: {
        fontSize: 12,
        color: Colors.dark.neutral400,
        marginTop: 4,
        textAlign: 'right',
        fontStyle: 'italic',
    },
});
