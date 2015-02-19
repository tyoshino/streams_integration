export function createOperationStream() {
  var exchange = new Exchange();
  return {writable: new WritableStream(exchange), readable: new ReadableStream(exchange)};
}

class Exchange {
  constructor() {
    this._writeQueue = [];
    this._readQueue = [];

    this._abortedPromise = new Promise((resolve, reject) => {
      this._resolveAbortedPromise = resolve;
      this._rejectAbortedPromise = reject;
    });
    this._cancelledPromise = new Promise((resolve, reject) => {
      this._resolveCancelledPromise = resolve;
      this._rejectCancelledPromise = reject;
    });

    this._state = 'normal';
  }

  get aborted() {
    return this._abortedPromise;
  }

  get cancelled() {
    return this._cancelledPromise;
  }

  // Writable side interfaces

  write(value) {
    if (this._state === 'closed') {
      return Promise.reject(new TypeError('already closed'));
    }
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'));
    }

    return new Promise((resolve, reject) => {
      const writeEntry = {type: 'data', value, resolve, reject};
      if (this._readQueue.length > 0) {
        // Assert: this._writeQueue.length === 0
        const readEntry = this._readQueue.shift();
        readEntry.resolve(writeEntry);
      } else {
        this._writeQueue.push(writeEntry);
      }
    });
  }

  close() {
    if (this._state === 'closed') {
      return Promise.reject(new TypeError('already closed'));
    }
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'));
    }

    this._state = 'closed';

    return new Promise((resolve, reject) => {
      const writeEntry = {type: 'close', resolve, reject};
      if (this._readQueue.length > 0) {
        const readEntry = this._readQueue.shift();
        readEntry.resolve(writeEntry);
      } else {
        this._writeQueue.push(writeEntry);
      }
    });
  }

  abort(reason) {
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'))
    }

    this._state = 'aborted';

    this._rejectAndClearWriteQueue(new TypeError('aborted'));
    this._rejectAndClearReadQueues(new TypeError('aborted'));

    return new Promise((resolve, reject) => {
      this._resolveAbortedPromise({reason, resolve, reject});
    });
  }

  // Readable side interfaces.

  read() {
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('already cancelled'));
    }
    if (this._state === 'aborted') {
      return Promise.reject('aborted');
    }

    if (this._writeQueue.length > 0) {
      // Assert: this._readQueue.length === 0
      const writeEntry = this._writeQueue.shift();
      return Promise.resolve(writeEntry);
    } else {
      return new Promise((resolve, reject) => {
        this._readQueue.push({resolve, reject});
      });
    }
  }

  cancel(reason) {
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('already cancelled'));
    }
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('aborted'));
    }

    this._state = 'cancelled';

    this._rejectAndClearWriteQueue(new TypeError('cancelled'));
    this._rejectAndClearReadQueues(new TypeError('cancelled'));

    return new Promise((resolve, reject) => {
      this._rejectCancelledPromise({reason, resolve, reject});
    }
  }

  _rejectAndClearReadQueue(e) {
    for (var i = 0; i < this._readQueue.length; ++i) {
      var entry = this._readQueue[i];
      entry.reject(e);
    }
    this._readQueue = [];
  }

  _rejectAndClearWriteQueue(e) {
    for (var i = 0; i < this._writeQueue.length; ++i) {
      var entry = this._writeQueue[i];
      entry.reject(e);
    }
    this._writeQueue = [];
  }
}

// Wrappers to hide the interfaces of the other side.

class WritableStream {
  constructor(exchange) {
    this._exchange = exchange;
  }

  get cancelled() {
    return this._exchange.cancelled;
  }

  write(value) {
    return this._exchange.write(value);
  }
  close() {
    return this._exchange.close();
  }
  abort(reason) {
    return this._exchange.abort(reason);
  }
}

class ReadableStream {
  constructor(exchange) {
    this._exchange = exchange;
  }

  get aborted() {
    return this._exchange.aborted;
  }
  read() {
    return this._exchange.read();
  }
  cancel(reason) {
    return this._exchange.cancel(reason);
  }
}
