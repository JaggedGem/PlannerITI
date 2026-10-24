import type { ApiResponse, ScheduleItem } from '@/services/scheduleService';

export function scheduleItem(name: string, id?: string): ScheduleItem {
  return {
    _id: `lesson:${name}`,
    subjectid: { name, ...(id ? { _id: id } : {}) },
    teacherids: { name: 'Teacher' },
    classroomids: { name: '124' },
    groupids: { name: 'Clasă întreagă', entireclass: 'true' },
    cards: { period: '1', weeks: 'both', days: 'monday' },
  };
}

export function sampleSchedule(): ApiResponse {
  const slot = (name: string) => ({ both: [scheduleItem(name)], par: [], impar: [] });
  return {
    data: {
      monday: { '1': slot('L.eng(A)'), '2': slot('Creare web') },
      tuesday: {
        '1': slot('Chimia'),
        '2': slot('Ed.fizica'),
        '3': slot('Matematica'),
        '4': slot('L.rom'),
      },
      wednesday: { '3': slot('Pv'), '4': slot('Inform') },
      thursday: {
        '1': slot('Prot.co'),
        '2': slot('Pv'),
        '3': slot('Creare web'),
        '4': slot('Matematica'),
      },
      friday: {
        '1': slot('Biologia'),
        '2': slot('Baz.legisl'),
        '3': slot('L.rom'),
        '4': slot('Matematica'),
      },
    },
    periods: [
      { _id: '1', starttime: '08:00', endtime: '09:20' },
      { _id: '2', starttime: '09:30', endtime: '10:50' },
      { _id: '3', starttime: '11:30', endtime: '12:50' },
      { _id: '4', starttime: '13:00', endtime: '14:20' },
    ],
  };
}
