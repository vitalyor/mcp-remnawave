import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RemnawaveClient } from './client.js';
import { Config } from './config.js';
import { buildTools, filterByMode, ToolDef } from './tools.js';
import { registerAllResources } from './resources.js';
import { registerAllPrompts } from './prompts.js';

export function createServer(config: Config): McpServer {
    const server = new McpServer({
        name: 'remnawave-mcp',
        version: '3.0.0',
    });

    const client = new RemnawaveClient(config);
    const tools = filterByMode(buildTools(), config.mode);
    const byName = new Map(tools.map((t) => [t.name, t]));

    server.server.registerCapabilities({ tools: {} });

    server.server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: {
                readOnlyHint: t.readOnly,
                destructiveHint: t.destructive,
            },
        })),
    }));

    server.server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const tool = byName.get(req.params.name);
        if (!tool) {
            return errorResult(`Unknown tool: ${req.params.name}`);
        }
        const args = (req.params.arguments ?? {}) as Record<string, unknown>;
        try {
            const result = await client.request(
                tool.method,
                buildPath(tool, args),
                buildBody(tool, args),
            );
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (e) {
            return errorResult(e instanceof Error ? e.message : String(e));
        }
    });

    registerAllResources(server, client);
    registerAllPrompts(server);

    return server;
}

function errorResult(message: string) {
    return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
    };
}

function buildPath(tool: ToolDef, args: Record<string, unknown>): string {
    let path = tool.path;
    for (const p of tool.pathParams) {
        if (args[p] === undefined) {
            throw new Error(`Missing required parameter: ${p}`);
        }
        path = path.replace(`{${p}}`, encodeURIComponent(String(args[p])));
    }
    const query = tool.queryParams
        .filter((q) => args[q] !== undefined)
        .map((q) => `${encodeURIComponent(q)}=${encodeURIComponent(String(args[q]))}`);
    return query.length ? `${path}?${query.join('&')}` : path;
}

function buildBody(
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
