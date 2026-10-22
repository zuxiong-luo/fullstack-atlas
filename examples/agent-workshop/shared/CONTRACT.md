# Chapter 01 shared contract (v1)

Implement independently in python/ and typescript/. Python 3.12 / FastAPI, Node 22 / Fastify. No paid calls in default tests. No database in chapter 01: SQLite reserved for persistence chapters, don't imply it exists yet.

POST /v1/answers JSON: {question: string, documents: [{id: string, text: string}]}
Strict no unknown fields. question trimmed, length 1..2000. documents 1..20; id matches ^[A-Za-z0-9_-]{1,64}$, unique; text trimmed length 1..10000. HTTP 400 INVALID_REQUEST for invalid body. Limit HTTP body to 256 KiB; return structured 413 PAYLOAD_TOO_LARGE for larger bodies. GET /health => {status:'ok'}.

Model raw text must decode to {answer: nonempty string <=4000 chars, citations: nonempty array of unique string ids}. Strict no extra fields. Citation strings follow id pattern. Malformed JSON => 502 MODEL_FORMAT_ERROR. Invalid schema => 502 MODEL_SCHEMA_ERROR. IDs not in supplied documents => 502 UNSUPPORTED_CITATION. We do NOT claim this proves semantic support or factual truth.

Success 200: {ok:true,result:{answer,citations}}.
Error: {ok:false,error:{code,message}}; messages may vary but do not leak key/raw model output or stack trace.
Upstream timeout => 504 UPSTREAM_TIMEOUT. Non-2xx/network/invalid provider envelope => 502 UPSTREAM_ERROR.
No automatic retries. Bound provider response to 1 MiB. Timeout must abort underlying HTTP request (or explain exact limitation).

Factory create_app/buildApp accepts provider injected in tests. Config MODEL_PROVIDER=mock default; MOCK_SCENARIO one of success, invalid_json, invalid_schema, unsupported_citation, timeout, upstream_error. Unknown scenario/config fails startup. Mock success returns {answer:'示例回答：请查看所附资料。',citations:[first doc id]}. Other scenarios produce deterministic failure. Request cannot select scenario or provider.

Real provider: MODEL_PROVIDER=http; MODEL_API_URL (full Chat Completions URL), MODEL_API_KEY, MODEL_NAME, MODEL_TIMEOUT_MS (default 3000, range 50..60000). Validate http(s), do not expose credentials. Use bounded HTTP call, messages with system instruction to return answer/citations JSON plus JSON-serialized input in user message, response_format json_object. Read choices[0].message.content string. Clearly document this wire contract is not universal and real calls unverified without credentials. Config only server-side.

Shared fixtures in cases.json created by root. Both implementations load same cases, run mock scenario or invalid request, assert HTTP status/error code/result citation ids. Add local fake upstream tests (no real API) for timeout, malformed envelope/non-2xx and successful adapter decoding.

Normalization: trim question, document text and answer using ECMAScript String.trim whitespace rules; lengths count Unicode code points. Require application/json (parameters allowed); non-JSON media types return 400 INVALID_REQUEST. Unexpected internal failures return 500 INTERNAL_ERROR with no details.
