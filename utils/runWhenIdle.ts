type IdleHandle = {
    cancel: () => void;
};

type IdleCallback = () => void;

type IdleScheduler = typeof globalThis & {
    requestIdleCallback?: (
        callback: IdleCallback,
        options?: { timeout?: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
};

export const runWhenIdle = (
    callback: () => void,
    timeout = 200,
): IdleHandle => {
    const scheduler = globalThis as IdleScheduler;

    if (typeof scheduler.requestIdleCallback === 'function') {
        const idleHandle = scheduler.requestIdleCallback(() => callback(), {
            timeout,
        });

        return {
            cancel: () => {
                if (typeof scheduler.cancelIdleCallback === 'function') {
                    scheduler.cancelIdleCallback(idleHandle);
                }
            },
        };
    }

    const timer = setTimeout(callback, 0);
    return {
        cancel: () => clearTimeout(timer),
    };
};
