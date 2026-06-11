import {
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { memo } from 'react';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { useTranslation } from '@/hooks/useTranslation';
import {
    GraficPePeriod,
    GraficPePeriodType,
    NextScheduledClass,
} from '@/types/academicCalendar';
import type { ExamScheduleEvent } from '@/services/scheduleService';
import { isExamAcademicPeriod } from '@/utils/academicCalendarUtils';

interface AcademicEmptyStateProps {
    variant: 'day' | 'week';
    period: GraficPePeriod | null;
    examEvents?: ExamScheduleEvent[];
    nextClass: NextScheduledClass | null;
    isNextClassLoading: boolean;
    onNextClassPress: () => void;
}

interface ExamAgendaCardProps {
    events: ExamScheduleEvent[];
}

interface NextClassCardProps {
    nextClass: NextScheduledClass | null;
    isLoading: boolean;
    onPress: () => void;
}

const periodIcon = (
    type?: GraficPePeriodType,
): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (type) {
        case 'exam':
        case 'exam_calificare':
            return 'school-outline';
        case 'vacation':
        case 'inter_semester_break':
        case 'summer_break':
            return 'sunny-outline';
        case 'dual_employer_training':
            return 'business-outline';
        case 'practice_intro':
        case 'practice_instruire':
        case 'practice_tehnologica':
        case 'practice_specialitate_1':
        case 'practice_specialitate_2':
        case 'practice_specialitate_3':
        case 'practice_productie':
            return 'briefcase-outline';
        default:
            return 'calendar-clear-outline';
    }
};

export const ExamAgendaCard = memo(function ExamAgendaCard({
    events,
}: ExamAgendaCardProps) {
    const { t, formatDate, formatTime } = useTranslation();
    const scheduleText = t('schedule');
    const sortedEvents = [...events].sort((first, second) => {
        const dateComparison = first.date.localeCompare(second.date);
        if (dateComparison !== 0) return dateComparison;
        return (first.time || '').localeCompare(second.time || '');
    });

    const formatExamTime = (time: string | null): string => {
        if (!time) return '';
        return /^\d{1,2}:\d{2}$/.test(time) ? formatTime(time) : time;
    };

    return (
        <View style={styles.examAgendaCard}>
            <View style={styles.examAgendaHeader}>
                <View style={styles.examAgendaIcon}>
                    <Ionicons
                        name="school-outline"
                        size={18}
                        color={Colors.dark.lightOrange}
                    />
                </View>
                <Text style={styles.examAgendaTitle}>
                    {scheduleText.officialExamSchedule}
                </Text>
            </View>

            {sortedEvents.length > 0 ?
                <View style={styles.examList}>
                    {sortedEvents.map((event, index) => (
                        <View
                            key={`${event.date}-${event.subject}-${event.time || ''}-${event.room}-${event.subgroup || ''}`}
                            style={[
                                styles.examRow,
                                index < sortedEvents.length - 1 &&
                                    styles.examRowBorder,
                            ]}
                        >
                            <View style={styles.examDateColumn}>
                                <Text style={styles.examDayText}>
                                    {formatDate(
                                        new Date(`${event.date}T00:00:00`),
                                        { weekday: 'short' },
                                    )}
                                </Text>
                                <Text style={styles.examDateText}>
                                    {formatDate(
                                        new Date(`${event.date}T00:00:00`),
                                        { day: 'numeric', month: 'short' },
                                    )}
                                </Text>
                            </View>
                            <View style={styles.examDetails}>
                                <Text
                                    style={styles.examSubject}
                                    numberOfLines={2}
                                >
                                    {event.subject}
                                </Text>
                                <Text
                                    style={styles.examMeta}
                                    numberOfLines={2}
                                >
                                    {[
                                        formatExamTime(event.time),
                                        event.room ?
                                            `${scheduleText.room} ${event.room}`
                                        :   '',
                                        event.teacher || '',
                                        event.subgroup ?
                                            `SG ${event.subgroup}`
                                        :   '',
                                    ]
                                        .filter(Boolean)
                                        .join(' • ')}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            :   <View style={styles.examEmpty}>
                    <Text style={styles.examEmptyTitle}>
                        {scheduleText.noOfficialExams}
                    </Text>
                    <Text style={styles.examEmptyHint}>
                        {scheduleText.noOfficialExamsHint}
                    </Text>
                </View>
            }
        </View>
    );
});

const NextClassCard = memo(function NextClassCard({
    nextClass,
    isLoading,
    onPress,
}: NextClassCardProps) {
    const { t, formatDate, formatTime } = useTranslation();
    const scheduleText = t('schedule');

    return (
        <TouchableOpacity
            style={[
                styles.nextClassCard,
                !nextClass && !isLoading && styles.nextClassCardDisabled,
            ]}
            activeOpacity={nextClass ? 0.72 : 1}
            disabled={!nextClass}
            onPress={onPress}
            accessibilityRole={nextClass ? 'button' : undefined}
            accessibilityLabel={scheduleText.nextClass}
        >
            <View style={styles.nextClassIcon}>
                <Ionicons
                    name={
                        nextClass ?
                            'arrow-forward-circle-outline'
                        :   'calendar-outline'
                    }
                    size={24}
                    color={
                        nextClass ?
                            Colors.dark.accentBlue
                        :   Colors.dark.neutral500
                    }
                />
            </View>
            <View style={styles.nextClassCopy}>
                <Text style={styles.nextClassLabel}>
                    {scheduleText.nextClass}
                </Text>
                {isLoading ?
                    <Text style={styles.nextClassMuted}>
                        {scheduleText.nextClassLoading}
                    </Text>
                : nextClass ?
                    <>
                        <Text style={styles.nextClassDate}>
                            {formatDate(nextClass.date, {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric',
                            })}{' '}
                            • {formatTime(nextClass.startTime)}
                        </Text>
                        <Text
                            style={styles.nextClassSubject}
                            numberOfLines={2}
                        >
                            {nextClass.className}
                            {nextClass.roomNumber ?
                                ` • ${scheduleText.room} ${nextClass.roomNumber}`
                            :   ''}
                        </Text>
                    </>
                :   <>
                        <Text style={styles.nextClassMuted}>
                            {scheduleText.noUpcomingClasses}
                        </Text>
                        <Text style={styles.nextClassHint}>
                            {scheduleText.noUpcomingClassesHint}
                        </Text>
                    </>
                }
            </View>
            {nextClass && (
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.dark.neutral500}
                />
            )}
        </TouchableOpacity>
    );
});

function AcademicEmptyState({
    variant,
    period,
    examEvents = [],
    nextClass,
    isNextClassLoading,
    onNextClassPress,
}: AcademicEmptyStateProps) {
    const { t, formatDate } = useTranslation();
    const scheduleText = t('schedule');
    const isExamMode =
        isExamAcademicPeriod(period) || examEvents.length > 0;

    const periodLabel = (() => {
        if (!period) return null;
        const labels = scheduleText.academicPeriod;
        const labelByType: Record<GraficPePeriodType, string> = {
            teaching: labels.teaching,
            exam: labels.exam,
            vacation: labels.vacation,
            practice_intro: labels.practiceIntro,
            practice_instruire: labels.practiceInstructional,
            practice_tehnologica: labels.practiceTechnological,
            practice_specialitate_1: labels.practiceSpecialty1,
            practice_specialitate_2: labels.practiceSpecialty2,
            practice_specialitate_3: labels.practiceSpecialty3,
            practice_productie: labels.practiceProduction,
            exam_calificare: labels.qualificationExam,
            dual_employer_training: labels.dualEmployerTraining,
            inter_semester_break: labels.interSemesterBreak,
            summer_break: labels.summerBreak,
        };
        return labelByType[period.type];
    })();

    const periodRange =
        period ?
            `${formatDate(new Date(`${period.startDate}T00:00:00`), {
                day: 'numeric',
                month: 'short',
            })} - ${formatDate(new Date(`${period.endDate}T00:00:00`), {
                day: 'numeric',
                month: 'short',
            })}`
        :   '';

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[
                    isExamMode ?
                        Colors.dark.overlayOrange20
                    :   Colors.dark.surfaceRaisedAlt,
                    isExamMode ?
                        Colors.dark.surfaceSecondary
                    :   Colors.dark.surfaceSecondary,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                    styles.heroCard,
                    isExamMode && styles.heroCardExam,
                ]}
            >
                <View
                    style={[
                        styles.heroIcon,
                        isExamMode && styles.heroIconExam,
                    ]}
                >
                    <Ionicons
                        name={periodIcon(period?.type)}
                        size={28}
                        color={
                            isExamMode ?
                                Colors.dark.lightOrange
                            :   Colors.dark.primarySoftText
                        }
                    />
                </View>
                <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>
                        {isExamMode ?
                            variant === 'day' ?
                                scheduleText.examDayTitle
                            :   scheduleText.examWeekTitle
                        : variant === 'day' ?
                            scheduleText.noRegularClassesToday
                        :   scheduleText.noRegularClassesWeek}
                    </Text>
                    <Text
                        style={[
                            styles.heroSubtitle,
                            isExamMode && styles.heroSubtitleExam,
                        ]}
                    >
                        {isExamMode ?
                            variant === 'day' ?
                                scheduleText.examDaySubtitle
                            :   scheduleText.examWeekSubtitle
                        : variant === 'day' ?
                            scheduleText.modifiedAcademicSchedule
                        :   scheduleText.modifiedAcademicWeek}
                    </Text>
                    {periodLabel && (
                        <View style={styles.periodRow}>
                            <View
                                style={[
                                    styles.periodPill,
                                    isExamMode && styles.periodPillExam,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.periodText,
                                        isExamMode && styles.periodTextExam,
                                    ]}
                                >
                                    {periodLabel}
                                </Text>
                            </View>
                            <Text style={styles.periodRange}>{periodRange}</Text>
                            {period?.confidence === 'inferred' && (
                                <Text style={styles.inferredText}>
                                    {scheduleText.inferredPeriod}
                                </Text>
                            )}
                        </View>
                    )}
                </View>
            </LinearGradient>

            {isExamMode &&
                (variant === 'week' || examEvents.length > 0) && (
                    <ExamAgendaCard events={examEvents} />
                )}

            <NextClassCard
                nextClass={nextClass}
                isLoading={isNextClassLoading}
                onPress={onNextClassPress}
            />
        </View>
    );
}

export default memo(AcademicEmptyState);

type Styles = {
    container: ViewStyle;
    heroCard: ViewStyle;
    heroCardExam: ViewStyle;
    heroIcon: ViewStyle;
    heroIconExam: ViewStyle;
    heroCopy: ViewStyle;
    heroTitle: TextStyle;
    heroSubtitle: TextStyle;
    heroSubtitleExam: TextStyle;
    periodRow: ViewStyle;
    periodPill: ViewStyle;
    periodPillExam: ViewStyle;
    periodText: TextStyle;
    periodTextExam: TextStyle;
    periodRange: TextStyle;
    inferredText: TextStyle;
    examAgendaCard: ViewStyle;
    examAgendaHeader: ViewStyle;
    examAgendaIcon: ViewStyle;
    examAgendaTitle: TextStyle;
    examList: ViewStyle;
    examRow: ViewStyle;
    examRowBorder: ViewStyle;
    examDateColumn: ViewStyle;
    examDayText: TextStyle;
    examDateText: TextStyle;
    examDetails: ViewStyle;
    examSubject: TextStyle;
    examMeta: TextStyle;
    examEmpty: ViewStyle;
    examEmptyTitle: TextStyle;
    examEmptyHint: TextStyle;
    nextClassCard: ViewStyle;
    nextClassCardDisabled: ViewStyle;
    nextClassIcon: ViewStyle;
    nextClassCopy: ViewStyle;
    nextClassLabel: TextStyle;
    nextClassDate: TextStyle;
    nextClassSubject: TextStyle;
    nextClassMuted: TextStyle;
    nextClassHint: TextStyle;
};

const styles = StyleSheet.create<Styles>({
    container: {
        width: '100%',
        gap: 14,
        paddingBottom: 24,
    },
    heroCard: {
        borderRadius: 24,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: Colors.dark.overlayPrimary25,
        padding: 20,
        flexDirection: 'row',
        gap: 16,
        overflow: 'hidden',
    },
    heroCardExam: {
        borderColor: Colors.dark.overlayOrange30,
    },
    heroIcon: {
        width: 52,
        height: 52,
        borderRadius: 18,
        backgroundColor: Colors.dark.overlayPrimary25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroIconExam: {
        backgroundColor: Colors.dark.overlayOrange20,
    },
    heroCopy: {
        flex: 1,
        gap: 7,
    },
    heroTitle: {
        color: Colors.dark.white,
        fontSize: 20,
        lineHeight: 25,
        fontWeight: '700',
    },
    heroSubtitle: {
        color: Colors.dark.primarySoftText,
        fontSize: 14,
        lineHeight: 20,
    },
    heroSubtitleExam: {
        color: Colors.dark.assessmentExamIcon,
    },
    periodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 7,
        paddingTop: 3,
    },
    periodPill: {
        borderRadius: 10,
        backgroundColor: Colors.dark.overlayAccentBlue20,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    periodPillExam: {
        backgroundColor: Colors.dark.overlayOrange20,
    },
    periodText: {
        color: Colors.dark.assessmentThesisIcon,
        fontSize: 12,
        fontWeight: '700',
    },
    periodTextExam: {
        color: Colors.dark.assessmentExamIcon,
    },
    periodRange: {
        color: Colors.dark.neutral500,
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    inferredText: {
        color: Colors.dark.lightOrange,
        fontSize: 11,
        fontWeight: '600',
    },
    examAgendaCard: {
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: Colors.dark.overlayOrange26,
        backgroundColor: Colors.dark.overlayOrange08,
        padding: 16,
        gap: 12,
    },
    examAgendaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    examAgendaIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: Colors.dark.overlayOrange20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    examAgendaTitle: {
        color: Colors.dark.white,
        fontSize: 15,
        fontWeight: '700',
    },
    examList: {
        gap: 0,
    },
    examRow: {
        flexDirection: 'row',
        gap: 13,
        paddingVertical: 12,
    },
    examRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.overlayOrange20,
    },
    examDateColumn: {
        width: 56,
        gap: 2,
    },
    examDayText: {
        color: Colors.dark.lightOrange,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    examDateText: {
        color: Colors.dark.neutral300,
        fontSize: 11,
    },
    examDetails: {
        flex: 1,
        gap: 4,
    },
    examSubject: {
        color: Colors.dark.white,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '700',
    },
    examMeta: {
        color: Colors.dark.assessmentExamIcon,
        fontSize: 12,
        lineHeight: 17,
    },
    examEmpty: {
        borderRadius: 14,
        backgroundColor: Colors.dark.overlayOrange08,
        padding: 12,
        gap: 4,
    },
    examEmptyTitle: {
        color: Colors.dark.assessmentExamIcon,
        fontSize: 13,
        fontWeight: '700',
    },
    examEmptyHint: {
        color: Colors.dark.neutral500,
        fontSize: 12,
        lineHeight: 17,
    },
    nextClassCard: {
        minHeight: 112,
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: Colors.dark.borderStrong,
        backgroundColor: Colors.dark.surfaceRaised,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
    },
    nextClassCardDisabled: {
        opacity: 0.82,
    },
    nextClassIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: Colors.dark.overlayAccentBlue12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextClassCopy: {
        flex: 1,
        gap: 4,
    },
    nextClassLabel: {
        color: Colors.dark.neutral500,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    nextClassDate: {
        color: Colors.dark.white,
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    nextClassSubject: {
        color: Colors.dark.primarySoftText,
        fontSize: 14,
        lineHeight: 19,
    },
    nextClassMuted: {
        color: Colors.dark.neutral300,
        fontSize: 15,
        fontWeight: '600',
    },
    nextClassHint: {
        color: Colors.dark.neutral500,
        fontSize: 12,
        lineHeight: 17,
    },
});
