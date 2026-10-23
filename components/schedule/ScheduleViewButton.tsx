import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRef, useState } from 'react';

import { StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useTranslation } from '@/hooks/useTranslation';
import { ScheduleView } from '@/services/scheduleService';
import { MenuAnchor } from '@/utils/anchoredMenu';

import ViewModeMenu from './ViewModeMenu';

export default function ScheduleViewButton({
  isEvenWeek,
  currentView,
}: {
  isEvenWeek: boolean;
  currentView: ScheduleView;
}) {
  const { t } = useTranslation();
  const buttonRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const [snapshot, setSnapshot] = useState<{
    rect: MenuAnchor;
    windowWidth: number;
    windowHeight: number;
    leftInset: number;
    topInset: number;
  } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const weekText = isEvenWeek ? t('schedule').evenWeek : t('schedule').oddWeek;
  const anchor =
    snapshot?.windowWidth === width &&
    snapshot.windowHeight === height &&
    snapshot.leftInset === insets.left &&
    snapshot.topInset === insets.top
      ? snapshot.rect
      : null;

  return (
    <>
      <TouchableOpacity
        ref={buttonRef}
        style={styles.button}
        accessibilityRole="button"
        accessibilityState={{ expanded: Boolean(anchor) }}
        onPress={() =>
          buttonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) =>
            setSnapshot({
              rect: { x, y, width: buttonWidth, height: buttonHeight },
              windowWidth: width,
              windowHeight: height,
              leftInset: insets.left,
              topInset: insets.top,
            }),
          )
        }
      >
        <Text style={styles.text}>{weekText}</Text>
      </TouchableOpacity>
      <ViewModeMenu
        isOpen={Boolean(anchor)}
        anchor={anchor}
        onClose={() => setSnapshot(null)}
        weekText={weekText}
        currentView={currentView}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.dark.primaryStrong,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    flexShrink: 0,
  },
  text: { color: Colors.dark.white, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
});
