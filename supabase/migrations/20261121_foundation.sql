-- NiketDigital.ai foundation migration — 2026-11-21
-- This file is identical in content to supabase/schema.sql (the single source
-- of truth for a fresh project). Run EITHER schema.sql OR this migration in
-- the Supabase SQL Editor — not both at once on the same project, although
-- every statement here is idempotent (create table if not exists / drop policy
-- if exists / on conflict do nothing), so re-running it is safe.
-- See schema.sql for the full commented definitions, RLS policies and plan seed.
-- DO NOT run this against a live project until Niket confirms the Supabase
-- project for NiketDigital.ai (separate from AdGenius AI).
\i ../schema.sql
