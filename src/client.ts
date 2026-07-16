import { Config } from './config.js';

export class RemnawaveClient {
    private baseUrl: string;
    private headers: Record<string, string>;

    constructor(config: Config) {
        this.baseUrl = config.baseUrl;
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
        const options: RequestInit = { method, headers: this.headers };
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
                errorMessage = `HTTP ${res.status} ${res.statusText}`;
            }
            throw new Error(`Remnawave API error: ${errorMessage}`);
        }
        return res.json() as Promise<T>;
    }
}
