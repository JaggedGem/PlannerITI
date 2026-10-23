import React from 'react';

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTranslation } from '@/hooks/useTranslation';

export function AssignmentFormHeader({
  title,
  submitLabel,
  onCancel,
  onSubmit,
  disabled,
}: {
  title: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const { isLandscape } = useResponsiveLayout();
  const { t } = useTranslation();
  return (
    <ScreenHeader contentStyle={[styles.content, isLandscape && styles.compact]}>
      <Text style={[styles.title, isLandscape && styles.compactTitle]}>{title}</Text>
      <View style={[styles.actions, isLandscape && styles.compactActions]}>
        <TouchableOpacity onPress={onCancel} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>{t('common').cancel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          style={[styles.submit, disabled && styles.disabled]}
        >
          <Text style={[styles.submitText, disabled && { color: Colors.dark.neutral650 }]}>
            {submitLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 720, padding: 20 },
  compact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 16 },
  title: {
    color: Colors.dark.white,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  compactTitle: { fontSize: 22, flex: 1, marginBottom: 0 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compactActions: { gap: 16 },
  cancel: { padding: 8 },
  cancelText: { color: Colors.dark.red, fontSize: 17, fontWeight: '600' },
  submit: {
    backgroundColor: Colors.dark.primaryStrong,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  submitText: { color: Colors.dark.white, fontSize: 17, fontWeight: '600' },
  disabled: {
    backgroundColor: Colors.dark.disabledBackground,
    borderWidth: 1,
    borderColor: Colors.dark.disabledBorder,
  },
});
