Streams API integration
=======================

Author: Takeshi Yoshino of Chromium Project

This document discusses integration of the [Streams API](https://github.com/whatwg/streams) with [XMLHttpRequest](http://xhr.spec.whatwg.org/).

See also https://github.com/slightlyoff/ServiceWorker/issues/413 where how streams should be passed to/from the Fetch API.

### XHR request body streaming

#### Plan A: Pass a `ReadableStream` representing the request body to `send()` method

```
interface XMLHttpRequest {
  ...
  void send(optional (ArrayBufferView or ... or ReadableStream)? data = null);
  ...
};
```

XHR reads data as `ArrayBuffer`s from the `ReadableStream` using its public methods, and sends them to the network using `Transfer-Encoding: chunked` without waiting for whole response body to be ready. When the `ReadableStream` is closed, terminates the request body.

```
var requestBodyStream = ...;
var xhr = new XMLHttpRequest();
xhr.open('POST', 'http://example.com/upload');
xhr.send(requestBodyStream);
```

#### Plan B: Add a new method to the XHR which returns a `WritableStream` to which we write the request body

```
interface XMLHttpRequest {
  ...
  WritableStream streamingSend();
  ...
};
```

XHR, as an underlying data sink, consumes `ArrayBuffer`s written to the `WritableStream` it returned. When the `WritableStream` is closed, terminates the request body.

```
var xhr = new XMLHttpRequest();
xhr.open('POST', 'http://example.com/upload');
var requestBodyStream = xhr.streamingSend();
```

When new data is ready:

```
requestBodyStream.write(arrayBuffer);
```

and close when done:

```
requestBodyStream.close();
```

#### Plan C: Pass a function to `send()` method via which XHR reveals a `WritableStream` to which we write the request body

This idea was suggested at https://github.com/slightlyoff/ServiceWorker/issues/413 for the Fetch API.

```
interface XMLHttpRequest {
  ...
  void send(optional (ArrayBufferView or ... or Function)? data = null);
  ...
};
```

XHR behaves as an underlying sink for the `WritableStream`. XHR sends `ArrayBuffer`s written to it to the network using `Transfer-Encoding: chunked`. When the `WritableStream` is closed, terminates the request body.



### XHR response body streaming

#### Plan A: Add a new method to XHR using which we pass a `WritableStream` to which XHR saves the response body

```
xhr.writeResponseToStream(writableStream);
```

#### Plan B: Add a new `responseType` value and get a `ReadableStream` from which we read the response body from the `response` property

Add a new `XMLHttpRequestResponseType` value, `"stream"`. When the `responseType` property is set to `"stream"`, the `response` property returns a `ReadableStream` from which received response body data is read as `ArrayBuffer`s, and once all data is read, it'll be closed.

```
xhr.responseType = "stream";
...
var responseBodyStream;
xhr.onreadystatechange = function () {
  if (responseBodyStream === undefined &&
      (xhr.readyState == xhr.LOADING ||
       xhr.readyState == xhr.DONE)) {
    responseBodyStream = xhr.response;
    readAndProcess(responseBodyStream);
  }
  ...
};
```

Wait by `wait()` and then `read()`:

```
function readAndProcess(stream) {
  stream.wait().then(
    function () {
      for (;;) {
        if (stream.state === "readable") {
          process(responseBodyStream.read());
          return;
        }
        if (stream.state === "waiting") {
          stream.wait().then(readAndProcess, readAndProcess);
          return;
        }
        ...
      }
    }
  );
}
```

Question: When the response should become non-null?

* HEADERS_RECEIVED
* LOADING or DONE
    * Note: DONE is include because we don't see LOADING when the response is empty.

Question: What we should do on the XHR when the ReadableStream is cancel()-ed?

* call abort() on the XHR?

### Acknowledgements

The author would like to thank Yutaka Hirano for his contributions to this document.

The response body streaming idea was in the XHR spec before but has been removed for now https://github.com/whatwg/xhr/commit/ecb48a1abb1d7249f6701c12d9134d91728a8edb
