import { useState, useEffect } from 'react';
import { scheduleService } from '@/services/scheduleService';
import DayView from '@/components/schedule/DayView';
import WeekView from '@/components/schedule/WeekView';

export default function Schedule() {
  const [settings, setSettings] = useState(scheduleService.getSettings());
  
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

  return settings.scheduleView === 'day' ? <DayView /> : <WeekView />;
}