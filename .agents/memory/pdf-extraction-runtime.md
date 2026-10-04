---
name: PDF extraction runtime
description: Runtime dependency needed by pdf-parse v2 when bundled into the API server.
---

Keep `@napi-rs/canvas` as a direct runtime dependency of the API server when using `pdf-parse` v2. The PDF.js code loaded by the parser attempts to use the optional canvas package for `DOMMatrix`; without it, the Node process exits before the server starts.

**Why:** The API-server bundle could compile while PDF.js still failed at startup with `ReferenceError: DOMMatrix is not defined`.

**How to apply:** If changing `pdf-parse`, its version, or the bundler, retain a directly resolvable canvas runtime and verify PDF parsing after a production-style bundle.