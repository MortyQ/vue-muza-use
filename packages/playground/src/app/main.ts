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
        maxPayloadSize: 10_000,
    },
}));

app.component("VToaster", VToaster);
app.mount("#app");
