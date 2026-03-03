# mcp-remnawave 

[English](#english) | [Русский](#русский)

---

<a id="english"></a>

## MCP Server for Remnawave Panel

MCP server ([Model Context Protocol](https://modelcontextprotocol.io)) providing LLM clients (Claude Desktop, Cursor, Windsurf, etc.) with tools to manage a [Remnawave](https://github.com/remnawave/) VPN panel.

### Features

- **51 tools** — full management of users, nodes, hosts, subscriptions, squads, HWID devices, and system
- **3 resources** — real-time panel stats, node status, health checks
- **5 prompts** — guided workflows for common tasks
- **Readonly mode** — restrict to read-only operations for safe monitoring
- **Caddy support** — `X-Api-Key` header for panels behind Caddy with custom path
- **Type-safe** — built on [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract) for API route validation
- **stdio transport** — works with Claude Desktop, Cursor, Windsurf, and any MCP-compatible client

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
| `REMNAWAVE_READONLY` | No | Set to `true` to enable readonly mode |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=your-api-token-here
```

### Caddy with Custom Path

If your Remnawave panel is deployed behind [Caddy with a custom path and API key protection](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), set the base URL to include the custom path and provide the API key:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=your-caddy-api-key
```

The `X-Api-Key` header will be added to every request automatically.

### Readonly Mode

Set `REMNAWAVE_READONLY=true` to disable all write operations (create, update, delete, enable, disable, restart, revoke, reset). Only read/list tools will be registered.

Useful for monitoring dashboards or shared environments where you want to prevent accidental changes.

In readonly mode, the available tools are reduced from 51 to 21:

| Category | Available tools |
|----------|----------------|
| Users | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid` |
| Nodes | `nodes_list`, `nodes_get` |
| Hosts | `hosts_list`, `hosts_get` |
| System | all 8 tools (read-only by nature) |
| Subscriptions | all 5 tools (read-only by nature) |
| Config Profiles | all 2 tools (read-only by nature) |
| Squads | `squads_list` |
| HWID | `hwid_devices_list` |

### Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/absolute/path/to/remnawave-mcp/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "your-api-token-here",
        "REMNAWAVE_API_KEY": "your-caddy-api-key",
        "REMNAWAVE_READONLY": "false"
      }
    }
  }
}
```

### Usage with Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json` in your project:

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/absolute/path/to/remnawave-mcp/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "your-api-token-here",
        "REMNAWAVE_API_KEY": "your-caddy-api-key",
        "REMNAWAVE_READONLY": "false"
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

Environment variables are passed via `.env` file or `docker-compose.yml`.

### Available Tools

#### Users (11 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `users_list` | List all users with pagination | read |
| `users_get` | Get user by UUID | read |
| `users_get_by_username` | Get user by username | read |
| `users_get_by_short_uuid` | Get user by short UUID | read |
| `users_create` | Create a new user | write |
| `users_update` | Update user settings | write |
| `users_delete` | Delete a user | write |
| `users_enable` | Enable a disabled user | write |
| `users_disable` | Disable a user | write |
| `users_revoke_subscription` | Revoke subscription (regenerate link) | write |
| `users_reset_traffic` | Reset traffic counter | write |

#### Nodes (11 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `nodes_list` | List all nodes | read |
| `nodes_get` | Get node by UUID | read |
| `nodes_create` | Create a new node | write |
| `nodes_update` | Update node settings | write |
| `nodes_delete` | Delete a node | write |
| `nodes_enable` | Enable a node | write |
| `nodes_disable` | Disable a node | write |
| `nodes_restart` | Restart a specific node | write |
| `nodes_restart_all` | Restart all nodes | write |
| `nodes_reset_traffic` | Reset node traffic counter | write |
| `nodes_reorder` | Reorder nodes | write |

#### Hosts (5 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `hosts_list` | List all hosts | read |
| `hosts_get` | Get host by UUID | read |
| `hosts_create` | Create a new host | write |
| `hosts_update` | Update host settings | write |
| `hosts_delete` | Delete a host | write |

#### System (8 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `system_stats` | Panel statistics (users, nodes, traffic, CPU, memory) | read |
| `system_bandwidth_stats` | Bandwidth statistics | read |
| `system_nodes_metrics` | Node metrics | read |
| `system_nodes_statistics` | Node statistics | read |
| `system_health` | Panel health check | read |
| `system_metadata` | Panel version and metadata | read |
| `system_generate_x25519` | Generate X25519 key pair | read |
| `auth_status` | Check authentication status | read |

#### Subscriptions (5 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `subscriptions_list` | List all subscriptions | read |
| `subscriptions_get_by_uuid` | Get subscription by UUID | read |
| `subscriptions_get_by_username` | Get subscription by username | read |
| `subscriptions_get_by_short_uuid` | Get subscription by short UUID | read |
| `subscription_info` | Get subscription info | read |

#### Config Profiles & Inbounds (2 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `config_profiles_list` | List config profiles | read |
| `inbounds_list` | List all inbounds | read |

#### Internal Squads (6 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `squads_list` | List all squads | read |
| `squads_create` | Create a squad | write |
| `squads_update` | Update a squad | write |
| `squads_delete` | Delete a squad | write |
| `squads_add_users` | Add users to a squad | write |
| `squads_remove_users` | Remove users from a squad | write |

#### HWID Devices (3 tools)

| Tool | Description | Mode |
|------|-------------|------|
| `hwid_devices_list` | List user's HWID devices | read |
| `hwid_device_delete` | Delete a specific device | write |
| `hwid_devices_delete_all` | Delete all user's devices | write |

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
"Disable users who exceeded their traffic limit"
"Which nodes are offline right now?"
```

### Project Structure

```
src/
├── index.ts              # Entry point (stdio transport)
├── server.ts             # McpServer setup
├── config.ts             # Environment config
├── client/
│   └── index.ts          # Remnawave HTTP client
├── tools/
│   ├── helpers.ts        # Result formatting helpers
│   ├── index.ts          # Tool registration
│   ├── users.ts          # User management
│   ├── nodes.ts          # Node management
│   ├── hosts.ts          # Host management
│   ├── system.ts         # System & auth
│   ├── subscriptions.ts  # Subscriptions
│   ├── inbounds.ts       # Config profiles & inbounds
│   ├── squads.ts         # Internal squads
│   └── hwid.ts           # HWID devices
├── resources/
│   └── index.ts          # MCP resources
└── prompts/
    └── index.ts          # MCP prompts
```

### License

MIT

---

<a id="русский"></a>

## MCP-сервер для Remnawave Panel

MCP-сервер ([Model Context Protocol](https://modelcontextprotocol.io)), предоставляющий LLM-клиентам (Claude Desktop, Cursor, Windsurf и др.) инструменты для управления VPN-панелью [Remnawave](https://github.com/remnawave/).

### Возможности

- **51 инструмент** — полное управление пользователями, нодами, хостами, подписками, группами, HWID-устройствами и системой
- **3 ресурса** — статистика панели, статус нод, проверка здоровья в реальном времени
- **5 промптов** — пошаговые сценарии для типичных задач
- **Readonly-режим** — ограничение только чтением для безопасного мониторинга
- **Поддержка Caddy** — заголовок `X-Api-Key` для панелей за Caddy с кастомным путём
- **Type-safe** — построен на [@remnawave/backend-contract](https://www.npmjs.com/package/@remnawave/backend-contract) для валидации API-маршрутов
- **stdio транспорт** — работает с Claude Desktop, Cursor, Windsurf и любым MCP-совместимым клиентом

### Требования

- Node.js >= 22
- Remnawave панель с API-токеном (Настройки > API Tokens)

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
| `REMNAWAVE_API_KEY` | Нет | API-ключ для аутентификации через Caddy reverse proxy |
| `REMNAWAVE_READONLY` | Нет | `true` для включения режима только чтения |

```env
REMNAWAVE_BASE_URL=https://vpn.example.com
REMNAWAVE_API_TOKEN=ваш-api-токен
```

### Caddy с кастомным путём

Если ваша панель Remnawave развёрнута за [Caddy с кастомным путём и защитой API-ключом](https://docs.remnawave.com/docs/security/caddy-with-custom-path/), укажите полный путь в base URL и предоставьте API-ключ:

```env
REMNAWAVE_BASE_URL=https://example.com/your-secret-path/api
REMNAWAVE_API_KEY=ваш-caddy-api-ключ
```

Заголовок `X-Api-Key` будет автоматически добавляться к каждому запросу.

### Режим Readonly

Установите `REMNAWAVE_READONLY=true`, чтобы отключить все операции записи (создание, обновление, удаление, включение, отключение, перезапуск, отзыв, сброс). Будут зарегистрированы только инструменты чтения.

Полезно для мониторинговых дашбордов или общих окружений, где нужно исключить случайные изменения.

В readonly-режиме количество доступных инструментов сокращается с 51 до 21:

| Категория | Доступные инструменты |
|-----------|----------------------|
| Пользователи | `users_list`, `users_get`, `users_get_by_username`, `users_get_by_short_uuid` |
| Ноды | `nodes_list`, `nodes_get` |
| Хосты | `hosts_list`, `hosts_get` |
| Система | все 8 инструментов (только чтение по своей природе) |
| Подписки | все 5 инструментов (только чтение по своей природе) |
| Конфиг-профили | все 2 инструмента (только чтение по своей природе) |
| Группы | `squads_list` |
| HWID | `hwid_devices_list` |

### Использование с Claude Desktop

Добавьте в конфигурацию Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` на macOS):

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/абсолютный/путь/к/remnawave-mcp/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "ваш-api-токен",
        "REMNAWAVE_API_KEY": "ваш-caddy-api-ключ",
        "REMNAWAVE_READONLY": "false"
      }
    }
  }
}
```

### Использование с Cursor / Windsurf

Добавьте в `.cursor/mcp.json` или `.windsurf/mcp.json` вашего проекта:

```json
{
  "mcpServers": {
    "remnawave": {
      "command": "node",
      "args": ["/абсолютный/путь/к/remnawave-mcp/dist/index.js"],
      "env": {
        "REMNAWAVE_BASE_URL": "https://vpn.example.com",
        "REMNAWAVE_API_TOKEN": "ваш-api-токен",
        "REMNAWAVE_API_KEY": "ваш-caddy-api-ключ",
        "REMNAWAVE_READONLY": "false"
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

Переменные окружения передаются через `.env` файл или `docker-compose.yml`.

### Доступные инструменты

#### Пользователи (11 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `users_list` | Список пользователей с пагинацией | read |
| `users_get` | Получить пользователя по UUID | read |
| `users_get_by_username` | Получить пользователя по username | read |
| `users_get_by_short_uuid` | Получить пользователя по short UUID | read |
| `users_create` | Создать нового пользователя | write |
| `users_update` | Обновить настройки пользователя | write |
| `users_delete` | Удалить пользователя | write |
| `users_enable` | Включить пользователя | write |
| `users_disable` | Отключить пользователя | write |
| `users_revoke_subscription` | Отозвать подписку (перегенерировать ссылку) | write |
| `users_reset_traffic` | Сбросить счётчик трафика | write |

#### Ноды (11 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `nodes_list` | Список всех нод | read |
| `nodes_get` | Получить ноду по UUID | read |
| `nodes_create` | Создать новую ноду | write |
| `nodes_update` | Обновить настройки ноды | write |
| `nodes_delete` | Удалить ноду | write |
| `nodes_enable` | Включить ноду | write |
| `nodes_disable` | Отключить ноду | write |
| `nodes_restart` | Перезапустить ноду | write |
| `nodes_restart_all` | Перезапустить все ноды | write |
| `nodes_reset_traffic` | Сбросить трафик ноды | write |
| `nodes_reorder` | Переупорядочить ноды | write |

#### Хосты (5 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `hosts_list` | Список всех хостов | read |
| `hosts_get` | Получить хост по UUID | read |
| `hosts_create` | Создать новый хост | write |
| `hosts_update` | Обновить настройки хоста | write |
| `hosts_delete` | Удалить хост | write |

#### Система (8 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `system_stats` | Статистика панели (пользователи, ноды, трафик, CPU, память) | read |
| `system_bandwidth_stats` | Статистика пропускной способности | read |
| `system_nodes_metrics` | Метрики нод | read |
| `system_nodes_statistics` | Статистика нод | read |
| `system_health` | Проверка здоровья панели | read |
| `system_metadata` | Версия и метаданные панели | read |
| `system_generate_x25519` | Генерация пары ключей X25519 | read |
| `auth_status` | Проверка статуса аутентификации | read |

#### Подписки (5 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `subscriptions_list` | Список всех подписок | read |
| `subscriptions_get_by_uuid` | Подписка по UUID | read |
| `subscriptions_get_by_username` | Подписка по username | read |
| `subscriptions_get_by_short_uuid` | Подписка по short UUID | read |
| `subscription_info` | Информация о подписке | read |

#### Конфиг-профили и Inbounds (2 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `config_profiles_list` | Список конфиг-профилей | read |
| `inbounds_list` | Список всех inbounds | read |

#### Внутренние группы (6 инструментов)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `squads_list` | Список групп | read |
| `squads_create` | Создать группу | write |
| `squads_update` | Обновить группу | write |
| `squads_delete` | Удалить группу | write |
| `squads_add_users` | Добавить пользователей в группу | write |
| `squads_remove_users` | Убрать пользователей из группы | write |

#### HWID-устройства (3 инструмента)

| Инструмент | Описание | Режим |
|------------|----------|-------|
| `hwid_devices_list` | Список устройств пользователя | read |
| `hwid_device_delete` | Удалить конкретное устройство | write |
| `hwid_devices_delete_all` | Удалить все устройства пользователя | write |

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
«Отключи пользователей, которые превысили лимит трафика»
«Какие ноды сейчас офлайн?»
```

### Структура проекта

```
src/
├── index.ts              # Точка входа (stdio транспорт)
├── server.ts             # Настройка McpServer
├── config.ts             # Конфигурация окружения
├── client/
│   └── index.ts          # HTTP-клиент Remnawave
├── tools/
│   ├── helpers.ts        # Хелперы форматирования
│   ├── index.ts          # Регистрация инструментов
│   ├── users.ts          # Управление пользователями
│   ├── nodes.ts          # Управление нодами
│   ├── hosts.ts          # Управление хостами
│   ├── system.ts         # Система и авторизация
│   ├── subscriptions.ts  # Подписки
│   ├── inbounds.ts       # Конфиг-профили и inbounds
│   ├── squads.ts         # Внутренние группы
│   └── hwid.ts           # HWID-устройства
├── resources/
│   └── index.ts          # MCP-ресурсы
└── prompts/
    └── index.ts          # MCP-промпты
```

### Лицензия

MIT
