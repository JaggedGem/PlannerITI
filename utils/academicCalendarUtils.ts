import {
    GraficPePeriod,
    NextScheduledClass,
} from '@/types/academicCalendar';

export const toLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const academicYearForDate = (date: Date): string => {
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 8 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
};

export const findAcademicPeriodForDate = (
    periods: GraficPePeriod[],
    date: Date | string,
): GraficPePeriod | null => {
    const dateKey = typeof date === 'string' ? date : toLocalDateKey(date);
    return (
        periods.find(
            (period) =>
                period.startDate <= dateKey && dateKey <= period.endDate,
        ) || null
    );
};

export const academicPeriodSuppressesClasses = (
    period: GraficPePeriod | null,
): boolean => Boolean(period && period.type !== 'teaching');

export const isExamAcademicPeriod = (
    period: GraficPePeriod | null,
): boolean =>
    period?.type === 'exam' || period?.type === 'exam_calificare';

export const findSharedAcademicPeriod = (
    periods: (GraficPePeriod | null)[],
): GraficPePeriod | null => {
    if (periods.length === 0 || periods.some((period) => !period)) return null;
    const first = periods[0];
    if (!first) return null;

    return periods.every(
        (period) =>
            period?.type === first.type &&
            period.startDate === first.startDate &&
            period.endDate === first.endDate,
    ) ?
            first
        :   null;
};

export const getWeekStart = (date: Date): Date => {
    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
    );
    const day = result.getDay();
    result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
    return result;
};

export const isDateInSameWeek = (first: Date, second: Date): boolean =>
    toLocalDateKey(getWeekStart(first)) ===
    toLocalDateKey(getWeekStart(second));

const utcDayNumber = (date: Date): number =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    (24 * 60 * 60 * 1000);

export const getWeekOffsetForDate = (
    targetDate: Date,
    anchorDate: Date = new Date(),
): number => {
    const targetMonday = getWeekStart(targetDate);
    const anchorMonday = getWeekStart(anchorDate);
    return Math.round(
        (utcDayNumber(targetMonday) - utcDayNumber(anchorMonday)) / 7,
    );
};

const addCalendarDays = (date: Date, days: number): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

interface SearchableScheduleItem {
    period?: string;
    startTime: string;
    endTime: string;
    className: string;
    roomNumber: string;
    isEvenWeek?: boolean;
}

interface FindNextScheduledClassOptions {
    fromDate: Date;
    maxDays?: number;
    isDateBlocked: (date: Date) => boolean | Promise<boolean>;
    getScheduleForDate: (
        date: Date,
    ) => SearchableScheduleItem[] | Promise<SearchableScheduleItem[]>;
    isEvenWeek: (date: Date) => boolean;
}

export const findNextScheduledClass = async ({
    fromDate,
    maxDays = 370,
    isDateBlocked,
    getScheduleForDate,
    isEvenWeek,
}: FindNextScheduledClassOptions): Promise<NextScheduledClass | null> => {
    for (let dayOffset = 1; dayOffset <= maxDays; dayOffset += 1) {
        const candidateDate = addCalendarDays(fromDate, dayOffset);
        if (await isDateBlocked(candidateDate)) continue;

        const evenWeek = isEvenWeek(candidateDate);
        const schedule = await getScheduleForDate(candidateDate);
        const firstClass = schedule
            .filter(
                (item) =>
                    item &&
                    item.period !== 'recovery-info' &&
                    (item.isEvenWeek === undefined ||
                        item.isEvenWeek === evenWeek),
            )
            .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

        if (firstClass) {
            return {
                date: candidateDate,
                startTime: firstClass.startTime,
                endTime: firstClass.endTime,
                className: firstClass.className,
                roomNumber: firstClass.roomNumber,
            };
        }
    }

    return null;
};
