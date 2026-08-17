# Request bodies and `Content-Type`

Read before wiring any non-JSON body: uploads, FormData, header precedence, and the failure modes.

The client created by `createApiClient` defaults every request to
`Content-Type: application/json`. Three places can change it, in increasing precedence:

1. the client instance (that default),
2. the composable — `useApiPost<Result>(url, { headers: { "Content-Type": "text/csv" } })`,
3. the call — `execute({ headers: { ... } })`.

**Per-call `headers` replaces composable-level `headers` wholesale**, it does not merge
key-by-key. If a call needs to override only the content type, it must repeat the other
headers it still wants. (Merging with the *instance* defaults is done by Axios itself,
per key.)

## File uploads

Pass `FormData` as `data` and let the library set the content type:

```ts
// ✅ correct — FormData reaches the server intact as multipart
const uploadReport = (options?: UseApiOptions<UploadResult>) =>
  useApiPost<UploadResult>("/reports/upload", { lazy: true, ...options });

const form = new FormData();
form.append("file", file);
await execute({ data: form });
```

A `FormData` or `URLSearchParams` body does not inherit the JSON default — the library
derives `multipart/form-data` / `application/x-www-form-urlencoded` from the body itself.

An explicit `Content-Type` always wins, including on a form — `headers: { "Content-Type":
"application/json" }` with a `FormData` body triggers Axios's deliberate form-to-JSON
conversion. Only set it if that is what you want.

## Raw `Blob` / `File` bodies

**A raw `Blob`/`File` as `data` is still JSON-ified by Axios** regardless of the library:
`transformRequest` treats it as a plain object payload, so the body arrives as
`{"type":"text/plain"}`. Wrap it in `FormData`, or set an explicit `Content-Type`.

## Pre-1.8: uploads silently sent as JSON

Before 1.8 a `FormData` body inherited the client's `application/json` default, and Axios's
`transformRequest` replaced the form with `JSON.stringify(formDataToJSON(data))`. The upload
arrived as metadata:

```
{"file":{"type":"","lastModified":1786984353917,"name":"blob"}}
```

with HTTP 200 and no error anywhere — the request looked successful and the file was gone.
On those versions the header had to be set by hand on every upload:

```ts
// workaround required before 1.8
await execute({ data: form, headers: { "Content-Type": "multipart/form-data" } });
```

When reading code written against an older version, an explicit `multipart/form-data` on an
upload is that workaround, not a mistake — it is still correct on 1.8.
