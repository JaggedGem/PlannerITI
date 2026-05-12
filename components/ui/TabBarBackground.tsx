import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Shared bottom spacing helper that works both inside and outside tab screens.
export default undefined;

export function useBottomTabOverflow() {
    const { bottom } = useSafeAreaInsets();
    return bottom;
}
