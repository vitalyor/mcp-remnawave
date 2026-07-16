# mcp-remnawave

[English](#english) | [Русский](#русский)

---

<a id="english"></a>

## MCP Server for Remnawave Panel

MCP server ([Model Context Protocol](https://modelcontextprotocol.io)) providing LLM clients (Claude Desktop, Cursor, Windsurf, etc.) with tools to manage a [Remnawave](https://github.com/remnawave/) VPN panel.

**Version:** 2.0.0 | **Remnawave API:** 2.8.1

### How it works

All tools are **generated at startup directly from the panel's OpenAPI spec** ([api-1.json](api-1.json)). Tool names, parameters, and descriptions always match the API — there is nothing to keep in sync by hand. To support a newer panel, replace `api-1.json` with the new spec and rebuild.

### Features

- **167 tools** — every admin operation of Remnawave 2.8.1: users (incl. bulk), nodes, hosts, subscriptions, templates, squads (internal/external), HWID, config profiles, inbounds, billing, snippets, settings, subscription page configs, node plugins, IP control, bandwidth stats, metadata
- **Access modes** — `readonly` (77 tools), `safe` (123 tools, no destructive operations), `full` (all 167)
- **Honest MCP annotations** — every tool carries `readOnlyHint`/`destructiveHint`; the 44 destructive tools tell the agent to confirm with you first
- **3 resources** — real-time panel stats, node status, health checks
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

### Access modes

| Mode | Tools | What the agent can do |
|------|-------|-----------------------|
| `readonly` | 77 | Look, but not touch: lists, stats, health, lookups |
| `safe` | 123 | Everything except destructive operations: create users/hosts/nodes, update single entities, enable, extend. No deletes, no bulk user operations, no config-profile/template/settings edits, no node restarts, no plugin execution |
| `full` | 167 | Everything. Destructive tools are annotated and instruct the agent to confirm with you before calling |

Use `safe` when giving an agent free rein (auto-approved tool calls): it physically cannot mass-delete users, wipe nodes, or break the xray config, because those tools are not registered.

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

Tool names follow the panel API verbs: `get_all_users`, `create_user`, `update_host`, `bulk_delete_users`, `restart_node`, `get_stats`, … Run `npm run check` to print the full catalog with each tool's mode flag (R = readonly, W = write, D = destructive) and its API route.

Coverage by area (167 total): Users 20 + 10 bulk, Nodes 15, Billing 12, Node Plugins 11, Config Profiles 9, Internal Squads 9, System 9, External Squads 8, Hosts 7 + 4 bulk, Subscriptions 7, HWID 7, Page Configs 7, Templates 6, Bandwidth Stats 6, IP Control 5, Snippets 4, Metadata 4, Settings 2+2, Request History 2, Keygen 1.

### Resources

| URI | Description |
|-----|-------------|
| `remnawave://stats` | Current panel statistics |
| `remnawave://nodes` | All nodes status |
| `remnawave://health` | Panel health status |
| `remnawave://users/{uuid}` | Specific user details |

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
├── server.ts     # McpServer + generic tool dispatch
├── tools.ts      # Tool generation from the spec, modes, destructive list
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

**Версия:** 2.0.0 | **Remnawave API:** 2.8.1

### Как это устроено

Все тулы **генерируются при старте напрямую из OpenAPI-спеки панели** ([api-1.json](api-1.json)). Имена, параметры и описания всегда совпадают с API — синхронизировать вручную нечего. Для поддержки новой версии панели достаточно заменить `api-1.json` и пересобрать.

### Возможности

- **167 инструментов** — все админские операции Remnawave 2.8.1: пользователи (вкл. массовые), ноды, хосты, подписки, шаблоны, группы (внутренние/внешние), HWID, конфиг-профили, inbounds, биллинг, сниппеты, настройки, страницы подписок, плагины нод, IP-контроль, статистика трафика, метаданные
- **Режимы доступа** — `readonly` (77 тулов), `safe` (123 тула, без деструктивных операций), `full` (все 167)
- **Честные MCP-аннотации** — каждый тул несёт `readOnlyHint`/`destructiveHint`; 44 деструктивных тула требуют от агента подтверждения у вас
- **3 ресурса** — статистика панели, статус нод, health-check в реальном времени
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

### Режимы доступа

| Режим | Тулы | Что может агент |
|-------|------|-----------------|
| `readonly` | 77 | Только смотреть: списки, статистика, health, поиск |
| `safe` | 123 | Всё, кроме деструктивного: создавать пользователей/хосты/ноды, обновлять отдельные сущности, включать, продлевать. Нет удалений, массовых операций над пользователями, правок конфиг-профилей/шаблонов/настроек, рестартов нод и запуска плагинов |
| `full` | 167 | Всё. Деструктивные тулы помечены аннотациями и требуют от агента подтверждения перед вызовом |

Используйте `safe`, когда даёте агенту карт-бланш (авто-подтверждение вызовов): он физически не сможет массово удалить пользователей, снести ноды или сломать xray-конфиг — этих тулов просто нет.

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

Имена тулов следуют глаголам API панели: `get_all_users`, `create_user`, `update_host`, `bulk_delete_users`, `restart_node`, `get_stats`, … Команда `npm run check` печатает полный каталог с флагом режима (R = чтение, W = запись, D = деструктивный) и API-маршрутом каждого тула.

Покрытие по областям (всего 167): пользователи 20 + 10 массовых, ноды 15, биллинг 12, плагины нод 11, конфиг-профили 9, внутренние группы 9, система 9, внешние группы 8, хосты 7 + 4 массовых, подписки 7, HWID 7, страницы подписок 7, шаблоны 6, статистика трафика 6, IP-контроль 5, сниппеты 4, метаданные 4, настройки 2+2, история запросов 2, keygen 1.

### Ресурсы

| URI | Описание |
|-----|----------|
| `remnawave://stats` | Текущая статистика панели |
| `remnawave://nodes` | Статус всех нод |
| `remnawave://health` | Состояние здоровья панели |
| `remnawave://users/{uuid}` | Данные конкретного пользователя |

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
├── server.ts     # McpServer + универсальный диспетчер тулов
├── tools.ts      # Генерация тулов из спеки, режимы, деструктивный список
├── client.ts     # HTTP-клиент
├── config.ts     # Конфигурация окружения
├── resources.ts  # MCP-ресурсы
└── prompts.ts    # MCP-промпты
scripts/
└── check.ts      # Печать каталога + самопроверка по спеке (npm run check)
```

### Лицензия

MIT
