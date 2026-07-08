import { createApp } from "vue";
import { createPinia } from "pinia";
import { createApi } from "@ametie/vue-muza-use";
import { VToaster, useToast } from "@ametie/ui";

import App from "./App.vue";
import { router } from "./routes/index";
import { apiAxios } from "../shared/api/axios";
import "./assets/main.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);

const { error } = useToast();
app.use(createApi({
    axios: apiAxios,
    onError: (err) => error(err.message),
    devtools: {
        enabled: true,
        maxHistory: 200,
        maxPayloadSize: 100_000,
    },
    globalOptions: {
        // Project-wide cache defaults — applied per-field under any request's
        // own `cache` option. Never activates caching by itself (a request must
        // still pass `cache`). See features/core/AutoCacheKeys.vue for a demo.
        cacheDefaults: {
            swr: true,
            staleTime: "5m",
            freshFor: "10s",
        },
    },
}));

app.component("VToaster", VToaster);
app.mount("#app");
