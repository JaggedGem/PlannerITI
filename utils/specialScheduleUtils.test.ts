import {
    buildSpecialEventKey,
    eventMatchesSelectedSubgroup,
    filterExamEventsForDate,
    filterThesisEventsForDate,
    formatExamTimeLabel,
    formatThesisTimeLabel,
    thesisMatchesScheduleSlot,
} from '@/utils/specialScheduleUtils';
import { ExamScheduleEvent, ThesisScheduleEvent } from '@/services/scheduleService';

const thesisEvent = (
    overrides: Partial<ThesisScheduleEvent> = {},
): ThesisScheduleEvent => ({
    type: 'thesis',
    group: 'P-2422',
    date: '2026-05-26',
    subject: 'Math',
    teacher: 'Teacher',
    room: 'A1',
    subgroup: null,
    period: 2,
    startTime: '09:30',
    endTime: '11:00',
    ...overrides,
});

const examEvent = (
    overrides: Partial<ExamScheduleEvent> = {},
): ExamScheduleEvent => ({
    type: 'exam',
    group: 'P-2422',
    date: '2026-05-26',
    subject: 'Physics',
    teacher: 'Teacher',
    room: 'B2',
    subgroup: null,
    time: '10:00',
    ...overrides,
});

describe('specialScheduleUtils', () => {
    describe('eventMatchesSelectedSubgroup', () => {
        it('matches events without subgroup to all users', () => {
            expect(eventMatchesSelectedSubgroup(null, 'Subgroup 1')).toBe(true);
            expect(
                eventMatchesSelectedSubgroup(undefined, 'Subgroup 2'),
            ).toBe(true);
        });

        it('matches normalized subgroup labels and rejects mismatch', () => {
            expect(
                eventMatchesSelectedSubgroup('grupa 1', 'Subgroup 1'),
            ).toBe(true);
            expect(
                eventMatchesSelectedSubgroup('subgroup 2', 'Subgroup 1'),
            ).toBe(false);
        });
    });

    it('filters thesis and exam events by date + subgroup', () => {
        const date = new Date('2026-05-26T10:00:00Z');
        const thesis = [
            thesisEvent({ subgroup: 'subgroup 1' }),
            thesisEvent({ date: '2026-05-27', subgroup: 'subgroup 1' }),
            thesisEvent({ subgroup: 'subgroup 2' }),
        ];
        const exams = [
            examEvent({ subgroup: 'subgroup 2' }),
            examEvent({ date: '2026-05-27', subgroup: 'subgroup 2' }),
            examEvent({ subgroup: 'subgroup 1' }),
        ];

        expect(filterThesisEventsForDate(thesis, date, 'Subgroup 1')).toHaveLength(
            1,
        );
        expect(filterExamEventsForDate(exams, date, 'Subgroup 2')).toHaveLength(1);
    });

    describe('thesisMatchesScheduleSlot', () => {
        it('matches by period when subgroup is compatible', () => {
            const event = thesisEvent({ subgroup: 'subgroup 1', period: 3 });
            expect(
                thesisMatchesScheduleSlot(
                    event,
                    { period: '3', group: 'subgroup 1' },
                    'Subgroup 1',
                ),
            ).toBe(true);
        });

        it('matches by time when period is unavailable', () => {
            const event = thesisEvent({
                subgroup: 'subgroup 2',
                period: null,
                startTime: '12:00',
                endTime: '13:30',
            });

            expect(
                thesisMatchesScheduleSlot(
                    event,
                    { startTime: '12:00', endTime: '13:30' },
                    'Subgroup 2',
                ),
            ).toBe(true);
        });

        it('rejects subgroup mismatch', () => {
            const event = thesisEvent({ subgroup: 'subgroup 2' });
            expect(
                thesisMatchesScheduleSlot(
                    event,
                    { period: 2, group: 'subgroup 1' },
                    'Subgroup 2',
                ),
            ).toBe(false);
        });
    });

    it('builds deterministic keys for exam/thesis events', () => {
        const examA = examEvent({ time: '10:00' });
        const examB = examEvent({ time: '11:00' });
        const thesis = thesisEvent({ period: 1, startTime: '08:00' });

        expect(buildSpecialEventKey(examA)).not.toBe(buildSpecialEventKey(examB));
        expect(buildSpecialEventKey(thesis)).toContain('thesis');
    });

    it('formats time labels safely', () => {
        expect(
            formatThesisTimeLabel(
                thesisEvent({ startTime: '08:00', endTime: '09:30' }),
            ),
        ).toBe('08:00 - 09:30');
        expect(formatThesisTimeLabel(thesisEvent({ endTime: null }))).toBe('09:30');
        expect(formatExamTimeLabel(examEvent({ time: null }))).toBe('');
    });
});
