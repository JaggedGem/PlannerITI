export interface ScheduleNavigationRequest {
    date: Date;
    view: 'day' | 'week';
}

type ScheduleNavigationListener = (
    request: ScheduleNavigationRequest,
) => void;

const listeners = new Set<ScheduleNavigationListener>();

export const scheduleNavigation = {
    request(request: ScheduleNavigationRequest) {
        listeners.forEach((listener) =>
            listener({ ...request, date: new Date(request.date) }),
        );
    },

    subscribe(listener: ScheduleNavigationListener) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};
