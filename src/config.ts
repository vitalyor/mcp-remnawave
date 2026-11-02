import { CORE_TOOLS } from './tools.js';

export type Mode = 'readonly' | 'safe' | 'full';

export interface Config {
    baseUrl: string;
    apiToken: string;
    apiKey?: string;
    mode: Mode;
    // Names exposed as first-class tools, or 'all' for the full catalog.
    tools: string[] | 'all';
    maxResponseChars: number;
    timeoutMs: number;
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

    const tools = process.env.REMNAWAVE_TOOLS?.trim();
    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiToken,
        apiKey,
        mode,
        tools: tools === 'all' ? 'all' : tools ? tools.split(',').map((t) => t.trim()) : CORE_TOOLS,
        maxResponseChars: positiveInt('REMNAWAVE_MAX_RESPONSE_CHARS', 40000),
        timeoutMs: positiveInt('REMNAWAVE_TIMEOUT_MS', 30000),
    };
}

function positiveInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`${name} must be a positive integer, got "${raw}"`);
    }
    return n;
}
