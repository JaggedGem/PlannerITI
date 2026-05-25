import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomModalPortal } from './BottomModalPortal';
import { Colors } from '@/constants/Colors';

type StorageViewerProps = {
    visible: boolean;
    onClose: () => void;
    items: [string, string | null][];
};

const MODAL_STORAGE_COLORS = {
    surface: Colors.dark.backgroundTertiary,
    surfaceInset: Colors.dark.backgroundSecondary,
    textPrimary: Colors.dark.text,
    textSecondary: Colors.dark.mutedText,
    accent: Colors.dark.primary,
} as const;

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
                                color={MODAL_STORAGE_COLORS.textPrimary}
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
        backgroundColor: MODAL_STORAGE_COLORS.surface,
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
        color: MODAL_STORAGE_COLORS.accent,
        flex: 1,
    },
    valueContainer: {
        backgroundColor: MODAL_STORAGE_COLORS.surfaceInset,
        borderRadius: 4,
        padding: 8,
    },
    itemValue: {
        fontSize: 14,
        color: MODAL_STORAGE_COLORS.textPrimary,
    },
    nullValue: {
        fontSize: 14,
        color: MODAL_STORAGE_COLORS.textSecondary,
        fontStyle: 'italic',
    },
    showMoreText: {
        fontSize: 12,
        color: MODAL_STORAGE_COLORS.textSecondary,
        marginTop: 4,
        textAlign: 'right',
        fontStyle: 'italic',
    },
});
