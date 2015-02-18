## createStreamPair

```es6
function createStreamPair() {
  var exchange = new Exchange();
  return {writable: new WritableStream(exchange), readable: new ReadableStream(exchange)};
}
```

## Exchange

```es6
class Exchange {
  constructor() {
    this._writeQueue = [];
    this._readQueue = [];

    this._writableClosed = new Promise((resolve, reject) => {
      this._resolveWritableClosed = resolve;
      this._rejectWritableClosed = reject;
    });
    this._readableClosed = new Promise((resolve, reject) => {
      this._resolveReadableClosed = resolve;
      this._rejectReadableClosed = reject;
    });

    this._state = 'normal';
  }

  get writableClosed() {
    return this._writableClosed;
  }

  get readableClosed() {
    return this._readableClosed;
  }

  abort(reason) {
    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }

    if (this._state === 'cancelled') {
      return Promise.reject(this._reason);
    }

    this._state = 'aborted';
    this._reason = reason;

    this._rejectAndClearWriteQueue(new TypeError('aborted'));
    this._rejectAndClearReadQueues(reason);

    this._resolveWritableClosed();

    return new Promise((resolve, reject) => {
      this._rejectReadableClosed({reason, resolve, reject});
    });
  }

  cancel(reason) {
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('already cancelled'));
    }

    if (this._state === 'aborted') {
      return Promise.reject(this._reason);
    }

    this._state = 'cancelled';
    this._reason = reason;

    this._rejectAndClearWriteQueue(reason);
    this._rejectAndClearReadQueues(new TypeError('cancelled'));

    this._resolveReadableClosed();

    return new Promise((resolve, reject) => {
      this._rejectWritableClosed({reason, resolve, reject});
    }
  }

  close() {
    if (this._state === 'closed') {
      return Promise.reject(new TypeError('already closed'));
    }

    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }

    if (this._state === 'cancelled') {
      return Promise.reject(this._reason);
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

  read() {
    if (this._state === 'cancelled') {
      return Promise.reject(new TypeError('cancelled'));
    }

    if (this._state === 'aborted') {
      return Promise.reject(this._reason);
    }

    return new Promise((resolve, reject) => {
      if (this._writeQueue.length > 0) {
        const writeEntry = this._writeQueue.shift();
        resolve(writeEntry);
      } else {
        this._readQueue.push({resolve, reject});
      }
    });
  }

  write(value) {
    if (this._state === 'closed') {
      return Promise.reject(new TypeError('already closed'));
    }

    if (this._state === 'aborted') {
      return Promise.reject(new TypeError('already aborted'));
    }

    if (this._state === 'cancelled') {
      return Promise.reject(this._reason);
    }

    return new Promise((resolve, reject) => {
      const writeEntry = {type: 'data', value: value, resolve: resolve, reject: reject};
      if (this._readQueue.length > 0) {
        const readEntry = this._readQueue.shift();
        readEntry.resolve(writeEntry);
      } else {
        this._writeQueue.push(writeEntry);
      }
    });
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
```

## WritableStream

```es6
class WritableStream {
  constructor(exchange) {
    this._exchange = exchange;
  }

  get closed() {
    return this._exchange.writableClosed;
  }

  abort(reason) {
    return this._exchange.abort(reason);
  }

  close() {
    return this._exchange.close();
  }

  write(value) {
    return this._exchange.write(value);
  }
}
```

## ReadableStream

```es6
class ReadableStream {
  constructor(exchange) {
    this._exchange = exchange;
  }

  get closed() {
    return this._exchange.readableClosed;
  }

  cancel(reason) {
    return this._exchange.cancel(reason);
  }

  read() {
    return this._exchange.read();
  }
}
```
