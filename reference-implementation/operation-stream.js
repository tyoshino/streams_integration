export function createOperationStream(strategy) {
  var exchange = new Exchange(strategy);
  return {writable: new WritableStream(exchange), readable: new ReadableStream(exchange)};
}

class OperationStatus {
  constructor() {
    this._state = 'waiting';
    this._result = undefined;
    this._readyPromise = new Promise((resolve, reject) => {
      this._resolveReadyPromsie = resolve;
      this._rejectReadyPromsie = reject;
    });
  }

  _onCompletion(v) {
    this._state = 'done';
    this._result = v;
    this._resolveReadyPromise();
  }
  _onError(e) {
    this._state = 'errored';
    this._result = e;
    this._resolveReadyPromise();
  }

  get state() {
    return this._state;
  }
  get result() {
    return this._result;
  }
  get ready() {
    return this._readyPromise;
  }
}

class Operation {
  constructor(type, argument, status) {
    this._type = type;
    this._argument = argument;
    this._status = status;
  }

  get type() {
    return this._type;
  }
  get argument() {
    return this._argument;
  }
  complete(result) {
    this._status._onCompletion(result);
  }
  error(reason) {
    this._status._onError(reason);
  }
}

class Exchange {
  constructor(strategy) {
    this._queue = [];
    this._queueSize = 0;

    this._window = 0;

    this._writableState = undefined;
    this._updateWritableState();
    this._initWritableReadyPromise();
    this._cancelOperation = undefined;
    this._cancelledPromise = new Promise((resolve, reject) => {
      this._resolveCancelledPromise = resolve;
    });

    this._readableState = 'waiting';
    this._readableReadyPromise = new Promise((resolve, reject) => {
      this._resolveReadableReadyPromise = resolve;
    });
    this._abortedPromise = new Promise((resolve, reject) => {
      this._resolveAbortedPromise = resolve;
    });
  }

  _initWritableReadyPromise() {
    this._writableReadyPromise = new Promise((resolve, reject) => {
      this._resolveWritableReadyPromise = resolve;
    });
  }

  _errorAndClearQueue(reason) {
    for (var i = 0; i < this._queue.length; ++i) {
      var entry = this._queue[i];
      entry.error(reason);
    }
    this._queue = [];
  }

  // Writable side interfaces

  get writableState() {
    return this._writableState;
  }
  get writableReady() {
    return this._writableReadyPromise;
  }
  get cancelOperation() {
    return this._cancelOperation;
  }
  get cancelled() {
    return this._cancelledPromise;
  }

  _checkWritablePrecondition() {
    if (this._writableState === 'closed') {
      return Promise.reject(new TypeError('already closed'));
    }
    if (this._writableState === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }
    if (this._writableState === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'));
    }
    return undefined;
  }

  _updateWritableState() {
    if (this._writableState === 'closed' ||
        this._writableState === 'aborted' ||
        this._writableState === 'cancelled') {
      return;
    }

    const shouldApplyBackpressure = this._strategy.shouldApplyBackpressure(this._queueSize);
    if (shouldApplyBackpressure && this._writableState === 'writable') {
      this._writableState = 'waiting';
      this._initWritableReadyPromise();
    } else if (!shouldApplyBackpressure && this._writableState === 'waiting') {
      this._writableState = 'writable';
      this._resolveWritableReadyPromise();
    }
  }

  write(argument) {
    const checkResult = this._checkWritePrecondition();
    if (checkResult !== undefined) {
      return checkResult;
    }

    if (this._queue.length === 0) {
      this._readableState = 'readable';
      this._resolveReadableReadyPromise();
    }

    const size = this._strategy.size(argument);

    var status = new OperationStatus();
    this._queue.push({value: new Operation('data', status, argument), size});
    this._queueSize += size;

    this._updateWritableState();

    return status;
  }

  close() {
    const checkResult = this._checkWritePrecondition();
    if (checkResult !== undefined) {
      return checkResult;
    }

    this._state = 'closed';

    this._writableState = 'closed';

    if (this._queue.length === 0) {
      this._readableState = 'readable';
      this._resolveReadableReadyPromise();
    }

    this._strategy = undefined;

    const status = new OperationStatus();
    this._queue.push({value: new Operation('close', undefined, status), size: 0});
    return status;
  }

  abort(reason) {
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'))
    }

    this._state = 'aborted';

    if (this._queue.length === 0) {
      this._readableState = 'readable';
      this._resolveReadableReadyPromise();
    }

    this._errorAndClearQueue(new TypeError('aborted'));

    this._resolveAbortedPromise();

    this._strategy = undefined;

    const status = new OperationStatus();
    this._queue.push({value: new Operation('abort', reason, status), size: 0});
    return status;
  }

  // Readable side interfaces.

  get window() {
    return this._window;
  }
  set window(v) {
    this._strategy.onWindowUpdate(v);
    this._window = v;
    this._updateWritableState();
  }
  get readableState() {
    return this._readableState;
  }
  get readableReady() {
    return this._readableReadyPromise;
  }
  get aborted() {
    return this._abortedPromise;
  }

  _checkReadPrecondition() {
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('already cancelled'));
    }
    if (this._state === 'aborted') {
      return Promise.reject('aborted');
    }
    return undefined;
  }

  read() {
    const checkResult = this._checkReadPrecondition();
    if (checkResult !== undefined) {
      return checkResult;
    }

    if (this._queue.length === 0) {
      throw new TypeError('not readable');
    }

    const entry = this._queue.shift();
    this._queueSize -= entry.size;
    this._updateWritableState();
    return entry.value;
  }

  cancel(reason) {
    const checkResult = this._checkReadPrecondition();
    if (checkResult !== undefined) {
      return checkResult;
    }

    this._state = 'cancelled';

    this._errorAndClearQueue(new TypeError('cancelled'));

    const status = new OperationStatus();
    this._cancelOperation = new Operation('cancel', reason, status);
    this._resolveCancelledPromise();
    return status;
  }
}

// Wrappers to hide the interfaces of the other side.

class WritableStream {
  constructor(exchange) {
    this._exchange = exchange;
  }

  get state() {
    return this._exchange.writableState;
  }
  get ready() {
    return this._exchange.writableReady;
  }
  get cancelOperation() {
    return this._exchange.cancelOperation;
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

  get state() {
    return this._exchange.readableState;
  }
  get ready() {
    return this._exchange.readableReady;
  }
  get aborted() {
    return this._exchange.aborted;
  }
  get window() {
    return this._exchange.window;
  }
  set window(v) {
    this._exchange.window = v;
  }

  read() {
    return this._exchange.read();
  }
  cancel(reason) {
    return this._exchange.cancel(reason);
  }
}
