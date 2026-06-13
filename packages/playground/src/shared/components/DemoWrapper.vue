<script setup lang="ts">
import { ref } from "vue";
import { useCodeBlock } from "../composables/useCodeBlock";

const props = defineProps<{
    title: string;
    description?: string;
    code?: string;
}>();

const showCode = ref(false);
const { highlighted } = useCodeBlock(props.code ?? "");
</script>

<template>
    <div class="demo-wrapper">
        <div class="demo-wrapper__header">
            <div>
                <h2 class="demo-wrapper__title">{{ title }}</h2>
                <p v-if="description" class="demo-wrapper__description">{{ description }}</p>
            </div>
            <button v-if="code" class="demo-wrapper__code-btn" :class="{ active: showCode }" @click="showCode = !showCode">
                &lt;/&gt; Code
            </button>
        </div>
        <div class="demo-wrapper__content"><slot /></div>
        <div v-if="showCode && code" class="demo-wrapper__code">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <pre><code class="hljs" v-html="highlighted" /></pre>
        </div>
    </div>
</template>

<style scoped>
.demo-wrapper { background: var(--ui-surface); border: 1px solid var(--ui-border-subtle); border-radius: var(--ui-radius-lg); overflow: hidden; max-width: 800px; }
.demo-wrapper__header { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px 16px; border-bottom: 1px solid var(--ui-border-subtle); }
.demo-wrapper__title { margin: 0 0 4px; font-size: 16px; font-weight: 600; color: var(--ui-foreground); }
.demo-wrapper__description { margin: 0; font-size: 13px; color: var(--ui-foreground-muted); }
.demo-wrapper__code-btn { flex-shrink: 0; padding: 6px 12px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-md); background: transparent; color: var(--ui-foreground-secondary); font-size: 12px; cursor: pointer; font-family: inherit; }
.demo-wrapper__code-btn.active { background: var(--ui-primary-subtle); color: var(--ui-primary); border-color: var(--ui-primary-muted); }
.demo-wrapper__content { padding: 24px; }
.demo-wrapper__code { border-top: 1px solid var(--ui-border-subtle); background: var(--ui-surface-sunken); }
.demo-wrapper__code pre { margin: 0; padding: 20px 24px; overflow-x: auto; font-size: 13px; line-height: 1.6; }
</style>
