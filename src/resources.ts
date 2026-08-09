import {
    McpServer,
    ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { RemnawaveClient } from './client.js';

export function registerAllResources(
    server: McpServer,
    client: RemnawaveClient,
) {
    const staticResources: [string, string, string, string][] = [
        [
            'panel-stats',
            'remnawave://stats',
            'Current Remnawave panel statistics (users, nodes, traffic, system)',
            '/api/system/stats',
        ],
        [
            'panel-nodes',
            'remnawave://nodes',
            'Status of all Remnawave nodes (online/offline, traffic)',
            '/api/nodes',
        ],
        [
            'panel-health',
            'remnawave://health',
            'Remnawave panel health check',
            '/api/system/health',
        ],
    ];

    for (const [name, uri, description, path] of staticResources) {
        server.resource(
            name,
            uri,
            { description, mimeType: 'application/json' },
            async () => ({
                contents: [
                    {
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(
                            await client.request('GET', path),
                            null,
                            2,
                        ),
                    },
                ],
            }),
        );
    }

    server.resource(
        'user-details',
        new ResourceTemplate('remnawave://users/{userId}', { list: undefined }),
        {
            description:
                'Detailed information about a specific Remnawave user by numeric user ID',
            mimeType: 'application/json',
        },
        async (uri, params) => ({
            contents: [
                {
                    uri: uri.href,
                    mimeType: 'application/json',
                    text: JSON.stringify(
                        await client.request(
                            'GET',
                            `/api/users/${encodeURIComponent(String(params.userId))}`,
                        ),
                        null,
                        2,
                    ),
                },
            ],
        }),
    );
}
