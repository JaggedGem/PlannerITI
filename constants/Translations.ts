type TranslationType = {
  weekdays: {
    short: string[];
    long: string[];
  };
  months: string[];
  settings: {
    language: string;
    subGroup: string;
    account: {
      title: string;
      signIn: string;
      notVerified: string;
      refresh: string;
      privacy: string;
      terms: string;
      actions: {
        title: string;
        logout: string;
        delete: string;
      };
      deleteConfirm: {
        title: string;
        message: string;
        cancel: string;
        confirm: string;
      };
      deleteError: {
        title: string;
        message: string;
      };
    };
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
      allFieldsRequired: string;
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
      emptyFields: string;
      passwordMismatch: string;
      acceptPrivacy: string;
    };
    forgotPassword: {
      title: string;
      email: string;
      submit: string;
      backToLogin: string;
      success: string;
      error: string;
      emailRequired: string;
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
      emptyFields: string;
      passwordMismatch: string;
      invalidToken: string;
    };
    optional: {
      title: string;
      message: string;
      skip: string;
      continue: string;
    };
  };
  privacyPolicy: {
    title: string;
    sections: {
      dataCollection: {
        title: string;
        content: string[];
      };
      idnpSecurity: {
        title: string;
        content: string[];
      };
      passwordSecurity: {
        title: string;
        content: string[];
      };
      dataStorage: {
        title: string;
        content: string[];
      };
      thirdParty: {
        title: string;
        content: string[];
      };
      rights: {
        title: string;
        content: string[];
      };
      updates: {
        title: string;
        content: string;
      };
      contact: {
        title: string;
        content: string;
      };
    };
  };
  loginPromo: {
    body: string;
    stayConnected: string;
    getStarted: string;
    dismiss: string;
  };
};

export const translations: Record<'en' | 'ro' | 'ru', TranslationType> = {
  en: {
    weekdays: {
      short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    settings: {
      language: 'Language',
      subGroup: 'Subgroup',
      account: {
        title: 'Account',
        signIn: 'Sign In to Your Account',
        notVerified: 'Email not verified',
        refresh: 'Refresh',
        privacy: 'Privacy',
        terms: 'Terms',
        actions: {
          title: 'Account Actions',
          logout: 'Sign Out',
          delete: 'Delete Account',
        },
        deleteConfirm: {
          title: 'Delete Account',
          message: 'Are you sure you want to delete your account? This action cannot be undone.',
          cancel: 'Cancel',
          confirm: 'Delete',
        },
        deleteError: {
          title: 'Error',
          message: 'There was a problem deleting your account. Please try again.',
        },
      },
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
        success: 'Successfully logged in',
        allFieldsRequired: 'All fields are required',
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
        privacyAccept: 'I accept the Privacy Policy',
        emptyFields: 'All fields are required',
        passwordMismatch: 'Passwords do not match',
        acceptPrivacy: 'You must accept the Privacy Policy',
      },
      forgotPassword: {
        title: 'Reset Password',
        email: 'Email',
        submit: 'Send Reset Link',
        backToLogin: 'Back to Login',
        success: 'Password reset email sent',
        error: 'Could not send reset email',
        emailRequired: 'Email is required',
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
        error: 'Could not update password',
        emptyFields: 'All fields are required',
        passwordMismatch: 'Passwords do not match',
        invalidToken: 'Invalid token',
      },
      optional: {
        title: 'Complete Your Profile',
        message: 'Create an account to sync your data across devices and access additional features',
        skip: 'Skip for Now',
        continue: 'Create Account'
      }
    },
    privacyPolicy: {
      title: 'Privacy Policy',
      sections: {
        dataCollection: {
          title: 'Data Collection',
          content: [
            'We collect data to provide better services to our users.',
            'The data we collect includes personal information such as name, email address, and IDNP(optional).'
          ]
        },
        idnpSecurity: {
          title: 'IDNP Security',
          content: [
            'Your IDNP is stored securely on our server with encryption before transit and at rest which makes it impossible to decrypt without your password or intercepted by malicious people.',
            'You can choose to store your IDNP locally on your device instead of syncing it with the server if you feel that it\'s not secure and store it only on-device.',
            'We do not share your IDNP with third parties.'
          ]
        },
        passwordSecurity: {
          title: 'Password Security',
          content: [
            'We use strong encryption to protect your password encrypting it even before it reaches our server which means that even if we wanted we wouldn\'t be able to see your password.',
            'Your password is never stored in plain text and is only used to encrypt your IDNP before it reaches our server.',
            'Never share your password with anyone.'
          ]
        },
        dataStorage: {
          title: 'Data Storage',
          content: [
            'Your data is stored securely either on our server or locally on your device.',
            'You can opt out from our services at any time.',
          ]
        },
        thirdParty: {
          title: 'Third Party Services',
          content: [
            'We do not share your data with third parties.',
            'We may use third-party services to improve our app.'
          ]
        },
        rights: {
          title: 'Your Rights',
          content: [
            'You have the right to access your data.',
            'You have the right to request the deletion of your data.'
          ]
        },
        updates: {
          title: 'Policy Updates',
          content: 'We may update this policy from time to time. Please check this page regularly for updates.'
        },
        contact: {
          title: 'Contact Us',
          content: 'If you have any questions about this policy, please contact us at <link>privacy@p.jagged.me</link>.'
        }
      }
    },
    loginPromo: {
      body: 'Sign in to unlock the full potential of your planner with cross-device sync and premium features.',
      stayConnected: 'Stay Connected',
      getStarted: 'Get Started',
      dismiss: 'Maybe Later',
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
      subGroup: 'Subgrupă',
      account: {
        title: 'Cont',
        signIn: 'Conectează-te la Contul Tău',
        notVerified: 'Email neverificat',
        refresh: 'Reîmprospătează',
        privacy: 'Confidențialitate',
        terms: 'Termeni',
        actions: {
          title: 'Acțiuni Cont',
          logout: 'Deconectare',
          delete: 'Șterge Contul',
        },
        deleteConfirm: {
          title: 'Șterge Contul',
          message: 'Ești sigur că vrei să ștergi contul? Această acțiune nu poate fi anulată.',
          cancel: 'Anulează',
          confirm: 'Șterge',
        },
        deleteError: {
          title: 'Eroare',
          message: 'A apărut o problemă la ștergerea contului tău. Te rugăm să încerci din nou.',
        },
      },
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
        success: 'Conectare reușită',
        allFieldsRequired: 'Toate câmpurile sunt obligatorii'
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
        privacyAccept: 'Accept Politica de Confidențialitate',
        emptyFields: 'Toate câmpurile sunt obligatorii',
        passwordMismatch: 'Parolele nu se potrivesc',
        acceptPrivacy: 'Trebuie să accepți Politica de Confidențialitate',
      },
      forgotPassword: {
        title: 'Resetare Parolă',
        email: 'Email',
        submit: 'Trimite Link de Resetare',
        backToLogin: 'Înapoi la Conectare',
        success: 'Email de resetare trimis',
        error: 'Nu s-a putut trimite emailul',
        emailRequired: 'Emailul este obligatoriu',
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
        error: 'Nu s-a putut actualiza parola',
        emptyFields: 'Toate câmpurile sunt obligatorii',
        passwordMismatch: 'Parolele nu se potrivesc',
        invalidToken: 'Token invalid',
      },
      optional: {
        title: 'Completează Profilul',
        message: 'Creează un cont pentru a sincroniza datele între dispozitive și a accesa funcții suplimentare',
        skip: 'Poate Mai Târziu',
        continue: 'Creează Cont'
      }
    },
    privacyPolicy: {
      title: 'Politica de Confidențialitate',
      sections: {
        dataCollection: {
          title: 'Colectarea Datelor',
          content: [
            'Colectăm date pentru a oferi servicii mai bune utilizatorilor noștri.',
            'Datele pe care le colectăm includ informații personale precum numele, adresa de email și IDNP (opțional).'
          ]
        },
        idnpSecurity: {
          title: 'Securitatea IDNP',
          content: [
            'IDNP-ul dvs. este stocat în siguranță pe serverul nostru cu criptare înainte de transmitere și în timpul stocării, ceea ce face imposibilă decriptarea fără parola dvs. sau interceptarea de către persoane rău intenționate.',
            'Puteți alege să stocați IDNP-ul local pe dispozitivul dvs. în loc să îl sincronizați cu serverul dacă considerați că nu este sigur și să îl păstrați doar pe dispozitiv.',
            'Nu împărtășim IDNP-ul dvs. cu terțe părți.'
          ]
        },
        passwordSecurity: {
          title: 'Securitatea Parolei',
          content: [
            'Folosim criptare puternică pentru a vă proteja parola, criptând-o înainte să ajungă pe serverul nostru, ceea ce înseamnă că nici dacă am vrea nu am putea să vă vedem parola.',
            'Parola dvs. nu este niciodată stocată în text simplu și este folosită doar pentru a cripta IDNP-ul înainte să ajungă pe serverul nostru.',
            'Nu împărtășiți niciodată parola cu nimeni.'
          ]
        },
        dataStorage: {
          title: 'Stocarea Datelor',
          content: [
            'Datele dvs. sunt stocate în siguranță fie pe serverul nostru, fie local pe dispozitivul dvs.',
            'Puteți opta să nu mai folosiți serviciile noastre în orice moment.'
          ]
        },
        thirdParty: {
          title: 'Servicii Terțe',
          content: [
            'Nu împărtășim datele dvs. cu terțe părți.',
            'Putem folosi servicii terțe pentru a îmbunătăți aplicația noastră.'
          ]
        },
        rights: {
          title: 'Drepturile Dvs.',
          content: [
            'Aveți dreptul de a vă accesa datele.',
            'Aveți dreptul de a solicita ștergerea datelor dvs.'
          ]
        },
        updates: {
          title: 'Actualizări ale Politicii',
          content: 'Putem actualiza această politică din când în când. Vă rugăm să verificați această pagină regulat pentru actualizări.'
        },
        contact: {
          title: 'Contactați-ne',
          content: 'Dacă aveți întrebări despre această politică, vă rugăm să ne contactați la <link>privacy@p.jagged.me</link>.'
        }
      }
    },
    loginPromo: {
      body: 'Conectează-te pentru a debloca întregul potențial al planificatorului tău cu sincronizare între dispozitive și funcții premium.',
      stayConnected: 'Rămâi Conectat',
      getStarted: 'Începe Acum',
      dismiss: 'Poate Mai Târziu',
    },
  },
  ru: {
    weekdays: {
      short: ['Вск', 'Пнд', 'Втр', 'Срд', 'Чтв', 'Птн', 'Сбт'],
      long: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    },
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    settings: {
      language: 'Язык',
      subGroup: 'Подгруппа',
      account: {
        title: 'Аккаунт',
        signIn: 'Войдите в Ваш Аккаунт',
        notVerified: 'Email не подтвержден',
        refresh: 'Обновить',
        privacy: 'Конфиденциальность',
        terms: 'Условия',
        actions: {
          title: 'Действия с Аккаунтом',
          logout: 'Выйти',
          delete: 'Удалить Аккаунт',
        },
        deleteConfirm: {
          title: 'Удалить Аккаунт',
          message: 'Вы уверены, что хотите удалить свой аккаунт? Это действие нельзя отменить.',
          cancel: 'Отмена',
          confirm: 'Удалить',
        },
        deleteError: {
          title: 'Ошибка',
          message: 'Возникла проблема при удалении аккаунта. Пожалуйста, попробуйте снова.',
        },
      },
      idnp: {
        title: 'Настройки IDNP',
        clearButton: 'Очистить сохраненный IDNP',
        clearConfirmTitle: 'Очистить сохраненный IDNP',
        clearConfirmMessage: 'Вы уверены, что хотите очистить сохраненный IDNP? Вам нужно будет ввести его снова для доступа к оценкам.',
        clearConfirmCancel: 'Отмена',
        clearConfirmConfirm: 'Очистить',
      },
      group: {
        title: 'Группа',
        notFound: 'Не найдены группы, соответствующие',
        select: 'Выберите группу',
        search: 'Поиск группы...',
        searching: 'Поиск группы...',
        failed: 'Не удалось загрузить группы. Проверьте подключение к интернету и попробуйте снова.',
      },
      customPeriods: {
        title: 'Пользовательские периоды',
        add: 'Добавить новый период',
        edit: 'Редактировать период',
        name: 'Название',
        time: 'Время',
        days: 'Дни',
        color: 'Цвет',
        enabled: 'Включено',
        save: 'Сохранить период',
        noPeriodsYet: 'Пользовательские периоды еще не добавлены',
        colorPicker: 'Выбрать цвет',
        cancel: 'Отмена',
        confirm: 'Подтвердить',
        deleteConfirmTitle: 'Удалить период',
        deleteConfirmMessage: 'Вы уверены, что хотите удалить этот период?',
        delete: 'Удалить',
      },
    },
    schedule: {
      noClassesWeekend: 'Нет занятий в выходные',
      noClassesDay: 'На этот день занятия не запланированы',
      room: 'Кабинет',
      evenWeek: 'Четная неделя',
      oddWeek: 'Нечетная неделя',
      prevWeek: 'Пред',
      nextWeek: 'След',
      currentWeek: 'Текущая неделя',
      loading: 'Загрузка расписания...',
      error: 'Не удалось загрузить расписание. Попробуйте позже.',
      in: 'в',
      dayView: 'По дням',
      weekView: 'По неделям',
    },
    subgroup: {
      group1: 'Подгруппа 1',
      group2: 'Подгруппа 2',
    },
    tabs: {
      today: 'Сегодня',
      schedule: 'Расписание',
      assignments: 'Задания',
      settings: 'Настройки',
      grades: 'Оценки',
    },
    grades: {
      title: 'Оценки',
      average: 'Средний балл',
      noGrades: 'Нет оценок',
      lastUpdated: 'Данные обновлены',
      dataStale: 'и могут быть устаревшими. Нажмите кнопку обновления.',
      refreshing: 'Обновление данных...',
      absences: 'Пропуски',
      unexcused: 'Неуважительные',
      networkError: 'Не удалось получить данные. Проверьте IDNP и попробуйте снова.',
      networkErrorCache: 'Ошибка сети. Используются кэшированные данные от',
      categories: {
        exam: 'Экзамены',
        test: 'Тест',
        homework: 'Домашняя работа',
        project: 'Проект',
        other: 'Другое',
      },
      sortOptions: {
        date: 'Дата',
        grade: 'Оценка',
        category: 'Категория',
      },
      add: 'Добавить оценку',
      edit: 'Редактировать оценку',
      form: {
        subject: 'Предмет',
        grade: 'Оценка',
        category: 'Категория',
        date: 'Дата',
        notes: 'Заметки',
        save: 'Сохранить оценку',
      },
      idnp: {
        title: 'Введите IDNP',
        description: 'Введите 13-значный IDNP для доступа к оценкам',
        placeholder: 'Введите 13-значный IDNP',
        disclaimer: 'Ваш IDNP будет сохранен только локально на устройстве.',
        continue: 'Продолжить',
        error: 'IDNP должен состоять из 13 цифр',
      },
      semesters: {
        all: 'Все семестры',
        yearSemester: 'Год {{year}}, Семестр {{semester}}',
        semester: 'Семестр {{semester}}',
        noData: 'Нет данных об экзаменах',
        noDataSemester: 'Нет экзаменов в Семестре {{semester}}',
        connecting: 'Подключение к серверу CEITI. Это может занять некоторое время, пожалуйста, подождите...',
      },
      subjects: {
        noExams: 'Нет доступных экзаменов',
        upcoming: 'Предстоящие',
        noSubjects: 'Нет предметов для Семестра {{semester}}',
      },
    },
    update: {
      availableTitle: 'Доступно обновление',
      availableMessage: 'Доступна новая версия приложения. Хотите загрузить ее сейчас?',
      readyTitle: 'Обновление готово',
      readyMessage: 'Обновление загружено и готово к установке. Приложение перезапустится для применения обновления.',
      errorTitle: 'Ошибка обновления',
      errorMessage: 'Произошла проблема при загрузке обновления. Пожалуйста, попробуйте снова.',
      downloadingMessage: 'Загрузка обновления...',
      downloading: 'Пожалуйста, подождите, идет загрузка обновления',
      downloadButton: 'Загрузить сейчас',
      restartButton: 'Перезапустить приложение',
      laterButton: 'Позже',
      retryButton: 'Попробовать снова',
    },
    loading: 'Загрузка...',
    auth: {
      login: {
        title: 'Добро пожаловать',
        email: 'Email',
        password: 'Пароль',
        submit: 'Войти',
        forgotPassword: 'Забыли пароль?',
        noAccount: 'Нет аккаунта?',
        signupLink: 'Зарегистрироваться',
        error: 'Неверный email или пароль',
        success: 'Успешный вход',
        allFieldsRequired: 'Все поля обязательны',
      },
      signup: {
        title: 'Создать аккаунт',
        email: 'Email',
        password: 'Пароль',
        confirmPassword: 'Подтвердите пароль',
        submit: 'Зарегистрироваться',
        hasAccount: 'Уже есть аккаунт?',
        loginLink: 'Войти',
        error: 'Не удалось создать аккаунт',
        success: 'Аккаунт успешно создан',
        privacyPolicy: 'Политика конфиденциальности',
        privacyPolicyLink: 'Просмотреть политику конфиденциальности',
        privacyAccept: 'Я принимаю политику конфиденциальности',
        emptyFields: 'Все поля обязательны',
        passwordMismatch: 'Пароли не совпадают',
        acceptPrivacy: 'Необходимо принять политику конфиденциальности',
      },
      forgotPassword: {
        title: 'Сброс пароля',
        email: 'Email',
        submit: 'Отправить ссылку для сброса',
        backToLogin: 'Вернуться к входу',
        success: 'Письмо для сброса пароля отправлено',
        error: 'Не удалось отправить письмо',
        emailRequired: 'Email обязателен',
      },
      verifyEmail: {
        title: 'Подтвердите Email',
        message: 'Пожалуйста, проверьте почту для подтверждения',
        resend: 'Отправить письмо повторно',
        success: 'Email успешно подтвержден',
        error: 'Не удалось подтвердить email',
      },
      resetPassword: {
        title: 'Установить новый пароль',
        newPassword: 'Новый пароль',
        confirmPassword: 'Подтвердите пароль',
        submit: 'Обновить пароль',
        success: 'Пароль успешно обновлен',
        error: 'Не удалось обновить пароль',
        emptyFields: 'Все поля обязательны',
        passwordMismatch: 'Пароли не совпадают',
        invalidToken: 'Недействительный токен',
      },
      optional: {
        title: 'Завершите профиль',
        message: 'Создайте аккаунт для синхронизации данных между устройствами и доступа к дополнительным функциям',
        skip: 'Пропустить',
        continue: 'Создать аккаунт',
      },
    },
    privacyPolicy: {
      title: 'Политика конфиденциальности',
      sections: {
        dataCollection: {
          title: 'Сбор данных',
          content: [
            'Мы собираем данные для предоставления лучших услуг нашим пользователям.',
            'Собираемые данные включают личную информацию, такую как имя, email и IDNP (опционально).',
          ],
        },
        idnpSecurity: {
          title: 'Безопасность IDNP',
          content: [
            'Ваш IDNP хранится безопасно на нашем сервере с шифрованием при передаче и хранении, что делает невозможным его расшифровку без вашего пароля или перехват злоумышленниками.',
            'Вы можете выбрать хранение IDNP локально на устройстве вместо синхронизации с сервером.',
            'Мы не передаем ваш IDNP третьим лицам.',
          ],
        },
        passwordSecurity: {
          title: 'Безопасность пароля',
          content: [
            'Мы используем надежное шифрование для защиты вашего пароля, шифруя его еще до отправки на сервер.',
            'Ваш пароль никогда не хранится в открытом виде и используется только для шифрования IDNP.',
            'Никогда никому не сообщайте свой пароль.',
          ],
        },
        dataStorage: {
          title: 'Хранение данных',
          content: [
            'Ваши данные хранятся безопасно на нашем сервере или локально на вашем устройстве.',
            'Вы можете отказаться от наших услуг в любое время.',
          ],
        },
        thirdParty: {
          title: 'Сторонние сервисы',
          content: [
            'Мы не передаем ваши данные третьим лицам.',
            'Мы можем использовать сторонние сервисы для улучшения нашего приложения.',
          ],
        },
        rights: {
          title: 'Ваши права',
          content: [
            'У вас есть право на доступ к вашим данным.',
            'У вас есть право запросить удаление ваших данных.',
          ],
        },
        updates: {
          title: 'Обновления политики',
          content: 'Мы можем обновлять эту политику время от времени. Пожалуйста, регулярно проверяйте эту страницу на наличие обновлений.',
        },
        contact: {
          title: 'Свяжитесь с нами',
          content: 'Если у вас есть вопросы об этой политике, пожалуйста, свяжитесь с нами по адресу <link>privacy@p.jagged.me</link>.',
        },
      },
    },
    loginPromo: {
      body: 'Войдите, чтобы разблокировать весь потенциал вашего планировщика с синхронизацией между устройствами и премиум-функциями.',
      stayConnected: 'Оставайтесь на связи',
      getStarted: 'Начать',
      dismiss: 'Может быть позже',
    },
  }

};

export type Translation = typeof translations.en;