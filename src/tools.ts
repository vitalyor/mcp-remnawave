import { readFileSync } from 'node:fs';
import { Mode } from './config.js';

// ponytail: api-1.json (Remnawave 2.8.1) is the single source of truth;
// tools are generated from it at startup, so tools can't drift from the API.

const EXCLUDED_TAGS = new Set([
    'Auth Controller',
    'Passkeys Controller',
    '[Public] Subscription Controller',
    'API Tokens Controller',
]);

// Auto-derived names that collide or are unreadable, keyed by "METHOD path".
const NAME_OVERRIDES: Record<string, string> = {
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
    'GET /api/bandwidth-stats/users/{uuid}': 'get_user_bandwidth_usage',
    'GET /api/bandwidth-stats/nodes': 'get_nodes_bandwidth_usage',
    'POST /api/bandwidth-stats/nodes/users': 'get_nodes_users_bandwidth_usage',
    'GET /api/bandwidth-stats/nodes/{uuid}/users':
        'get_node_users_bandwidth_usage',
};

// POST endpoints that only read data — allowed in readonly mode.
const READONLY_POSTS = new Set([
    'POST /api/users/resolve',
    'POST /api/system/testers/srr-matcher',
    'POST /api/bandwidth-stats/nodes/users',
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
    'POST /api/ip-control/drop-connections',
]);

function isDestructive(method: string, path: string): boolean {
    if (method === 'DELETE') return true;
    if (path.startsWith('/api/users/bulk')) return true;
    return DESTRUCTIVE_PATHS.has(`${method} ${path}`);
}

export interface ToolDef {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    method: string;
    path: string;
    pathParams: string[];
    queryParams: string[];
    bodyProps: string[] | null;
    readOnly: boolean;
    destructive: boolean;
}

type Schema = Record<string, any>;

function snake(s: string): string {
    return s.replace(/(?<=[a-z0-9])([A-Z])/g, '_$1').toLowerCase();
}

// Inline all $refs (spec has no recursive schemas) and convert
// OpenAPI 3.0 `nullable` to JSON Schema type arrays.
function normalize(schema: Schema, components: Record<string, Schema>): Schema {
    if (Array.isArray(schema)) {
        return schema.map((s) => normalize(s, components)) as any;
    }
    if (typeof schema !== 'object' || schema === null) return schema;
    if (schema.$ref) {
        const name = schema.$ref.split('/').pop()!;
        return normalize(components[name], components);
    }
    const out: Schema = {};
    for (const [k, v] of Object.entries(schema)) {
        out[k] =
            typeof v === 'object' && v !== null
                ? normalize(v as Schema, components)
                : v;
    }
    if (out.nullable === true && typeof out.type === 'string') {
        out.type = [out.type, 'null'];
        delete out.nullable;
    }
    return out;
}

export function buildTools(): ToolDef[] {
    const spec = JSON.parse(
        readFileSync(new URL('../api-1.json', import.meta.url), 'utf8'),
    );
    const components: Record<string, Schema> = spec.components?.schemas ?? {};
    const tools: ToolDef[] = [];

    for (const [path, methods] of Object.entries<any>(spec.paths)) {
        for (const [m, op] of Object.entries<any>(methods)) {
            if (!['get', 'post', 'patch', 'put', 'delete'].includes(m)) {
                continue;
            }
            const tag: string = op.tags?.[0] ?? '';
            if (EXCLUDED_TAGS.has(tag)) continue;

            const method = m.toUpperCase();
            const key = `${method} ${path}`;
            const name =
                NAME_OVERRIDES[key] ?? snake(op.operationId.split('_')[1]);

            const properties: Record<string, unknown> = {};
            const required: string[] = [];
            const pathParams: string[] = [];
            const queryParams: string[] = [];

            for (const p of op.parameters ?? []) {
                properties[p.name] = {
                    ...normalize(p.schema ?? {}, components),
                    ...(p.description ? { description: p.description } : {}),
                };
                if (p.in === 'path') {
                    pathParams.push(p.name);
                    required.push(p.name);
                } else {
                    queryParams.push(p.name);
                    if (p.required) required.push(p.name);
                }
            }

            let bodyProps: string[] | null = null;
            const bodySchema =
                op.requestBody?.content?.['application/json']?.schema;
            if (bodySchema) {
                const body = normalize(bodySchema, components);
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
                description,
                inputSchema: {
                    type: 'object',
                    properties,
                    ...(required.length ? { required } : {}),
                },
                method,
                path,
                pathParams,
                queryParams,
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
