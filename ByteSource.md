# ByteSource

```es6
class ReadableStream {
  ...
  // Controls how much data to pull. For queue-backed ones, this corresponds to
  // the high water mark. Set a positive integer to pull or 0 not to pull. It
  // depends on each implementation whether the size of the positive integer is
  // interpreted or not. Initially set to 0.
  get window()
  set window(value)
  ...
}
```

```es6
class ByteSource {
  // Returns the number of bytes being pulled from the I/O but not finished.
  get bytesPulling()
  // Returns the number of bytes ready for pulling. Returns undefined if the number is
  // unknown. Returns a meaningful value only when .pullable is true.
  get bytesPullable()
  // Returns true when the ByteSource is ready for pulling.
  // 
  // For POSIX socket:
  //   This becomes true when epoll(7) returns, and continues to be true until read(2)
  //   returns EAGAIN.
  // For blocking or async I/O interfaces which takes a buffer on invocation:
  //   This is always true.
  get pullable()
  // Returns the associated ReadableStream to which pulled bytes will be enqueued.
  get stream()
  // Create an auto puller and have it control this ByteSource. After calling
  // this method, any call on this ByteSource except for .stream will throw.
  startAutoPull()
  // Pulls bytes into the given Uint8Array, and once filled (not necessarily whole
  // region) enqueues a new Uint8Array encapsulating the ArrayBuffer of the given
  // Uint8Array but offset and size set to represent the written region.
  //
  // For POSIX socket:
  //   Calls read(2) on the given Uint8Array and enqueues new Uint8Array
  //   representing the written region to the associated ReadableStream.
  //
  // For blocking or async I/O interfaces which takes a buffer on invocation:
  //   Kicks the async I/O with the given Uint8Array. Queues a new Uint8Array
  //   representing the written region to the associated ReadableStream
  //   on completion.
  pull(abv)
  // Called when .pullable is true:
  //   Retrusn a promise that fulfills when .bytesPullable value changes from
  //   one at the watch() call.
  // Called when .pullable is false:
  //   Returns a promise that fulfills when .pullable becomes true.
  watch()
}
```

## How to use

In response to [Domenic's suggestion](https://github.com/whatwg/streams/issues/253#issuecomment-74765051) to write how each proposal works for known use cases.

### Read _n_ MiB file into a single ArrayBuffer.

```es6
function readAsSingleArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fileSize = file.fileSize;
    const byteSource = file.byteSource;

    var pulling = false;

    const ab = new ArrayBuffer(fileSize);
    var position = 0;

    function pull() {
      for (;;) {
        if (position >= fileSize) {
          resolve(new Uint8Array(ab, 0, position));
          return;
        }

        const rs = byteSource.stream;

        if (rs.state === 'closed') {
          resolve(new Uint8Array(ab, 0, position));
          return;
        } else if (rs.state === 'errored') {
          reject(new TypeError());
          return;
        }

        if (!pulling) {
          if (!byteSource.pullable) {
            Promise.race(rs.closed, byteSource.watch()).then(pull);
            return;
          }

          byteSource.pull(new Uint8Array(ab, position, fileSize - position));
          pulling = true;
        }

        if (rs.state === 'waiting') {
          rs.ready.then(pump);
          return;
        }

        var writtenRegion = rs.read();
        // Assert: pulling
        // Assert: writtenRegion.buffer === ab
        // Assert: writtenRegion.byteOffset === position
        position += writtenRegion.byteLength;
        pulling = false;
      }
    };

    pull();
  }
});
```

### _n_ MiB at a time, reusing the same ArrayBuffer

```es6
function processFile(file, chunkSize) {
  return new Promise((resolve, reject) => {
    const byteSource = file.byteSource;

    var pulling = false;

    const ab = new ArrayBuffer(chunkSize);

    function pull() {
      for (;;) {
        const rs = byteSource.stream;

        if (rs.state === 'closed') {
          resolve();
          return;
        } else if (rs.state === 'errored') {
          reject(new TypeError());
          return;
        }

        if (!pulling) {
          if (!byteSource.pullable) {
            Promise.race(rs.closed, byteSource.watch()).then(pull);
            return;
          }

          byteSource.pull(new Uint8Array(ab));
          pulling = true;
        }

        if (rs.state === 'waiting') {
          rs.ready.then(pump);
          return;
        }

        var writtenRegion = rs.read();
        // Assert: pulling
        // Assert: writtenRegion.buffer === ab
        // Assert: writtenRegion.byteOffset === position
        processChunk(writtenRegion);
        pulling = false;
      }
    };

    pull();
  }
});
```

### Process _file_ with _processor_ reusing _numBuffers_ `ArrayBuffer`s (_bufferSize_ byte long each) in _bufferPool_

```es6
function processFileUsingBufferPool(file, processor, numBuffers, bufferSize) {
  return new Promise((resolve, reject) => {
    var bufferPool = [];
    for (var i = 0; i < numBuffers; ++i) {
      bufferPool.push(new ArrayBuffer(bufferSize));
    }

    const byteSource = file.byteSource;

    var activeProcesses = [];

    function loop() {
      const rs = byteSource.stream;
    
      for (;;) {
        // Error check.
        if (rs.state === 'errored') {
          reject(new TypeError());
          return;
        }
        if (processor.state === 'closing' || processor.state === 'closed' || processor.state === 'errored') {
          reject(new TypeError());
          return;
        }

        // Completion check.
        if (rs.state === 'closed' && activeProcesses.length === 0) {
          resolve();
          return;
        }

        var hasProgress = false;

        if (bufferPool.length > 0 && byteSource.pullable) {
          const buffer = bufferPool.shift();
          byteSource.pull(new Uint8Array(buffer));

          hasProgress = true;
          // Keep going.
        }

        if (rs.state === 'readable' && processor.state === 'writable') {
          const writtenRegion = rs.read();
          const processPromise = processor.write(writtenRegion);
          activeProcesses.push({
              promise: processPromise.then(() => {
                const process = activeProcesses.shift();
                bufferPool.push(process.buffer);
              }),
              buffer: writtenRegion.buffer
          });

          hasProgress = true;
        }

        if (hasProgress) {
          continue;
        }

        var promisesToRace = [];

        if (!byteSource.pullable) {
          promisesToRace.push(byteSource.watch());
        }

        if (rs.state === 'readable') {
          promisesToRace.push(rs.closed);
        } else if (rs.state === 'waiting') {
          promisesToRace.push(rs.ready);
        }

        if (processor.state === 'writable') {
          promisesToRace.push(processor.closed);
        } else if (processor.state === 'waiting') {
          promisesToRace.push(processor.ready);
        }

        if (activeProcesses.length > 0) {
          const oldestProcess = activeProcesses[0];
          promisesToRace.push(oldestProcess.promise);
        }

        Promise.race(promisesToRace).then(loop, loop);
      }
    }

    loop();
  }
});
```

# Strategy

