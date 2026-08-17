# `UseApiOptions` generics, `select` and `mutate`

How the response type flows through the generics, and how `mutate` is typed once `select` is in play.

## Choosing generics

`UseApiOptions` accepts up to three generics: `UseApiOptions<TRaw, D, TSelected>`.

Use `UseApiOptions<Response>` by default.

Only include additional generics when they genuinely improve clarity:

```ts
// preferred — single generic in most cases
UseApiOptions<ResponseShape>

// second generic only when request body type matters
UseApiOptions<ResponseShape, RequestBody>

// third generic only when select transforms the response type
UseApiOptions<RawResponse, unknown, SelectedType>
```

## Typing `data`, `select` and `mutate`

`data` is typed by the first generic. `mutate` is typed by the **last** one — they are
the same type until `select` is involved, and different the moment it is.

```ts
// no select — mutate takes the response type
const { data, mutate } = fetchUsers();          // UseApiOptions<User[]>
mutate(nextUsers);                               // User[]

// with select — data AND mutate are the SELECTED type, not the raw one
const { data, mutate } = fetchUsers();           // UseApiOptions<ApiEnvelope<User[]>, unknown, User[]>
mutate(nextUsers);                               // User[]  ← not ApiEnvelope<User[]>
```

`select` is re-applied on every fetch, polling tick and SWR revalidation, so `data` never
holds the raw shape.

## `mutate`

`mutate` accepts a value, `null`, or an updater function — and clears `error` as a side
effect:

```ts
mutate(prev => prev?.filter(u => u.active) ?? null);   // updater form
mutate(null);                                          // clear
```

Use it for optimistic updates and for patching a list after a mutation elsewhere:

```ts
const { data, mutate } = fetchUsers();
const { execute: deactivate } = deactivateUser(id);

// optimistic: patch first, roll back if the request fails
const snapshot = data.value;
mutate(prev => prev?.map(u => (u.id === id ? { ...u, active: false } : u)) ?? null);
try { await deactivate(); } catch { mutate(snapshot); }
```

`mutate` takes only the new data — there is no second argument for replacing `response`.
