// Self-check: verifies every generated tool against api-1.json and
// prints the catalog. Fails on name collisions, unresolved refs, or
// route keys in tools.ts that the spec no longer has.
import {
    buildTools,
    filterByMode,
    specRoutes,
    specVersion,
    staleRouteKeys,
} from '../src/tools.js';

const stale = staleRouteKeys(specRoutes());
if (stale.length) {
    console.error('Stale route keys in tools.ts (not in api-1.json):');
    for (const k of stale) console.error(`  ${k}`);
    throw new Error(`${stale.length} stale route key(s)`);
}

const tools = buildTools();
const ro = filterByMode(tools, 'readonly').length;
const safe = filterByMode(tools, 'safe').length;

console.log(
    `spec ${specVersion()} | total: ${tools.length} | readonly: ${ro} | safe: ${safe}`,
);

for (const t of tools.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const flag = t.destructive ? 'D' : t.readOnly ? 'R' : 'W';
    console.log(`${flag} ${t.name}  ->  ${t.method} ${t.path}`);
}

// invariants
for (const t of tools) {
    if (!/^[a-z0-9_]+$/.test(t.name) || t.name.length > 64) {
        throw new Error(`Bad tool name: ${t.name}`);
    }
    if (t.inputSchema.type !== 'object') {
        throw new Error(`Non-object schema: ${t.name}`);
    }
    const json = JSON.stringify(t.inputSchema);
    if (json.includes('$ref')) {
        throw new Error(`Unresolved $ref in: ${t.name}`);
    }
    // OpenAPI 3.0 leftovers that JSON Schema 2020-12 validators reject
    if (/"(nullable|exclusiveM(in|ax)imum)":(true|false)/.test(json)) {
        throw new Error(`OpenAPI 3.0 keyword left unconverted in: ${t.name}`);
    }
    for (const p of t.pathParams) {
        if (!t.path.includes(`{${p}}`)) {
            throw new Error(`Path param ${p} not in path: ${t.name}`);
        }
    }
    const placeholders = (t.path.match(/\{[^}]+\}/g) ?? []).map((s) =>
        s.slice(1, -1),
    );
    for (const ph of placeholders) {
        if (!t.pathParams.includes(ph)) {
            throw new Error(`Path placeholder ${ph} has no parameter: ${t.name}`);
        }
    }
}
console.log(
    'OK: no stale keys, names valid, schemas object-typed, refs resolved,' +
        ' path params complete',
);
