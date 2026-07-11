.PHONY: install db-migrate db-seed data-generate ml-train rag-ingest evaluate bootstrap dev test build

install:
	npm install
	cd backend && npm install
	cd frontend && npm install
	python -m venv ai-service/.venv
	./ai-service/.venv/Scripts/pip install -r ai-service/requirements.txt

db-migrate:
	cd backend && npx prisma db push

db-seed:
	cd backend && npx ts-node prisma/seed.ts

data-generate:
	./ai-service/.venv/Scripts/python -m app.scripts.generate_data

ml-train:
	./ai-service/.venv/Scripts/python -m app.scripts.train_models

rag-ingest:
	./ai-service/.venv/Scripts/python -m app.scripts.ingest_rag

evaluate:
	./ai-service/.venv/Scripts/python -m app.scripts.evaluate

bootstrap:
	docker compose up -d mysql
	npm run db:migrate
	npm run db:seed
	npm run data:generate
	npm run ml:train
	npm run rag:ingest
	npm run evaluate

dev:
	npm run dev

test:
	npm run test

build:
	npm run build
