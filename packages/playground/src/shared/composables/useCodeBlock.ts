import { onMounted, ref, type Ref } from "vue";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);

export function useCodeBlock(code: string | Ref<string>) {
    const highlighted = ref("");

    function highlight(raw: string): void {
        highlighted.value = hljs.highlight(raw.trim(), { language: "typescript" }).value;
    }

    const raw = typeof code === "string" ? code : code.value;
    onMounted(() => highlight(raw));

    return { highlighted };
}
