type TranslationType = {
  weekdays: {
    short: string[];
    long: string[];
  };
  months: string[];
  settings: {
    language: string;
    group: string;
    idnp: {
      title: string;
      clearButton: string;
      clearConfirmTitle: string;
      clearConfirmMessage: string;
      clearConfirmCancel: string;
      clearConfirmConfirm: string;
    };
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
    grades: string;
  };
  grades: {
    title: string;
    average: string;
    noGrades: string;
    categories: {
      exam: string;
      test: string;
      homework: string;
      project: string;
      other: string;
    };
    sortOptions: {
      date: string;
      grade: string;
      category: string;
    };
    add: string;
    edit: string;
    form: {
      subject: string;
      grade: string;
      category: string;
      date: string;
      notes: string;
      save: string;
    };
    idnp: {
      title: string;
      description: string;
      placeholder: string;
      disclaimer: string;
      continue: string;
      error: string;
    };
    semesters: {
      all: string;
      yearSemester: string;
      noData: string;
      noDataSemester: string;
    };
    subjects: {
      noExams: string;
      upcoming: string;
    };
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
      idnp: {
        title: 'IDNP Settings',
        clearButton: 'Clear Saved IDNP',
        clearConfirmTitle: 'Clear Saved IDNP',
        clearConfirmMessage: 'Are you sure you want to clear your saved IDNP? You will need to enter it again to access your grades.',
        clearConfirmCancel: 'Cancel',
        clearConfirmConfirm: 'Clear',
      },
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
      grades: 'Grades'
    },
    grades: {
      title: 'Grades',
      average: 'Average',
      noGrades: 'No grades recorded yet',
      categories: {
        exam: 'Exam',
        test: 'Test',
        homework: 'Homework',
        project: 'Project',
        other: 'Other'
      },
      sortOptions: {
        date: 'Date',
        grade: 'Grade',
        category: 'Category'
      },
      add: 'Add Grade',
      edit: 'Edit Grade',
      form: {
        subject: 'Subject',
        grade: 'Grade',
        category: 'Category',
        date: 'Date',
        notes: 'Notes',
        save: 'Save Grade'
      },
      idnp: {
        title: 'Enter your IDNP',
        description: 'Please enter your 13-digit IDNP to access your grades',
        placeholder: 'Enter 13-digit IDNP',
        disclaimer: 'Your IDNP will only be stored locally on your device.',
        continue: 'Continue',
        error: 'IDNP must be exactly 13 digits',
      },
      semesters: {
        all: 'All Semesters',
        yearSemester: 'Year {{year}}, Semester {{semester}}',
        noData: 'No exam data available',
        noDataSemester: 'No exams available for Semester {{semester}}',
      },
      subjects: {
        noExams: 'No exams available',
        upcoming: 'Upcoming',
      },
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
      idnp: {
        title: 'Setări IDNP',
        clearButton: 'Șterge IDNP salvat',
        clearConfirmTitle: 'Șterge IDNP salvat',
        clearConfirmMessage: 'Sigur doriți să ștergeți IDNP-ul salvat? Va trebui să îl introduceți din nou pentru a accesa notele.',
        clearConfirmCancel: 'Anulează',
        clearConfirmConfirm: 'Șterge',
      },
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
      grades: 'Note'
    },
    grades: {
      title: 'Note',
      average: 'Media',
      noGrades: 'Nicio notă înregistrată încă',
      categories: {
        exam: 'Examen',
        test: 'Test',
        homework: 'Temă',
        project: 'Proiect',
        other: 'Altele'
      },
      sortOptions: {
        date: 'Data',
        grade: 'Nota',
        category: 'Categorie'
      },
      add: 'Adaugă Notă',
      edit: 'Editează Nota',
      form: {
        subject: 'Materie',
        grade: 'Notă',
        category: 'Categorie',
        date: 'Data',
        notes: 'Observații',
        save: 'Salvează Nota'
      },
      idnp: {
        title: 'Introduceți IDNP-ul',
        description: 'Vă rugăm să introduceți IDNP-ul format din 13 cifre pentru a accesa notele',
        placeholder: 'Introduceți IDNP-ul (13 cifre)',
        disclaimer: 'IDNP-ul dvs. va fi stocat doar local pe dispozitiv.',
        continue: 'Continuă',
        error: 'IDNP-ul trebuie să conțină exact 13 cifre',
      },
      semesters: {
        all: 'Toate Semestrele',
        yearSemester: 'Anul {{year}}, Semestrul {{semester}}',
        noData: 'Nu există date despre examene',
        noDataSemester: 'Nu există examene pentru Semestrul {{semester}}',
      },
      subjects: {
        noExams: 'Nu există examene disponibile',
        upcoming: 'În curând',
      },
    },
  },
};

export type Translation = typeof translations.en;