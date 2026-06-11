export type GraficPeTrackType = 'regular' | 'evening' | 'dual';

export type GraficPePeriodType =
    | 'teaching'
    | 'exam'
    | 'vacation'
    | 'practice_intro'
    | 'practice_instruire'
    | 'practice_tehnologica'
    | 'practice_specialitate_1'
    | 'practice_specialitate_2'
    | 'practice_specialitate_3'
    | 'practice_productie'
    | 'exam_calificare'
    | 'dual_employer_training'
    | 'inter_semester_break'
    | 'summer_break';

export type GraficPePeriodCode =
    | 'EX'
    | 'V'
    | 'Pis'
    | 'Pi'
    | 'Pt'
    | 'Ps1'
    | 'Ps2'
    | 'Ps3'
    | 'Pp'
    | 'EC'
    | 'I/A'
    | null;

export interface GraficPePeriod {
    type: GraficPePeriodType;
    code: GraficPePeriodCode;
    startDate: string;
    endDate: string;
    weekNumbers: number[];
    confidence: 'explicit' | 'inferred';
}

export interface GraficPeGroup {
    group: string;
    trackType: GraficPeTrackType;
    academicYear: string;
    periods: GraficPePeriod[];
}

export interface NextScheduledClass {
    date: Date;
    startTime: string;
    endTime: string;
    className: string;
    roomNumber: string;
}
