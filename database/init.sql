-- Script de Inicialización de PostgreSQL 16 para MejoraWS y Evolution API
SELECT 'CREATE DATABASE evolution'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'evolution')\gexec

\c mejoraws;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Carga automática del esquema inicial
\i /docker-entrypoint-initdb.d/migrations/001_initial_schema.sql;
