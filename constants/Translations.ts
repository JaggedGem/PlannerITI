type TranslationType = {
  common: {
    error: string;
    alert: string;
    success: string;
    ok: string;
    cancel: string;
    confirm: string;
    delete: string;
    done: string;
    back: string;
    retry: string;
    search: string;
    noResults: string;
    clear: string;
    hour: string;
    minute: string;
    dayPeriod: string;
    unknown: string;
    tapToExpand: string;
    noValue: string;
    notFoundTitle: string;
    notFoundMessage: string;
    goHome: string;
  };
  scheduleDetails: {
    allRemoved: string;
    emptyOverride: string;
    removedPeriods: string;
    showingPeriods: string;
    customSchedule: string;
    followsWeekday: string;
    overrideActive: string;

    special: string;
    recoveryTitle: string;
    specialTitle: string;
    noReason: string;
    replaces: string;
    temporaryOverride: string;
    swipeForMore: string;
    now: string;
    noAssignments: string;
    subgroup: string;
    examBadge: string;
    thesisBadge: string;
    periodNumber: string;
    customPeriod: string;
    allWeekdays: string;
    offline: string;
    usingCache: string;
    refreshFailed: string;
    overrideLabel: string;
  };
  assignmentEditor: {
    titleAndCourseRequired: string;
    titleRequired: string;
    saveFailed: string;
    notFound: string;
    loadFailed: string;
    updateFailed: string;
    goToSettings: string;

    thisDay: string;
  };
  accountDeletion: {
    title: string;
    message: string;
    password: string;
    passwordRequired: string;
    networkError: string;
    incorrectPassword: string;
    genericError: string;
    requestSent: string;
    emailMessage: string;
    openEmail: string;
  };
  appInfo: {
    title: string;
    currentVersion: string;
    currentOta: string;
    releaseChannel: string;
    production: string;
    beta: string;
    development: string;
  };
  developer: {
    title: string;
    storageCleared: string;
    clearStorage: string;
    scheduleReset: string;
    resetSchedule: string;
    expoGoUnavailable: string;
    expoGoNotifications: string;
    notificationsReset: string;
    notificationsResetFailed: string;
    resetNotifications: string;
    viewStorageFailed: string;
    viewStorage: string;
    injected: string;
    removed: string;
    gradesAdded: string;
    gradesRemoved: string;
    gradeInjectionFailed: string;
    removeGrades: string;
    injectGrades: string;
    tapToRemove: string;
    tapToAdd: string;
  };
  notificationMessages: {
    defaultChannel: string;
    assignmentChannel: string;
    assignmentChannelDescription: string;
    digestChannel: string;
    digestChannelDescription: string;
    dueInHour: string;
    dueTomorrow: string;
    dueInDays: string;
    priority: string;
    noUpcoming: string;
    item: string;
    more: string;
    dayTitle: string;
    upcomingTitle: string;
    summary: string;
    viewDetails: string;
    viewAll: string;
    assignmentCount: {
      one: string;
      few: string;
      many: string;
      other: string;
    };
  };
  demoGrades: {
    familyName: string;
    firstName: string;
    specialization: string;
    status: string;
    mathematics: string;
    programming: string;
    english: string;
    databases: string;
    mathematicsFinal: string;
    programmingProject: string;
    programmingFinal: string;
  };
  weekdays: {
    short: string[];
    long: string[];
  };
  months: string[];
  general: {
    more: string;
    less: string;
    found: string;
  };
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
      syncToggle: string;
      syncTitle: string;
      syncEnabledInfo: string;
      syncDisabledInfo: string;
      syncedStatus: string;
      noIdnpSaved: string;
      loginRequired: string;
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
    notifications: {
      title: string;
      enabled: string;
      enabledDescription: string;
      disabledDescription: string;
      time: string;
      timeSettings: string;
      timeDescription: string;
      selectTime: string;
      reminderDays: string;
      reminderDaysDescription: string;
      importantAssignments: string;
      otherAssignments: string;
      exams: string;
      tests: string;
      quizzes: string;
      homework: string;
      projects: string;
      other: string;
      dailyReminders: string;
      dailyRemindersDescription: string;
      dailyExams: string;
      dailyTests: string;
      dailyQuizzes: string;
      testNotification: string;
      days: string;
      sendDigestNow: string;
      digestSentTitle: string;
      digestSentMessage: string;
      errorTitle: string;
      digestErrorMessage: string;
    };
    schedule: {
      title: string;
      refresh: string;
      refreshing: string;
      group: string;
      lastUpdated: string;
      noRecentRefresh: string;
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
    assignments: string;
    assessments: string;
    loadingAssignments: string;
    noRegularClassesToday: string;
    noRegularClassesWeek: string;
    modifiedAcademicSchedule: string;
    modifiedAcademicWeek: string;
    nextClass: string;
    nextClassLoading: string;
    noUpcomingClasses: string;
    noUpcomingClassesHint: string;
    inferredPeriod: string;
    examDayTitle: string;
    examWeekTitle: string;
    examDaySubtitle: string;
    examWeekSubtitle: string;
    officialExamSchedule: string;
    noOfficialExams: string;
    noOfficialExamsHint: string;
    academicPeriod: {
      teaching: string;
      exam: string;
      vacation: string;
      practiceIntro: string;
      practiceInstructional: string;
      practiceTechnological: string;
      practiceSpecialty1: string;
      practiceSpecialty2: string;
      practiceSpecialty3: string;
      practiceProduction: string;
      qualificationExam: string;
      dualEmployerTraining: string;
      interSemesterBreak: string;
      summerBreak: string;
    };
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
  assignments: {
    title: string;
    loading: string;
    empty: string;
    addNew: string;
    save: string;
    edit: string;
    delete: string;
    update: string;
    updating: string;
    editTitle: string;
    segments: {
      dueDate: string;
      classes: string;
      priority: string;
    };
    saving: string;
    common: {
      uncategorized: string;
      period: string;
      due: string;
      orphaned: string;
      orphanedAssignments: string;
      orphanedReason: string;
    };
    types: {
      homework: string;
      test: string;
      exam: string;
      project: string;
      quiz: string;
      lab: string;
      essay: string;
      presentation: string;
      other: string;
    };
    days: {
      yesterday: string;
      today: string;
      tomorrow: string;
      monday: string;
      tuesday: string;
      wednesday: string;
      thursday: string;
      friday: string;
      saturday: string;
      sunday: string;
      nextWeek: string;
      inTwoWeeks: string;
      thisWeek: string;
      in: string;
      weeks: string;
    };
    titlePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    optional: string;
    type: string;
    autoDetectedType: string;
    dueDate: string;
    dueTime: string;
    markAsPriority: string;
    selectSubject: string;
    periods: {
      first: string;
      second: string;
      third: string;
      fourth: string;
      fifth: string;
    };
    useNextPeriod: string;
    noUpcomingClasses: string;
    inNextTwoWeeks: string;
    findingNextClass: string;
    assignmentDueText: string;
    on: string;
    at: string;
    thisSubject: string;
    noUpcomingClassesFound: string;
    recent: string;
    all: string;
    custom: string;
    loadingSubjects: string;
    noSubjects: string;
    noCustomSubjects: string;
    enterSubjectName: string;
    add: string;
    subtasks: {
      title: string;
      add: string;
      addFirst: string;
      placeholder: string;
      progress: string;
      loading: string;
      hint: string;
    };
    status: {
      overdue: string;
      completedIn: string;
      dueIn: string;
      dueTomorrow: string;
      dueToday: string;
      in: string;
      inMinute: string;
      inMinutes: string;
      inHour: string;
      inHours: string;
      inDay: string;
      inDays: string;
      inWeek: string;
      inWeeks: string;
    };
    archive: {
      title: string;
      pastDue: string;
      completed: string;
      noItems: string;
      archiveAll: string;
      archiveConfirmation: string;
    };
    errors: {
      switchingTip: string;
      stabilityMode: string;
      recoveringTitle: string;
      recovering: string;
      tip: string;
      somethingWrong: string;
    };
  };
  grades: {
    title: string;
    average: string;
    noGrades: string;
    lastUpdated: string;
    neverUpdated: string;
    dataStale: string;
    refreshing: string;
    updatedLabel: string;
    absences: string;
    unexcused: string;
    networkError: string;
    networkErrorCache: string;
    categories: {
      practice: string;
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
    calculator: {
      title: string;
      selectSubject: string;
      currentGrades: string;
      noGrades: string;
      currentAverage: string;
      targetAverage: string;
      targetGrade: string;
      minimumGradesNeeded: string;
      calculate: string;
      clear: string;
      noSolution: string;
      resultsTitle: string;
      alreadyAchieved: string;
      calculationType: string;
      semesterOnly: string;
      annualAverage: string;
      allGrades: string;
    };
    pdf: {
      export: string;
      exportTitle: string;
      exportDescription: string;
      preparing: string;
      shareTitle: string;
      shareMessage: string;
      errorTitle: string;
      errorMessage: string;
      generatedOn: string;
      summaryTitle: string;
      totalSemesters: string;
      totalSubjects: string;
      totalGrades: string;
      impactedSubjects: string;
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
      pending: string;
      noExams: string;
      upcoming: string;
      noSubjects: string;
      finalAverage: string;
      withoutExam: string;
      thesis: string;
      exam: string;
      newBadge: string;
      officialSchedule: string;
      noOfficialExams: string;
    };
  };
  recovery: {
    recoveryDay: string;
    noReason: string;
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
  nativeUpdate: {
    recommended: string;
    ready: string;
    recovery: string;
    failed: string;
    update: string;
    install: string;
    openStore: string;
    retry: string;
    later: string;
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
    common: {
      error: 'Error',
      alert: 'Notice',
      success: 'Success',
      ok: 'OK',
      cancel: 'Cancel',
      confirm: 'Confirm',
      delete: 'Delete',
      done: 'Done',
      back: 'Back',
      retry: 'Try again',
      search: 'Search',
      noResults: 'No results found',
      clear: 'Clear',
      hour: 'Hour',
      minute: 'Minute',
      dayPeriod: 'AM/PM',
      unknown: 'Unknown',
      tapToExpand: 'Tap to expand',
      noValue: 'No value',
      notFoundTitle: 'Screen not found',
      notFoundMessage: 'This screen does not exist.',
      goHome: 'Go to home screen',
    },
    scheduleDetails: {
      allRemoved: 'All periods were removed for this day ({{count}}).',
      emptyOverride: 'No classes are scheduled for this day due to a schedule change.',
      removedPeriods: 'Removed periods: {{periods}}.',
      showingPeriods: 'Showing {{count}} of {{total}} periods.',
      customSchedule: 'Custom schedule ({{count}} periods).',
      followsWeekday: 'Follows {{day}} classes.',
      overrideActive: 'A temporary schedule change is active for this day.',

      special: 'Special',
      recoveryTitle: 'Make-up day schedule',
      specialTitle: 'Special schedule',
      noReason: 'No reason provided',
      replaces: 'Replaces {{day}}',
      temporaryOverride: 'Temporary schedule change',
      swipeForMore: 'Swipe to see more',
      now: 'Now',
      noAssignments: 'No assignments for this period',
      subgroup: 'SG {{number}}',
      examBadge: 'E',
      thesisBadge: 'T',
      periodNumber: 'Period {{number}}',
      customPeriod: 'Custom period',
      allWeekdays: 'All weekdays',
      offline: 'Offline',
      usingCache: 'Using cached schedule',
      refreshFailed: 'Failed to refresh schedule',
      overrideLabel: 'Schedule change: {{reason}}',
    },
    assignmentEditor: {
      titleAndCourseRequired: 'Please enter a title and select a course.',
      titleRequired: 'Please enter a title for the assignment.',
      saveFailed: 'Failed to save assignment. Please try again.',
      notFound: 'Assignment not found.',
      loadFailed: 'Failed to load assignment. Please try again.',
      updateFailed: 'Failed to update assignment. Please try again.',
      goToSettings: 'Go to Settings',

      thisDay: 'this {{day}}',
    },
    accountDeletion: {
      title: 'Confirm account deletion',
      message: 'Please enter your password to confirm account deletion.',
      password: 'Your password',
      passwordRequired: 'Please enter your password.',
      networkError: 'Network error. Please check your connection.',
      incorrectPassword: 'Incorrect password. Please try again.',
      genericError: 'Something went wrong. Please try again.',
      requestSent: 'Deletion request sent',
      emailMessage:
        "We've sent a confirmation email to verify your account deletion request. Please check your inbox and follow the instructions to complete the process.",
      openEmail: 'Open email app',
    },
    appInfo: {
      title: 'App version and updates',
      currentVersion: 'Current version',
      currentOta: 'Current OTA version',
      releaseChannel: 'Release channel',
      production: 'Production',
      beta: 'Beta',
      development: 'Development',
    },
    developer: {
      title: 'Developer tools',
      storageCleared: 'AsyncStorage has been cleared',
      clearStorage: 'Clear AsyncStorage',
      scheduleReset: 'Schedule settings have been reset',
      resetSchedule: 'Reset schedule settings',
      expoGoUnavailable: 'Unavailable in Expo Go',
      expoGoNotifications:
        'Notifications are disabled in Expo Go. Use a development build to test notifications.',
      notificationsReset: 'Notification system reset. This can resolve timing issues.',
      notificationsResetFailed: 'Failed to reset notification system',
      resetNotifications: 'Reset notification system',
      viewStorageFailed: 'Failed to view AsyncStorage contents',
      viewStorage: 'View AsyncStorage',
      injected: 'Injected',
      removed: 'Removed',
      gradesAdded: 'Added 5 random grades immediately. Tap again to remove.',
      gradesRemoved: 'Removed injected grades. Tap again to add back.',
      gradeInjectionFailed: 'Could not toggle grade injection',
      removeGrades: 'Remove injected grades',
      injectGrades: 'Inject 5 random grades',
      tapToRemove: 'Injected now • tap to remove',
      tapToAdd: 'Tap to add instantly',
    },
    notificationMessages: {
      defaultChannel: 'General notifications',
      assignmentChannel: 'Assignments',
      assignmentChannelDescription: 'Assignment due dates and reminders',
      digestChannel: 'Daily assignment summary',
      digestChannelDescription: 'Daily summary of upcoming assignments',
      dueInHour: '“{{title}}” {{course}} is due in 1 hour.',
      dueTomorrow: '“{{title}}” {{course}} is due tomorrow at {{time}}.',
      dueInDays: '“{{title}}” {{course}} is due {{time}}.',
      priority: 'Priority: {{type}}',
      noUpcoming: 'No assignments due soon.',
      item: '“{{title}}” {{course}} at {{time}}',
      more: '+ {{count}} more…',
      dayTitle: '{{assignments}} • {{day}}',
      upcomingTitle: '{{assignments}} coming up',
      summary: 'Assignment summary:',
      viewDetails: 'Tap to view details.',
      viewAll: 'Tap to view all.',
      assignmentCount: {
        one: '{{count}} assignment',
        few: '{{count}} assignments',
        many: '{{count}} assignments',
        other: '{{count}} assignments',
      },
    },
    demoGrades: {
      familyName: 'Demo',
      firstName: 'Student',
      specialization: 'Software development',
      status: 'Demo account',
      mathematics: 'Mathematics',
      programming: 'Programming',
      english: 'English',
      databases: 'Database systems',
      mathematicsFinal: 'Mathematics final',
      programmingProject: 'Programming project',
      programmingFinal: 'Programming final',
    },
    weekdays: {
      short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    },
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    general: {
      more: 'More',
      less: 'Less',
      found: 'Found',
    },
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
        syncToggle: 'Sync IDNP to server',
        syncTitle: 'IDNP Sync Settings',
        syncEnabledInfo:
          'Your IDNP is securely stored on our server. This allows you to access your grades on any device without re-entering it.',
        syncDisabledInfo:
          'Your IDNP is only stored locally on this device. If you disable syncing, it will be removed from our server.',
        syncedStatus: 'IDNP is synced',
        noIdnpSaved: 'No IDNP saved',
        loginRequired: 'Sign in to your account to enable IDNP syncing across devices',
        title: 'IDNP Settings',
        clearButton: 'Clear Saved IDNP',
        clearConfirmTitle: 'Clear Saved IDNP',
        clearConfirmMessage:
          'Are you sure you want to clear your saved IDNP? You will need to enter it again to access your grades.',
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
      notifications: {
        title: 'Notifications',
        enabled: 'Enable Notifications',
        enabledDescription: 'You will receive reminders for upcoming assignments',
        disabledDescription: 'You will not receive any assignment notifications',
        time: 'Notification Time',
        timeSettings: 'Time Settings',
        timeDescription: 'When notifications will be sent each day',
        selectTime: 'Select Time',
        reminderDays: 'Reminder Days',
        reminderDaysDescription: 'How many days before the due date to send notifications',
        importantAssignments: 'Important Assignments',
        otherAssignments: 'Other Assignments',
        exams: 'Exams',
        tests: 'Tests',
        quizzes: 'Quizzes',
        homework: 'Homework',
        projects: 'Projects',
        other: 'Other',
        dailyReminders: 'Daily Reminders',
        dailyRemindersDescription: 'Send additional reminders every day until the due date',
        dailyExams: 'For Exams',
        dailyTests: 'For Tests',
        dailyQuizzes: 'For Quizzes',
        testNotification: 'Send Test Notification',
        days: 'days',
        sendDigestNow: 'Send Daily Digest Now',
        digestSentTitle: 'Daily Digest Sent',
        digestSentMessage: 'Check your notifications to see your daily assignment summary',
        errorTitle: 'Error',
        digestErrorMessage: 'Failed to send daily digest',
      },
      schedule: {
        title: 'Schedule',
        refresh: 'Refresh Schedule',
        refreshing: 'Refreshing...',
        group: 'Group',
        lastUpdated: 'Last updated',
        noRecentRefresh: 'No recent refresh',
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
      assignments: 'Assignments',
      assessments: 'Assessments',
      loadingAssignments: 'Loading assignments...',
      noRegularClassesToday: 'No regular classes today',
      noRegularClassesWeek: 'No regular classes this week',
      modifiedAcademicSchedule: 'This day has a modified academic schedule',
      modifiedAcademicWeek: 'This week has a modified academic schedule',
      nextClass: 'Next class',
      nextClassLoading: 'Finding the next scheduled class...',
      noUpcomingClasses: 'No upcoming regular classes found',
      noUpcomingClassesHint: 'The academic calendar may not include the next study period yet.',
      inferredPeriod: 'Calendar estimate',
      examDayTitle: 'Exam schedule today',
      examWeekTitle: 'Exam session this week',
      examDaySubtitle: 'Regular classes are paused. Follow the official exam schedule.',
      examWeekSubtitle: 'Regular classes are paused during the exam session.',
      officialExamSchedule: 'Official exam schedule',
      noOfficialExams: 'No official exams are listed yet',
      noOfficialExamsHint: 'Published exam dates, times, and rooms will appear here automatically.',
      academicPeriod: {
        teaching: 'Teaching period',
        exam: 'Exam period',
        vacation: 'Vacation',
        practiceIntro: 'Introductory specialty practice',
        practiceInstructional: 'Instructional practice',
        practiceTechnological: 'Technological practice',
        practiceSpecialty1: 'Specialty practice I',
        practiceSpecialty2: 'Specialty practice II',
        practiceSpecialty3: 'Specialty practice III',
        practiceProduction: 'Production practice',
        qualificationExam: 'Qualification exam',
        dualEmployerTraining: 'Employer training',
        interSemesterBreak: 'Inter-semester break',
        summerBreak: 'Summer break',
      },
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
    assignments: {
      title: 'Assignments',
      loading: 'Loading assignments...',
      empty: 'No assignments found',
      addNew: 'New Assignment',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      update: 'Update',
      updating: 'Updating...',
      editTitle: 'Edit Assignment',
      segments: {
        dueDate: 'Due date',
        classes: 'Classes',
        priority: 'Priority',
      },
      saving: 'Saving...',
      common: {
        uncategorized: 'Uncategorized',
        period: 'Period',
        due: 'Due',
        orphaned: 'Orphaned',
        orphanedAssignments: 'Orphaned assignments (from different group)',
        orphanedReason: 'Orphaned: Group changed',
      },
      types: {
        homework: 'Homework',
        test: 'Test',
        exam: 'Exam',
        project: 'Project',
        quiz: 'Quiz',
        lab: 'Lab',
        essay: 'Essay',
        presentation: 'Presentation',
        other: 'Other',
      },
      days: {
        yesterday: 'Yesterday',
        today: 'Today',
        tomorrow: 'Tomorrow',
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday',
        nextWeek: 'Next Week',
        inTwoWeeks: 'In 2 Weeks',
        thisWeek: 'this week',
        in: 'in',
        weeks: 'weeks',
      },
      titlePlaceholder: 'Assignment title',
      description: 'Description',
      descriptionPlaceholder: 'Add details about the assignment',
      optional: 'Optional',
      type: 'Assignment Type',
      autoDetectedType: 'Assignment type automatically detected',
      dueDate: 'Due Date',
      dueTime: 'Due Time',
      markAsPriority: 'Mark as Priority',
      selectSubject: 'Select Subject',
      periods: {
        first: '1st Period',
        second: '2nd Period',
        third: '3rd Period',
        fourth: '4th Period',
        fifth: '5th Period',
      },
      useNextPeriod: 'Use Next Period',
      noUpcomingClasses: 'No upcoming classes found for',
      inNextTwoWeeks: 'in the next two weeks',
      findingNextClass: 'Finding next class period...',
      assignmentDueText: 'This assignment will be due',
      on: 'on',
      at: 'at',
      thisSubject: 'this subject',
      noUpcomingClassesFound: 'No upcoming classes found. Please set a custom due date below.',
      recent: 'Recent',
      all: 'All',
      custom: 'Custom',
      loadingSubjects: 'Loading subjects...',
      noSubjects: 'No subjects found',
      noCustomSubjects: 'No custom subjects found',
      enterSubjectName: 'Enter subject name',
      add: 'Add',
      subtasks: {
        title: 'Subtasks',
        add: 'Add subtask',
        addFirst: 'Add subtasks',
        placeholder: 'Enter subtask...',
        progress: 'Subtask progress',
        loading: 'Loading subtasks...',
        hint: 'Breaking tasks into steps improves progress tracking.',
      },
      status: {
        overdue: 'Overdue',
        completedIn: 'Completed in',
        dueIn: 'Due in',
        dueTomorrow: 'Due tomorrow',
        dueToday: 'Due today',
        in: 'in',
        inMinute: 'minute',
        inMinutes: 'minutes',
        inHour: 'hour',
        inHours: 'hours',
        inDay: 'day',
        inDays: 'days',
        inWeek: 'week',
        inWeeks: 'weeks',
      },
      archive: {
        title: 'Archive',
        pastDue: 'Past due',
        completed: 'Completed',
        noItems: 'No items',
        archiveAll: 'Archive all',
        archiveConfirmation: 'Are you sure you want to archive all completed assignments?',
      },
      errors: {
        switchingTip: 'Avoid rapid switching between tabs',
        stabilityMode: 'Stability mode active',
        recoveringTitle: 'Recovering',
        recovering: 'Recovering',
        tip: 'Tip',
        somethingWrong: 'Something went wrong',
      },
    },
    grades: {
      title: 'Grades',
      average: 'Average',
      noGrades: 'No grades recorded yet',
      lastUpdated: 'Your data was last updated on',
      neverUpdated: 'Never',
      dataStale: 'and might be outdated. Press the refresh button to update.',
      refreshing: 'Refreshing data...',
      updatedLabel: 'Updated',
      absences: 'Absences',
      unexcused: 'Unexcused',
      networkError: 'Unable to retrieve data. Please check your IDNP and try again.',
      networkErrorCache: 'Network error. Using cached data from',
      categories: {
        practice: 'Practice',
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
      calculator: {
        title: 'Grade Calculator',
        selectSubject: 'Select Subject',
        currentGrades: 'Current Grades',
        noGrades: 'No grades recorded yet',
        currentAverage: 'Current Average',
        targetAverage: 'Target Average',
        targetGrade: 'Target Grade',
        minimumGradesNeeded: 'Minimum Grades Needed',
        calculate: 'Calculate',
        clear: 'Clear',
        noSolution: 'No solution found',
        resultsTitle: 'Results',
        alreadyAchieved: 'You have already achieved this target average.',
        calculationType: 'Calculation Type',
        semesterOnly: 'Semester Only',
        annualAverage: 'Annual Average',
        allGrades: 'All Grades',
      },
      pdf: {
        export: 'Export PDF',
        exportTitle: 'Export grade report',
        exportDescription:
          'Create a polished PDF with every subject, all grades, and exam or thesis impacts.',
        preparing: 'Preparing PDF...',
        shareTitle: 'Grade report ready',
        shareMessage: 'Your PDF is ready to share or save.',
        errorTitle: 'Export failed',
        errorMessage: 'We could not create the PDF. Please try again.',
        generatedOn: 'Generated on',
        summaryTitle: 'Summary',
        totalSemesters: 'Semesters',
        totalSubjects: 'Subjects',
        totalGrades: 'Grades',
        impactedSubjects: 'With exam/thesis',
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
        connecting:
          'Connecting to the CEITI server. This might take some time, please be patient...',
      },
      subjects: {
        pending: 'Pending',
        noExams: 'No exams available',
        upcoming: 'Upcoming',
        noSubjects: 'No subjects available for Semester {{semester}}',
        finalAverage: 'Final avg',
        withoutExam: 'Without exam',
        thesis: 'Thesis',
        exam: 'Exam',
        newBadge: 'New',
        officialSchedule: 'Official Schedule',
        noOfficialExams: 'No official exam/thesis schedule available',
      },
    },
    recovery: {
      recoveryDay: 'Recovery Day',
      noReason: 'No reason for this recovery day',
    },
    update: {
      availableTitle: 'Update Available',
      availableMessage: 'A new version of the app is available. Would you like to download it now?',
      readyTitle: 'Update Ready',
      readyMessage:
        'The update has been downloaded and is ready to install. The app will restart to apply the update.',
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
        error: 'Could not verify email',
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
        message:
          'Create an account to sync your data across devices and access additional features',
        skip: 'Skip for Now',
        continue: 'Create Account',
      },
    },
    privacyPolicy: {
      title: 'Privacy Policy',
      sections: {
        dataCollection: {
          title: 'Data Collection',
          content: [
            'We collect data to provide better services to our users.',
            'The data we collect includes personal information such as name, email address, and IDNP(optional).',
          ],
        },
        idnpSecurity: {
          title: 'IDNP Security',
          content: [
            'Your IDNP is stored securely on our server with encryption before transit and at rest which makes it impossible to decrypt without your password or intercepted by malicious people.',
            "You can choose to store your IDNP locally on your device instead of syncing it with the server if you feel that it's not secure and store it only on-device.",
            'We do not share your IDNP with third parties.',
          ],
        },
        passwordSecurity: {
          title: 'Password Security',
          content: [
            "We use strong encryption to protect your password encrypting it even before it reaches our server which means that even if we wanted we wouldn't be able to see your password.",
            'Your password is never stored in plain text and is only used to encrypt your IDNP before it reaches our server.',
            'Never share your password with anyone.',
          ],
        },
        dataStorage: {
          title: 'Data Storage',
          content: [
            'Your data is stored securely either on our server or locally on your device.',
            'You can opt out from our services at any time.',
          ],
        },
        thirdParty: {
          title: 'Third Party Services',
          content: [
            'We do not share your data with third parties.',
            'We may use third-party services to improve our app.',
          ],
        },
        rights: {
          title: 'Your Rights',
          content: [
            'You have the right to access your data.',
            'You have the right to request the deletion of your data.',
          ],
        },
        updates: {
          title: 'Policy Updates',
          content:
            'We may update this policy from time to time. Please check this page regularly for updates.',
        },
        contact: {
          title: 'Contact Us',
          content:
            'If you have any questions about this policy, please contact us at <link>privacy@p.jagged.me</link>.',
        },
      },
    },
    nativeUpdate: {
      recommended: 'A new app update is available. Updating is highly recommended.',
      ready: 'Your update is ready. Install and restart when convenient.',
      recovery: 'Finish your app update in Google Play.',
      failed: 'The update could not finish. You can try again later.',
      update: 'Update',
      install: 'Install and restart',
      openStore: 'Open Google Play',
      retry: 'Try again',
      later: 'Later',
    },
    loginPromo: {
      body: 'Sign in to unlock the full potential of your planner with cross-device sync and premium features.',
      stayConnected: 'Stay Connected',
      getStarted: 'Get Started',
      dismiss: 'Maybe Later',
    },
  },
  ro: {
    common: {
      error: 'Eroare',
      alert: 'Informare',
      success: 'Succes',
      ok: 'OK',
      cancel: 'Anulează',
      confirm: 'Confirmă',
      delete: 'Șterge',
      done: 'Gata',
      back: 'Înapoi',
      retry: 'Încearcă din nou',
      search: 'Caută',
      noResults: 'Nu s-au găsit rezultate',
      clear: 'Șterge',
      hour: 'Oră',
      minute: 'Minut',
      dayPeriod: 'AM/PM',
      unknown: 'Necunoscut',
      tapToExpand: 'Atinge pentru a extinde',
      noValue: 'Fără valoare',
      notFoundTitle: 'Ecranul nu a fost găsit',
      notFoundMessage: 'Acest ecran nu există.',
      goHome: 'Mergi la ecranul principal',
    },
    scheduleDetails: {
      allRemoved: 'Toate lecțiile din această zi au fost eliminate ({{count}}).',
      emptyOverride: 'Nu sunt lecții în această zi din cauza unei modificări de orar.',
      removedPeriods: 'Lecții eliminate: {{periods}}.',
      showingPeriods: 'Se afișează {{count}} din {{total}} lecții.',
      customSchedule: 'Orar personalizat ({{count}} lecții).',
      followsWeekday: 'Se urmează orarul de {{day}}.',
      overrideActive: 'În această zi se aplică o modificare temporară a orarului.',

      special: 'Special',
      recoveryTitle: 'Orarul zilei de recuperare',
      specialTitle: 'Orar special',
      noReason: 'Motiv nespecificat',
      replaces: 'Înlocuiește ziua de {{day}}',
      temporaryOverride: 'Modificare temporară a orarului',
      swipeForMore: 'Glisează pentru a vedea mai mult',
      now: 'Acum',
      noAssignments: 'Nu sunt teme pentru această lecție',
      subgroup: 'SG {{number}}',
      examBadge: 'E',
      thesisBadge: 'T',
      periodNumber: 'Lecția {{number}}',
      customPeriod: 'Lecție personalizată',
      allWeekdays: 'Toate zilele lucrătoare',
      offline: 'Fără conexiune',
      usingCache: 'Se folosește orarul salvat',
      refreshFailed: 'Nu s-a putut actualiza orarul',
      overrideLabel: 'Modificare de orar: {{reason}}',
    },
    assignmentEditor: {
      titleAndCourseRequired: 'Introdu un titlu și selectează o materie.',
      titleRequired: 'Introdu un titlu pentru temă.',
      saveFailed: 'Nu s-a putut salva tema. Încearcă din nou.',
      notFound: 'Tema nu a fost găsită.',
      loadFailed: 'Nu s-a putut încărca tema. Încearcă din nou.',
      updateFailed: 'Nu s-a putut actualiza tema. Încearcă din nou.',
      goToSettings: 'Mergi la setări',

      thisDay: '{{day}}',
    },
    accountDeletion: {
      title: 'Confirmă ștergerea contului',
      message: 'Introdu parola pentru a confirma ștergerea contului.',
      password: 'Parola ta',
      passwordRequired: 'Introdu parola.',
      networkError: 'Eroare de rețea. Verifică conexiunea.',
      incorrectPassword: 'Parolă incorectă. Încearcă din nou.',
      genericError: 'A apărut o eroare. Încearcă din nou.',
      requestSent: 'Cererea de ștergere a fost trimisă',
      emailMessage:
        'Am trimis un email de confirmare pentru cererea de ștergere a contului. Verifică mesajele primite și urmează instrucțiunile pentru a finaliza procesul.',
      openEmail: 'Deschide aplicația de email',
    },
    appInfo: {
      title: 'Versiunea aplicației și actualizări',
      currentVersion: 'Versiunea curentă',
      currentOta: 'Versiunea OTA curentă',
      releaseChannel: 'Canal de lansare',
      production: 'Producție',
      beta: 'Beta',
      development: 'Dezvoltare',
    },
    developer: {
      title: 'Instrumente pentru dezvoltatori',
      storageCleared: 'AsyncStorage a fost golit',
      clearStorage: 'Golește AsyncStorage',
      scheduleReset: 'Setările orarului au fost resetate',
      resetSchedule: 'Resetează setările orarului',
      expoGoUnavailable: 'Indisponibil în Expo Go',
      expoGoNotifications:
        'Notificările sunt dezactivate în Expo Go. Folosește un build de dezvoltare pentru a testa notificările.',
      notificationsReset:
        'Sistemul de notificări a fost resetat. Acest lucru poate rezolva problemele de sincronizare.',
      notificationsResetFailed: 'Nu s-a putut reseta sistemul de notificări',
      resetNotifications: 'Resetează sistemul de notificări',
      viewStorageFailed: 'Nu s-a putut afișa conținutul AsyncStorage',
      viewStorage: 'Vezi AsyncStorage',
      injected: 'Adăugate',
      removed: 'Eliminate',
      gradesAdded: 'Au fost adăugate 5 note aleatorii. Atinge din nou pentru a le elimina.',
      gradesRemoved: 'Notele de test au fost eliminate. Atinge din nou pentru a le adăuga.',
      gradeInjectionFailed: 'Nu s-a putut modifica adăugarea notelor de test',
      removeGrades: 'Elimină notele de test',
      injectGrades: 'Adaugă 5 note aleatorii',
      tapToRemove: 'Adăugate • atinge pentru a elimina',
      tapToAdd: 'Atinge pentru a adăuga imediat',
    },
    notificationMessages: {
      defaultChannel: 'Notificări generale',
      assignmentChannel: 'Teme',
      assignmentChannelDescription: 'Termene și reamintiri pentru teme',
      digestChannel: 'Rezumatul zilnic al temelor',
      digestChannelDescription: 'Rezumat zilnic al temelor viitoare',
      dueInHour: '„{{title}}” {{course}} are termenul peste o oră.',
      dueTomorrow: '„{{title}}” {{course}} are termenul mâine la {{time}}.',
      dueInDays: '„{{title}}” {{course}} are termenul {{time}}.',
      priority: 'Prioritar: {{type}}',
      noUpcoming: 'Nu sunt teme cu termen apropiat.',
      item: '„{{title}}” {{course}} la {{time}}',
      more: '+ încă {{count}}…',
      dayTitle: '{{assignments}} • {{day}}',
      upcomingTitle: '{{assignments}} în curând',
      summary: 'Rezumatul temelor:',
      viewDetails: 'Atinge pentru detalii.',
      viewAll: 'Atinge pentru a vedea toate temele.',
      assignmentCount: {
        one: '{{count}} temă',
        few: '{{count}} teme',
        many: '{{count}} de teme',
        other: '{{count}} de teme',
      },
    },
    demoGrades: {
      familyName: 'Demo',
      firstName: 'Student',
      specialization: 'Dezvoltarea aplicațiilor software',
      status: 'Cont demonstrativ',
      mathematics: 'Matematică',
      programming: 'Programare',
      english: 'Limba engleză',
      databases: 'Baze de date',
      mathematicsFinal: 'Examen la matematică',
      programmingProject: 'Proiect de programare',
      programmingFinal: 'Examen la programare',
    },
    weekdays: {
      short: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'],
      long: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
    },
    months: [
      'Ianuarie',
      'Februarie',
      'Martie',
      'Aprilie',
      'Mai',
      'Iunie',
      'Iulie',
      'August',
      'Septembrie',
      'Octombrie',
      'Noiembrie',
      'Decembrie',
    ],
    general: {
      more: 'Mai mult',
      less: 'Mai puțin',
      found: 'Găsite',
    },
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
        syncToggle: 'Sincronizează IDNP pe server',
        syncTitle: 'Setări sincronizare IDNP',
        syncEnabledInfo:
          'IDNP-ul dvs. este stocat în siguranță pe serverul nostru. Acest lucru vă permite să accesați notele pe orice dispozitiv fără a-l reintroduce.',
        syncDisabledInfo:
          'IDNP-ul dvs. este stocat doar local pe acest dispozitiv. Dacă dezactivați sincronizarea, acesta va fi eliminat de pe serverul nostru.',
        syncedStatus: 'IDNP este sincronizat',
        noIdnpSaved: 'Niciun IDNP salvat',
        loginRequired:
          'Conectați-vă la contul dvs. pentru a activa sincronizarea IDNP între dispozitive',
        title: 'Setări IDNP',
        clearButton: 'Șterge IDNP salvat',
        clearConfirmTitle: 'Șterge IDNP salvat',
        clearConfirmMessage:
          'Sigur doriți să ștergeți IDNP-ul salvat? Va trebui să îl introduceți din nou pentru a accesa notele.',
        clearConfirmCancel: 'Anulează',
        clearConfirmConfirm: 'Șterge',
      },
      group: {
        title: 'Grupă',
        notFound: 'Nu au fost găsite grupe care să se potrivească',
        select: 'Selectează o Grupă',
        search: 'Caută o grupă...',
        searching: 'Se caută grupa...',
        failed:
          'Nu s-a reușit încărcarea grupelor. Verificați conexiunea la internet și încercați din nou.',
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
      notifications: {
        title: 'Notificări',
        enabled: 'Activează Notificările',
        enabledDescription: 'Vei primi notificări pentru temele viitoare',
        disabledDescription: 'Nu vei primi nicio notificare despre teme',
        time: 'Ora Notificării',
        timeSettings: 'Setări Oră',
        timeDescription: 'Când vor fi trimise notificările în fiecare zi',
        selectTime: 'Selectează Ora',
        reminderDays: 'Zile de Reamintire',
        reminderDaysDescription: 'Cu câte zile înainte de data scadentă să se trimită notificări',
        importantAssignments: 'Teme Importante',
        otherAssignments: 'Alte Teme',
        exams: 'Examene',
        tests: 'Teste',
        quizzes: 'Quizuri',
        homework: 'Teme',
        projects: 'Proiecte',
        other: 'Altele',
        dailyReminders: 'Reamintiri Zilnice',
        dailyRemindersDescription:
          'Trimite notificări suplimentare în fiecare zi până la data scadentă',
        dailyExams: 'Pentru Examene',
        dailyTests: 'Pentru Teste',
        dailyQuizzes: 'Pentru Quizuri',
        testNotification: 'Trimite Notificare de Test',
        days: 'zile',
        sendDigestNow: 'Trimite Digest Zilnic Acum',
        digestSentTitle: 'Digest Zilnic Trimis',
        digestSentMessage: 'Verificați notificările pentru a vedea rezumatul temelor viitoare',
        errorTitle: 'Eroare',
        digestErrorMessage: 'Nu s-a putut trimite digestul zilnic',
      },
      schedule: {
        title: 'Orar',
        refresh: 'Reîmprospătează Orarul',
        refreshing: 'Se reîmprospătează...',
        group: 'Grupă',
        lastUpdated: 'Ultima actualizare',
        noRecentRefresh: 'Nicio actualizare recentă',
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
      assignments: 'Teme',
      assessments: 'Evaluări',
      loadingAssignments: 'Se încarcă temele...',
      noRegularClassesToday: 'Astăzi nu sunt lecții obișnuite',
      noRegularClassesWeek: 'Nu sunt lecții obișnuite în această săptămână',
      modifiedAcademicSchedule: 'Această zi are un program academic modificat',
      modifiedAcademicWeek: 'Această săptămână are un program academic modificat',
      nextClass: 'Următoarea lecție',
      nextClassLoading: 'Se caută următoarea lecție programată...',
      noUpcomingClasses: 'Nu au fost găsite lecții obișnuite viitoare',
      noUpcomingClassesHint:
        'Calendarul academic poate să nu includă încă următoarea perioadă de studii.',
      inferredPeriod: 'Estimare din calendar',
      examDayTitle: 'Programul examenelor de astăzi',
      examWeekTitle: 'Sesiune de examene în această săptămână',
      examDaySubtitle:
        'Lecțiile obișnuite sunt suspendate. Urmează programul oficial al examenelor.',
      examWeekSubtitle: 'Lecțiile obișnuite sunt suspendate pe durata sesiunii.',
      officialExamSchedule: 'Programul oficial al examenelor',
      noOfficialExams: 'Nu sunt publicate încă examene oficiale',
      noOfficialExamsHint: 'Datele, orele și sălile publicate vor apărea automat aici.',
      academicPeriod: {
        teaching: 'Perioadă de studii',
        exam: 'Sesiune de examene',
        vacation: 'Vacanță',
        practiceIntro: 'Practică de inițiere în specialitate',
        practiceInstructional: 'Practică de instruire',
        practiceTechnological: 'Practică tehnologică',
        practiceSpecialty1: 'Practică de specialitate I',
        practiceSpecialty2: 'Practică de specialitate II',
        practiceSpecialty3: 'Practică de specialitate III',
        practiceProduction: 'Practică de producție',
        qualificationExam: 'Examen de calificare',
        dualEmployerTraining: 'Instruire la angajator',
        interSemesterBreak: 'Vacanță intersemestrială',
        summerBreak: 'Vacanță de vară',
      },
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
      grades: 'Note',
    },
    assignments: {
      title: 'Teme',
      loading: 'Se încarcă temele...',
      empty: 'Nu există teme',
      save: 'Salvează',
      addNew: 'Temă Nouă',
      edit: 'Editează',
      delete: 'Șterge',
      update: 'Actualizează',
      updating: 'Se actualizează...',
      editTitle: 'Editează Tema',
      segments: {
        dueDate: 'Data scadentă',
        classes: 'Clase',
        priority: 'Prioritate',
      },
      saving: 'Se salvează...',
      common: {
        uncategorized: 'Necategorizat',
        period: 'Perioada',
        due: 'Scadent',
        orphaned: 'Orfan',
        orphanedAssignments: 'Teme orfane (din alt grup)',
        orphanedReason: 'Orfan: Grup schimbat',
      },
      types: {
        homework: 'Temă',
        test: 'Test',
        exam: 'Examen',
        project: 'Proiect',
        quiz: 'Quiz',
        lab: 'Laborator',
        essay: 'Eseu',
        presentation: 'Prezentare',
        other: 'Altele',
      },
      days: {
        yesterday: 'Ieri',
        today: 'Astăzi',
        tomorrow: 'Mâine',
        monday: 'Luni',
        tuesday: 'Marți',
        wednesday: 'Miercuri',
        thursday: 'Joi',
        friday: 'Vineri',
        saturday: 'Sâmbătă',
        sunday: 'Duminică',
        nextWeek: 'Săptămâna Viitoare',
        inTwoWeeks: 'În 2 Săptămâni',
        thisWeek: 'această săptămână',
        in: 'în',
        weeks: 'săptămâni',
      },
      titlePlaceholder: 'Titlul temei',
      description: 'Descriere',
      descriptionPlaceholder: 'Adaugă detalii despre temă',
      optional: 'Opțional',
      type: 'Tipul Temei',
      autoDetectedType: 'Tipul temei detectat automat',
      dueDate: 'Data Scadentă',
      dueTime: 'Ora Scadentă',
      markAsPriority: 'Marchează ca Prioritate',
      selectSubject: 'Selectează Materia',
      periods: {
        first: 'Perioada 1',
        second: 'Perioada 2',
        third: 'Perioada 3',
        fourth: 'Perioada 4',
        fifth: 'Perioada 5',
      },
      useNextPeriod: 'Folosește Următoarea Oră',
      noUpcomingClasses: 'Nu s-au găsit ore viitoare pentru',
      inNextTwoWeeks: 'în următoarele două săptămâni',
      findingNextClass: 'Se caută următoarea oră...',
      assignmentDueText: 'Această temă va fi scadentă',
      on: 'pe',
      at: 'la',
      thisSubject: 'această materie',
      noUpcomingClassesFound:
        'Nu s-au găsit ore viitoare. Vă rugăm să setați o dată personalizată mai jos.',
      recent: 'Recente',
      all: 'Toate',
      custom: 'Personalizate',
      loadingSubjects: 'Se încarcă materiile...',
      noSubjects: 'Nu s-au găsit materii',
      noCustomSubjects: 'Nu s-au găsit materii personalizate',
      enterSubjectName: 'Introduceți numele materiei',
      add: 'Adaugă',
      subtasks: {
        title: 'Subtask-uri',
        add: 'Adaugă subtask',
        addFirst: 'Adaugă subtask-uri',
        placeholder: 'Introduceți subtask...',
        progress: 'Progresul subtask-ului',
        loading: 'Se încarcă subtaskurile…',
        hint: 'Împărțirea sarcinilor în pași îmbunătățește urmărirea progresului.',
      },
      status: {
        overdue: 'Târziu',
        completedIn: 'Completat în',
        dueIn: 'Scadent în',
        dueTomorrow: 'Scadent mâine',
        dueToday: 'Scadent astăzi',
        in: 'în',
        inMinute: 'minut',
        inMinutes: 'minute',
        inHour: 'oră',
        inHours: 'ore',
        inDay: 'zi',
        inDays: 'zile',
        inWeek: 'săptămână',
        inWeeks: 'săptămâni',
      },
      archive: {
        title: 'Arhivă',
        pastDue: 'Târziu',
        completed: 'Completat',
        noItems: 'Niciun element',
        archiveAll: 'Arhivează toate',
        archiveConfirmation: 'Sunteți sigur că doriți să arhivezi toate temele îndeplinite?',
      },
      errors: {
        switchingTip: 'Evită schimbarea rapidă a filelor',
        stabilityMode: 'Modul de stabilitate este activ',
        recoveringTitle: 'Recuperare',
        recovering: 'Recuperare',
        tip: 'Sfat',
        somethingWrong: 'Ceva nu a mers bine',
      },
    },
    grades: {
      title: 'Note',
      average: 'Media',
      noGrades: 'Nicio notă înregistrată încă',
      lastUpdated: 'Datele dvs. au fost actualizate ultima dată pe',
      neverUpdated: 'Niciodată',
      dataStale: 'și ar putea fi învechite. Apăsați butonul de reîmprospătare pentru a actualiza.',
      refreshing: 'Se actualizează datele...',
      updatedLabel: 'Actualizat',
      absences: 'Absențe',
      unexcused: 'Nemotivate',
      networkError: 'Nu s-au putut recupera datele. Verificați IDNP-ul și încercați din nou.',
      networkErrorCache: 'Eroare de rețea. Se folosesc date stocate din',
      categories: {
        practice: 'Practică',
        exam: 'Examene',
        test: 'Test',
        homework: 'Temă',
        project: 'Proiect',
        other: 'Altele',
      },
      sortOptions: {
        date: 'Data',
        grade: 'Nota',
        category: 'Categorie',
      },
      calculator: {
        title: 'Calculator de Note',
        selectSubject: 'Selectează Materie',
        currentGrades: 'Note curente',
        noGrades: 'Nicio notă înregistrată încă',
        currentAverage: 'Media curentă',
        targetAverage: 'Media țintă',
        targetGrade: 'Nota țintă',
        minimumGradesNeeded: 'Numărul minim de note necesare',
        calculate: 'Calculează',
        clear: 'Șterge',
        noSolution: 'Nu există soluție',
        resultsTitle: 'Rezultate',
        alreadyAchieved: 'Ați atins deja această medie țintă.',
        calculationType: 'Tipul de calcul',
        semesterOnly: 'Doar Semestrul',
        annualAverage: 'Media Anuală',
        allGrades: 'Toate Notele',
      },
      pdf: {
        export: 'Exportă PDF',
        exportTitle: 'Exportă raportul notelor',
        exportDescription:
          'Creează un PDF elegant cu toate materiile, notele și impactul tezelor sau examenelor.',
        preparing: 'Se pregătește PDF-ul...',
        shareTitle: 'Raportul este gata',
        shareMessage: 'PDF-ul este gata pentru a fi partajat sau salvat.',
        errorTitle: 'Export eșuat',
        errorMessage: 'Nu am putut crea PDF-ul. Încercați din nou.',
        generatedOn: 'Generat la',
        summaryTitle: 'Rezumat',
        totalSemesters: 'Semestre',
        totalSubjects: 'Materii',
        totalGrades: 'Note',
        impactedSubjects: 'Cu teză/examen',
      },
      add: 'Adaugă Notă',
      edit: 'Editează Nota',
      form: {
        subject: 'Materie',
        grade: 'Notă',
        category: 'Categorie',
        date: 'Data',
        notes: 'Observații',
        save: 'Salvează Nota',
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
        connecting:
          'Se conectează la serverul CEITI. Acest lucru poate dura ceva timp, vă rugăm să aveți răbdare...',
      },
      subjects: {
        pending: 'În așteptare',
        noExams: 'Nu există examene disponibile',
        upcoming: 'În curând',
        noSubjects: 'Nu există materii disponibile pentru Semestrul {{semester}}',
        finalAverage: 'Media finală',
        withoutExam: 'Fără teză/examen',
        thesis: 'Teză',
        exam: 'Examen',
        newBadge: 'Nou',
        officialSchedule: 'Program Oficial',
        noOfficialExams: 'Nu există program oficial de examene/teze disponibil',
      },
    },
    recovery: {
      recoveryDay: 'Zi de Recuperare',
      noReason: 'Nu există motiv pentru această zi de recuperare',
    },
    update: {
      availableTitle: 'Actualizare Disponibilă',
      availableMessage:
        'O nouă versiune a aplicației este disponibilă. Doriți să o descărcați acum?',
      readyTitle: 'Actualizare Pregătită',
      readyMessage:
        'Actualizarea a fost descărcată și este gata de instalare. Aplicația va reporni pentru a aplica actualizarea.',
      errorTitle: 'Eroare de Actualizare',
      errorMessage:
        'A apărut o problemă la descărcarea actualizării. Vă rugăm să încercați din nou.',
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
        allFieldsRequired: 'Toate câmpurile sunt obligatorii',
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
        error: 'Nu s-a putut verifica emailul',
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
        message:
          'Creează un cont pentru a sincroniza datele între dispozitive și a accesa funcții suplimentare',
        skip: 'Poate Mai Târziu',
        continue: 'Creează Cont',
      },
    },
    privacyPolicy: {
      title: 'Politica de Confidențialitate',
      sections: {
        dataCollection: {
          title: 'Colectarea Datelor',
          content: [
            'Colectăm date pentru a oferi servicii mai bune utilizatorilor noștri.',
            'Datele pe care le colectăm includ informații personale precum numele, adresa de email și IDNP-ul (opțional).',
          ],
        },
        idnpSecurity: {
          title: 'Securitatea IDNP',
          content: [
            'IDNP-ul tău este stocat în siguranță pe serverul nostru, fiind criptat înainte de transmitere și în timpul stocării, astfel încât să nu poată fi decriptat fără parola ta sau interceptat de persoane rău intenționate.',
            'Poți alege să stochezi IDNP-ul doar local, pe dispozitiv, în loc să îl sincronizezi cu serverul, dacă preferi această opțiune din motive de securitate.',
            'Nu transmitem IDNP-ul tău unor terțe părți.',
          ],
        },
        passwordSecurity: {
          title: 'Securitatea Parolei',
          content: [
            'Folosim criptare puternică pentru a-ți proteja parola, criptând-o chiar înainte să ajungă pe serverul nostru, astfel încât nici noi să nu o putem vedea.',
            'Parola ta nu este niciodată stocată în text simplu și este folosită doar pentru a cripta IDNP-ul înainte ca acesta să ajungă pe serverul nostru.',
            'Nu divulga niciodată parola ta altor persoane.',
          ],
        },
        dataStorage: {
          title: 'Stocarea Datelor',
          content: [
            'Datele tale sunt stocate în siguranță pe serverul nostru sau local, pe dispozitiv.',
            'Poți renunța oricând la serviciile noastre.',
          ],
        },
        thirdParty: {
          title: 'Servicii Terțe',
          content: [
            'Nu transmitem datele tale unor terțe părți.',
            'Putem folosi servicii terțe pentru a îmbunătăți aplicația.',
          ],
        },
        rights: {
          title: 'Drepturile Dvs.',
          content: [
            'Aveți dreptul de a vă accesa datele.',
            'Aveți dreptul de a solicita ștergerea datelor dvs.',
          ],
        },
        updates: {
          title: 'Actualizări ale Politicii',
          content:
            'Putem actualiza această politică din când în când. Vă rugăm să verificați această pagină regulat pentru actualizări.',
        },
        contact: {
          title: 'Contactați-ne',
          content:
            'Dacă aveți întrebări despre această politică, vă rugăm să ne contactați la <link>privacy@p.jagged.me</link>.',
        },
      },
    },
    nativeUpdate: {
      recommended: 'Este disponibilă o actualizare. Actualizarea este recomandată.',
      ready: 'Actualizarea este gata. Instalează și repornește când îți este convenabil.',
      recovery: 'Finalizează actualizarea aplicației în Google Play.',
      failed: 'Actualizarea nu s-a finalizat. Poți încerca din nou mai târziu.',
      update: 'Actualizează',
      install: 'Instalează și repornește',
      openStore: 'Deschide Google Play',
      retry: 'Încearcă din nou',
      later: 'Mai târziu',
    },
    loginPromo: {
      body: 'Conectează-te pentru a debloca întregul potențial al planificatorului tău cu sincronizare între dispozitive și funcții premium.',
      stayConnected: 'Rămâi Conectat',
      getStarted: 'Începe Acum',
      dismiss: 'Poate Mai Târziu',
    },
  },
  ru: {
    common: {
      error: 'Ошибка',
      alert: 'Уведомление',
      success: 'Готово',
      ok: 'ОК',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
      delete: 'Удалить',
      done: 'Готово',
      back: 'Назад',
      retry: 'Повторить',
      search: 'Поиск',
      noResults: 'Ничего не найдено',
      clear: 'Очистить',
      hour: 'Час',
      minute: 'Минута',
      dayPeriod: 'AM/PM',
      unknown: 'Неизвестно',
      tapToExpand: 'Нажмите, чтобы развернуть',
      noValue: 'Нет значения',
      notFoundTitle: 'Экран не найден',
      notFoundMessage: 'Этот экран не существует.',
      goHome: 'На главный экран',
    },
    scheduleDetails: {
      allRemoved: 'Все занятия в этот день отменены ({{count}}).',
      emptyOverride: 'В этот день занятий нет из-за изменения расписания.',
      removedPeriods: 'Отменённые занятия: {{periods}}.',
      showingPeriods: 'Показано занятий: {{count}} из {{total}}.',
      customSchedule: 'Своё расписание (занятий: {{count}}).',
      followsWeekday: 'Занятия по расписанию: {{day}}.',
      overrideActive: 'На этот день действует временное изменение расписания.',

      special: 'Особое',
      recoveryTitle: 'Расписание отработки',
      specialTitle: 'Особое расписание',
      noReason: 'Причина не указана',
      replaces: 'Вместо: {{day}}',
      temporaryOverride: 'Временное изменение расписания',
      swipeForMore: 'Проведите, чтобы увидеть больше',
      now: 'Сейчас',
      noAssignments: 'Для этого занятия нет заданий',
      subgroup: 'ПГ {{number}}',
      examBadge: 'Э',
      thesisBadge: 'Т',
      periodNumber: 'Занятие {{number}}',
      customPeriod: 'Своё занятие',
      allWeekdays: 'Все будние дни',
      offline: 'Нет подключения',
      usingCache: 'Используется сохранённое расписание',
      refreshFailed: 'Не удалось обновить расписание',
      overrideLabel: 'Изменение расписания: {{reason}}',
    },
    assignmentEditor: {
      titleAndCourseRequired: 'Введите название и выберите предмет.',
      titleRequired: 'Введите название задания.',
      saveFailed: 'Не удалось сохранить задание. Попробуйте снова.',
      notFound: 'Задание не найдено.',
      loadFailed: 'Не удалось загрузить задание. Попробуйте снова.',
      updateFailed: 'Не удалось обновить задание. Попробуйте снова.',
      goToSettings: 'Открыть настройки',

      thisDay: '{{day}}',
    },
    accountDeletion: {
      title: 'Подтвердите удаление аккаунта',
      message: 'Введите пароль, чтобы подтвердить удаление аккаунта.',
      password: 'Ваш пароль',
      passwordRequired: 'Введите пароль.',
      networkError: 'Ошибка сети. Проверьте подключение.',
      incorrectPassword: 'Неверный пароль. Попробуйте снова.',
      genericError: 'Произошла ошибка. Попробуйте снова.',
      requestSent: 'Запрос на удаление отправлен',
      emailMessage:
        'Мы отправили письмо для подтверждения удаления аккаунта. Проверьте почту и следуйте инструкциям, чтобы завершить процесс.',
      openEmail: 'Открыть почту',
    },
    appInfo: {
      title: 'Версия приложения и обновления',
      currentVersion: 'Текущая версия',
      currentOta: 'Текущая версия OTA',
      releaseChannel: 'Канал выпуска',
      production: 'Основной',
      beta: 'Бета',
      development: 'Разработка',
    },
    developer: {
      title: 'Инструменты разработчика',
      storageCleared: 'AsyncStorage очищено',
      clearStorage: 'Очистить AsyncStorage',
      scheduleReset: 'Настройки расписания сброшены',
      resetSchedule: 'Сбросить настройки расписания',
      expoGoUnavailable: 'Недоступно в Expo Go',
      expoGoNotifications:
        'Уведомления отключены в Expo Go. Используйте сборку для разработки, чтобы проверить уведомления.',
      notificationsReset:
        'Система уведомлений сброшена. Это может устранить проблемы со временем отправки.',
      notificationsResetFailed: 'Не удалось сбросить систему уведомлений',
      resetNotifications: 'Сбросить систему уведомлений',
      viewStorageFailed: 'Не удалось просмотреть содержимое AsyncStorage',
      viewStorage: 'Просмотреть AsyncStorage',
      injected: 'Добавлено',
      removed: 'Удалено',
      gradesAdded: 'Добавлено 5 случайных оценок. Нажмите ещё раз, чтобы удалить.',
      gradesRemoved: 'Тестовые оценки удалены. Нажмите ещё раз, чтобы добавить.',
      gradeInjectionFailed: 'Не удалось изменить добавление тестовых оценок',
      removeGrades: 'Удалить тестовые оценки',
      injectGrades: 'Добавить 5 случайных оценок',
      tapToRemove: 'Добавлено • нажмите, чтобы удалить',
      tapToAdd: 'Нажмите, чтобы добавить',
    },
    notificationMessages: {
      defaultChannel: 'Общие уведомления',
      assignmentChannel: 'Задания',
      assignmentChannelDescription: 'Сроки выполнения заданий и напоминания',
      digestChannel: 'Ежедневная сводка заданий',
      digestChannelDescription: 'Ежедневная сводка предстоящих заданий',
      dueInHour: 'Срок задания «{{title}}» {{course}} — через час.',
      dueTomorrow: 'Срок задания «{{title}}» {{course}} — завтра в {{time}}.',
      dueInDays: 'Срок задания «{{title}}» {{course}} — {{time}}.',
      priority: 'Приоритет: {{type}}',
      noUpcoming: 'Нет заданий с близким сроком.',
      item: '«{{title}}» {{course}} в {{time}}',
      more: '+ ещё {{count}}…',
      dayTitle: '{{assignments}} • {{day}}',
      upcomingTitle: 'Предстоящие: {{assignments}}',
      summary: 'Сводка заданий:',
      viewDetails: 'Нажмите для просмотра подробностей.',
      viewAll: 'Нажмите, чтобы просмотреть всё.',
      assignmentCount: {
        one: '{{count}} задание',
        few: '{{count}} задания',
        many: '{{count}} заданий',
        other: '{{count}} задания',
      },
    },
    demoGrades: {
      familyName: 'Демо',
      firstName: 'Студент',
      specialization: 'Разработка программного обеспечения',
      status: 'Демоаккаунт',
      mathematics: 'Математика',
      programming: 'Программирование',
      english: 'Английский язык',
      databases: 'Базы данных',
      mathematicsFinal: 'Экзамен по математике',
      programmingProject: 'Проект по программированию',
      programmingFinal: 'Экзамен по программированию',
    },
    weekdays: {
      short: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      long: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
    },
    months: [
      'Январь',
      'Февраль',
      'Март',
      'Апрель',
      'Май',
      'Июнь',
      'Июль',
      'Август',
      'Сентябрь',
      'Октябрь',
      'Ноябрь',
      'Декабрь',
    ],
    general: {
      more: 'Больше',
      less: 'Меньше',
      found: 'Найдено',
    },
    settings: {
      language: 'Язык',
      subGroup: 'Подгруппа',
      account: {
        title: 'Аккаунт',
        signIn: 'Войдите в Ваш Аккаунт',
        notVerified: 'Электронная почта не подтверждена',
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
        syncToggle: 'Синхронизировать IDNP на сервере',
        syncTitle: 'Настройки синхронизации IDNP',
        syncEnabledInfo:
          'Ваш IDNP надежно хранится на нашем сервере. Это позволяет вам получать доступ к оценкам на любом устройстве без повторного ввода.',
        syncDisabledInfo:
          'Ваш IDNP хранится только локально на этом устройстве. Если вы отключите синхронизацию, он будет удален с нашего сервера.',
        syncedStatus: 'IDNP синхронизирован',
        noIdnpSaved: 'Нет сохраненных IDNP',
        loginRequired:
          'Войдите в свой аккаунт, чтобы включить синхронизацию IDNP между устройствами',
        title: 'Настройки IDNP',
        clearButton: 'Очистить сохраненный IDNP',
        clearConfirmTitle: 'Очистить сохраненный IDNP',
        clearConfirmMessage:
          'Вы уверены, что хотите очистить сохраненный IDNP? Вам нужно будет ввести его снова для доступа к оценкам.',
        clearConfirmCancel: 'Отмена',
        clearConfirmConfirm: 'Очистить',
      },
      group: {
        title: 'Группа',
        notFound: 'Не найдены группы, соответствующие',
        select: 'Выберите группу',
        search: 'Поиск группы...',
        searching: 'Поиск группы...',
        failed:
          'Не удалось загрузить группы. Проверьте подключение к интернету и попробуйте снова.',
      },
      customPeriods: {
        title: 'Свои занятия',
        add: 'Добавить занятие',
        edit: 'Изменить занятие',
        name: 'Название',
        time: 'Время',
        days: 'Дни',
        color: 'Цвет',
        enabled: 'Включено',
        save: 'Сохранить занятие',
        noPeriodsYet: 'Свои занятия ещё не добавлены',
        colorPicker: 'Выбрать цвет',
        cancel: 'Отмена',
        confirm: 'Подтвердить',
        deleteConfirmTitle: 'Удалить занятие',
        deleteConfirmMessage: 'Вы уверены, что хотите удалить это занятие?',
        delete: 'Удалить',
      },
      notifications: {
        title: 'Уведомления',
        enabled: 'Включить уведомления',
        enabledDescription: 'Вы будете получать напоминания о предстоящих заданиях',
        disabledDescription: 'Вы не будете получать никаких уведомлений о заданиях',
        time: 'Время уведомления',
        timeSettings: 'Настройки времени',
        timeDescription: 'Когда уведомления будут отправляться каждый день',
        selectTime: 'Выбрать время',
        reminderDays: 'Дни напоминания',
        reminderDaysDescription: 'За сколько дней до срока отправлять уведомления',
        importantAssignments: 'Важные задания',
        otherAssignments: 'Другие задания',
        exams: 'Экзамены',
        tests: 'Тесты',
        quizzes: 'Контрольные',
        homework: 'Домашние задания',
        projects: 'Проекты',
        other: 'Другое',
        dailyReminders: 'Ежедневные напоминания',
        dailyRemindersDescription:
          'Отправлять дополнительные напоминания каждый день до срока выполнения',
        dailyExams: 'Для экзаменов',
        dailyTests: 'Для тестов',
        dailyQuizzes: 'Для контрольных',
        testNotification: 'Отправить тестовое уведомление',
        days: 'дней',
        sendDigestNow: 'Отправить ежедневный дайджест сейчас',
        digestSentTitle: 'Ежедневный дайджест отправлен',
        digestSentMessage: 'Проверьте уведомления для просмотра сводного отчета по заданиям',
        errorTitle: 'Ошибка',
        digestErrorMessage: 'Не удалось отправить ежедневный дайджест',
      },
      schedule: {
        title: 'Расписание',
        refresh: 'Обновить расписание',
        refreshing: 'Обновление...',
        group: 'Группа',
        lastUpdated: 'Последнее обновление',
        noRecentRefresh: 'Нет недавних обновлений',
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
      in: 'через',
      dayView: 'По дням',
      weekView: 'По неделям',
      assignments: 'Задания',
      assessments: 'Оценивания',
      loadingAssignments: 'Загрузка заданий...',
      noRegularClassesToday: 'Сегодня обычных занятий нет',
      noRegularClassesWeek: 'На этой неделе обычных занятий нет',
      modifiedAcademicSchedule: 'На этот день действует измененный учебный график',
      modifiedAcademicWeek: 'На эту неделю действует измененный учебный график',
      nextClass: 'Следующее занятие',
      nextClassLoading: 'Поиск следующего занятия...',
      noUpcomingClasses: 'Ближайшие обычные занятия не найдены',
      noUpcomingClassesHint: 'В учебном календаре может еще не быть следующего периода обучения.',
      inferredPeriod: 'Оценка по календарю',
      examDayTitle: 'Расписание экзаменов на сегодня',
      examWeekTitle: 'Экзаменационная сессия на этой неделе',
      examDaySubtitle:
        'Обычные занятия приостановлены. Следуйте официальному расписанию экзаменов.',
      examWeekSubtitle: 'Обычные занятия приостановлены на время экзаменационной сессии.',
      officialExamSchedule: 'Официальное расписание экзаменов',
      noOfficialExams: 'Официальные экзамены пока не опубликованы',
      noOfficialExamsHint: 'Опубликованные даты, время и кабинеты появятся здесь автоматически.',
      academicPeriod: {
        teaching: 'Учебный период',
        exam: 'Экзаменационный период',
        vacation: 'Каникулы',
        practiceIntro: 'Вводная практика по специальности',
        practiceInstructional: 'Учебная практика',
        practiceTechnological: 'Технологическая практика',
        practiceSpecialty1: 'Практика по специальности I',
        practiceSpecialty2: 'Практика по специальности II',
        practiceSpecialty3: 'Практика по специальности III',
        practiceProduction: 'Производственная практика',
        qualificationExam: 'Квалификационный экзамен',
        dualEmployerTraining: 'Обучение у работодателя',
        interSemesterBreak: 'Межсеместровые каникулы',
        summerBreak: 'Летние каникулы',
      },
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
    assignments: {
      title: 'Задания',
      loading: 'Загрузка заданий...',
      empty: 'Заданий не найдено',
      addNew: 'Новое Задание',
      save: 'Сохранить',
      edit: 'Редактировать',
      delete: 'Удалить',
      update: 'Обновить',
      updating: 'Обновление...',
      editTitle: 'Редактировать Задание',
      segments: {
        dueDate: 'Срок сдачи',
        classes: 'Классы',
        priority: 'Приоритет',
      },
      saving: 'Сохранение...',
      common: {
        uncategorized: 'Без категории',
        period: 'Период',
        due: 'Срок',
        orphaned: 'Потерянные',
        orphanedAssignments: 'Потерянные задания (из другой группы)',
        orphanedReason: 'Потеряно: Группа изменена',
      },
      types: {
        homework: 'Домашнее задание',
        test: 'Тест',
        exam: 'Экзамен',
        project: 'Проект',
        quiz: 'Опрос',
        lab: 'Лабораторная',
        essay: 'Эссе',
        presentation: 'Презентация',
        other: 'Другое',
      },
      days: {
        yesterday: 'Вчера',
        today: 'Сегодня',
        tomorrow: 'Завтра',
        monday: 'Понедельник',
        tuesday: 'Вторник',
        wednesday: 'Среда',
        thursday: 'Четверг',
        friday: 'Пятница',
        saturday: 'Суббота',
        sunday: 'Воскресенье',
        nextWeek: 'Следующая Неделя',
        inTwoWeeks: 'Через 2 Недели',
        thisWeek: 'на этой неделе',
        in: 'через',
        weeks: 'недели',
      },
      titlePlaceholder: 'Название задания',
      description: 'Описание',
      descriptionPlaceholder: 'Добавьте детали о задании',
      optional: 'Необязательно',
      type: 'Тип Задания',
      autoDetectedType: 'Тип задания определен автоматически',
      dueDate: 'Срок Сдачи',
      dueTime: 'Время Сдачи',
      markAsPriority: 'Отметить как Приоритетное',
      selectSubject: 'Выбрать Предмет',
      periods: {
        first: '1-й Период',
        second: '2-й Период',
        third: '3-й Период',
        fourth: '4-й Период',
        fifth: '5-й Период',
      },
      useNextPeriod: 'Использовать Следующий Урок',
      noUpcomingClasses: 'Не найдены предстоящие уроки для',
      inNextTwoWeeks: 'в ближайшие две недели',
      findingNextClass: 'Поиск следующего урока...',
      assignmentDueText: 'Срок сдачи этого задания',
      on: 'в',
      at: 'в',
      thisSubject: 'этот предмет',
      noUpcomingClassesFound:
        'Предстоящие уроки не найдены. Пожалуйста, установите пользовательскую дату ниже.',
      recent: 'Недавние',
      all: 'Все',
      custom: 'Пользовательские',
      loadingSubjects: 'Загрузка предметов...',
      noSubjects: 'Предметы не найдены',
      noCustomSubjects: 'Пользовательские предметы не найдены',
      enterSubjectName: 'Введите название предмета',
      add: 'Добавить',
      subtasks: {
        title: 'Подзадачи',
        add: 'Добавить подзадачу',
        addFirst: 'Добавить подзадачи',
        placeholder: 'Введите подзадачу...',
        progress: 'Прогресс подзадачи',
        loading: 'Загрузка подзадач...',
        hint: 'Разбиение задач на шаги улучшает отслеживание прогресса.',
      },
      status: {
        overdue: 'Просрочено',
        completedIn: 'Завершено в',
        dueIn: 'Срок в',
        dueTomorrow: 'Срок завтра',
        dueToday: 'Срок сегодня',
        in: 'через',
        inMinute: 'минуту',
        inMinutes: 'минуты',
        inHour: 'час',
        inHours: 'часа',
        inDay: 'день',
        inDays: 'дня',
        inWeek: 'неделю',
        inWeeks: 'недели',
      },
      archive: {
        title: 'Архив',
        pastDue: 'Просрочено',
        completed: 'Завершено',
        noItems: 'Нет элементов',
        archiveAll: 'Архивировать все',
        archiveConfirmation: 'Вы уверены, что хотите архивировать все выполненные задания?',
      },
      errors: {
        switchingTip: 'Не переключайтесь между вкладками слишком быстро',
        stabilityMode: 'Режим стабильности включён',
        recoveringTitle: 'Восстановление',
        recovering: 'Восстановление',
        tip: 'Совет',
        somethingWrong: 'Что-то пошло не так',
      },
    },
    grades: {
      title: 'Оценки',
      average: 'Средний балл',
      noGrades: 'Нет оценок',
      lastUpdated: 'Данные обновлены',
      neverUpdated: 'Никогда',
      dataStale: 'и могут быть устаревшими. Нажмите кнопку обновления.',
      refreshing: 'Обновление данных...',
      updatedLabel: 'Обновлено',
      absences: 'Пропуски',
      unexcused: 'Неуважительные',
      networkError: 'Не удалось получить данные. Проверьте IDNP и попробуйте снова.',
      networkErrorCache: 'Ошибка сети. Используются кэшированные данные от',
      categories: {
        practice: 'Практика',
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
      calculator: {
        title: 'Калькулятор оценок',
        selectSubject: 'Выберите Предмет',
        currentGrades: 'Текущие оценки',
        noGrades: 'Нет оценок в записи',
        currentAverage: 'Текущая Средняя Оценка',
        targetAverage: 'Целевая Средняя Оценка',
        targetGrade: 'Целевая Оценка',
        minimumGradesNeeded: 'Минимальное количество оценок',
        calculate: 'Вычислить',
        clear: 'Очистить',
        noSolution: 'Нет решения',
        resultsTitle: 'Результаты',
        alreadyAchieved: 'Вы уже достигли этой целевой средней оценки.',
        calculationType: 'Тип расчета',
        semesterOnly: 'Только семестр',
        annualAverage: 'Средняя оценка за год',
        allGrades: 'Все оценки',
      },
      pdf: {
        export: 'Экспорт PDF',
        exportTitle: 'Экспорт отчета по оценкам',
        exportDescription:
          'Создайте аккуратный PDF со всеми предметами, оценками и влиянием экзаменов или тез.',
        preparing: 'Подготовка PDF...',
        shareTitle: 'Отчет готов',
        shareMessage: 'PDF готов к отправке или сохранению.',
        errorTitle: 'Не удалось экспортировать',
        errorMessage: 'Не удалось создать PDF. Попробуйте еще раз.',
        generatedOn: 'Сформировано',
        summaryTitle: 'Сводка',
        totalSemesters: 'Семестры',
        totalSubjects: 'Предметы',
        totalGrades: 'Оценки',
        impactedSubjects: 'С экзаменом/тезой',
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
        connecting:
          'Подключение к серверу CEITI. Это может занять некоторое время, пожалуйста, подождите...',
      },
      subjects: {
        pending: 'Ожидается',
        noExams: 'Нет доступных экзаменов',
        upcoming: 'Предстоящие',
        noSubjects: 'Нет предметов для Семестра {{semester}}',
        finalAverage: 'Итоговая средняя',
        withoutExam: 'Без экзамена/тезы',
        thesis: 'Семестровая работа',
        exam: 'Экзамен',
        newBadge: 'Новое',
        officialSchedule: 'Официальное расписание',
        noOfficialExams: 'Официальное расписание экзаменов/тез недоступно',
      },
    },
    recovery: {
      recoveryDay: 'День отработки',
      noReason: 'Причина отработки не указана',
    },
    update: {
      availableTitle: 'Доступно обновление',
      availableMessage: 'Доступна новая версия приложения. Хотите загрузить ее сейчас?',
      readyTitle: 'Обновление готово',
      readyMessage:
        'Обновление загружено и готово к установке. Приложение перезапустится для применения обновления.',
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
        email: 'Электронная почта',
        password: 'Пароль',
        submit: 'Войти',
        forgotPassword: 'Забыли пароль?',
        noAccount: 'Нет аккаунта?',
        signupLink: 'Зарегистрироваться',
        error: 'Неверная почта или пароль',
        success: 'Успешный вход',
        allFieldsRequired: 'Все поля обязательны',
      },
      signup: {
        title: 'Создать аккаунт',
        email: 'Электронная почта',
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
        email: 'Электронная почта',
        submit: 'Отправить ссылку для сброса',
        backToLogin: 'Вернуться к входу',
        success: 'Письмо для сброса пароля отправлено',
        error: 'Не удалось отправить письмо',
        emailRequired: 'Укажите электронную почту',
      },
      verifyEmail: {
        title: 'Подтвердите почту',
        message: 'Пожалуйста, проверьте почту для подтверждения',
        resend: 'Отправить письмо повторно',
        success: 'Почта успешно подтверждена',
        error: 'Не удалось подтвердить почту',
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
        message:
          'Создайте аккаунт для синхронизации данных между устройствами и доступа к дополнительным функциям',
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
          content:
            'Мы можем обновлять эту политику время от времени. Пожалуйста, регулярно проверяйте эту страницу на наличие обновлений.',
        },
        contact: {
          title: 'Свяжитесь с нами',
          content:
            'Если у вас есть вопросы об этой политике, пожалуйста, свяжитесь с нами по адресу <link>privacy@p.jagged.me</link>.',
        },
      },
    },
    nativeUpdate: {
      recommended: 'Доступно обновление приложения. Рекомендуем обновить его.',
      ready: 'Обновление готово. Установите и перезапустите приложение в удобное время.',
      recovery: 'Завершите обновление приложения в Google Play.',
      failed: 'Не удалось завершить обновление. Попробуйте позже.',
      update: 'Обновить',
      install: 'Установить и перезапустить',
      openStore: 'Открыть Google Play',
      retry: 'Повторить',
      later: 'Позже',
    },
    loginPromo: {
      body: 'Войдите, чтобы разблокировать весь потенциал вашего планировщика с синхронизацией между устройствами и премиум-функциями.',
      stayConnected: 'Оставайтесь на связи',
      getStarted: 'Начать',
      dismiss: 'Может быть позже',
    },
  },
};

export type Translation = typeof translations.en;
