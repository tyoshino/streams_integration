# ByteSource

```
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

# Strategy

