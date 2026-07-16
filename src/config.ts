export type Mode = 'readonly' | 'safe' | 'full';

export interface Config {
    baseUrl: string;
    apiToken: string;
    apiKey?: string;
    mode: Mode;
}

export function loadConfig(): Config {
    const baseUrl = process.env.REMNAWAVE_BASE_URL;
    const apiToken = process.env.REMNAWAVE_API_TOKEN;
    const apiKey = process.env.REMNAWAVE_API_KEY;

    if (!baseUrl) {
        throw new Error('REMNAWAVE_BASE_URL environment variable is required');
    }
    if (!apiToken) {
        throw new Error('REMNAWAVE_API_TOKEN environment variable is required');
    }
    if (process.env.REMNAWAVE_READONLY !== undefined) {
        throw new Error(
            'REMNAWAVE_READONLY was replaced by REMNAWAVE_MODE=readonly|safe|full',
        );
    }

    const mode = (process.env.REMNAWAVE_MODE ?? 'full') as Mode;
    if (!['readonly', 'safe', 'full'].includes(mode)) {
        throw new Error(
            `Invalid REMNAWAVE_MODE "${mode}", expected readonly|safe|full`,
        );
    }

    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiToken,
        apiKey,
        mode,
    };
}
