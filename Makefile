.PHONY: backend frontend migrate seed-demo test lint build docker-up docker-down

backend:
	DEBUG=false uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

migrate:
	DEBUG=false alembic upgrade head

seed-demo:
	DEBUG=false python -m scripts.seed_demo

test:
	DEBUG=false pytest

lint:
	cd frontend && npm run lint

build:
	cd frontend && npm run build

docker-up:
	docker compose up --build

docker-down:
	docker compose down
