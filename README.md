Streams API integration
=======================

Author: Takeshi Yoshino of Chromium Project

This document discusses and drafts integration of the [Streams API](https://github.com/whatwg/streams) with [XMLHttpRequest](http://xhr.spec.whatwg.org/).

### Request body streaming

#### Plan A: Pass a stream representing request body to `send()` method

```
interface XMLHttpRequest {
  ...
  void send(optional (ArrayBufferView or ... or BaseReadableStream)? data = null);
  ...
};
```

XHR reads data from the given `BaseReadableStream` using its public methods and sends data as it becomes available. When the stream is closed, terminates the request body.

```
var requestBodyStream = ...;
var xhr = new XMLHttpRequest();
xhr.open('POST', 'http://example.com/upload');
xhr.send(requestBodyStream);
...
```

When new data is ready:

```
requestBodyStream.write(arrayBuffer);
```

#### Plan B: Add a method to XHR which returns a stream for writing request body data

```
interface XMLHttpRequest {
  ...
  BaseWritableStream streamingSend();
  ...
};
```

XHR consumes data written to the `BaseWritableStream` it returned. When the stream is closed, terminates the request body.

### Response body streaming

Add a new `XMLHttpRequestResponseType` value, `"stream"`. When `responseType` is set to `"stream"`, `response` returns a BaseReadableStream instance from which received response body data can be read and once all data is read, it'll be closed.

```
xhr.responseType = "stream";
...
xhr.onreadystatechange = function () {
  if (xhr.readyState == xhr.HEADERS_RECEIVED) {
    responseBodyStream = xhr.response;
  }
  ...
};
```

Wait by `wait()` and then `read()`:

```
responseBodyStream.wait().then(
  function () {
    if (responseBodyStream.state === "readable") {
      process(responseBodyStream.read());
    }
    ...
  }
);
```

This idea was in the XHR spec but has been removed for now https://github.com/whatwg/xhr/commit/ecb48a1abb1d7249f6701c12d9134d91728a8edb
