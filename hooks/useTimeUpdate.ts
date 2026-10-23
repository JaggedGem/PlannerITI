import { useEffect, useState } from 'react';

import { AppState } from 'react-native';

const MINUTE_MS = 60_000;

/** Schedule labels have minute precision; pause their clock when the app is inactive. */
export function useTimeUpdate() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      setTime(new Date());
      timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS));
    };
    const resume = () => {
      clearTimeout(timer);
      tick();
    };
    if (AppState.currentState === 'active') {
      timer = setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS));
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else clearTimeout(timer);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return time;
}
