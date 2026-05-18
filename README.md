# Mini-CRM

Mini-CRM для управления клиентами, сделками и продажами в розничном магазине.

**Стек серверной части:** Python · FastAPI · PostgreSQL · SQLAlchemy async · Alembic · JWT

**Стек клиентской части:** React 18 · TypeScript · Vite · React Router · Axios · Zustand · TanStack Query · Tailwind CSS

---

## Содержание

- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Структура проекта](#структура-проекта)
- [Роли и доступ](#роли-и-доступ)
- [API](#api)
- [Тесты](#тесты)
- [Переменные окружения](#переменные-окружения)

---

## Требования

- Python 3.11+
- PostgreSQL 14+
- Node.js 20+

---

## Быстрый старт

### 1. Клонирование и виртуальное окружение

```bash
git clone <repo-url>
cd mini_CRM

python3 -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows
```

### 2. Зависимости

```bash
pip install -r requirements.txt
```

### 3. Переменные окружения

```bash
cp .env.example .env
```

Откройте `.env` и укажите ваши значения:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/mini_crm
SECRET_KEY=your-secret-key-min-32-chars
```

### 4. База данных

```bash
# Создать БД
createdb -U postgres mini_crm

# Применить миграции
alembic upgrade head
```

### 5. Запуск

```bash
DEBUG=false uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Сервер доступен по адресу: **http://localhost:8000**

| URL | Описание |
|-----|----------|
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Проверка состояния |

### 6. Клиентская часть

```bash
cd frontend
npm install
npm run dev
```

Клиентская часть доступна по адресу: **http://localhost:3000**

---

## Docker

```bash
docker compose up --build
```

Сервисы:

| Сервис | URL |
|--------|-----|
| Клиентская часть | http://localhost:3000 |
| Сервер | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

---

## Makefile

```bash
make migrate
make seed-demo
make backend
make frontend
make test
make lint
make build
make docker-up
```

---

## Первый пользователь

Первый зарегистрированный пользователь автоматически получает роль **Admin**, независимо от переданной роли.

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secret123", "full_name": "Admin"}'
```

После регистрации — создайте начальные стадии воронки:

```bash
# Получить токен
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secret123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Сидировать стадии
curl -X POST http://localhost:8000/api/v1/stages/seed \
  -H "Authorization: Bearer $TOKEN"
```

---

## Демо-данные

Для наглядной проверки можно заполнить базу тестовыми пользователями, клиентами, сделками, задачами и активностями:

```bash
DEBUG=false python -m scripts.seed_demo
```

Логины после заполнения:

| Роль | Почта | Пароль |
|------|-------|--------|
| Администратор | `admin@test.com` | `demo12345` |
| Менеджер | `manager@test.com` | `demo12345` |
| Продажи | `sales@test.com` | `demo12345` |

Демо-заполнение идемпотентное: повторный запуск не создает дубли по пользователям, клиентам, сделкам, задачам и активностям.

---

## Откуда берутся данные

Клиентская часть не хранит бизнес-данные сама. Она получает их из серверного REST API через Axios:

| Экран | Источник данных |
|-------|-----------------|
| Вход | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` |
| Дашборд | `GET /api/v1/reports/funnel`, `GET /api/v1/activities/`, `GET /api/v1/clients/` |
| Клиенты | `GET/POST/PATCH/DELETE /api/v1/clients/` |
| Сделки | `GET/POST/PATCH/DELETE /api/v1/deals/`, `GET /api/v1/stages/` |
| Задачи | `GET/POST/PATCH/DELETE /api/v1/tasks/` |
| Активности | `GET/POST /api/v1/activities/` |
| Отчеты | `GET /api/v1/reports/funnel` |
| Пользователи | `GET/PATCH/DELETE /api/v1/users/`, `POST /api/v1/auth/register` |
| Имена пользователей и фильтры | `GET /api/v1/users/options` |
| Stages | `GET/POST/PATCH/DELETE /api/v1/stages/`, `PUT /api/v1/stages/reorder` |

PostgreSQL является основным источником данных. React Query кэширует ответы на фронте, но после мутаций инвалидирует соответствующие запросы и перечитывает актуальные данные из API.

---

## Структура проекта

```
mini_CRM/
├── app/
│   ├── main.py               # FastAPI app, CORS, healthcheck
│   ├── core/
│   │   ├── config.py         # Настройки из .env
│   │   ├── database.py       # Async SQLAlchemy engine и сессия
│   │   ├── security.py       # JWT токены, bcrypt
│   │   ├── dependencies.py   # get_current_user, require_roles
│   │   ├── exceptions.py     # HTTP-исключения (400/401/403/404)
│   │   └── constants.py      # Enum: UserRole, ActivityType
│   ├── models/               # SQLAlchemy модели
│   ├── schemas/              # Pydantic схемы (Create/Update/Read)
│   ├── repositories/         # Слой доступа к данным (SQL-запросы)
│   ├── services/             # Бизнес-логика, ownership checks
│   └── api/v1/               # HTTP-роутеры
├── alembic/                  # Миграции БД
├── tests/                    # pytest тесты
├── scripts/
│   └── seed_demo.py          # demo-данные для ручной проверки
├── frontend/                 # React frontend
├── docker-compose.yml
├── Dockerfile
├── Makefile
├── docs/
│   └── PRD.md                # Product Requirements Document
├── .env.example
├── requirements.txt
└── pytest.ini
```

---

## Роли и доступ

| Роль | Описание |
|------|----------|
| **Admin** | Полный доступ: управление пользователями, стадиями, всеми данными |
| **Manager** | Видит все сделки и клиентов, назначает ответственных, смотрит отчёты |
| **Sales** | Работает только со своими клиентами, сделками, задачами и активностями |

---

## API

Все маршруты с префиксом `/api/v1`.

### Auth

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/auth/register` | Регистрация |
| `POST` | `/auth/login` | Вход → access + refresh токены |
| `POST` | `/auth/refresh` | Обновление токенов |
| `GET` | `/auth/me` | Текущий пользователь |

### Users (Admin only)

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `GET` | `/users/` | Список пользователей |
| `GET` | `/users/options` | Безопасный список активных пользователей для фильтров (Admin/Manager) |
| `GET` | `/users/{id}` | Один пользователь |
| `PATCH` | `/users/{id}` | Обновить (роль, статус) |
| `DELETE` | `/users/{id}` | Деактивировать |

### Clients

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/clients/` | Создать клиента |
| `GET` | `/clients/` | Список (с поиском и пагинацией) |
| `GET` | `/clients/{id}` | Один клиент |
| `PATCH` | `/clients/{id}` | Обновить |
| `DELETE` | `/clients/{id}` | Удалить |

Параметры поиска: `?search=name&page=1&per_page=20`

### Stages (Admin only для создания/изменения/удаления)

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/stages/seed` | Создать стандартные стадии |
| `GET` | `/stages/` | Список стадий |
| `POST` | `/stages/` | Создать стадию |
| `PATCH` | `/stages/{id}` | Обновить |
| `DELETE` | `/stages/{id}` | Удалить (запрещено если есть сделки) |
| `PUT` | `/stages/reorder` | Изменить порядок |

### Deals

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/deals/` | Создать сделку |
| `GET` | `/deals/` | Список (с фильтрами) |
| `GET` | `/deals/{id}` | Одна сделка |
| `PATCH` | `/deals/{id}` | Обновить (смена стадии → auto closed_at) |
| `DELETE` | `/deals/{id}` | Удалить |

Фильтры: `?stage_id=1&client_id=2&amount_min=1000&amount_max=50000`

### Tasks

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/tasks/` | Создать задачу |
| `GET` | `/tasks/` | Список (с фильтрами) |
| `GET` | `/tasks/{id}` | Одна задача |
| `PATCH` | `/tasks/{id}` | Обновить |
| `PATCH` | `/tasks/{id}/complete` | Отметить выполненной |
| `DELETE` | `/tasks/{id}` | Удалить |

### Activities (лог — только запись и чтение)

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `POST` | `/activities/` | Записать активность (`call`, `email`, `meeting`, `note`) |
| `GET` | `/activities/` | Список |
| `GET` | `/activities/{id}` | Одна запись |

### Reports

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `GET` | `/reports/funnel` | Отчёт по воронке продаж |

Фильтры: `?date_from=2024-01-01&date_to=2024-12-31&owner_id=3`

---

## Тесты

```bash
pytest
pytest -v
pytest tests/test_auth.py -v
```

Тесты используют временную SQLite-базу на каждый тест — PostgreSQL для запуска серверных тестов не нужен.

Клиентская часть:

```bash
cd frontend
npm run lint
npm run build
npm run test:e2e
```

Для e2e нужен запущенный сервер на `http://localhost:8000` и демо-данные из `scripts.seed_demo`.

### Покрытие тестами

| Файл | Что тестируется |
|------|----------------|
| `test_auth.py` | Регистрация, логин, refresh, /me, 401 без токена |
| `test_users.py` | RBAC: Admin управляет пользователями, Sales → 403 |
| `test_clients.py` | Ownership, поиск, пагинация |
| `test_deals.py` | Стадии, переход в «Успешно закрыта», `closed_at`, защита удаления стадий |
| `test_stages.py` | Базовые стадии, RBAC, порядок, удаление с защитой |
| `test_tasks.py` | CRUD, выполнение, владение |
| `test_activities.py` | Неизменяемость лога, RBAC, фильтры |
| `test_reports.py` | Суммы, конверсия, изоляция данных продаж |

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `DATABASE_URL` | — | URL подключения к PostgreSQL |
| `SECRET_KEY` | — | Секрет для JWT (мин. 32 символа) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Срок жизни access-токена |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Срок жизни refresh-токена |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `300` | Лимит запросов к auth endpoints с одного IP/path за минуту |
| `ALGORITHM` | `HS256` | Алгоритм JWT |
| `APP_NAME` | `Mini-CRM` | Название приложения |
| `DEBUG` | `false` | Режим отладки (SQL-логи) |
| `CORS_ORIGINS` | `["http://localhost:3000","http://127.0.0.1:3000"]` | Разрешённые origins |

---

## Миграции

```bash
# Создать новую миграцию после изменения моделей
alembic revision --autogenerate -m "описание изменения"

# Применить все миграции
alembic upgrade head

# Откатить последнюю миграцию
alembic downgrade -1

# Статус миграций
alembic current
```
