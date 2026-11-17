export const MAX_QUEUED_REVIEWS = 16;
export class JevReviewQueue {
    queued = new Map();
    active;
    running;
    failures = [];
    enqueue(job) {
        this.invalidate(job.key);
        if (this.queued.size >= MAX_QUEUED_REVIEWS) {
            return;
        }
        const controller = new AbortController();
        this.queued.set(job.key, {
            ...job,
            controller,
            signal: controller.signal,
        });
        this.pump();
    }
    invalidate(path) {
        for (const [key, job] of this.queued) {
            if (key === path || job.dependencies?.includes(path) === true) {
                job.controller.abort();
                this.queued.delete(key);
            }
        }
        if (this.active?.key === path
            || this.active?.dependencies?.includes(path) === true) {
            this.active.controller.abort();
        }
    }
    cancel() {
        this.active?.controller.abort();
        for (const job of this.queued.values()) {
            job.controller.abort();
        }
        this.queued.clear();
        this.failures = [];
    }
    async drain() {
        while (this.running !== undefined || this.queued.size > 0) {
            await this.running;
        }
        if (this.failures.length > 0) {
            const failures = this.failures;
            this.failures = [];
            throw new AggregateError(failures, 'Jev background review failed');
        }
    }
    pump() {
        if (this.running !== undefined) {
            return;
        }
        const next = this.queued.entries().next().value;
        if (next === undefined) {
            return;
        }
        const [key, job] = next;
        this.queued.delete(key);
        if (job.signal.aborted) {
            this.pump();
            return;
        }
        this.active = job;
        this.running = Promise.resolve()
            .then(() => {
            if (!job.signal.aborted) {
                return job.run(job.signal);
            }
            return undefined;
        })
            .catch((error) => {
            if (!job.signal.aborted) {
                this.failures.push(error);
            }
        })
            .finally(() => {
            this.active = undefined;
            this.running = undefined;
            this.pump();
        });
    }
}
