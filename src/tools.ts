import { readFileSync } from 'node:fs';
import { Mode } from './config.js';

// api-1.json is the single source of truth;
// tools are generated from it at startup, so tools can't drift from the API.
// The route keys in the tables below are validated against the spec at build
// time by `npm run check`, so a spec update can't silently leave them stale.

const EXCLUDED_TAGS = new Set([
    'Auth Controller',
    'Passkeys Controller',
    '[Public] Subscription Controller',
    'API Tokens Controller',
]);

// Auto-derived names that collide or are unreadable, keyed by "METHOD path".
const NAME_OVERRIDES: Record<string, string> = {
    'GET /api/subscription-page-configs/tags': 'get_subscription_page_config_tags',
    'PATCH /api/subscription-page-configs/tags': 'set_subscription_page_config_tags',
    'GET /api/subscription-templates/tags': 'get_subscription_template_tags',
    'PATCH /api/subscription-templates/tags': 'set_subscription_template_tags',
    'GET /api/config-profiles/tags': 'get_config_profile_tags',
    'PATCH /api/config-profiles/tags': 'set_config_profile_tags',
    'GET /api/internal-squads/tags': 'get_internal_squad_tags',
    'PATCH /api/internal-squads/tags': 'set_internal_squad_tags',
    'GET /api/external-squads/tags': 'get_external_squad_tags',
    'PATCH /api/external-squads/tags': 'set_external_squad_tags',
    'GET /api/node-plugins/tags': 'get_node_plugin_tags',
    'PATCH /api/node-plugins/tags': 'set_node_plugin_tags',
    'GET /api/internal-squads/{uuid}/usage': 'get_internal_squad_usage',
    'GET /api/remnawave-settings': 'get_remnawave_settings',
    'PATCH /api/remnawave-settings': 'update_remnawave_settings',
    'GET /api/subscription-settings': 'get_subscription_settings',
    'PATCH /api/subscription-settings': 'update_subscription_settings',
    'GET /api/subscription-page-configs': 'get_all_subscription_page_configs',
    'POST /api/subscription-page-configs': 'create_subscription_page_config',
    'PATCH /api/subscription-page-configs': 'update_subscription_page_config',
    'GET /api/subscription-page-configs/{uuid}':
        'get_subscription_page_config_by_uuid',
    'DELETE /api/subscription-page-configs/{uuid}':
        'delete_subscription_page_config',
    'GET /api/node-plugins': 'get_all_node_plugins',
    'POST /api/node-plugins': 'create_node_plugin',
    'PATCH /api/node-plugins': 'update_node_plugin',
    'GET /api/node-plugins/{uuid}': 'get_node_plugin_by_uuid',
    'DELETE /api/node-plugins/{uuid}': 'delete_node_plugin',
    'GET /api/hwid/devices': 'get_all_hwid_devices',
    'GET /api/bandwidth-stats/users/{userId}': 'get_user_bandwidth_usage',
    'GET /api/bandwidth-stats/nodes': 'get_nodes_bandwidth_usage',
    'POST /api/bandwidth-stats/nodes/users': 'get_nodes_users_bandwidth_usage',
    'GET /api/bandwidth-stats/nodes/{uuid}/users':
        'get_node_users_bandwidth_usage',
    'POST /api/bandwidth-stats/nodes/usage':
        'get_users_exceeding_nodes_traffic',
    'GET /api/bandwidth-stats/internal-squads/{uuid}/usage':
        'get_internal_squad_bandwidth_usage',
    'GET /api/bandwidth-stats/internal-squads/{squadUuid}/users/{userId}/usage':
        'get_internal_squad_user_bandwidth_usage',
    // Panel typo in operationId ("delte"), and clearer job-based names.
    'DELETE /api/infra-billing/providers/{uuid}': 'delete_infra_provider',
    'POST /api/connections/by-user/{userId}': 'request_user_connections',
    'GET /api/connections/by-user/{jobId}': 'get_user_connections_result',
    'POST /api/connections/by-node/{nodeUuid}': 'request_node_connections',
    'GET /api/connections/by-node/{jobId}': 'get_node_connections_result',
    'GET /api/subscriptions/by-id/{userId}': 'get_subscription_by_user_id',
    'POST /api/nodes/bulk-actions/profile-modification':
        'bulk_nodes_profile_modification',
    'GET /api/hosts/{uuid}': 'get_host_by_uuid',
};

// POST endpoints that only read data — allowed in readonly mode.
const READONLY_POSTS = new Set([
    'POST /api/users/resolve',
    'POST /api/system/testers/srr-matcher',
    'POST /api/bandwidth-stats/nodes/users',
    'POST /api/bandwidth-stats/nodes/usage',
]);

// Irreversible / mass-impact operations: hidden in safe mode,
// marked destructive (confirm-with-user) in full mode.
const DESTRUCTIVE_PATHS = new Set([
    'POST /api/hosts/bulk/delete',
    'POST /api/hosts/bulk/disable',
    'PATCH /api/config-profiles',
    'POST /api/nodes/actions/restart-all',
    'POST /api/nodes/{uuid}/actions/disable',
    'POST /api/nodes/{uuid}/actions/restart',
    'POST /api/nodes/bulk-actions',
    'POST /api/nodes/bulk-actions/profile-modification',
    'POST /api/nodes/bulk-actions/update',
    'PATCH /api/remnawave-settings',
    'PATCH /api/subscription-settings',
    'PATCH /api/subscription-templates',
    'POST /api/node-plugins',
    'PATCH /api/node-plugins',
    'POST /api/node-plugins/executor',
    'POST /api/hwid/devices/delete',
    'POST /api/hwid/devices/delete-all',
    'POST /api/connections/drop',
    'POST /api/snippets/actions/sync',
    'POST /api/node-plugins/actions/sync',
    'POST /api/node-plugins/shared-lists/actions/sync',
]);

function isDestructive(method: string, path: string): boolean {
    if (method === 'DELETE') return true;
    if (path.startsWith('/api/users/bulk')) return true;
    return DESTRUCTIVE_PATHS.has(`${method} ${path}`);
}

// Route keys above that no longer exist in the spec. A renamed or removed
// endpoint would otherwise silently lose its override or destructive flag.
export function staleRouteKeys(seenRoutes: Set<string>): string[] {
    return [
        ...Object.keys(NAME_OVERRIDES),
        ...READONLY_POSTS,
        ...DESTRUCTIVE_PATHS,
    ].filter((key) => !seenRoutes.has(key));
}

// Exposed as first-class tools by default; everything else is reachable
// through search_api / get_api_schema / call_api to keep tools/list small.
export const CORE_TOOLS = [
    'get_stats',
    'get_users',
    'get_user_by_id',
    'get_user_by_username',
    'create_user',
    'update_user',
    'enable_user',
    'disable_user',
    'extend_user_expiration_date',
    'reset_user_traffic',
    'revoke_user_subscription',
    'get_nodes',
    'get_node',
    'get_hosts',
    'get_internal_squads',
];

export interface ToolDef {
    name: string;
    summary: string;
    tag: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
        $defs?: Record<string, unknown>;
    };
    method: string;
    path: string;
    pathParams: string[];
    queryParams: string[];
    deepObjectParams: string[];
    bodyProps: string[] | null;
    readOnly: boolean;
    destructive: boolean;
}

type Schema = Record<string, any>;

function snake(s: string): string {
    return s.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();
}

// Preserve references in local $defs, including recursive schemas, and convert OpenAPI 3.0
// quirks (`nullable`, boolean `exclusiveMinimum/Maximum`) to the JSON Schema
// 2020-12 forms that MCP clients validate against.
function normalize(schema: Schema, components: Record<string, Schema>, defs: Record<string, Schema>): Schema {
    if (Array.isArray(schema)) {
        return schema.map((s) => normalize(s, components, defs)) as any;
    }
    if (typeof schema !== 'object' || schema === null) return schema;
    if (schema.$ref) {
        const name = schema.$ref.split('/').pop()!;
        if (!components[name]) throw new Error(`Unknown schema reference: ${schema.$ref}`);
        if (!Object.hasOwn(defs, name)) {
            defs[name] = {};
            defs[name] = normalize(components[name], components, defs);
        }
        return { $ref: `#/$defs/${name}` };
    }
    const out: Schema = {};
    for (const [k, v] of Object.entries(schema)) {
        out[k] =
            typeof v === 'object' && v !== null
                ? normalize(v as Schema, components, defs)
                : v;
    }
    if (out.nullable !== undefined) {
        // Without a declared type, any value (incl. null) is already allowed.
        if (out.nullable === true && typeof out.type === 'string') {
            out.type = [out.type, 'null'];
        }
        delete out.nullable;
    }
    for (const [flag, bound] of [
        ['exclusiveMinimum', 'minimum'],
        ['exclusiveMaximum', 'maximum'],
    ] as const) {
        if (out[flag] === true && typeof out[bound] === 'number') {
            out[flag] = out[bound];
            delete out[bound];
        } else if (out[flag] === false) {
            delete out[flag];
        }
    }
    return out;
}

const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'];

function loadSpec(): any {
    return JSON.parse(
        readFileSync(new URL('../api-1.json', import.meta.url), 'utf8'),
    );
}

export function specVersion(): string {
    return loadSpec().info?.version ?? 'unknown';
}

export function specRoutes(): Set<string> {
    const routes = new Set<string>();
    for (const [path, methods] of Object.entries<any>(loadSpec().paths)) {
        for (const m of Object.keys(methods)) {
            if (HTTP_METHODS.includes(m)) {
                routes.add(`${m.toUpperCase()} ${path}`);
            }
        }
    }
    return routes;
}

export function buildTools(): ToolDef[] {
    const spec = loadSpec();
    const components: Record<string, Schema> = spec.components?.schemas ?? {};
    const tools: ToolDef[] = [];

    for (const [path, methods] of Object.entries<any>(spec.paths)) {
        for (const [m, op] of Object.entries<any>(methods)) {
            if (!HTTP_METHODS.includes(m)) continue;
            const tag: string = op.tags?.[0] ?? '';
            if (EXCLUDED_TAGS.has(tag)) continue;

            const method = m.toUpperCase();
            const key = `${method} ${path}`;
            const name =
                NAME_OVERRIDES[key] ?? snake(op.operationId.split('_')[1]);

            const properties: Record<string, unknown> = {};
            const defs: Record<string, Schema> = {};
            const required: string[] = [];
            const pathParams: string[] = [];
            const queryParams: string[] = [];
            const deepObjectParams: string[] = [];

            for (const p of op.parameters ?? []) {
                properties[p.name] = {
                    ...normalize(p.schema ?? {}, components, defs),
                    ...(p.description ? { description: p.description } : {}),
                };
                if (p.in === 'path') {
                    pathParams.push(p.name);
                    required.push(p.name);
                } else {
                    queryParams.push(p.name);
                    if (p.style === 'deepObject') deepObjectParams.push(p.name);
                    if (p.required) required.push(p.name);
                }
            }

            let bodyProps: string[] | null = null;
            const bodySchema =
                op.requestBody?.content?.['application/json']?.schema;
            if (bodySchema) {
                const body = normalize(
                    bodySchema.$ref ? components[bodySchema.$ref.split('/').pop()!] : bodySchema,
                    components,
                    defs,
                );
                bodyProps = Object.keys(body.properties ?? {});
                Object.assign(properties, body.properties ?? {});
                required.push(...(body.required ?? []));
            }

            const destructive = isDestructive(method, path);
            const readOnly = method === 'GET' || READONLY_POSTS.has(key);
            let description = `${op.summary} [${tag.replace(' Controller', '')}]`;
            if (op.description) description += ` ${op.description}`;
            if (destructive) {
                description +=
                    ' DESTRUCTIVE: irreversible or affects many users/nodes.' +
                    ' Always confirm with the user before calling.';
            }

            tools.push({
                name,
                summary: op.summary ?? '',
                tag: tag.replace(' Controller', ''),
                description,
                inputSchema: {
                    type: 'object',
                    properties,
                    ...(Object.keys(defs).length ? { $defs: defs } : {}),
                    ...(required.length ? { required } : {}),
                },
                method,
                path,
                pathParams,
                queryParams,
                deepObjectParams,
                bodyProps,
                readOnly,
                destructive,
            });
        }
    }

    const names = new Set<string>();
    for (const t of tools) {
        if (names.has(t.name)) {
            throw new Error(`Duplicate tool name: ${t.name}`);
        }
        names.add(t.name);
    }
    return tools;
}

export function filterByMode(tools: ToolDef[], mode: Mode): ToolDef[] {
    if (mode === 'readonly') return tools.filter((t) => t.readOnly);
    if (mode === 'safe') return tools.filter((t) => !t.destructive);
    return tools;
}

// ponytail: substring scoring over name/path/tag/summary, fine for ~200 ops;
// swap for embeddings only if search quality becomes a real problem.
export function searchTools(tools: ToolDef[], query: string, limit: number): ToolDef[] {
    const words = query.toLowerCase().split(/[\s_\-/]+/).filter(Boolean);
    return tools
        .map((t) => {
            const name = t.name.replace(/_/g, ' ');
            const meta = `${t.path} ${t.tag}`.toLowerCase();
            const text = t.summary.toLowerCase();
            const score = words.reduce((sum, w) =>
                sum + (name.includes(w) ? 3 : 0) + (meta.includes(w) ? 2 : 0) + (text.includes(w) ? 1 : 0), 0);
            return { t, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.t.name.length - b.t.name.length)
        .slice(0, limit)
        .map((x) => x.t);
}
