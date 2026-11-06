import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RemnawaveClient } from './client.js';
import { Config, Mode } from './config.js';
import { buildTools, filterByMode, searchTools, ToolDef } from './tools.js';
import { registerAllResources } from './resources.js';
import { registerAllPrompts } from './prompts.js';

export function createServer(config: Config): McpServer {
    const server = new McpServer({
        name: 'remnawave-mcp',
        version: '3.4.8',
    });

    const client = new RemnawaveClient(config);
    const catalog = filterByMode(buildTools(), config.mode);
    const byName = new Map(catalog.map((t) => [t.name, t]));
    const validator = new AjvJsonSchemaValidator();
    const validators = new Map<string, ReturnType<typeof validator.getValidator>>();
    const validate = (tool: ToolDef, args: Record<string, unknown>) => {
        if (!validators.has(tool.name)) {
            validators.set(tool.name, validator.getValidator(tool.inputSchema as JsonSchemaType));
        }
        return validators.get(tool.name)!(args);
    };

    const exposed = config.tools === 'all'
        ? catalog
        : catalog.filter((t) => (config.tools as string[]).includes(t.name));
    const exposedNames = new Set(exposed.map((t) => t.name));
    const meta = metaTools(config.mode);

    server.server.registerCapabilities({ tools: {} });

    server.server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: [
            ...exposed.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
                annotations: {
                    readOnlyHint: t.readOnly,
                    destructiveHint: t.destructive,
                },
            })),
            ...(exposed.length < catalog.length ? meta : []),
        ],
    }));

    const call = async (tool: ToolDef, args: Record<string, unknown>) => {
        const validation = validate(tool, args);
        if (!validation.valid) {
            return errorResult(`Invalid arguments for ${tool.name}: ${validation.errorMessage}`);
        }
        return textResult(await client.requestText(
            tool.method,
            buildPath(tool, args),
            buildBody(tool, args),
        ));
    };

    server.server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const args = (req.params.arguments ?? {}) as Record<string, unknown>;
        try {
            switch (req.params.name) {
                case 'search_api': {
                    const found = searchTools(catalog, String(args.query ?? ''), Number(args.limit ?? 10));
                    if (!found.length) return textResult('No matching operations. Try other keywords.');
                    return textResult(found.map((t) =>
                        `${t.name} [${t.destructive ? 'D' : t.readOnly ? 'R' : 'W'}] ${t.method} ${t.path} — ${t.summary}`,
                    ).join('\n'));
                }
                case 'get_api_schema': {
                    const tool = byName.get(String(args.name));
                    if (!tool) return errorResult(`Unknown operation: ${args.name}. Use search_api.`);
                    return textResult(JSON.stringify({
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema,
                    }));
                }
                case 'call_api': {
                    const tool = byName.get(String(args.name));
                    if (!tool) return errorResult(`Unknown operation: ${args.name}. Use search_api.`);
                    if (tool.destructive && args.confirm !== true) {
                        return errorResult(
                            `${tool.name} is destructive. Confirm with the user, then retry with confirm: true.`,
                        );
                    }
                    return await call(tool, (args.args ?? {}) as Record<string, unknown>);
                }
            }
            const tool = exposedNames.has(req.params.name) ? byName.get(req.params.name) : undefined;
            if (!tool) return errorResult(`Unknown tool: ${req.params.name}. Use call_api for non-core operations.`);
            return await call(tool, args);
        } catch (e) {
            return errorResult(e instanceof Error ? e.message : String(e));
        }
    });

    registerAllResources(server, client);
    registerAllPrompts(server);

    return server;
}

function metaTools(mode: Mode) {
    const scope = mode === 'full' ? '' : ` Only ${mode}-mode operations are available.`;
    return [
        {
            name: 'search_api',
            description:
                'Find Remnawave panel API operations by keywords (e.g. "hwid devices", "node restart", "squad users").' +
                ' Returns operation names with [R]ead/[W]rite/[D]estructive flag, route and summary.' + scope,
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Keywords' },
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                },
                required: ['query'],
            },
            annotations: { readOnlyHint: true },
        },
        {
            name: 'get_api_schema',
            description: 'Get the full input JSON schema of an operation found via search_api.',
            inputSchema: {
                type: 'object',
                properties: { name: { type: 'string', description: 'Operation name' } },
                required: ['name'],
            },
            annotations: { readOnlyHint: true },
        },
        {
            name: 'call_api',
            description:
                'Call any Remnawave API operation by name. Arguments are validated against its schema' +
                ' (see get_api_schema). [D] operations need confirm: true, after asking the user.',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Operation name' },
                    args: { type: 'object', description: 'Operation arguments' },
                    confirm: { type: 'boolean', description: 'Required true for destructive operations' },
                },
                required: ['name'],
            },
            annotations: { readOnlyHint: mode === 'readonly', destructiveHint: mode === 'full' },
        },
    ];
}

function textResult(text: string) {
    return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
    return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
    };
}

export function buildPath(tool: ToolDef, args: Record<string, unknown>): string {
    let path = tool.path;
    for (const p of tool.pathParams) {
        if (args[p] === undefined) {
            throw new Error(`Missing required parameter: ${p}`);
        }
        path = path.replace(`{${p}}`, encodeURIComponent(String(args[p])));
    }
    const query = tool.queryParams
        .filter((q) => args[q] !== undefined)
        .flatMap((q) => {
            const value = args[q];
            if (tool.deepObjectParams.includes(q)) {
                return Object.entries(value as Record<string, unknown>).map(([key, v]) =>
                    `${encodeURIComponent(`${q}[${key}]`)}=${encodeURIComponent(String(v))}`,
                );
            }
            const encoded = typeof value === 'object' ? JSON.stringify(value) : String(value);
            return [`${encodeURIComponent(q)}=${encodeURIComponent(encoded)}`];
        });
    return query.length ? `${path}?${query.join('&')}` : path;
}

export function buildBody(
    tool: ToolDef,
    args: Record<string, unknown>,
): unknown | undefined {
    if (tool.bodyProps === null) return undefined;
    const body: Record<string, unknown> = {};
    for (const k of tool.bodyProps) {
        if (args[k] !== undefined) body[k] = args[k];
    }
    return body;
}
