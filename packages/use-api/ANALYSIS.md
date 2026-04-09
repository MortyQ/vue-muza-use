# @ametie/vue-muza-use — Полный анализ функционала

> Версия: `0.6.1` | Vue 3 + Axios | TypeScript | MIT

---

## Содержание

1. [Обзор](#1-обзор)
2. [Структура исходников](#2-структура-исходников)
3. [Plugin — createApi / useApiConfig](#3-plugin--createapi--useapiconfig)
4. [createApiClient — фабрика axios](#4-createapiclient--фабрика-axios)
5. [useApi — главный компосабл](#5-useapi--главный-компосабл)
6. [HTTP-хелперы](#6-http-хелперы)
7. [useApiBatch — батч-запросы](#7-useapibatch--батч-запросы)
8. [useApiState — управление состоянием](#8-useapistate--управление-состоянием)
9. [useAbortController — глобальная отмена](#9-useabortcontroller--глобальная-отмена)
10. [TokenManager — управление токенами](#10-tokenmanager--управление-токенами)
11. [Interceptors — auth-перехватчики](#11-interceptors--auth-перехватчики)
12. [AuthMonitor — мониторинг событий](#12-authmonitor--мониторинг-событий)
13. [Утилиты](#13-утилиты)
14. [Типы и интерфейсы](#14-типы-и-интерфейсы)
15. [Тесты](#15-тесты)
16. [Сборка и CI/CD](#16-сборка-и-cicd)
17. [Известные проблемы и замечания](#17-известные-проблемы-и-замечания)

---

## 1. Обзор

Библиотека предоставляет набор Vue 3 composable-функций для работы с HTTP API через Axios. Цель — убрать boilerplate при работе с запросами: состояние загрузки, обработка ошибок, отмена запросов, авто-обновление токенов, поллинг.

**Peer dependencies:**
- `vue ^3.3.0`
- `axios ^1.0.0`

**Экспортируемый публичный API (`src/index.ts`):**
```
createApi, useApiConfig
useApi, useApiGet, useApiPost, useApiPut, useApiPatch, useApiDelete
useApiBatch
useApiState, useAbortController
createApiClient, setupInterceptors
tokenManager
setAuthMonitor, AuthEventType
+ все TypeScript типы
```

---

## 2. Структура исходников

```
src/
├── index.ts                      — публичный экспорт
├── types.ts                      — все TypeScript типы
├── plugin.ts                     — Vue плагин (createApi / useApiConfig)
├── useApi.ts                     — главный composable
├── useApiBatch.ts                — параллельные батч-запросы
├── composables/
│   ├── useApiState.ts            — реактивное состояние запроса
│   └── useAbortController.ts    — глобальный AbortController (singleton)
├── features/
│   ├── createInstance.ts         — фабрика axios-инстанса
│   ├── interceptors.ts           — request/response interceptors (auth)
│   ├── tokenManager.ts           — singleton для работы с токенами
│   └── monitor.ts                — система событий авторизации
└── utils/
    ├── debounce.ts               — Promise-aware debounce
    └── errorParser.ts            — нормализация ошибок в ApiError
```

---

## 3. Plugin — createApi / useApiConfig

**Файл:** `src/plugin.ts`

### createApi(options)

Создаёт Vue-плагин. При вызове `app.use(createApi(...))`:
- Сохраняет конфиг **глобально** (переменная модуля `globalConfig`)
- Делает конфиг доступным через Vue `provide` (для `inject`)

Глобальное хранение позволяет использовать `useApi` за пределами компонентов — в Pinia stores, в сервисах и т.д.

```ts
app.use(createApi({
  axios: myAxiosInstance,
  onError: (error) => toast.error(error.message),
  errorParser: (err) => myCustomParser(err),
  globalOptions: {
    retry: 3,
    retryDelay: 1000,
    useGlobalAbort: true,
  }
}))
```

**Параметры `ApiPluginOptions`:**

| Параметр | Тип | Описание |
|---|---|---|
| `axios` | `AxiosInstance` | Обязателен. Инстанс axios |
| `onError` | `(error, original) => void` | Глобальный обработчик ошибок (уведомления, toast) |
| `errorParser` | `(error) => ApiError` | Кастомный парсер ошибок бэкенда |
| `globalOptions.retry` | `number \| boolean` | Количество повторов по умолчанию |
| `globalOptions.retryDelay` | `number` | Задержка между повторами (мс) |
| `globalOptions.useGlobalAbort` | `boolean` | Использовать глобальный AbortController |

### useApiConfig()

Возвращает текущий конфиг плагина. Сначала проверяет `globalConfig`, затем пробует `inject`. Если конфиг не найден — бросает ошибку с подробной инструкцией по настройке.

---

## 4. createApiClient — фабрика axios

**Файл:** `src/features/createInstance.ts`

Создаёт готовый `AxiosInstance` с настроенными interceptors.

```ts
const api = createApiClient({
  baseURL: 'https://api.example.com',
  withAuth: true,             // default: true
  timeout: 60000,             // default: 60000
  authOptions: {
    refreshUrl: '/auth/refresh',
    refreshWithCredentials: false,
    onTokenRefreshFailed: () => router.push('/login'),
    onTokenRefreshed: (response) => store.setUser(response.data.user),
    extractTokens: (response) => ({
      accessToken: response.data.token,
      refreshToken: response.data.refresh,
    }),
    refreshPayload: () => ({ refreshToken: tokenManager.getRefreshToken() }),
  }
})
```

**Параметры `CreateApiClientOptions`:**

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `withAuth` | `boolean` | `true` | Подключить auth interceptors |
| `authOptions` | `InterceptorOptions` | — | Настройки авторизации |
| `...axiosConfig` | `CreateAxiosDefaults` | — | Любые axios-параметры |

**Режимы хранения токенов** (определяются автоматически):

| `refreshWithCredentials` | Режим | Хранение |
|---|---|---|
| `false` (default) | localStorage | access + refresh токены в localStorage |
| `true` | httpOnly cookie | только access токен в localStorage |

---

## 5. useApi — главный компосабл

**Файл:** `src/useApi.ts`

Центральный composable. Все HTTP-хелперы — обёртки над ним.

### Сигнатура

```ts
function useApi<T = unknown, D = unknown>(
  url: MaybeRefOrGetter<string | undefined>,
  options: UseApiOptions<T, D> = {}
): UseApiReturn<T, D>
```

- `T` — тип ответных данных
- `D` — тип тела запроса (data)
- `url` — строка, `ref<string>`, или геттер-функция `() => string`

### Параметры UseApiOptions

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `method` | `string` | `'GET'` | HTTP метод |
| `immediate` | `boolean` | `false` | Выполнить запрос сразу при инициализации |
| `initialData` | `T` | `null` | Начальное значение `data` |
| `initialLoading` | `boolean` | `false` | Начальное значение `loading` |
| `debounce` | `number` | `0` | Дебаунс в мс |
| `watch` | `WatchSource \| WatchSource[]` | — | Авто-перезапрос при изменении |
| `poll` | `number \| object` | `0` | Поллинг (см. ниже) |
| `retry` | `boolean \| number` | из globalOptions | Повтор при ошибке |
| `retryDelay` | `number` | `1000` | Задержка перед повтором |
| `authMode` | `'default' \| 'public' \| 'optional'` | `'default'` | Режим авторизации |
| `useGlobalAbort` | `boolean` | из globalOptions | Подписка на глобальный AbortController |
| `skipErrorNotification` | `boolean` | `false` | Не вызывать `onError` из плагина |
| `onSuccess` | `(response) => void` | — | Колбэк при успехе |
| `onError` | `(error) => void` | — | Колбэк при ошибке |
| `onBefore` | `() => void` | — | Колбэк перед запросом |
| `onFinish` | `() => void` | — | Колбэк после завершения (всегда) |
| `data` | `MaybeRefOrGetter<D>` | — | Тело запроса (авто-unwrap ref) |
| `params` | `MaybeRefOrGetter<D>` | — | Query-параметры (авто-unwrap ref) |
| `...axiosConfig` | `AxiosRequestConfig` | — | Любые axios-параметры |

### Возвращаемые значения UseApiReturn

| Свойство | Тип | Описание |
|---|---|---|
| `data` | `Ref<T \| null>` | Данные ответа |
| `loading` | `Ref<boolean>` | Флаг загрузки |
| `error` | `Ref<ApiError \| null>` | Объект ошибки |
| `statusCode` | `Ref<number \| null>` | HTTP статус-код |
| `response` | `Ref<AxiosResponse \| null>` | Полный axios ответ |
| `execute` | `(config?) => Promise<T \| null>` | Выполнить запрос |
| `abort` | `(message?) => void` | Отменить запрос |
| `reset` | `() => void` | Сбросить состояние + отменить |
| `mutate` | `(data \| updater) => void` | Ручная мутация данных |

### Поллинг (poll)

```ts
// Простой — число в мс
poll: 5000

// Расширенный — объект (поля могут быть Ref)
poll: {
  interval: ref(5000),      // реактивный интервал
  whenHidden: ref(false),   // продолжать при скрытой вкладке
}
```

**Логика поллинга:**
1. После завершения запроса (если не отменён) — ставится `setTimeout`
2. При скрытии вкладки (`document.hidden`) — следующий тик пропускается (если `whenHidden: false`)
3. При возврате на вкладку — `visibilitychange` запускает выполнение немедленно
4. При изменении `interval` (реактивный ref) — текущий таймер сбрасывается, новый запрос стартует
5. `onScopeDispose` — таймер очищается при размонтировании компонента

### Логика execute()

```
1. Очистить предыдущий pollTimer
2. Отменить предыдущий AbortController
3. Создать новый AbortController
4. Подписаться на глобальный AbortController (если useGlobalAbort)
5. Вызвать onBefore()
6. Установить loading = true, error = null
7. Выполнить axios.request()
8. При успехе: mutate(data), onSuccess(response)
9. При ошибке: parseApiError(), globalOnError(), setError(), onError()
10. finally: setLoading(false), onFinish(), запустить новый pollTimer
```

### authMode

| Значение | Поведение |
|---|---|
| `'default'` | Добавляет `Authorization: Bearer <token>`. При 401 — пытается рефрешнуть |
| `'public'` | Не добавляет заголовок. При 401 — не рефрешит |
| `'optional'` | Добавляет токен если есть, но при 401 — не рефрешит |

### Примеры

```ts
// Авто-запрос с начальными данными
const { data } = useApi<User[]>('/users', {
  immediate: true,
  initialData: [],
})

// Динамический URL (getter)
const id = ref(1)
const { data } = useApi(() => `/users/${id.value}`, {
  watch: id,
  immediate: true,
})

// Реактивные параметры
const filters = ref({ page: 1, status: 'active' })
const { data } = useApi('/users', {
  params: filters,
  watch: filters,
  immediate: true,
})

// Отправка формы с debounce
const form = reactive({ name: '', email: '' })
const { execute, loading } = useApi('/users', {
  method: 'POST',
  data: form,
  debounce: 300,
  onSuccess: () => router.push('/users'),
})

// Переопределение данных при выполнении
const { execute } = useApi<User>('/users')
await execute({ data: { name: 'John' }, params: { notify: true } })
```

---

## 6. HTTP-хелперы

**Файл:** `src/useApi.ts`

Удобные обёртки над `useApi` с предустановленным методом:

```ts
useApiGet<T>(url, options?)      // method: 'GET'
useApiPost<T, D>(url, options?)  // method: 'POST'
useApiPut<T, D>(url, options?)   // method: 'PUT'
useApiPatch<T, D>(url, options?) // method: 'PATCH'
useApiDelete<T>(url, options?)   // method: 'DELETE'
```

Параметр `method` исключён из `options` (через `Omit<UseApiOptions, 'method'>`).

---

## 7. useApiBatch — батч-запросы

**Файл:** `src/useApiBatch.ts`

Выполняет массив запросов параллельно с реактивным состоянием.

### Сигнатура

```ts
function useApiBatch<T = unknown>(
  urls: MaybeRefOrGetter<string[]>,
  options: UseApiBatchOptions<T> = {}
): UseApiBatchReturn<T>
```

### Параметры UseApiBatchOptions

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `settled` | `boolean` | `true` | Продолжать при ошибках отдельных запросов |
| `concurrency` | `number` | не ограничено | Макс. параллельных запросов |
| `immediate` | `boolean` | `false` | Авто-запуск |
| `watch` | `WatchSource` | — | Авто-перезапуск |
| `skipErrorNotification` | `boolean` | `true` | Не вызывать глобальный onError |
| `onItemSuccess` | `(item, index) => void` | — | Колбэк при успехе одного запроса |
| `onItemError` | `(item, index) => void` | — | Колбэк при ошибке одного запроса |
| `onFinish` | `(results) => void` | — | Колбэк после всех запросов |
| `onProgress` | `(progress) => void` | — | Колбэк обновления прогресса |

### Возвращаемые значения UseApiBatchReturn

| Свойство | Тип | Описание |
|---|---|---|
| `data` | `Ref<BatchResultItem<T>[]>` | Все результаты с метаданными |
| `successfulData` | `Ref<T[]>` | Только успешные данные (computed) |
| `loading` | `Ref<boolean>` | Идёт ли загрузка |
| `error` | `Ref<ApiError \| null>` | Ошибка (если все запросы упали) |
| `errors` | `Ref<ApiError[]>` | Список всех ошибок |
| `progress` | `Ref<BatchProgress>` | Прогресс выполнения |
| `execute` | `() => Promise<BatchResultItem[]>` | Запустить батч |
| `abort` | `(message?) => void` | Отменить все запросы |
| `reset` | `() => void` | Сбросить состояние |

### BatchResultItem

```ts
interface BatchResultItem<T> {
  url: string         // запрошенный URL
  index: number       // индекс в исходном массиве
  success: boolean    // успех / провал
  data: T | null      // данные (null если ошибка)
  error: ApiError | null  // ошибка (null если успех)
  statusCode: number | null
}
```

### BatchProgress

```ts
interface BatchProgress {
  completed: number   // выполнено (успех + ошибки)
  total: number       // всего запросов
  percentage: number  // процент (0-100)
  succeeded: number   // успешных
  failed: number      // упавших
}
```

### Логика concurrency

- Без лимита: все запросы стартуют через `Promise.all` / `Promise.allSettled`
- С лимитом: создаётся N "воркеров", каждый берёт следующий URL из очереди

### Режим settled

- `true` (default): ошибки не прерывают батч, все результаты сохраняются
- `false`: первая ошибка отменяет остальные запросы и бросает исключение

### Важная деталь реализации

Каждый запрос внутри батча создаёт **отдельный экземпляр** `useApi` с `useGlobalAbort: false`, что гарантирует независимое состояние.

---

## 8. useApiState — управление состоянием

**Файл:** `src/composables/useApiState.ts`

Базовый composable для реактивного состояния запроса. Используется внутри `useApi`, но также экспортируется для самостоятельного использования.

### Интерфейс

```ts
interface UseApiStateReturn<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<ApiError | null>
  statusCode: Ref<number | null>
  response: Ref<AxiosResponse<T> | null>  // полный ответ
  mutate(newData: SetDataInput<T>, response?): void
  setError(error: ApiError | null): void
  setLoading(isLoading: boolean): void
  setStatusCode(code: number | null): void
  reset(): void
}
```

### mutate()

Поддерживает два формата:

```ts
// Прямое значение
mutate(newData)
mutate(null)  // очистить

// Функция-обновитель (как React setState)
mutate(prev => prev?.filter(u => u.active) ?? null)
mutate(prev => ({ ...prev, name: prev.name + ' [edited]' }))
```

При вызове `mutate` — автоматически очищает `error`.

### Дизайн-решения (из комментариев в коде)

- Нет computed-хелперов типа `isSuccess`, `isEmpty` — состояние выводится явно
- Нет enum статусов — статус выводится из комбинации `loading/error/data`
- `data !== null && !error && !loading` → успех
- `!data && !error && !loading` → idle
- `loading === true` → запрос идёт
- `error !== null` → ошибка

---

## 9. useAbortController — глобальная отмена

**Файл:** `src/composables/useAbortController.ts`

Singleton глобального AbortController. Позволяет отменить **все** активные запросы одновременно (например, при смене фильтров или разлогинивании).

```ts
const { abort, getSignal, isAbortError, abortCount } = useAbortController()

// Отменить все активные запросы
abort()

// Получить текущий сигнал (для нового запроса)
const signal = getSignal()
```

### Механизм подписки в useApi

Каждый `useApi` при инициализации:
1. Получает текущий `AbortSignal` через `getSignal()`
2. Запоминает текущий `abortCount`
3. Вешает обработчик на `abort` событие сигнала
4. В обработчике проверяет: если `abortCount` не изменился → отменяет только свой запрос

Это позволяет отменять запросы **выборочно** (только те, что были активны в момент вызова `abort()`).

---

## 10. TokenManager — управление токенами

**Файл:** `src/features/tokenManager.ts`

Singleton для хранения и управления JWT-токенами.

### TokenStorage интерфейс

Абстракция хранилища — позволяет подменять в тестах:

```ts
interface TokenStorage {
  getAccessToken(): string | null
  getRefreshToken(): string | null
  setTokens(tokens: AuthTokens): void
  clearTokens(): void
  getTokenExpiresAt(): number | null
  isTokenExpired(): boolean
}
```

### LocalStorageTokenStorage

Реализация по умолчанию. Два режима:

**Режим 1: storeRefreshToken = true** (default)
- `accessToken` → `localStorage.accessToken`
- `refreshToken` → `localStorage.refreshToken`
- `tokenExpiresAt` → `localStorage.tokenExpiresAt`

**Режим 2: storeRefreshToken = false** (httpOnly cookie)
- `accessToken` → `localStorage.accessToken`
- `refreshToken` → не хранится (в httpOnly cookie)
- `getRefreshToken()` всегда возвращает `null`

### TokenManager API

```ts
tokenManager.getAccessToken()          // → string | null
tokenManager.getRefreshToken()         // → string | null
tokenManager.setTokens({ accessToken, refreshToken, expiresIn })
tokenManager.clearTokens()             // очистить все токены
tokenManager.hasTokens()               // есть ли accessToken
tokenManager.isTokenExpired()          // просрочен ли (с буфером 5 сек)
tokenManager.getTokenExpiresAt()       // timestamp истечения
tokenManager.getAuthHeader()           // "Bearer <token>" | null
tokenManager.setStorage(storage)       // заменить хранилище (тесты)
```

### Хранение времени истечения

```ts
// При setTokens({ expiresIn: 3600 }):
expiresAt = Date.now() + 3600 * 1000
localStorage.setItem('tokenExpiresAt', expiresAt)

// isTokenExpired() с 5-секундным буфером:
return Date.now() >= expiresAt - 5000
```

---

## 11. Interceptors — auth-перехватчики

**Файл:** `src/features/interceptors.ts`

Настраивает request и response interceptors на переданный `AxiosInstance`.

### Request Interceptor

Логика для каждого запроса:
1. Если `authMode === 'public'` → пропустить, не добавлять заголовок
2. Получить `accessToken` из `tokenManager`
3. Если токен есть → `Authorization: Bearer <token>`
4. Если токена нет → явно удалить заголовок `Authorization`

### Response Interceptor (401 handler)

```
Получен ответ 401
  ↓
Проверки (пропустить если):
  - нет originalRequest
  - уже была попытка (_retry = true)
  - authMode === 'public' или 'optional'
  - URL запроса совпадает с refreshUrl → logout
  ↓
Если сейчас идёт рефреш (isRefreshing = true):
  → добавить запрос в очередь failedQueue
  → вернуть Promise, который выполнится после рефреша
  ↓
Иначе:
  → isRefreshing = true
  → trackAuthEvent(REFRESH_START)
  → вызвать POST refreshUrl
  → извлечь токены (extractTokens или авто-определение)
  → tokenManager.setTokens(...)
  → onTokenRefreshed(response)
  → trackAuthEvent(REFRESH_SUCCESS)
  → processQueue(null, newToken) — разблокировать очередь
  → повторить оригинальный запрос
  ↓
При ошибке рефреша:
  → processQueue(error) — отклонить очередь
  → tokenManager.clearTokens()
  → onTokenRefreshFailed()
```

### Параметры InterceptorOptions

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `refreshUrl` | `string` | `'/auth/refresh'` | URL для обновления токена |
| `refreshWithCredentials` | `boolean` | `false` | Отправлять cookie с запросом |
| `onTokenRefreshFailed` | `() => void` | — | Колбэк при провале рефреша (logout) |
| `onTokenRefreshed` | `(response) => void` | — | Колбэк после успешного рефреша |
| `extractTokens` | `(response) => tokens` | — | Кастомное извлечение токенов |
| `refreshPayload` | `object \| () => object` | `{}` | Дополнительные данные с запросом рефреша |

### Smart detection токенов

Авто-определение полей из ответа рефреша:
```
accessToken || access_token
refreshToken || refresh_token
```

### Smart detection режима cookies

```ts
const shouldUseCredentials = refreshWithCredentials || !tokenManager.getRefreshToken()
```

Если refresh токена нет в localStorage — автоматически используются cookies.

### Очередь запросов (failedQueue)

Модульные переменные (не singleton, а per-setup):
- `failedQueue: FailedRequestQueue[]` — очередь ожидающих запросов
- `isRefreshing: boolean` — флаг активного рефреша

**Проблема:** `isRefreshing` и `failedQueue` — переменные **модуля** (не closure), что означает что они **глобальны** для всех инстансов в пределах одного бандла. При нескольких вызовах `setupInterceptors` переменные разделяются.

---

## 12. AuthMonitor — мониторинг событий

**Файл:** `src/features/monitor.ts`

Система наблюдения за событиями авторизации. По умолчанию — `console.debug` только в `NODE_ENV === 'development'`.

### События AuthEventType

| Событие | Когда |
|---|---|
| `AUTH_REFRESH_START` | Начало попытки рефреша токена |
| `AUTH_REQUEST_QUEUED` | Запрос добавлен в очередь ожидания |
| `AUTH_REFRESH_SUCCESS` | Токен успешно обновлён |
| `AUTH_REFRESH_ERROR` | Ошибка при обновлении токена |

### Использование

```ts
import { setAuthMonitor, AuthEventType } from '@ametie/vue-muza-use'

// Кастомный монитор (аналитика, Sentry, etc.)
setAuthMonitor((type, payload) => {
  if (type === AuthEventType.REFRESH_ERROR) {
    Sentry.captureException(payload.error)
  }
  analytics.track(type, payload)
})
```

### AuthEventPayload

```ts
interface AuthEventPayload {
  url?: string
  queueSize?: number
  error?: unknown
  timestamp?: string    // добавляется автоматически (ISO 8601)
  requestId?: string
  details?: Record<string, unknown>
}
```

---

## 13. Утилиты

### debounce (`src/utils/debounce.ts`)

Promise-aware debounce. Особенность: возвращает `Promise`, который резолвится результатом отложенного вызова.

```ts
function debounceFn<A, R>(fn: (...args: A) => Promise<R>, delay: number): (...args: A) => Promise<R | undefined>
```

**Поведение:** при каждом вызове до истечения `delay` — предыдущий таймер сбрасывается. Promise предыдущего вызова так и не резолвится (hanging promise). Это потенциальная утечка — см. раздел [17. Известные проблемы](#17-известные-проблемы-и-замечания).

### errorParser (`src/utils/errorParser.ts`)

Нормализует ошибки в унифицированный `ApiError`:

```ts
function parseApiError(error: unknown): ApiError
```

**Логика:**
1. Если `isAxiosError(error)` и есть `response`:
   - `message` = `data.message || data.error || axiosError.message || 'Unknown Error'`
   - `status` = HTTP статус-код
   - `code` = `data.code`
   - `errors` = `data.errors` (для validation errors)
   - `details` = вся `data`
2. Иначе:
   - `message` = `error.message` или `String(error)`
   - `status` = `0`

---

## 14. Типы и интерфейсы

**Файл:** `src/types.ts`

### ApiError

```ts
interface ApiError {
  message: string
  status: number
  code?: string
  errors?: Record<string, string[]>  // validation errors
  details?: unknown                   // raw response data
}
```

### AuthMode

```ts
type AuthMode = 'default' | 'public' | 'optional'
```

### ApiState

```ts
interface ApiState<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  statusCode: number | null
}
```

### UseApiOptions (полная)

Расширяет `ApiRequestConfig<D>` (который расширяет `Omit<AxiosRequestConfig, 'data' | 'params'>`), добавляя поля composable-уровня.

### AuthTokens

```ts
interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number   // в секундах
}
```

---

## 15. Тесты

### useApi.test.ts

Тестирует через `mount` с моком axios. Покрытые сценарии:

| Тест | Что проверяет |
|---|---|
| `immediate: true` | Запрос выполняется при монтировании |
| `immediate: false` | Запрос не выполняется без явного вызова |
| `poll: 1000` | Поллинг срабатывает каждые N мс |
| `poll: { interval, whenHidden }` | Объектная конфигурация поллинга |
| unmount | Поллинг останавливается при размонтировании |
| ошибки | `error.value` заполняется, `loading` = false |
| `watch` | Авто-перезапрос при изменении ref |
| `debounce` | Несколько вызовов → один запрос |
| `document.hidden` | Поллинг паузится при скрытой вкладке |
| `whenHidden: true` | Поллинг продолжается при скрытой вкладке |
| динамический интервал | Смена `interval` ref перезапускает таймер |
| `url = undefined` | Выбрасывает ошибку "Request URL is missing" |
| реактивные params | Обновление ref обновляет параметры запроса |

### useApi.promiseAll.test.ts

Тестирует паттерны использования с `Promise.all`:

| Группа | Что проверяет |
|---|---|
| ✅ Правильный паттерн | Новый инстанс для каждого запроса |
| ✅ Смешанные ответы | Успехи и ошибки в одном Promise.all |
| ✅ Независимое состояние | Каждый хук имеет свой `data` |
| ❌ Неправильный паттерн | Переиспользование одного хука — последний ответ затирает предыдущие |
| ❌ Abort при переиспользовании | Каждый новый `execute()` отменяет предыдущий |
| 🔄 50 запросов | Производительность |
| 🔄 Чанкинг | Пакетная обработка по 5 запросов |
| 🛡️ Promise.allSettled | Частичные ошибки |
| 🎯 Dashboard | Несколько разных endpoint'ов параллельно |
| 🎯 Batch delete | DELETE для массива ID |

### interceptors.test.ts

| Тест | Что проверяет |
|---|---|
| Инъекция токена | `Authorization: Bearer <token>` добавляется в заголовки |
| authMode public | Заголовок НЕ добавляется |
| 401 → рефреш | POST на refreshUrl, сохранение нового токена, повтор запроса |
| Очередь при рефреше | 2 запроса → 1 рефреш → 2 повтора |
| Ошибка рефреша | Токены очищены, `onTokenRefreshFailed` вызван |

---

## 16. Сборка и CI/CD

### Сборка (tsup)

**Файл:** `tsup.config.ts`

```ts
{
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,          // генерация .d.ts
  clean: true,        // очистка dist перед сборкой
  shims: true,        // polyfills для Node.js
  external: ['vue', 'axios'],   // не включать в бандл
  outExtension: { cjs: '.cjs', esm: '.mjs' }
}
```

**Артефакты:**
- `dist/index.mjs` — ES Module
- `dist/index.cjs` — CommonJS
- `dist/index.d.ts` — TypeScript типы
- `dist/index.d.cts` — TypeScript типы для CJS

### package.json exports

```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    }
  }
}
```

### GitHub Actions (release.yml)

Триггер: push в `main`, только если изменились файлы в `packages/use-api/**`

Шаги:
1. Checkout (полная история для semantic-release)
2. Node.js 22 + pnpm 8
3. `pnpm install`
4. `pnpm --filter @ametie/vue-muza-use build`
5. `npx semantic-release` (из директории `packages/use-api`)

Требует secrets: `GITHUB_TOKEN`, `NPM_TOKEN`

### Semantic Release (.releaserc)

Используется для автоматического версионирования и публикации в npm на основе conventional commits.

---

## 17. Известные проблемы и замечания

### 1. Retry не реализован

В `useApi.ts` в блоке `catch` есть комментарий:
```ts
// Retry logic here (insert your retryRequest function)
return null;
```
Параметры `retry` и `retryDelay` объявлены в типах и принимаются в опциях, но логика повторов **не реализована**.

### 2. Hanging Promise в debounce

`debounceFn` при отмене предыдущего вызова не резолвит/реджектит старый Promise — он остаётся "висеть". При частом использовании это может привести к накоплению незавершённых промисов.

### 3. isRefreshing и failedQueue — глобальные переменные модуля

В `interceptors.ts`:
```ts
let failedQueue: FailedRequestQueue[] = [];
let isRefreshing = false;
```
Это переменные уровня **модуля**. При нескольких вызовах `setupInterceptors` (несколько axios-инстансов) они **разделяют** одно состояние. Для большинства приложений это не проблема, но при множественных инстансах — потенциальный баг.

### 4. useApiBatch создаёт useApi вне компонентного контекста

```ts
const { execute, error, statusCode } = useApi<T>(url, { ... })
```
Вызов происходит внутри `executeRequest`, которая вызывается из `execute()` — уже после монтирования. `useApi` использует `getCurrentScope()` / `onScopeDispose`, что может вести себя неожиданно вне scope.

### 5. DynamicUrlDemo не добавлен в App.vue

Компонент `DynamicUrlDemo.vue` существует в `playground/src/components/`, но не импортирован в `App.vue`.

### 6. response в useApiBatch не экспонируется

`BatchResultItem` содержит `statusCode`, но не полный `AxiosResponse`. Нет доступа к заголовкам ответа для отдельных запросов в батче.

### 7. Нет обработки `onBefore` / `onFinish` в useApiBatch

`UseApiBatchOptions` не поддерживает глобальные `onBefore` / `onFinish` для каждого запроса (только `onItemSuccess` / `onItemError` / `onFinish` для всего батча).
