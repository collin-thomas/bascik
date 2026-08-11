import { Worker } from "node:worker_threads";

interface QueuedTask<Task, Result> {
  task: Task;
  resolve: (value: Result) => void;
  reject: (error: unknown) => void;
}

/**
 * Fixed-size pool of worker threads. Each worker is initialized once with
 * `initData` (via `workerData`) and then reused for many `run()` calls,
 * avoiding the cost of re-spawning a worker (and re-running its module
 * top-level code) per task.
 */
export class WorkerPool<Task, Result> {
  #workers: Worker[] = [];
  #idleWorkers: Worker[] = [];
  #queue: QueuedTask<Task, Result>[] = [];
  #pending = new Map<Worker, QueuedTask<Task, Result>>();

  constructor(workerScript: string, size: number, initData: unknown) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(workerScript, { workerData: initData });
      worker.on("message", (message: any) => {
        const job = this.#pending.get(worker);
        this.#pending.delete(worker);
        if (job) {
          if (message.ok) job.resolve(message.result);
          else job.reject(new Error(message.error));
        }
        this.#dispatch(worker);
      });
      worker.on("error", (error) => {
        const job = this.#pending.get(worker);
        this.#pending.delete(worker);
        job?.reject(error);
      });
      this.#workers.push(worker);
      this.#idleWorkers.push(worker);
    }
  }

  run(task: Task): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      const worker = this.#idleWorkers.pop();
      if (worker) this.#dispatch(worker);
    });
  }

  #dispatch(worker: Worker): void {
    const job = this.#queue.shift();
    if (!job) {
      this.#idleWorkers.push(worker);
      return;
    }
    this.#pending.set(worker, job);
    worker.postMessage(job.task);
  }

  async terminate(): Promise<void> {
    await Promise.all(this.#workers.map((w) => w.terminate()));
  }
}
