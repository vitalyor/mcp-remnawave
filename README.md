# mcp-remnawave

[English](#english) | [Русский](#русский)

---

<a id="english"></a>

## MCP Server for Remnawave Panel

MCP server ([Model Context Protocol](https://modelcontextprotocol.io)) providing LLM clients (Claude Desktop, Cursor, Windsurf, etc.) with tools to manage a [Remnawave](https://github.com/remnawave/) VPN panel.

**Version:** 3.4.7 | **Remnawave API:** 3.4.7

### How it works

All tools are **generated at startup directly from the panel's OpenAPI spec** ([api-1.json](api-1.json)). Tool names, parameters, and descriptions always match the API — there is nothing to keep in sync by hand. To support a newer panel, replace `api-1.json` with the new spec (`curl -o api-1.json https://cdn.docs.rw/docs/openapi.json`) and rebuild.

**Token-lean by design.** Only ~15 everyday tools (users, nodes, hosts, squads, stats) are listed with full schemas; the rest of the catalog is reached through three meta-tools: `search_api` → `get_api_schema` → `call_api`. The tool list costs ~3k tokens per session instead of ~55k. Responses are compact JSON (no indentation, no `null` fields, the `{response: …}` envelope unwrapped) and capped in size.

### Features

- **199 operations** — every admin operation of Remnawave 3.4.7: users (incl. bulk), nodes, hosts, subscriptions, templates, squads (internal/external), HWID, config profiles, inbounds, billing, snippets, settings, subscription page configs, node plugins, connections, bandwidth stats, metadata
- **Access modes** — `readonly` (89 tools), `safe` (149 tools, no destructive operations), `full` (all 199)
- **Honest MCP annotations** — every tool carries `readOnlyHint`/`destructiveHint`; destructive operations tell the agent to confirm with you first, and `call_api` refuses them without `confirm: true`
- **4 resources** — real-time panel stats, node status, health checks
- **5 prompts** — guided workflows for common tasks
- **Caddy support** — `X-Api-Key` header for panels behind Caddy with custom path
- **stdio transport** — works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client

Not exposed (deliberately): panel auth/login, passkeys, public subscription endpoints, and API token management — an agent has no business touching those.

### Requirements

- Node.js >= 22
- Remnawave panel with API token (Settings > API Tokens)

### Installation

```bash
git clone https://github.com/TrackLine/mcp-remnawave.git
cd mcp-remnawave
npm install
npm run build
```

### Configuration

Create a `.env` file or pass environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `REMNAWAVE_BASE_URL` | Yes | Panel URL (e.g. `https://vpn.example.com`) |
| `REMNAWAVE_API_TOKEN` | Yes | API token from panel settings |
| `REMNAWAVE_API_KEY` | No | API key for Caddy reverse proxy authentication |
| `REMNAWAVE_MODE` | No | `readonly` \| `safe` \| `full` (default `full`) |
| `REMNAWAVE_TOOLS` | No | Comma-separated tool names to list directly, or `all` for every operation as its own tool (~55k tokens). Default: the built-in core set |
| `REMNAWAVE_MAX_RESPONSE_CHARS` | No | Truncate responses longer than this (default `40000`) |
| `REMNAWAVE_TIMEOUT_MS` | No | Panel request timeout (default `30000`) |

### Access modes

| Mode | Operations | What the agent can do |
|------|-------|-----------------------|
| `readonly` | 89 | Look, but not touch: lists, stats, health, lookups |
| `safe` | 149 | Everything except destructive operations: create users/hosts/nodes, update single entities, enable, extend. No deletes, no bulk user operations, no config-profile/template/settings edits, no node restarts, no plugin execution |
| `full` | 199 | Everything. Destructive tools are annotated and instruct the agent to confirm with you before calling |

The `safe` mode hides the operations marked destructive, including snippet/plugin synchronization. Other writes can still affect active service; this mode is not a guarantee of harmless changes.

`REMNAWAVE_READONLY` from v1.x was replaced by `REMNAWAVE_MODE=readonly`; the server exits with a clear error if the old variable is set.

### Caddy with Custom Path

If your panel is behind [Caddy with a custom path and API key protection](https://docs.remnawave.com/docs/security/caddy-with-custom-path/):

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=your-caddy-api-key
```

The `X-Api-Key` header is added to every request automatically.

### Usage with Claude Desktop / Cursor / Windsurf

Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS). Cursor/Windsurf: `.cursor/mcp.json` / `.windsurf/mcp.json`.

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-remnawave/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "your-api-token-here",
        "REMNAWAVE_MODE": "safe"
      }
    }
  }
}
```

### Docker

```bash
npm run build
docker compose up -d
```

### Tools

Tool names follow the panel API verbs: `get_users`, `create_user`, `update_host`, `bulk_delete_users`, `restart_node`, `get_stats`, … Run `npm run check` to print the full catalog with each tool's mode flag (R = readonly, W = write, D = destructive) and its API route.

Coverage: 199 of 218 API operations; core tools are listed directly, the rest via `call_api`. Intentionally excluded: authentication (8), passkeys (5), public subscriptions (3), API token management (3). New in API 3.4.5: node integrations, shared lists, geocheck jobs, host cloning, tags and synchronization. Run `npm run check` for the exact catalog.

**Note on Remnawave 3.x:** users are addressed by their **numeric `id`**, not a UUID (`get_user_by_id`, `delete_user`, `get_user_hwid_devices` all take `userId`). Look one up with `get_user_by_username`, `get_user_by_short_uuid`, or `resolve_user`. The old `/api/ip-control/*` endpoints became the Connections tools (`request_user_connections` → `get_user_connections_result`, `drop_connections`).

### Resources

| URI | Description |
|-----|-------------|
| `remnawave://stats` | Current panel statistics |
| `remnawave://nodes` | All nodes status |
| `remnawave://health` | Panel health status |
| `remnawave://users/{userId}` | Specific user details (numeric user ID) |

### Prompts

| Prompt | Description |
|--------|-------------|
| `create_user_wizard` | Step-by-step user creation guide |
| `node_diagnostics` | Node troubleshooting |
| `traffic_report` | Traffic usage report |
| `user_audit` | Complete user audit |
| `bulk_user_cleanup` | Find and manage expired users |

### Example Queries

```
"Show me all users with expired subscriptions"
"Create user vasya with 50 GB limit for one month"
"Restart node amsterdam-01"
"Give me a traffic report for the last week"
"Which nodes are offline right now?"
```

### Project Structure

```
api-1.json        # Remnawave OpenAPI spec — the single source of truth
src/
├── index.ts      # Entry point (stdio transport)
├── server.ts     # McpServer, core tools + search_api/get_api_schema/call_api
├── tools.ts      # Operation generation from the spec, core set, search, modes
├── client.ts     # HTTP client
├── config.ts     # Environment config
├── resources.ts  # MCP resources
└── prompts.ts    # MCP prompts
scripts/
└── check.ts      # Catalog printer + spec self-check (npm run check)
```

### License

MIT

---

<a id="русский"></a>

## MCP-сервер для Remnawave Panel

MCP-сервер ([Model Context Protocol](https://modelcontextprotocol.io)), предоставляющий LLM-клиентам (Claude Desktop, Cursor, Windsurf и др.) инструменты для управления VPN-панелью [Remnawave](https://github.com/remnawave/).

**Версия:** 3.4.7 | **Remnawave API:** 3.4.7

### Как это устроено

Все тулы **генерируются при старте напрямую из OpenAPI-спеки панели** ([api-1.json](api-1.json)). Имена, параметры и описания всегда совпадают с API — синхронизировать вручную нечего. Для поддержки новой версии панели достаточно заменить `api-1.json` (`curl -o api-1.json https://cdn.docs.rw/docs/openapi.json`) и пересобрать.

**Экономия токенов.** С полными схемами выставлено только ~15 повседневных тулов (пользователи, ноды, хосты, группы, статистика); остальной каталог доступен через три мета-тула: `search_api` → `get_api_schema` → `call_api`. Список тулов стоит ~3k токенов за сессию вместо ~55k. Ответы — компактный JSON (без отступов, без `null`-полей, без обёртки `{response: …}`) с ограничением размера.

### Возможности

- **199 операций** — все админские операции Remnawave 3.4.7: пользователи (вкл. массовые), ноды, хосты, подписки, шаблоны, группы (внутренние/внешние), HWID, конфиг-профили, inbounds, биллинг, сниппеты, настройки, страницы подписок, плагины нод, соединения, статистика трафика, метаданные
- **Режимы доступа** — `readonly` (89 тулов), `safe` (149 тулов, без деструктивных операций), `full` (все 199)
- **Честные MCP-аннотации** — каждый тул несёт `readOnlyHint`/`destructiveHint`; деструктивные операции требуют от агента подтверждения у вас, а `call_api` не выполнит их без `confirm: true`
- **4 ресурса** — статистика панели, статус нод, health-check в реальном времени
- **5 промптов** — пошаговые сценарии для типичных задач
- **Поддержка Caddy** — заголовок `X-Api-Key` для панелей за Caddy с кастомным путём
- **stdio транспорт** — работает с Claude Desktop, Cursor, Windsurf и любым MCP-совместимым клиентом

Намеренно не выставлено: логин/авторизация панели, passkeys, публичные эндпоинты подписок и управление API-токенами — агенту там делать нечего.

### Требования

- Node.js >= 22
- Панель Remnawave с API-токеном (Настройки > API Tokens)

### Установка

```bash
git clone https://github.com/TrackLine/mcp-remnawave.git
cd mcp-remnawave
npm install
npm run build
```

### Конфигурация

Создайте файл `.env` или передайте переменные окружения:

| Переменная | Обязательная | Описание |
|------------|-------------|----------|
| `REMNAWAVE_BASE_URL` | Да | URL панели (например `https://vpn.example.com`) |
| `REMNAWAVE_API_TOKEN` | Да | API-токен из настроек панели |
| `REMNAWAVE_API_KEY` | Нет | API-ключ для Caddy reverse proxy |
| `REMNAWAVE_MODE` | Нет | `readonly` \| `safe` \| `full` (по умолчанию `full`) |
| `REMNAWAVE_TOOLS` | Нет | Имена тулов через запятую для прямого показа, или `all` — каждая операция отдельным тулом (~55k токенов). По умолчанию встроенное ядро |
| `REMNAWAVE_MAX_RESPONSE_CHARS` | Нет | Обрезать ответы длиннее (по умолчанию `40000`) |
| `REMNAWAVE_TIMEOUT_MS` | Нет | Таймаут запроса к панели (по умолчанию `30000`) |

### Режимы доступа

| Режим | Операции | Что может агент |
|-------|------|-----------------|
| `readonly` | 89 | Только смотреть: списки, статистика, health, поиск |
| `safe` | 149 | Всё, кроме деструктивного: создавать пользователей/хосты/ноды, обновлять отдельные сущности, включать, продлевать. Нет удалений, массовых операций над пользователями, правок конфиг-профилей/шаблонов/настроек, рестартов нод и запуска плагинов |
| `full` | 199 | Всё. Деструктивные тулы помечены аннотациями и требуют от агента подтверждения перед вызовом |

Режим `safe` скрывает операции с отметкой destructive, включая синхронизацию сниппетов и плагинов. Остальные изменения тоже могут влиять на работающий сервис; этот режим не гарантирует безвредность правок.

`REMNAWAVE_READONLY` из v1.x заменён на `REMNAWAVE_MODE=readonly`; со старой переменной сервер завершится с понятной ошибкой.

### Caddy с кастомным путём

Если панель за [Caddy с кастомным путём и API-ключом](https://docs.remnawave.com/docs/security/caddy-with-custom-path/):

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=ваш-caddy-api-ключ
```

Заголовок `X-Api-Key` добавляется к каждому запросу автоматически.

### Использование с Claude Desktop / Cursor / Windsurf

Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS). Cursor/Windsurf: `.cursor/mcp.json` / `.windsurf/mcp.json`.

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/абсолютный/путь/к/mcp-remnawave/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "ваш-api-токен",
        "REMNAWAVE_MODE": "safe"
      }
    }
  }
}
```

### Docker

```bash
npm run build
docker compose up -d
```

### Инструменты

Имена тулов следуют глаголам API панели: `get_users`, `create_user`, `update_host`, `bulk_delete_users`, `restart_node`, `get_stats`, … Команда `npm run check` печатает полный каталог с флагом режима (R = чтение, W = запись, D = деструктивный) и API-маршрутом каждого тула.

Покрытие: 199 из 218 операций API; ядро показано напрямую, остальное через `call_api`. Исключены: авторизация (8), passkeys (5), публичные подписки (3), управление API-токенами (3). В API 3.4.5 добавлены интеграции нод, общие списки, задания geocheck, клонирование хостов, теги и синхронизация. Точный каталог: `npm run check`.

**Важное про Remnawave 3.x:** пользователи адресуются **числовым `id`**, а не UUID (`get_user_by_id`, `delete_user`, `get_user_hwid_devices` принимают `userId`). Найти id можно через `get_user_by_username`, `get_user_by_short_uuid` или `resolve_user`. Старые эндпоинты `/api/ip-control/*` стали тулами Connections (`request_user_connections` → `get_user_connections_result`, `drop_connections`).

### Ресурсы

| URI | Описание |
|-----|----------|
| `remnawave://stats` | Текущая статистика панели |
| `remnawave://nodes` | Статус всех нод |
| `remnawave://health` | Состояние здоровья панели |
| `remnawave://users/{userId}` | Данные конкретного пользователя (числовой ID) |

### Промпты

| Промпт | Описание |
|--------|----------|
| `create_user_wizard` | Пошаговое создание пользователя |
| `node_diagnostics` | Диагностика ноды |
| `traffic_report` | Отчёт по трафику |
| `user_audit` | Полный аудит пользователя |
| `bulk_user_cleanup` | Поиск и управление просроченными пользователями |

### Примеры запросов

```
«Покажи мне всех пользователей с истёкшей подпиской»
«Создай пользователя vasya с лимитом 50 ГБ на месяц»
«Перезапусти ноду amsterdam-01»
«Дай отчёт по трафику за последнюю неделю»
«Какие ноды сейчас офлайн?»
```

### Структура проекта

```
api-1.json        # OpenAPI-спека Remnawave — единственный источник истины
src/
├── index.ts      # Точка входа (stdio транспорт)
├── server.ts     # McpServer, ядро тулов + search_api/get_api_schema/call_api
├── tools.ts      # Генерация операций из спеки, ядро, поиск, режимы
├── client.ts     # HTTP-клиент
├── config.ts     # Конфигурация окружения
├── resources.ts  # MCP-ресурсы
└── prompts.ts    # MCP-промпты
scripts/
└── check.ts      # Печать каталога + самопроверка по спеке (npm run check)
```

### Лицензия

MIT

## 3.4.7 — token-lean refactor

- Remnawave API 3.4.7 spec (routes and schemas unchanged from 3.4.5).
- Hybrid tool surface: ~15 core tools + `search_api` / `get_api_schema` / `call_api`.
  tools/list dropped from ~55k to ~3k tokens. `REMNAWAVE_TOOLS=all` restores the old behaviour.
- Destructive operations via `call_api` require `confirm: true`.
- Compact responses (no indentation/nulls, envelope unwrapped) with a size cap; request timeout.
- Updated MCP SDK 1.32, zod 4, TypeScript 7, tsup 9; `npm run check` now type-checks and enforces a tools/list budget.

## 3.4.5 — API 3.4.5 compatibility

The API JSON was already updated to 3.4.5 in the existing 3.1.0 working tree.
This release updates the documentation and fixes empty 202/204 responses,
structured query parameters (JSON filters/sorting and deepObject filterModes),
and server-side argument validation using the MCP SDK validator.
Snippet/plugin/shared-list sync operations are now marked destructive and hidden
in safe mode. Existing tool names and authentication configuration are preserved.
`npm run check` verifies the catalog and exercises MCP requests with mocked HTTP;
it does not modify a live panel. Restart/reconnect the MCP server after updating.

MCP release numbering follows the supported Remnawave API version (3.4.5).
