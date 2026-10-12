/**
 * Type-level contract of named clients (`ApiClientRegistry`, `ApiClientName`, `client` options).
 *
 * Module augmentation is program-wide, so augmenting `ApiClientRegistry` in this
 * file would leak into every other test compiled with it. Instead each case is a
 * small source file compiled in isolation with the TypeScript compiler API:
 * zero diagnostics = the expectations (including `@ts-expect-error` lines) hold.
 *
 * Covers the "Client names are type-checked when declared" scenarios:
 *  - an augmented registry rejects an undeclared name, accepts "default" and declared names
 *  - without augmentation any string is accepted
 *  - `ExecuteConfig` has no `client`
 */
import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { resolve } from 'path'

const TYPES = resolve(__dirname, '../../src/types').replace(/\\/g, '/')

function diagnosticsFor(source: string): string[] {
    const fileName = resolve(__dirname, '__virtual__/case.ts')
    const options: ts.CompilerOptions = {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        lib: ['lib.esnext.d.ts', 'lib.dom.d.ts'],
        types: [],
    }
    const host = ts.createCompilerHost(options)
    const readFile = host.readFile.bind(host)
    const fileExists = host.fileExists.bind(host)
    const getSourceFile = host.getSourceFile.bind(host)
    host.fileExists = (f) => f === fileName || fileExists(f)
    host.readFile = (f) => (f === fileName ? source : readFile(f))
    host.getSourceFile = (f, lang, onError, create) =>
        f === fileName ? ts.createSourceFile(f, source, lang) : getSourceFile(f, lang, onError, create)

    const program = ts.createProgram([fileName], options, host)
    return ts.getPreEmitDiagnostics(program)
        .filter((d) => d.file?.fileName === fileName)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

const HEADER = `import type { UseApiOptions, UseApiBatchOptions, BatchRequestConfig, ExecuteConfig, ApiClientName } from "${TYPES}";\n`

describe('named clients — types', () => {
    it('the harness reports a real type error (guards against a vacuous pass)', () => {
        const errors = diagnosticsFor(`${HEADER}const x: UseApiOptions = { client: 42 };\nexport {};\n`)
        expect(errors.length).toBeGreaterThan(0)
    })

    it('without augmentation any client name type-checks', () => {
        const errors = diagnosticsFor(`${HEADER}
const a: UseApiOptions = { client: "anything" };
const b: UseApiBatchOptions = { client: "whatever" };
const c: BatchRequestConfig = { url: "/x", client: "any" };
const name: ApiClientName = "free-form";
export { a, b, c, name };
`)
        expect(errors).toEqual([])
    })

    it('an augmented registry accepts "default" and declared names and rejects a typo', () => {
        const errors = diagnosticsFor(`${HEADER}
declare module "${TYPES}" {
    interface ApiClientRegistry {
        tools: true;
        mcp: true;
    }
}
const a: UseApiOptions = { client: "tools" };
const b: UseApiOptions = { client: "default" };
const c: UseApiBatchOptions = { client: "mcp" };
const d: BatchRequestConfig = { url: "/x", client: "tools" };
// @ts-expect-error — "tool" is not declared
const e: UseApiOptions = { client: "tool" };
// @ts-expect-error — undeclared on a batch item too
const f: BatchRequestConfig = { url: "/x", client: "nope" };
const exact: ApiClientName[] = ["default", "tools", "mcp"];
export { a, b, c, d, e, f, exact };
`)
        expect(errors).toEqual([])
    })

    it('ExecuteConfig has no client — it is fixed per composable', () => {
        const errors = diagnosticsFor(`${HEADER}
type HasClient = "client" extends keyof ExecuteConfig ? true : false;
const check: HasClient = false;
// @ts-expect-error — client is not accepted per call
const cfg: ExecuteConfig = { client: "tools" };
export { check, cfg };
`)
        expect(errors).toEqual([])
    })
})
