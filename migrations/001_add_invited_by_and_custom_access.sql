-- Migration 001 — Campos novos em user_profiles
-- Pré-requisito: supabase-schema.sql + fix-rls-recursion.sql já executados
-- Seguro re-executar: usa IF NOT EXISTS / IF NOT EXISTS em índices

-- 1. Rastreamento de quem convidou (UUID FK, nullable para usuários pré-existentes)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS invited_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Nome do convitador para exibição (texto, evita JOIN na lista de usuários)
--    Pode já existir no banco ao vivo — ADD COLUMN IF NOT EXISTS é seguro
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS invited_by_name TEXT;

-- 3. Flag de personalização de acesso (desligado por padrão — preserva comportamento atual)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS custom_access_enabled BOOLEAN NOT NULL DEFAULT false;

-- 4. Índice para queries "quem esse admin convidou" (usado nas funções RLS)
CREATE INDEX IF NOT EXISTS idx_user_profiles_invited_by_id
  ON user_profiles(invited_by_id);

-- 5. Índice para queries de personalização ativa
CREATE INDEX IF NOT EXISTS idx_user_profiles_custom_access
  ON user_profiles(custom_access_enabled)
  WHERE custom_access_enabled = true;
