import {
    academicPeriodSuppressesClasses,
    academicYearForDate,
    findAcademicPeriodForDate,
    findNextScheduledClass,
    findSharedAcademicPeriod,
    getWeekOffsetForDate,
    isDateInSameWeek,
    isExamAcademicPeriod,
} from '@/utils/academicCalendarUtils';
import {
    buildNextClassCacheKey,
    clearNextClassMemoryCache,
    peekNextClassCache,
    writeNextClassCache,
} from '@/utils/nextClassCache';
import { GraficPePeriod } from '@/types/academicCalendar';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    getAllKeys: jest.fn(async () => []),
    multiRemove: jest.fn(async () => undefined),
}));

const periods: GraficPePeriod[] = [
    {
        type: 'inter_semester_break',
        code: 'V',
        startDate: '2026-01-05',
        endDate: '2026-01-18',
        weekNumbers: [18, 19],
        confidence: 'explicit',
    },
    {
        type: 'teaching',
        code: null,
        startDate: '2026-01-19',
        endDate: '2026-05-10',
        weekNumbers: [20],
        confidence: 'explicit',
    },
];

describe('academicCalendarUtils', () => {
    it('matches academic periods inclusively', () => {
        expect(
            findAcademicPeriodForDate(periods, '2026-01-05')?.type,
        ).toBe('inter_semester_break');
        expect(
            findAcademicPeriodForDate(periods, '2026-01-18')?.type,
        ).toBe('inter_semester_break');
        expect(findAcademicPeriodForDate(periods, '2026-01-19')?.type).toBe(
            'teaching',
        );
    });

    it('suppresses every non-teaching academic period', () => {
        expect(academicPeriodSuppressesClasses(periods[0])).toBe(true);
        expect(academicPeriodSuppressesClasses(periods[1])).toBe(false);
        expect(academicPeriodSuppressesClasses(null)).toBe(false);
    });

    it('identifies exam periods and a shared period scope', () => {
        const examPeriod: GraficPePeriod = {
            ...periods[0],
            type: 'exam',
            code: 'EX',
        };
        expect(isExamAcademicPeriod(examPeriod)).toBe(true);
        expect(isExamAcademicPeriod(periods[0])).toBe(false);
        expect(findSharedAcademicPeriod([examPeriod, examPeriod])).toBe(
            examPeriod,
        );
        expect(findSharedAcademicPeriod([examPeriod, periods[1]])).toBeNull();
    });

    it('derives academic years and week navigation offsets locally', () => {
        expect(academicYearForDate(new Date(2026, 7, 31))).toBe('2025-2026');
        expect(academicYearForDate(new Date(2026, 8, 1))).toBe('2026-2027');
        expect(
            isDateInSameWeek(
                new Date(2026, 5, 8),
                new Date(2026, 5, 14),
            ),
        ).toBe(true);
        expect(
            getWeekOffsetForDate(
                new Date(2026, 5, 22),
                new Date(2026, 5, 8),
            ),
        ).toBe(2);
    });

    it('skips blocked dates and odd/even mismatches when finding a class', async () => {
        const result = await findNextScheduledClass({
            fromDate: new Date(2026, 0, 5),
            maxDays: 5,
            isDateBlocked: (date) => date.getDate() < 8,
            isEvenWeek: () => true,
            getScheduleForDate: async (date) =>
                date.getDate() === 8 ?
                    [
                        {
                            period: '1',
                            startTime: '08:00',
                            endTime: '09:30',
                            className: 'Chemistry',
                            roomNumber: '309',
                            isEvenWeek: false,
                        },
                        {
                            period: '2',
                            startTime: '09:45',
                            endTime: '11:15',
                            className: 'Mathematics',
                            roomNumber: '201',
                        },
                    ]
                :   [],
        });

        expect(result?.date.getDate()).toBe(8);
        expect(result?.className).toBe('Mathematics');
        expect(result?.startTime).toBe('09:45');
    });

    it('reuses one next-class cache entry across the same academic period', async () => {
        clearNextClassMemoryCache();
        const examPeriod: GraficPePeriod = {
            type: 'exam',
            code: 'EX',
            startDate: '2026-05-18',
            endDate: '2026-05-31',
            weekNumbers: [38, 39],
            confidence: 'explicit',
        };
        const firstKey = buildNextClassCacheKey({
            selectedGroupId: 'group-1',
            selectedGroupName: 'P-2422',
            subgroup: 'Subgroup 2',
            scheduleRefreshVersion: 3,
            fromDate: new Date(2026, 4, 18),
            sharedAcademicPeriod: examPeriod,
        });
        const secondKey = buildNextClassCacheKey({
            selectedGroupId: 'group-1',
            selectedGroupName: 'P-2422',
            subgroup: 'Subgroup 2',
            scheduleRefreshVersion: 3,
            fromDate: new Date(2026, 4, 25),
            sharedAcademicPeriod: examPeriod,
        });
        const nextClass = {
            date: new Date(2026, 5, 1),
            startTime: '08:00',
            endTime: '09:30',
            className: 'Chemistry',
            roomNumber: '309',
        };

        expect(firstKey).toBe(secondKey);
        await writeNextClassCache(firstKey, nextClass, 1000);
        expect(peekNextClassCache(secondKey, 1001)).toEqual({
            found: true,
            value: nextClass,
        });
    });
});
