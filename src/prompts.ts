import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Operations that aren't in the tool list are reached through call_api.
const NOTE = '\n\nIf a named operation is not in your tool list, call it via call_api(name, args).';

function prompt(text: string) {
    return {
        messages: [{ role: 'user' as const, content: { type: 'text' as const, text: text + NOTE } }],
    };
}

export function registerAllPrompts(server: McpServer) {
    server.registerPrompt(
        'create_user_wizard',
        {
            description: 'Step-by-step guide to create a new VPN user',
            argsSchema: { username: z.string().describe('Username for the new user') },
        },
        ({ username }) => prompt(`I want to create a new VPN user with username "${username}". Please guide me through the process:

1. First, check if the username is already taken using get_user_by_username
2. Get the list of available config profiles using get_config_profiles
3. Get the list of available internal squads using get_internal_squads
   (users are identified by a numeric id in this API, not a UUID)
4. Create the user with create_user (ask me about traffic limit, expiration date, and which squads to assign)
5. Confirm the user was created successfully and show the subscription URL`),
    );

    server.registerPrompt(
        'node_diagnostics',
        {
            description: 'Diagnose issues with a specific node',
            argsSchema: { nodeUuid: z.string().describe('UUID of the node to diagnose') },
        },
        ({ nodeUuid }) => prompt(`Please run diagnostics on node ${nodeUuid}:

1. Get node details using get_node
2. Check system health using get_remnawave_health
3. Get node metrics using get_nodes_metrics
4. Check bandwidth stats using get_bandwidth_stats
5. Summarize the node's status: connection state, xray version, uptime, traffic usage, online users
6. Flag any issues found (offline, high traffic usage, errors)`),
    );

    server.registerPrompt(
        'traffic_report',
        {
            description: 'Generate a traffic usage report',
            argsSchema: {
                startDate: z.string().optional().describe('Start date (ISO 8601)'),
                endDate: z.string().optional().describe('End date (ISO 8601)'),
            },
        },
        ({ startDate, endDate }) => prompt(`Generate a traffic report for the ${
            startDate && endDate ? `from ${startDate} to ${endDate}` : 'current'
        } period:

1. Get overall system stats using get_stats
2. Get bandwidth statistics using get_bandwidth_stats
3. Get node statistics using get_nodes_statistics
4. List all users and their traffic using get_users
5. Provide a summary including:
   - Total traffic consumed
   - Per-node traffic breakdown
   - Top users by traffic consumption
   - Users who exceeded their traffic limits
   - Users with expired subscriptions`),
    );

    server.registerPrompt(
        'user_audit',
        {
            description: 'Complete audit of a specific user',
            argsSchema: { userId: z.string().describe('Numeric user ID to audit') },
        },
        ({ userId }) => prompt(`Perform a complete audit of user ${userId}:

1. Get full user details using get_user_by_id
2. Get subscription info using get_subscription_by_user_id
3. Get HWID devices using get_user_hwid_devices
4. Summarize:
   - Account status and expiration
   - Traffic usage vs limit
   - Subscription URL and last access
   - Connected devices (HWID)
   - Squad memberships
   - Any issues or concerns`),
    );

    server.registerPrompt(
        'bulk_user_cleanup',
        { description: 'Find and manage expired or inactive users' },
        () => prompt(`Help me clean up users:

1. List all users using get_users with a large page size
2. Identify:
   - Users with EXPIRED status
   - Users with DISABLED status
   - Users with LIMITED status (exceeded traffic)
   - Users who haven't connected recently
3. Present the findings in a clear table
4. Ask what action to take (disable_user, delete_user, extend_user_expiration_date, reset_user_traffic)
5. Execute the chosen action only after my explicit confirmation`),
    );
}
