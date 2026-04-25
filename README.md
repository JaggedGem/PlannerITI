# PlannerITI 📚

<div align="center">
  <img src="./assets/images/icon.png" alt="PlannerITI Logo" width="128" height="128"/>
  
  **A comprehensive student planner for CEITI students**
  
  [![React Native](https://img.shields.io/badge/React%20Native-0.81.4-blue.svg)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo-~54.0.12-000020.svg)](https://expo.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
</div>

## 📖 Overview

PlannerITI is a modern, feature-rich mobile application designed specifically for students at the College of Excellence in IT (CEITI). It combines schedule management, assignment tracking, grade monitoring, and intelligent notifications into one seamless experience.

Built with React Native and Expo, PlannerITI offers a native-like experience on both iOS and Android platforms with a beautiful, intuitive interface optimized for student productivity.

## ✨ Key Features

### 📅 Smart Schedule Management
- **Real-time Class Schedule**: Automatically syncs with CEITI's schedule system
- **Day & Week Views**: Toggle between detailed daily view and comprehensive weekly overview
- **Even/Odd Week Detection**: Automatically determines the current week type
- **Recovery Day Support**: Special handling for weekend recovery classes
- **Custom Periods**: Create and manage custom time blocks for extracurricular activities
- **Subgroup Filtering**: Display classes specific to your subgroup (Subgroup 1 or 2)
- **Offline Support**: Cached schedules available even without internet connection
- **Assignment Integration**: See assignment counts directly on each class period

### 📝 Assignment Tracking
- **Multiple Views**: Organize assignments by due date, class, or priority
- **Rich Assignment Types**: Support for homework, tests, exams, projects, quizzes, labs, essays, and presentations
- **Subtasks**: Break down complex assignments into manageable subtasks
- **Priority Marking**: Flag important assignments for quick access
- **Completion Tracking**: Mark assignments and subtasks as complete
- **Archive System**: Automatically archive past-due assignments
- **Course Integration**: Link assignments to specific schedule periods
- **Orphaned Assignment Handling**: Smart detection and restoration when switching groups

### 📊 Grade Monitoring
- **IDNP Integration**: Secure login using your IDNP number
- **Real-time Grade Display**: View current semester grades and averages
- **Semester Overview**: Access grades for all semesters (Semester I & II)
- **Exam Tracking**: Monitor upcoming and completed exams (Examen, Teza, Practică)
- **Automatic Average Calculation**: Real-time computation of subject and semester averages
- **Exam Grade Integration**: Automatically applies exam grades to semester averages using proper weighting
- **Absence Tracking**: Monitor total, sick, excused, and unexcused absences
- **Grade Calculator**: Smart tool to calculate what grades you need to reach your target average
  - Semester-specific calculations
  - Annual average calculations (for multi-semester subjects)
  - Realistic grade suggestions
- **Annual Grades**: View complete annual performance summaries
- **Offline Caching**: Access your grades even when offline
- **Background Refresh**: Silent updates when opening the app

### 🔔 Intelligent Notifications
- **Smart Reminders**: Customizable reminder schedules based on assignment type
  - Exams: Default 3 days before
  - Tests: Default 2 days before
  - Quizzes: Default 2 days before
  - Projects: Default 3 days before
  - Homework: Default 1 day before
  - Other: Default 1 day before
- **Daily Digest**: Optional morning summary of upcoming assignments
- **Type-Specific Daily Reminders**: Enable daily reminders for specific assignment types (exams, tests, quizzes)
- **Customizable Timing**: Set your preferred notification time
- **Completion Awareness**: Automatically cancels notifications for completed assignments
- **Priority Alerts**: Enhanced notifications for priority assignments

### 🔐 Account & Sync (Authentication System)
- **Secure Authentication**: Email-based login with password encryption
- **Email Verification**: Verify your account via email
- **Password Reset**: Secure password recovery system
- **Gravatar Integration**: Automatic profile pictures from Gravatar
- **Account Management**: View profile, manage settings, delete account
- **Skip Login Option**: Use the app without creating an account
- **Session Management**: Automatic token refresh and secure session handling

### 🌍 Localization
- **Multi-Language Support**: 
  - English (en)
  - Română (ro)
  - Русский (ru)
- **Automatic Language Detection**: Defaults to system language
- **Localized Date Formatting**: Dates displayed in your preferred language
- **Translation Coverage**: Complete UI translation including all features

### ⚙️ Customization
- **Theme Support**: Optimized dark theme for comfortable viewing
- **Schedule Views**: Switch between day and week views
- **Group Selection**: Choose from all CEITI groups (e.g., P-2422, M-2422, etc.)
- **Custom Period Management**: Create, edit, and delete custom time blocks
  - Set custom names and colors
  - Define specific days of the week
  - Set custom start and end times
  - Enable/disable periods as needed
- **Notification Preferences**: Fine-tune all notification settings
- **IDNP Management**: Securely store and manage your student ID

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **iOS Simulator** (Mac only) or **Android Emulator**
- **Expo Go app** (for testing on physical devices)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/JaggedGem/PlannerITI.git
   cd PlannerITI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   GRAVATAR_API_KEY=your_gravatar_api_key
   API_KEY=your_api_key
   ```

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run on your device**
   - Scan the QR code with Expo Go (Android) or Camera app (iOS)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

## 📱 Building for Production

### Using EAS Build

1. **Install EAS CLI**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure EAS**
   ```bash
   eas build:configure
   ```

3. **Build for Android**
   ```bash
   eas build --platform android
   ```

4. **Build for iOS**
   ```bash
   eas build --platform ios
   ```

### Local Builds

For Android:
```bash
npx expo run:android
```

For iOS (Mac only):
```bash
npx expo run:ios
```

## 🏗️ Project Structure

```
PlannerITI/
├── app/                          # Main application screens
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── assignments.tsx       # Assignment management
│   │   ├── schedule.tsx          # Class schedule
│   │   ├── grades.tsx            # Grade tracking
│   │   └── settings.tsx          # App settings
│   ├── auth.tsx                  # Authentication screen
│   ├── new-assignment.tsx        # Create assignment
│   ├── edit-assignment.tsx       # Edit assignment
│   ├── archive.tsx               # Archived assignments
│   └── _layout.tsx               # Root layout
├── components/                   # Reusable components
│   ├── assignments/              # Assignment-related components
│   ├── auth/                     # Authentication components
│   ├── schedule/                 # Schedule view components
│   └── ui/                       # UI primitives
├── services/                     # Business logic & API
│   ├── authService.ts            # Authentication service
│   ├── scheduleService.ts        # Schedule management
│   ├── gradesService.ts          # Grades API integration
│   └── settingsService.ts        # Settings persistence
├── utils/                        # Utility functions
│   ├── assignmentStorage.ts     # Assignment data management
│   ├── notificationHelper.ts    # Notification scheduling
│   ├── notificationUtils.ts     # Notification configuration
│   └── dateLocalization.ts      # Date formatting
├── constants/                    # App constants
│   ├── Colors.ts                 # Color definitions
│   └── Translations.ts           # Translation strings
├── hooks/                        # Custom React hooks
│   ├── useTranslation.ts         # Localization hook
│   ├── useAssignments.ts         # Assignment management
│   └── useAuth.ts                # Authentication state
└── assets/                       # Static assets
    ├── fonts/                    # Custom fonts
    └── images/                   # Images and icons
```

## 🔧 Configuration

### App Configuration

The app uses `app.config.js` for configuration. Key settings:

- **App Name**: PlannerITI
- **Slug**: planneriti
- **Version**: 1.0.1
- **Orientation**: Portrait (locked)
- **Splash Screen**: Custom splash with icon
- **Status Bar**: Light content style
- **Permissions**: Notifications

### EAS Configuration

Build profiles are defined in `eas.json`:
- **Development**: Development builds with dev client
- **Preview**: Internal testing builds
- **Production**: Release builds for stores

## 🛠️ Technologies Used

### Core
- **React Native** 0.81.4 - Mobile framework
- **Expo** ~54.0.12 - Development platform
- **TypeScript** 5.9.2 - Type safety
- **React** 19.1.0 - UI library

### Navigation & Routing
- **Expo Router** ~6.0.10 - File-based routing
- **React Navigation** 7.x - Navigation library

### Data & Storage
- **AsyncStorage** 2.2.0 - Local data persistence
- **Expo SecureStore** ~15.0.7 - Secure credential storage

### UI & Animation
- **React Native Reanimated** ~4.1.1 - Smooth animations
- **React Native Gesture Handler** ~2.28.0 - Touch gestures
- **Expo Blur** ~15.0.7 - Blur effects
- **Expo Linear Gradient** ~15.0.7 - Gradient backgrounds
- **Expo Haptics** ~15.0.7 - Haptic feedback

### Utilities
- **date-fns** 4.1.0 - Date manipulation
- **crypto-js** 4.2.0 - Encryption
- **Expo Notifications** ~0.32.12 - Push notifications
- **Expo Linking** ~8.0.8 - Deep linking

## 📡 API Integration

### Schedule API
- **Base URL**: `https://orar-api.ceiti.md/v1`
- **Endpoints**:
  - `/grupe` - Fetch available groups
  - `/orar?_id={groupId}&tip=class` - Fetch class schedule

### Grades API
- **Base URL**: `https://api.ceiti.md`
- **Authentication**: IDNP-based login
- **Endpoints**:
  - `/date/login` - Authenticate with IDNP
  - `/index.php/date/info/{idnp}` - Fetch student grades

### Custom Backend API
- **Development resolution order**:
  - `CUSTOM_API_LOCAL_URL` (full URL)
  - `CUSTOM_API_LOCAL_HOST` + `CUSTOM_API_LOCAL_PORT` (defaults to `5000`)
  - Expo host-derived local URLs (plus Android/iOS emulator fallbacks)
- **Production fallback URL**: `https://papi.jagged.site`
- **Features**:
  - User authentication and management
  - Period time synchronization
  - Recovery day scheduling
  - Encrypted data storage

## 🔒 Security & Privacy

- **Secure Storage**: Passwords and sensitive data stored using Expo SecureStore
- **Encryption**: Client-side encryption for IDNP data
- **Token Management**: JWT-based authentication with auto-refresh
- **Offline First**: Local data storage with minimal network exposure
- **No Analytics**: No third-party tracking or analytics
- **GDPR Compliant**: Account deletion removes all user data

## 🐛 Known Issues & Limitations

- **iOS Simulator**: Some notification features may not work in iOS Simulator (test on device)
- **Network Dependency**: Schedule and grade sync require internet connection
- **Group Changes**: When switching groups, some assignments may become "orphaned" (can be restored)
- **IDNP Requirement**: Grade features require a valid CEITI IDNP number

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Update documentation for new features
- Test on both iOS and Android
- Maintain code style consistency

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Orlet** - *Initial work* - [JaggedGem](https://github.com/JaggedGem)

## 🙏 Acknowledgments

- CEITI for the schedule API access
- Expo team for the amazing development platform
- React Native community for valuable resources
- All contributors and testers

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/JaggedGem/PlannerITI/issues)
- Contact the development team

## 🗺️ Roadmap

### Upcoming Features
- [ ] Widget support for iOS and Android
- [ ] Calendar integration
- [ ] Study timer and pomodoro technique
- [ ] Group study sessions
- [ ] Cloud sync across devices
- [ ] Dark/light theme toggle
- [ ] Export grades to PDF
- [ ] Grade predictions and trends
- [ ] Collaborative assignments
- [ ] Teacher contact information

### In Progress
- [x] Background refresh optimization
- [x] Grade calculator improvements
- [x] Multi-semester subject support

---

<div align="center">
  Made with ❤️ for CEITI students
  
  **Star ⭐ this repository if you find it helpful!**
</div>
