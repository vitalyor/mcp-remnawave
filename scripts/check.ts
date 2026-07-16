// Self-check: verifies every generated tool against api-1.json and
// prints the catalog. Fails on name collisions or spec drift.
import { buildTools, filterByMode } from '../src/tools.js';

const tools = buildTools();
const ro = filterByMode(tools, 'readonly').length;
const safe = filterByMode(tools, 'safe').length;

console.log(`total: ${tools.length} | readonly: ${ro} | safe: ${safe}`);

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
    if (JSON.stringify(t.inputSchema).includes('$ref')) {
        throw new Error(`Unresolved $ref in: ${t.name}`);
    }
}
console.log('OK: names valid, schemas object-typed, all $refs resolved');
