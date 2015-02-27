Meged into https://github.com/whatwg/streams/pull/287

### Revise note

```es6
class WritableOperationStream {
  // List of states in the form of:
  //   X -> A, B, C, ...
  // X is state name or a name of a group of states.
  // A, B, C, ... are the states X may transit to.
  //
  // - "locked" -> available
  // - available -> "locked"
  //   - (write()/close() are allowed) -> "closed", "aborted", "cancelled", "errored"
  //     - "writable" (backpressure applied) -> "waiting"
  //     - "waiting" (backpressure not applied) -> "writable"
  //   - "closed" -> "aborted", "cancelled", "errored"
  //   - "aborted"
  //   - "cancelled"
  //   - "errored"
  get state()
  // Returns a promise which gets fulfilled when this instance enters "writable" state.
  get writable()
  // Returns a promise which gets fulfilled when this instance enters any of "cancelled" and "errored" state.
  get errored()

  // Returns an Operation instance representing cancellation when the state is "cancelled".
  get cancelOperation()

  // Returns the space available for write.
  get space()
  // Returns a promise which gets fulfilled when space() becomes different value than one at the last
  waitSpaceChange()
  // call or this instance enters non "writable" state.
}

class ExclusiveOperationStreamWriter {
  // - "locked" -> available
  // - available -> "locked"
  //   - (write()/close() are allowed) -> "closed", "aborted", "cancelled", "errored"
  //     - "writable" (backpressure applied) -> "waiting"
  //     - "waiting" (backpressure not applied) -> "writable"
  //   - "closed -> "aborted", "cancelled", "errored"
  //   - "aborted"
  //   - "cancelled"
  //   - "errored"
  get state()
  get writable()
  get errored()
}
```

```es6
class ReadableOperationStream {
  // - "locked" -> available
  // - available -> "locked"
  //   - normal -> "aborted", "cancelled", "errored"
  //     - "waiting" -> "readable"
  //     - "readable" -> "waiting", "drained"
  //   - "drained"
  //   - "aborted"
  //   - "cancelled"
  //   - "errored"
  get state()
  // Returns a promise which gets fulfilled when this instance enters "readable" state.
  get readable()
  // Returns a promise which gets fulfilled when this instance enters any of "aborted" and "errored" state.
  get errored()
  
}
```
