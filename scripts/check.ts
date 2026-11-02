import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, buildPath, buildBody } from '../src/server.js';
import { RemnawaveClient, compactJson } from '../src/client.js';
// Self-check: verifies every generated tool against api-1.json and
// prints the catalog. Fails on name collisions, unresolved refs, or
// route keys in tools.ts that the spec no longer has.
import {
    buildTools,
    CORE_TOOLS,
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

// Every non-authenticated/public endpoint must have exactly one tool.
const spec = JSON.parse(readFileSync(new URL('../api-1.json', import.meta.url), 'utf8'));
const excluded = new Set(['Auth Controller', 'Passkeys Controller', '[Public] Subscription Controller', 'API Tokens Controller']);
const expected = Object.entries<any>(spec.paths).flatMap(([path, methods]) =>
    Object.entries<any>(methods)
        .filter(([m, op]) => ['get', 'post', 'patch', 'put', 'delete'].includes(m) && !excluded.has(op.tags?.[0]))
        .map(([m]) => `${m.toUpperCase()} ${path}`),
);
assert.deepEqual(tools.map((t) => `${t.method} ${t.path}`).sort(), expected.sort());
assert.ok(filterByMode(tools, 'readonly').every((t) => t.readOnly));
assert.ok(filterByMode(tools, 'safe').every((t) => !t.destructive));
for (const name of ['sync_snippet', 'sync_node_plugin', 'sync_shared_list']) {
    assert.ok(tools.find((t) => t.name === name)?.destructive);
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
    for (const match of json.matchAll(/"\$ref":"([^"]+)"/g)) {
        const prefix = '#/$defs/';
        if (!match[1].startsWith(prefix) ||
            !Object.hasOwn(t.inputSchema.$defs ?? {}, match[1].slice(prefix.length))) {
            throw new Error(`Unresolved $ref in: ${t.name}: ${match[1]}`);
        }
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

// Exercise the actual MCP handlers without calling a live panel.
const config = {
    baseUrl: 'https://panel.invalid', apiToken: 'test', mode: 'full' as const,
    tools: CORE_TOOLS, maxResponseChars: 1000, timeoutMs: 5000,
};
for (const name of CORE_TOOLS) assert.ok(tools.some((t) => t.name === name), `core tool missing: ${name}`);
const originalFetch = globalThis.fetch;
const requests: { url: string; init?: RequestInit }[] = [];
globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ response: { ok: true } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });
};
const server = createServer(config);
const client = new Client({ name: 'self-check', version: '1' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = (await client.listTools()).tools;
    assert.equal(listed.length, CORE_TOOLS.length + 3);
    // Token budget: tools/list is sent with every session.
    const listChars = JSON.stringify(listed).length;
    console.log(`tools/list: ${listed.length} tools, ${listChars} chars (~${Math.round(listChars / 4)} tokens)`);
    assert.ok(listChars < 40000, `tools/list grew to ${listChars} chars; trim CORE_TOOLS`);

    const text = (r: any) => r.content[0].text as string;
    assert.match(text(await client.callTool({ name: 'search_api', arguments: { query: 'hwid devices' } })), /get_user_hwid_devices/);
    assert.match(text(await client.callTool({ name: 'get_api_schema', arguments: { name: 'delete_user' } })), /"userId"/);
    assert.equal((await client.callTool({ name: 'get_user_hwid_devices', arguments: { userId: 1 } })).isError, true, 'non-core must go via call_api');
    assert.ok(!(await client.callTool({ name: 'call_api', arguments: { name: 'get_user_hwid_devices', args: { userId: 1 } } })).isError);
    assert.equal(new URL(requests.at(-1)!.url).pathname, '/api/hwid/devices/1');
    let before = requests.length;
    assert.equal((await client.callTool({ name: 'call_api', arguments: { name: 'delete_user', args: { userId: 1 } } })).isError, true);
    assert.equal(requests.length, before, 'destructive call without confirm must not reach panel');
    assert.ok(!(await client.callTool({ name: 'call_api', arguments: { name: 'delete_user', args: { userId: 1 }, confirm: true } })).isError);
    assert.equal(text(await client.callTool({ name: 'get_stats', arguments: {} })), '{"ok":true}', 'envelope unwrapped');

    assert.equal(compactJson({ response: { a: 1, b: null } }, 100), '{"a":1}');
    assert.match(compactJson({ s: 'x'.repeat(50) }, 10), /^\{"s":"xxx.*truncated/s);
    const filters = [{ id: 'username', value: 'test' }];
    const sorting = [{ id: 'createdAt', desc: true }];
    const result = await client.callTool({ name: 'get_users', arguments: {
        filters, sorting, filterModes: { username: 'contains' }, limit: 1,
    } });
    assert.ok(!result.isError);
    const query = new URL(requests.at(-1)!.url).searchParams;
    assert.deepEqual(JSON.parse(query.get('filters')!), filters);
    assert.deepEqual(JSON.parse(query.get('sorting')!), sorting);
    assert.equal(query.get('filterModes[username]'), 'contains');
    const count = requests.length;
    assert.equal((await client.callTool({ name: 'get_user_by_id', arguments: { userId: 'bad' } })).isError, true);
    assert.equal(requests.length, count, 'invalid arguments must not reach panel');
    const tool = tools.find((t) => t.name === 'update_host')!;
    assert.deepEqual(buildBody(tool, { uuid: 'test', remark: 'new', ignored: true }), { uuid: 'test', remark: 'new' });
    const userTool = tools.find((t) => t.name === 'get_user_by_id')!;
    assert.equal(buildPath(userTool, { userId: 'a/b' }), '/api/users/a%2Fb');
    for (const status of [202, 204]) {
        globalThis.fetch = async () => new Response(null, { status });
        assert.deepEqual(await new RemnawaveClient(config).request('POST', '/test'), { status });
    }
    globalThis.fetch = async () => new Response('not JSON', { status: 200 });
    await assert.rejects(() => new RemnawaveClient(config).request('GET', '/test'));
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'denied' }), { status: 403 });
    await assert.rejects(() => new RemnawaveClient(config).request('GET', '/test'), /denied/);
} finally {
    globalThis.fetch = originalFetch;
    await client.close();
    await server.close();
}
console.log('OK: MCP catalog, search/schema/call_api, destructive confirm, compact output, input validation, query serialization, request bodies, empty responses and errors');
