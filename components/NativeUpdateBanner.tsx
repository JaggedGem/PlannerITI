import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSyncExternalStore } from 'react';

import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { updateService } from '@/services/updateService';

export default function NativeUpdateBanner() {
  const state = useSyncExternalStore(
    updateService.subscribeToNativeUpdates,
    updateService.getNativeUpdateSnapshot,
  );
  const theme = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const copy = t('nativeUpdate');
  if (state.dismissed || state.phase === 'idle' || state.phase === 'downloading') return null;
  const ready = state.phase === 'ready';
  const failed = state.phase === 'error';
  const message = ready
    ? copy.ready
    : failed
      ? copy.failed
      : state.phase === 'recovery'
        ? copy.recovery
        : copy.recommended;
  const label = state.storeFallback
    ? copy.openStore
    : ready
      ? copy.install
      : failed
        ? copy.retry
        : copy.update;

  const handleAction = () => {
    const action = state.storeFallback
      ? updateService.openNativeUpdateStore()
      : ready
        ? updateService.completeNativeUpdate()
        : failed
          ? updateService.checkForNativeUpdate()
          : updateService.startNativeUpdate();
    void action.catch((error) => console.warn('Update action failed:', error));
  };

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        {
          bottom: Math.max(insets.bottom, 12) + 72,
          backgroundColor: theme.surfaceRaised,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => updateService.dismissNativeUpdate()}
          disabled={state.busy}
          style={styles.action}
        >
          <Text style={{ color: theme.subduedText }}>{copy.later}</Text>
        </TouchableOpacity>
        {(state.phase !== 'recovery' || state.storeFallback) && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleAction}
            disabled={state.busy}
            style={styles.action}
          >
            {state.busy ? (
              <ActivityIndicator color={theme.primaryStrong} />
            ) : (
              <Text style={[styles.actionText, { color: theme.accentBlue }]}>{label}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    zIndex: 1100,
    elevation: 8,
  },
  message: { fontSize: 14, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  action: { padding: 8, minHeight: 44, justifyContent: 'center' },
  actionText: { fontWeight: '600' },
});
