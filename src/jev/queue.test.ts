import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JevReviewQueue, MAX_QUEUED_REVIEWS } from '@/jev/queue.js';

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolveFn: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  return { promise, resolve: resolveFn };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

test('one review runs at a time', async () => {
  const queue = new JevReviewQueue();
  const started: string[] = [];
  const first = deferred();
  const second = deferred();
  queue.enqueue({
    key: 'a',
    run: () => {
      started.push('a');
      return first.promise;
    },
  });
  queue.enqueue({
    key: 'b',
    run: () => {
      started.push('b');
      return second.promise;
    },
  });
  await flush();
  assert.deepEqual(started, ['a']);
  first.resolve();
  await flush();
  assert.deepEqual(started, ['a', 'b']);
  second.resolve();
  await queue.drain();
});

test('a new review of the same subject cancels the active one', async () => {
  const queue = new JevReviewQueue();
  const firstRun = deferred();
  const signals: AbortSignal[] = [];
  queue.enqueue({
    key: 'a',
    run: (signal) => {
      signals.push(signal);
      return firstRun.promise;
    },
  });
  await flush();
  queue.enqueue({
    key: 'a',
    run: (signal) => {
      signals.push(signal);
      return Promise.resolve();
    },
  });
  assert.equal(signals[0]?.aborted, true);
  firstRun.resolve();
  await queue.drain();
  assert.equal(signals.length, 2);
  assert.equal(signals[1]?.aborted, false);
});

test('a dependency change cancels a queued review', async () => {
  const queue = new JevReviewQueue();
  const blocker = deferred();
  let reviewed = false;
  queue.enqueue({ key: 'blocker', run: () => blocker.promise });
  queue.enqueue({
    key: 'a',
    dependencies: ['src/dep.ts'],
    run: () => {
      reviewed = true;
      return Promise.resolve();
    },
  });
  queue.invalidate('src/dep.ts');
  blocker.resolve();
  await queue.drain();
  assert.equal(reviewed, false);
});

test('the backlog is bounded', async () => {
  const queue = new JevReviewQueue();
  const blocker = deferred();
  const executed: string[] = [];
  queue.enqueue({ key: 'blocker', run: () => blocker.promise });
  for (let index = 0; index < MAX_QUEUED_REVIEWS + 1; index += 1) {
    queue.enqueue({
      key: `job-${String(index)}`,
      run: () => {
        executed.push(`job-${String(index)}`);
        return Promise.resolve();
      },
    });
  }
  blocker.resolve();
  await queue.drain();
  assert.equal(executed.length, MAX_QUEUED_REVIEWS);
  assert.equal(executed.includes(`job-${String(MAX_QUEUED_REVIEWS)}`), false);
});

test('cancelling aborts the active review and drops the backlog', async () => {
  const queue = new JevReviewQueue();
  const blocker = deferred();
  const signals: AbortSignal[] = [];
  queue.enqueue({
    key: 'a',
    run: (signal) => {
      signals.push(signal);
      return blocker.promise;
    },
  });
  queue.enqueue({
    key: 'b',
    run: (signal) => {
      signals.push(signal);
      return Promise.resolve();
    },
  });
  await flush();
  queue.cancel();
  assert.equal(signals[0]?.aborted, true);
  blocker.resolve();
  await queue.drain();
  assert.equal(signals.length, 1);
});

test('drain surfaces a background failure', async () => {
  const queue = new JevReviewQueue();
  queue.enqueue({
    key: 'a',
    run: () => Promise.reject(new Error('socket closed')),
  });
  await assert.rejects(queue.drain(), AggregateError);
});

test('an aborted job is skipped before it starts', async () => {
  const queue = new JevReviewQueue();
  const blocker = deferred();
  let reviewed = false;
  queue.enqueue({ key: 'blocker', run: () => blocker.promise });
  queue.enqueue({
    key: 'a',
    run: () => {
      reviewed = true;
      return Promise.resolve();
    },
  });
  queue.invalidate('a');
  blocker.resolve();
  await queue.drain();
  assert.equal(reviewed, false);
});
