import { Config } from './config.js';

export class RemnawaveClient {
    private baseUrl: string;
    private headers: Record<string, string>;
    private timeoutMs: number;
    private maxChars: number;

    constructor(config: Config) {
        this.baseUrl = config.baseUrl;
        this.timeoutMs = config.timeoutMs;
        this.maxChars = config.maxResponseChars;
        this.headers = {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json',
        };
        if (config.apiKey) {
            this.headers['X-Api-Key'] = config.apiKey;
        }
    }

    async request<T = unknown>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<T> {
        const options: RequestInit = {
            method,
            headers: this.headers,
            signal: AbortSignal.timeout(this.timeoutMs),
        };
        if (body !== undefined) {
            options.body = JSON.stringify(body);
        }
        const res = await fetch(`${this.baseUrl}${path}`, options);
        if (!res.ok) {
            let errorMessage: string;
            try {
                const errorBody = await res.json();
                errorMessage =
                    (errorBody as { message?: string }).message ||
                    JSON.stringify(errorBody);
            } catch {
                errorMessage = res.statusText;
            }
            throw new Error(`Remnawave API error (HTTP ${res.status}): ${errorMessage}`);
        }
        const text = await res.text();
        // Accepted jobs and successful deletions commonly have no response body.
        return (text.trim() ? JSON.parse(text) : { status: res.status }) as T;
    }

    // Request and render for the model: unwrap the panel's {response: ...}
    // envelope, drop nulls, no indentation, and cap the size.
    async requestText(method: string, path: string, body?: unknown): Promise<string> {
        return compactJson(await this.request(method, path, body), this.maxChars);
    }
}

export function compactJson(value: unknown, maxChars: number): string {
    if (
        value && typeof value === 'object' && !Array.isArray(value) &&
        Object.keys(value).length === 1 && 'response' in value
    ) {
        value = (value as { response: unknown }).response;
    }
    const text = JSON.stringify(value, (_k, v) => (v === null ? undefined : v)) ?? 'null';
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n…[truncated ${text.length - maxChars} of ${text.length} chars; narrow the query or use pagination params like size/start]`;
}
