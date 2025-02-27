type TranslationType = {
  weekdays: {
    short: string[];
    long: string[];
  };
  months: string[];
  settings: {
    language: string;
    group: string;
    customPeriods: {
      title: string;
      add: string;
      edit: string;
      name: string;
      time: string;
      days: string;
      color: string;
      enabled: string;
      save: string;
      noPeriodsYet: string;
      colorPicker: string;
    };
  };
  schedule: {
    noClassesWeekend: string;
    noClassesDay: string;
    room: string;
    evenWeek: string;
    oddWeek: string;
    prevWeek: string;
    nextWeek: string;
    currentWeek: string;
    loading: string;
    error: string;
  };
  subgroup: {
    group1: string;
    group2: string;
  };
  tabs: {
    today: string;
    schedule: string;
    assignments: string;
    settings: string;
  };
};

export const translations: Record<'en' | 'ro', TranslationType> = {
  en: {
    weekdays: {
      short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    settings: {
      language: 'Language',
      group: 'Subgroup',
      customPeriods: {
        title: 'Custom Periods',
        add: 'Add New Period',
        edit: 'Edit Period',
        name: 'Name',
        time: 'Time',
        days: 'Days',
        color: 'Color',
        enabled: 'Enabled',
        save: 'Save Period',
        noPeriodsYet: 'No custom periods added yet',
        colorPicker: 'Choose Color',
      },
    },
    schedule: {
      noClassesWeekend: 'No classes on weekends',
      noClassesDay: 'No classes scheduled for this day',
      room: 'Room',
      evenWeek: 'Even Week',
      oddWeek: 'Odd Week',
      prevWeek: 'Prev',
      nextWeek: 'Next',
      currentWeek: 'Current Week',
      loading: 'Loading schedule...',
      error: 'Unable to load schedule. Please try again later.',
    },
    subgroup: {
      group1: 'Subgroup 1',
      group2: 'Subgroup 2',
    },
    tabs: {
      today: 'Today',
      schedule: 'Schedule',
      assignments: 'Assignments',
      settings: 'Settings',
    },
  },
  ro: {
    weekdays: {
      short: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'],
      long: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
    },
    months: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
    settings: {
      language: 'Limbă',
      group: 'Subgrupă',
      customPeriods: {
        title: 'Perioade Personalizate',
        add: 'Adaugă Perioadă',
        edit: 'Editează Perioada',
        name: 'Nume',
        time: 'Timp',
        days: 'Zile',
        color: 'Culoare',
        enabled: 'Activat',
        save: 'Salvează Perioada',
        noPeriodsYet: 'Nu există perioade personalizate',
        colorPicker: 'Alege Culoarea',
      },
    },
    schedule: {
      noClassesWeekend: 'Nu sunt cursuri în weekend',
      noClassesDay: 'Nu sunt cursuri programate pentru această zi',
      room: 'Sala',
      evenWeek: 'Săptămână Pară',
      oddWeek: 'Săptămână Impară',
      prevWeek: 'Prec',
      nextWeek: 'Urm',
      currentWeek: 'Săptămâna Curentă',
      loading: 'Se încarcă orarul...',
      error: 'Nu s-a putut încărca orarul. Încercați din nou mai târziu.',
    },
    subgroup: {
      group1: 'Subgrupa 1',
      group2: 'Subgrupa 2',
    },
    tabs: {
      today: 'Astăzi',
      schedule: 'Orar',
      assignments: 'Teme',
      settings: 'Setări',
    },
  },
};

export type Translation = typeof translations.en;