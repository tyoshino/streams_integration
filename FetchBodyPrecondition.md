Copy of https://github.com/slightlyoff/ServiceWorker/issues/452#issuecomment-71971020

## (A) Lock + `body passed flag`

Request

- a `Request` has a boolean `body passed flag`
- `req.bodyUsed` = (`req.body` is locked) || `req`'s `body passed flag` is set
- The following operations fail when `req.bodyUsed` is set. Otherwise, they acquire the lock of `req.body` and release it when done.
    - `req.arrayBuffer()`
    - `req.blob()`
    - `req.formData()`
    - `req.json()`
    - `req.text()`
- `req.clone()` fail when `req.bodyUsed` is set.
- The following operations fail when `req.bodyUsed` is set. Otherwise, they set `req`'s `body passed flag`, confiscate the underlying source and queue from `req.body` and error it.
    - `fetch(req)`
    - `new Request(req)`
    - `cache.put(req, res)`

Response

- a `Response` has a boolean `body passed flag`
- `res.bodyUsed` = (`res.body` is locked) || `res`'s `body passed flag` is set
- The following operations fail when `res.bodyUsed` is set. Otherwise, they acquire the lock of `res.body` and release it when done.
    - `res.arrayBuffer()`
    - `res.blob()`
    - `res.formData()`
    - `res.json()`
    - `res.text()`
- `res.clone()` fail when `res.bodyUsed` is set.
- The following operations fail when `res.bodyUsed` is set. Otherwise, they set `res`'s `body passed flag`, confiscate the underlying source and queue from `res.body` and error it.
    - `e.respondWith(res)`
    - `cache.put(req, res)`

Note

- a `Response`/`Request` with `body passed flag` is unset but `.body` `"errored"` is considered to be one whose headers were received successfully but body wasn't
- a `Response`/`Request` with `body passed flag` set is considered to be invalid

## (A)'

Same as (A) but the following operations make the body `"closed"`.

- `fetch(req)`
- `new Request(req)`
- `cache.put(req, res)`
- `e.respondWith(res)`
- `cache.put(req, res)`

## (B) Permanent lock

Request

- `req.bodyUsed` = `req.body` is locked
- The following operations fail when `req.body` is locked. Otherwise, they acquire the lock of `req.body` and release it when done.
    - `req.arrayBuffer()`
    - `req.blob()`
    - `req.formData()`
    - `req.json()`
    - `req.text()`
- `req.clone()` fails when `req.body` is locked.
- The following operations fail when `req.body` is locked. Otherwise, they acquire the lock of `req.body` and never release it.
    - `fetch(req)`
    - `new Request(req)`
    - `cache.put(req, res)`

Response

- `res.bodyUsed` = `res.body` is locked
- The following operations fail when `res.body` is locked. Otherwise, they acquire the lock of `res.body` and release it when done.
    - `res.arrayBuffer()`
    - `res.blob()`
    - `res.formData()`
    - `res.json()`
    - `res.text()`
- `res.clone()` fails when `res.body` is locked.
- The following operations fail when `res.body` is locked. Otherwise, they acquire the lock of `res.body` and never release it.
    - `e.respondWith(res)`
    - `cache.put(req, res)`

Note

- Needs change on the Streams API spec to hold the lock of a stream even after draining it.

## (C) Only lock

Request

- `req.bodyUsed` = `req.body` is locked
- The following operations fail when `req.body` is locked. Otherwise, they acquire the lock of `req.body` and release it when done.
    - `req.arrayBuffer()`
    - `req.blob()`
    - `req.formData()`
    - `req.json()`
    - `req.text()`
    - `fetch(req)`
    - `new Request(req)`
    - `cache.put(req, res)`
- `req.clone()` fails when `req.body` is locked.

Response

- `res.bodyUsed` = `res.body` is locked
- The following operations fail when `res.body` is locked. Otherwise, they acquire the lock of `res.body` and release it when done.
    - `res.arrayBuffer()`
    - `res.blob()`
    - `res.formData()`
    - `res.json()`
    - `res.text()`
    - `e.respondWith(res)`
    - `cache.put(req, res)`
- `res.clone()` fails when `res.body` is locked.
