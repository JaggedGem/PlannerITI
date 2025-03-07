type TranslationType = {
  weekdays: {
    short: string[];
    long: string[];
  };
  months: string[];
  settings: {
    language: string;
    subGroup: string;
    idnp: {
      title: string;
      clearButton: string;
      clearConfirmTitle: string;
      clearConfirmMessage: string;
      clearConfirmCancel: string;
      clearConfirmConfirm: string;
    };
    group: {
      title: string;
      notFound: string;
      select: string;
      search: string;
      searching: string;
      failed: string;
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
      cancel: string;
      confirm: string;
      deleteConfirmTitle: string;
      deleteConfirmMessage: string;
      delete: string;
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
    in: string;
    dayView: string;
    weekView: string;
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
    lastUpdated: string;
    dataStale: string;
    refreshing: string;
    absences: string;
    unexcused: string;
    networkError: string;
    networkErrorCache: string;
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
      semester: string;
      noData: string;
      noDataSemester: string;
      connecting: string;
    };
    subjects: {
      noExams: string;
      upcoming: string;
      noSubjects: string;
    };
  };
  update: {
    availableTitle: string;
    availableMessage: string;
    readyTitle: string;
    readyMessage: string;
    errorTitle: string;
    errorMessage: string;
    downloadingMessage: string;
    downloading: string;
    downloadButton: string;
    restartButton: string;
    laterButton: string;
    retryButton: string;
  };
  loading: string;
  auth: {
    login: {
      title: string;
      email: string;
      password: string;
      submit: string;
      forgotPassword: string;
      noAccount: string;
      signupLink: string;
      error: string;
      success: string;
    };
    signup: {
      title: string;
      email: string;
      password: string;
      confirmPassword: string;
      submit: string;
      hasAccount: string;
      loginLink: string;
      error: string;
      success: string;
      privacyPolicy: string;
      privacyPolicyLink: string;
      privacyAccept: string;
    };
    forgotPassword: {
      title: string;
      email: string;
      submit: string;
      backToLogin: string;
      success: string;
      error: string;
    };
    verifyEmail: {
      title: string;
      message: string;
      resend: string;
      success: string;
      error: string;
    };
    resetPassword: {
      title: string;
      newPassword: string;
      confirmPassword: string;
      submit: string;
      success: string;
      error: string;
    };
    optional: {
      title: string;
      message: string;
      skip: string;
      continue: string;
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
      subGroup: 'Subgroup',
      idnp: {
        title: 'IDNP Settings',
        clearButton: 'Clear Saved IDNP',
        clearConfirmTitle: 'Clear Saved IDNP',
        clearConfirmMessage: 'Are you sure you want to clear your saved IDNP? You will need to enter it again to access your grades.',
        clearConfirmCancel: 'Cancel',
        clearConfirmConfirm: 'Clear',
      },
      group: {
        title: 'Group',
        notFound: 'No groups found matching',
        select: 'Select a Group',
        search: 'Search for a group...',
        searching: 'Searching for group...',
        failed: 'Failed to load groups. Please check your internet connection and try again.',
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
        cancel: 'Cancel',
        confirm: 'Confirm',
        deleteConfirmTitle: 'Delete Period',
        deleteConfirmMessage: 'Are you sure you want to delete this period?',
        delete: 'Delete',
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
      in: 'in',
      dayView: 'Day View',
      weekView: 'Week View',
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
      grades: 'Grades',
    },
    grades: {
      title: 'Grades',
      average: 'Average',
      noGrades: 'No grades recorded yet',
      lastUpdated: 'Your data was last updated on',
      dataStale: 'and might be outdated. Press the refresh button to update.',
      refreshing: 'Refreshing data...',
      absences: 'Absences',
      unexcused: 'Unexcused',
      networkError: 'Unable to retrieve data. Please check your IDNP and try again.',
      networkErrorCache: 'Network error. Using cached data from',
      categories: {
        exam: 'Exams',
        test: 'Test',
        homework: 'Homework',
        project: 'Project',
        other: 'Other',
      },
      sortOptions: {
        date: 'Date',
        grade: 'Grade',
        category: 'Category',
      },
      add: 'Add Grade',
      edit: 'Edit Grade',
      form: {
        subject: 'Subject',
        grade: 'Grade',
        category: 'Category',
        date: 'Date',
        notes: 'Notes',
        save: 'Save Grade',
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
        semester: 'Semester {{semester}}',
        noData: 'No exam data available',
        noDataSemester: 'No exams available for Semester {{semester}}',
        connecting: 'Connecting to the CEITI server. This might take some time, please be patient...',
      },
      subjects: {
        noExams: 'No exams available',
        upcoming: 'Upcoming',
        noSubjects: 'No subjects available for Semester {{semester}}',
      },
    },
    update: {
      availableTitle: 'Update Available',
      availableMessage: 'A new version of the app is available. Would you like to download it now?',
      readyTitle: 'Update Ready',
      readyMessage: 'The update has been downloaded and is ready to install. The app will restart to apply the update.',
      errorTitle: 'Update Error',
      errorMessage: 'There was a problem downloading the update. Please try again.',
      downloadingMessage: 'Downloading update...',
      downloading: 'Please wait while the update is being downloaded',
      downloadButton: 'Download Now',
      restartButton: 'Restart App',
      laterButton: 'Later',
      retryButton: 'Try Again',
    },
    loading: 'Loading...',
    auth: {
      login: {
        title: 'Welcome Back',
        email: 'Email',
        password: 'Password',
        submit: 'Sign In',
        forgotPassword: 'Forgot Password?',
        noAccount: "Don't have an account?",
        signupLink: 'Sign Up',
        error: 'Invalid email or password',
        success: 'Successfully logged in'
      },
      signup: {
        title: 'Create Account',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        submit: 'Sign Up',
        hasAccount: 'Already have an account?',
        loginLink: 'Sign In',
        error: 'Could not create account',
        success: 'Account created successfully',
        privacyPolicy: 'Privacy Policy',
        privacyPolicyLink: 'View Privacy Policy',
        privacyAccept: 'I accept the Privacy Policy'
      },
      forgotPassword: {
        title: 'Reset Password',
        email: 'Email',
        submit: 'Send Reset Link',
        backToLogin: 'Back to Login',
        success: 'Password reset email sent',
        error: 'Could not send reset email'
      },
      verifyEmail: {
        title: 'Verify Your Email',
        message: 'Please check your email for a verification link',
        resend: 'Resend Verification Email',
        success: 'Email verified successfully',
        error: 'Could not verify email'
      },
      resetPassword: {
        title: 'Set New Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm New Password',
        submit: 'Update Password',
        success: 'Password updated successfully',
        error: 'Could not update password'
      },
      optional: {
        title: 'Complete Your Profile',
        message: 'Create an account to sync your data across devices and access additional features',
        skip: 'Skip for Now',
        continue: 'Create Account'
      }
    }
  },
  ro: {
    weekdays: {
      short: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'],
      long: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
    },
    months: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
    settings: {
      language: 'Limbă',
      subGroup: 'Subgrupă',
      idnp: {
        title: 'Setări IDNP',
        clearButton: 'Șterge IDNP salvat',
        clearConfirmTitle: 'Șterge IDNP salvat',
        clearConfirmMessage: 'Sigur doriți să ștergeți IDNP-ul salvat? Va trebui să îl introduceți din nou pentru a accesa notele.',
        clearConfirmCancel: 'Anulează',
        clearConfirmConfirm: 'Șterge',
      },
      group: {
        title: 'Grupă',
        notFound: 'Nu au fost găsite grupe care să se potrivească',
        select: 'Selectează o Grupă',
        search: 'Caută o grupă...',
        searching: 'Se caută grupa...',
        failed: 'Nu s-a reușit încărcarea grupelor. Verificați conexiunea la internet și încercați din nou.',
      },
      customPeriods: {
        title: 'Lecții Personalizate',
        add: 'Adaugă Lecție Nouă',
        edit: 'Editează Lecția',
        name: 'Nume',
        time: 'Timp',
        days: 'Zile',
        color: 'Culoare',
        enabled: 'Activat',
        save: 'Salvează Lecția Nouă',
        noPeriodsYet: 'Nu există lecții personalizate',
        colorPicker: 'Alege Culoarea',
        cancel: 'Anulează',
        confirm: 'Confirmă',
        deleteConfirmTitle: 'Șterge Lecția',
        deleteConfirmMessage: 'Sigur doriți să ștergeți această lecție?',
        delete: 'Șterge',
      },
    },
    schedule: {
      noClassesWeekend: 'Nu sunt lecții în weekend',
      noClassesDay: 'Nu sunt lecții programate pentru această zi',
      room: 'Sala',
      evenWeek: 'Săptămână Pară',
      oddWeek: 'Săptămână Impară',
      prevWeek: 'Prec',
      nextWeek: 'Urm',
      currentWeek: 'Săptămâna Curentă',
      loading: 'Se încarcă orarul...',
      error: 'Nu s-a putut încărca orarul. Încercați din nou mai târziu.',
      in: 'în',
      dayView: 'Vizualizare pe zi',
      weekView: 'Vizualizare pe săptămână',
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
      lastUpdated: 'Datele dvs. au fost actualizate ultima dată pe',
      dataStale: 'și ar putea fi învechite. Apăsați butonul de reîmprospătare pentru a actualiza.',
      refreshing: 'Se actualizează datele...',
      absences: 'Absențe',
      unexcused: 'Nemotivate',
      networkError: 'Nu s-au putut recupera datele. Verificați IDNP-ul și încercați din nou.',
      networkErrorCache: 'Eroare de rețea. Se folosesc date stocate din',
      categories: {
        exam: 'Examene',
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
        semester: 'Semestrul {{semester}}',
        noData: 'Nu există date despre examene',
        noDataSemester: 'Nu există examene pentru Semestrul {{semester}}',
        connecting: 'Se conectează la serverul CEITI. Acest lucru poate dura ceva timp, vă rugăm să aveți răbdare...'
      },
      subjects: {
        noExams: 'Nu există examene disponibile',
        upcoming: 'În curând',
        noSubjects: 'Nu există materii disponibile pentru Semestrul {{semester}}',
      },
    },
    update: {
      availableTitle: 'Actualizare Disponibilă',
      availableMessage: 'O nouă versiune a aplicației este disponibilă. Doriți să o descărcați acum?',
      readyTitle: 'Actualizare Pregătită',
      readyMessage: 'Actualizarea a fost descărcată și este gata de instalare. Aplicația va reporni pentru a aplica actualizarea.',
      errorTitle: 'Eroare de Actualizare',
      errorMessage: 'A apărut o problemă la descărcarea actualizării. Vă rugăm să încercați din nou.',
      downloadingMessage: 'Se descarcă actualizarea...',
      downloading: 'Vă rugăm să așteptați în timp ce actualizarea este descărcată',
      downloadButton: 'Descarcă Acum',
      restartButton: 'Repornește Aplicația',
      laterButton: 'Mai Târziu',
      retryButton: 'Încearcă din nou',
    },
    loading: 'Se încarcă...',
    auth: {
      login: {
        title: 'Bun Venit',
        email: 'Email',
        password: 'Parolă',
        submit: 'Conectare',
        forgotPassword: 'Ai uitat parola?',
        noAccount: 'Nu ai cont?',
        signupLink: 'Înregistrare',
        error: 'Email sau parolă invalidă',
        success: 'Conectare reușită'
      },
      signup: {
        title: 'Creează Cont',
        email: 'Email',
        password: 'Parolă',
        confirmPassword: 'Confirmă Parola',
        submit: 'Înregistrare',
        hasAccount: 'Ai deja cont?',
        loginLink: 'Conectare',
        error: 'Nu s-a putut crea contul',
        success: 'Cont creat cu succes',
        privacyPolicy: 'Politica de Confidențialitate',
        privacyPolicyLink: 'Vezi Politica de Confidențialitate',
        privacyAccept: 'Accept Politica de Confidențialitate'
      },
      forgotPassword: {
        title: 'Resetare Parolă',
        email: 'Email',
        submit: 'Trimite Link de Resetare',
        backToLogin: 'Înapoi la Conectare',
        success: 'Email de resetare trimis',
        error: 'Nu s-a putut trimite emailul'
      },
      verifyEmail: {
        title: 'Verifică Emailul',
        message: 'Te rugăm să verifici emailul pentru linkul de verificare',
        resend: 'Retrimite Email de Verificare',
        success: 'Email verificat cu succes',
        error: 'Nu s-a putut verifica emailul'
      },
      resetPassword: {
        title: 'Setează Parolă Nouă',
        newPassword: 'Parolă Nouă',
        confirmPassword: 'Confirmă Parola Nouă',
        submit: 'Actualizează Parola',
        success: 'Parola actualizată cu succes',
        error: 'Nu s-a putut actualiza parola'
      },
      optional: {
        title: 'Completează Profilul',
        message: 'Creează un cont pentru a sincroniza datele între dispozitive și a accesa funcții suplimentare',
        skip: 'Poate Mai Târziu',
        continue: 'Creează Cont'
      }
    }
  },
};

export type Translation = typeof translations.en;