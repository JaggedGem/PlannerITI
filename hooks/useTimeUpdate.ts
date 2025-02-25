import { useState, useEffect } from 'react';

interface ScheduleItem {
  startTime: string;
  endTime: string;
}

export function useTimeUpdate() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Only run effect once on mount

  return time;
}