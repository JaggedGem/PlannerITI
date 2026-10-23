import type { ModalProps } from 'react-native';

// React Native modals otherwise restrict iPhone rotation even when the app allows it.
export const MODAL_ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape-left',
  'landscape-right',
];
