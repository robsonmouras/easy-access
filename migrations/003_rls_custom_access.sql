-- Migration 003 — Políticas RLS para acesso personalizado
-- Pré-requisito: migrations 001 e 002 executadas
-- Padrão: todas as funções usam SECURITY DEFINER para evitar recursão (igual ao padrão já adotado)

-- ═══════════════════════════════════════════════════════
-- FUNÇÕES HELPER
-- ═══════════════════════════════════════════════════════

-- Verifica se um usuário tem personalização de acesso ativa
CREATE OR REPLACE FUNCTION has_custom_access(target_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(custom_access_enabled, false)
  FROM user_profiles
  WHERE id = target_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Verifica se o usuário autenticado pode gerenciar o ESCOPO GERAL de target_id
-- Regra HU1/HU2 (gestão geral do escopo):
--   super_admin → qualquer usuário
--   admin       → somente básicos que ELE mesmo convidou (invited_by_id = auth.uid())
CREATE OR REPLACE FUNCTION can_manage_user_scope(target_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  my_role        TEXT;
  target_role    TEXT;
  target_inviter UUID;
BEGIN
  my_role := get_user_role(auth.uid());

  IF my_role = 'super_admin' THEN
    RETURN true;
  END IF;

  IF my_role = 'admin' THEN
    SELECT role, invited_by_id
      INTO target_role, target_inviter
      FROM user_profiles
     WHERE id = target_id;

    RETURN target_role = 'básico' AND target_inviter = auth.uid();
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════
-- COMPANIES — substituir política SELECT
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;

-- Nova política de leitura:
--   super_admin        → vê todas (personalização nunca se aplica, regra de negócio §4)
--   custom_access=false → vê todas (comportamento atual preservado)
--   custom_access=true  → vê apenas as empresas presentes em user_company_access
CREATE POLICY "Companies visibility with custom access" ON companies
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      is_super_admin(auth.uid())
      OR NOT has_custom_access(auth.uid())
      OR EXISTS (
        SELECT 1
          FROM user_company_access
         WHERE user_id    = auth.uid()
           AND company_id = companies.id
      )
    )
  );


-- ═══════════════════════════════════════════════════════
-- CREDENTIALS — substituir política SELECT
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view credentials" ON credentials;

-- Nova política de leitura:
--   super_admin        → vê todas
--   custom_access=false → vê todas
--   custom_access=true  → vê credencial SOMENTE SE:
--       empresa está liberada em user_company_access
--       E credencial NÃO está em user_credential_exceptions
CREATE POLICY "Credentials visibility with custom access" ON credentials
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      is_super_admin(auth.uid())
      OR NOT has_custom_access(auth.uid())
      OR (
        EXISTS (
          SELECT 1
            FROM user_company_access
           WHERE user_id    = auth.uid()
             AND company_id = credentials.company_id
        )
        AND NOT EXISTS (
          SELECT 1
            FROM user_credential_exceptions
           WHERE user_id       = auth.uid()
             AND credential_id = credentials.id
        )
      )
    )
  );


-- ═══════════════════════════════════════════════════════
-- USER_COMPANY_ACCESS — habilitar RLS e políticas
-- ═══════════════════════════════════════════════════════

ALTER TABLE user_company_access ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê seus próprios grants; admins/super_admin veem todos (necessário para as telas de gestão)
CREATE POLICY "View company access grants" ON user_company_access
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_admin_or_super(auth.uid())
  );

-- INSERT — cobre dois cenários com uma regra unificada:
--
--   Cenário A (HU3/HU4 — liberação pontual no cadastro de empresa/credencial):
--     Qualquer admin ou super_admin pode inserir para QUALQUER usuário com custom_access_enabled=true,
--     independentemente de quem o convidou. (Assimetria intencional documentada na spec §4.)
--
--   Cenário B (HU1/HU2 — gestão geral do escopo no convite/edição):
--     Admin só pode inserir para usuários básicos que ele mesmo convidou.
--     Inclui o momento do convite, quando custom_access_enabled ainda está sendo ativado.
--
--   A combinação OR entre os dois cobre ambos os cenários sem conflito:
--   no fluxo HU1, o profile é inserido com custom_access_enabled=true na mesma transação,
--   então has_custom_access() já retorna true quando as linhas de empresa são inseridas.
CREATE POLICY "Grant company access" ON user_company_access
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      is_admin_or_super(auth.uid())
      AND (
        has_custom_access(user_company_access.user_id)       -- Cenário A
        OR can_manage_user_scope(user_company_access.user_id) -- Cenário B
      )
    )
  );

-- DELETE: mesma lógica do INSERT (quem pode liberar, pode revogar)
CREATE POLICY "Revoke company access" ON user_company_access
  FOR DELETE USING (
    is_super_admin(auth.uid())
    OR (
      is_admin_or_super(auth.uid())
      AND (
        has_custom_access(user_company_access.user_id)
        OR can_manage_user_scope(user_company_access.user_id)
      )
    )
  );


-- ═══════════════════════════════════════════════════════
-- USER_CREDENTIAL_EXCEPTIONS — habilitar RLS e políticas
-- ═══════════════════════════════════════════════════════

ALTER TABLE user_credential_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View credential exceptions" ON user_credential_exceptions
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_admin_or_super(auth.uid())
  );

CREATE POLICY "Add credential exception" ON user_credential_exceptions
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR (
      is_admin_or_super(auth.uid())
      AND (
        has_custom_access(user_credential_exceptions.user_id)
        OR can_manage_user_scope(user_credential_exceptions.user_id)
      )
    )
  );

CREATE POLICY "Remove credential exception" ON user_credential_exceptions
  FOR DELETE USING (
    is_super_admin(auth.uid())
    OR (
      is_admin_or_super(auth.uid())
      AND (
        has_custom_access(user_credential_exceptions.user_id)
        OR can_manage_user_scope(user_credential_exceptions.user_id)
      )
    )
  );


-- ═══════════════════════════════════════════════════════
-- USER_PROFILES UPDATE — política para admins alterarem custom_access_enabled
-- ═══════════════════════════════════════════════════════

-- Admin pode fazer UPDATE no perfil de básicos que ele convidou
-- (super_admin já está coberto pela política "Super admins can update roles" existente)
-- Nota de segurança: a política não restringe quais colunas são atualizadas —
-- a proteção de colunas sensíveis (role, status) fica no frontend.
-- Se quiser restrição cirúrgica no banco, substituir por função SECURITY DEFINER.
CREATE POLICY "Admins can update invited basicusers profile" ON user_profiles
  FOR UPDATE USING (
    get_user_role(auth.uid()) = 'admin'
    AND get_user_role(id)     = 'básico'
    AND invited_by_id         = auth.uid()
  );
