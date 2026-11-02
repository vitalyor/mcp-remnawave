import {
    McpServer,
    ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from './client.js';

const mimeType = 'application/json';

export function registerAllResources(
    server: McpServer,
    client: RemnawaveClient,
) {
    const staticResources: [string, string, string, string][] = [
        ['panel-stats', 'remnawave://stats', 'Current Remnawave panel statistics (users, nodes, traffic, system)', '/api/system/stats'],
        ['panel-nodes', 'remnawave://nodes', 'Status of all Remnawave nodes (online/offline, traffic)', '/api/nodes'],
        ['panel-health', 'remnawave://health', 'Remnawave panel health check', '/api/system/health'],
    ];

    for (const [name, uri, description, path] of staticResources) {
        server.registerResource(name, uri, { description, mimeType }, async () => ({
            contents: [{ uri, mimeType, text: await client.requestText('GET', path) }],
        }));
    }

    server.registerResource(
        'user-details',
        new ResourceTemplate('remnawave://users/{userId}', { list: undefined }),
        { description: 'Detailed information about a specific Remnawave user by numeric user ID', mimeType },
        async (uri, { userId }) => ({
            contents: [{
                uri: uri.href,
                mimeType,
                text: await client.requestText('GET', `/api/users/${encodeURIComponent(String(userId))}`),
            }],
        }),
    );
}
