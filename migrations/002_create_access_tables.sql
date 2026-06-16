-- Migration 002 — Tabelas de acesso personalizado
-- Pré-requisito: migration 001 executada

-- ─────────────────────────────────────────────
-- Tabela: user_company_access
-- Empresas explicitamente liberadas para usuários com personalização ativa.
-- Modelo de inclusão: o usuário só vê o que está aqui.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_company_access (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id)   ON DELETE CASCADE,
  granted_by  UUID          REFERENCES auth.users(id)  ON DELETE SET NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, company_id)
);

-- ─────────────────────────────────────────────
-- Tabela: user_credential_exceptions
-- Credenciais explicitamente ocultadas para um usuário.
-- Modelo de exclusão: dentro de uma empresa liberada, o usuário vê tudo exceto o que está aqui.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_credential_exceptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES credentials(id)  ON DELETE CASCADE,
  created_by    UUID          REFERENCES auth.users(id)   ON DELETE SET NULL,  -- auditoria (decisão #3)
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (user_id, credential_id)
);

-- ─────────────────────────────────────────────
-- Índices para as subqueries de visibilidade usadas nas políticas RLS
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uca_user_id        ON user_company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uca_company_id     ON user_company_access(company_id);
CREATE INDEX IF NOT EXISTS idx_uce_user_id        ON user_credential_exceptions(user_id);
CREATE INDEX IF NOT EXISTS idx_uce_credential_id  ON user_credential_exceptions(credential_id);

-- ─────────────────────────────────────────────
-- Realtime — necessário para logout imediato (decisão #1)
-- Habilita publicação das tabelas no canal realtime do Supabase.
-- ATENÇÃO: confirme também em Dashboard → Database → Replication que
--          user_profiles e user_company_access estão marcadas.
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_company_access;

-- REPLICA IDENTITY FULL permite que o Supabase filtre eventos DELETE por coluna.
-- Sem isso, o filtro "user_id=eq.X" não funciona em DELETEs no canal Realtime.
ALTER TABLE user_company_access REPLICA IDENTITY FULL;
