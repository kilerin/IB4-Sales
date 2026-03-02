-- IB4Sales - Clear all data (keeps tables)
-- Run: psql $DATABASE_URL -f src/lib/clear-data.sql

TRUNCATE deals, clients, uploads RESTART IDENTITY CASCADE;
