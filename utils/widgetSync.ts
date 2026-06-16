import { requestWidgetUpdate } from 'react-native-android-widget';

export function refreshWidget(widgetName: string, renderFn: () => any) {
  try {
    requestWidgetUpdate({
      widgetName,
      renderWidget: renderFn,
      widgetNotFound: () => {},
    });
  } catch {
    // Widget update silently fails - user might not have the widget added
  }
}