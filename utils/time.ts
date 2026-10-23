/** Minutes since midnight, accepting both H:mm and HH:mm API values. */
export const timeToMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
};

export const hourIndex = (hour: number, use12HourFormat: boolean): number =>
  use12HourFormat ? hour % 12 : hour;

export const hourFromIndex = (index: number, use12HourFormat: boolean, isPM: boolean): number =>
  use12HourFormat ? (index % 12) + (isPM ? 12 : 0) : index;
