import EventEmitter from 'node:events';

export const eventEmitter = new EventEmitter();
// Every open browser tab adds a `transpiled` + `asset-changed` listener for its
// SSE live-reload connection.  The default max of 10 fires a false-positive
// MaxListenersExceededWarning after just a few tabs; listeners are removed on
// stream close, so an unbounded cap is correct here.
eventEmitter.setMaxListeners(0);