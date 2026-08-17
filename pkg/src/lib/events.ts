import EventEmitter from 'node:events';

export const eventEmitter = new EventEmitter();
// Every open browser tab adds a `transpiled` + `asset-changed` listener for its
// SSE live-reload connection.  The default max of 10 fires a false-positive
// MaxListenersExceededWarning after just a few tabs; listeners are removed on
// stream close, so an unbounded cap is correct here.
eventEmitter.setMaxListeners(0);

// Cleanup functions registered by modules that hold open handles.
// The SIGINT handler in http2.ts calls all of these before exiting.
const _shutdownHandlers: Array<() => void | Promise<void>> = [];
export const registerShutdownHandler = (fn: () => void | Promise<void>) => {
  _shutdownHandlers.push(fn);
};
export const runShutdownHandlers = (): Promise<void> =>
  Promise.all(_shutdownHandlers.map(fn => fn())).then(() => void 0);