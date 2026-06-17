-- Migration 004 — Cargos e Permissões
-- Substitui os perfis Admin/Básico por um sistema de Cargos configuráveis.
-- Seções 2, 5 e 8 de docs/Especificacao_Cargos_e_Permissoes.md
--
-- Pré-requisitos: migrations 001, 002, 003 e fix-rls-recursion.sql já executados.
-- Seguro re-executar: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--                     CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING.


-- ═══════════════════════════════════════════════════════
-- PARTE 1: NOVAS TABELAS
-- ═══════════════════════════════════════════════════════

-- 1.1 Cargos (ex: Desenvolvedor, Redes Sociais, Tráfego Pago)
CREATE TABLE IF NOT EXISTS cargos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Tipos de credencial — substitui o enum fixo do campo 'type' em credentials.
--     UNIQUE(nome) evita duplicatas no seed em re-execuções.
CREATE TABLE IF NOT EXISTS tipos_credencial (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT NOT NULL UNIQUE,
  categoria   TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.3 Junção cargo ↔ tipo: define quais tipos cada cargo enxerga.
--     PK composta impede duplicatas.
CREATE TABLE IF NOT EXISTS cargo_tipo_credencial (
  cargo_id            UUID NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  tipo_credencial_id  UUID NOT NULL REFERENCES tipos_credencial(id) ON DELETE CASCADE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (cargo_id, tipo_credencial_id)
);

-- 1.4 Junção usuário ↔ tipo extra: tipos liberados individualmente além do cargo.
CREATE TABLE IF NOT EXISTS usuario_tipo_credencial_extra (
  usuario_id          UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tipo_credencial_id  UUID NOT NULL REFERENCES tipos_credencial(id) ON DELETE CASCADE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (usuario_id, tipo_credencial_id)
);

-- 1.5 Junção usuário ↔ empresa: lista explícita de empresas acessíveis quando
--     pode_ver_todas_empresas = false.
CREATE TABLE IF NOT EXISTS usuario_empresa (
  usuario_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  empresa_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (usuario_id, empresa_id)
);


-- ═══════════════════════════════════════════════════════
-- PARTE 2: TRIGGERS updated_at PARA NOVAS TABELAS
-- ═══════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS update_cargos_updated_at ON cargos;
CREATE TRIGGER update_cargos_updated_at
  BEFORE UPDATE ON cargos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tipos_credencial_updated_at ON tipos_credencial;
CREATE TRIGGER update_tipos_credencial_updated_at
  BEFORE UPDATE ON tipos_credencial
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════
-- PARTE 3: NOVAS COLUNAS EM user_profiles
-- ═══════════════════════════════════════════════════════

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cargo_id                UUID REFERENCES cargos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_super_admin          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_ver_todas_empresas BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pode_criar_empresa      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_editar_empresa     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_excluir_empresa    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_criar_credencial   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_editar_credencial  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pode_excluir_credencial BOOLEAN NOT NULL DEFAULT false;

-- Backfill: propaga super admins existentes (role TEXT) para a nova coluna booleana.
UPDATE user_profiles
  SET is_super_admin = true
  WHERE role = 'super_admin'
    AND is_super_admin = false;


-- ═══════════════════════════════════════════════════════
-- PARTE 4: NOVA COLUNA EM credentials
-- ═══════════════════════════════════════════════════════

-- A coluna 'type' (TEXT) permanece intacta — será migrada na última etapa.
ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS tipo_credencial_id UUID REFERENCES tipos_credencial(id) ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════
-- PARTE 5: ÍNDICES
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_user_profiles_cargo_id
  ON user_profiles(cargo_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_super_admin
  ON user_profiles(is_super_admin)
  WHERE is_super_admin = true;

CREATE INDEX IF NOT EXISTS idx_ctc_cargo_id
  ON cargo_tipo_credencial(cargo_id);

CREATE INDEX IF NOT EXISTS idx_ctc_tipo_credencial_id
  ON cargo_tipo_credencial(tipo_credencial_id);

CREATE INDEX IF NOT EXISTS idx_utce_usuario_id
  ON usuario_tipo_credencial_extra(usuario_id);

CREATE INDEX IF NOT EXISTS idx_utce_tipo_credencial_id
  ON usuario_tipo_credencial_extra(tipo_credencial_id);

CREATE INDEX IF NOT EXISTS idx_ue_usuario_id
  ON usuario_empresa(usuario_id);

CREATE INDEX IF NOT EXISTS idx_ue_empresa_id
  ON usuario_empresa(empresa_id);

CREATE INDEX IF NOT EXISTS idx_credentials_tipo_credencial_id
  ON credentials(tipo_credencial_id);


-- ═══════════════════════════════════════════════════════
-- PARTE 6: FUNÇÕES HELPER
-- ═══════════════════════════════════════════════════════

-- Atualiza is_super_admin() para usar a nova coluna booleana em vez do campo role TEXT.
-- SECURITY DEFINER bypassa RLS, evitando recursão infinita nas policies.
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(up.is_super_admin, false)
  FROM user_profiles up
  WHERE up.id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna o conjunto de tipo_credencial_id visíveis ao usuário:
-- união dos tipos vinculados ao cargo com os tipos extras concedidos individualmente.
-- SECURITY DEFINER: chamada de dentro de policies RLS, não pode disparar nova avaliação de RLS.
CREATE OR REPLACE FUNCTION tipos_visiveis(p_usuario_id UUID)
RETURNS TABLE (tipo_credencial_id UUID) AS $$
  -- Tipos herdados do cargo
  SELECT ctc.tipo_credencial_id
  FROM cargo_tipo_credencial ctc
  INNER JOIN user_profiles up ON up.cargo_id = ctc.cargo_id
  WHERE up.id = p_usuario_id

  UNION

  -- Tipos liberados individualmente além do cargo
  SELECT utce.tipo_credencial_id
  FROM usuario_tipo_credencial_extra utce
  WHERE utce.usuario_id = p_usuario_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════
-- PARTE 7: RLS — EMPRESAS (tabela: companies)
-- ═══════════════════════════════════════════════════════

-- Remove políticas existentes que serão substituídas
DROP POLICY IF EXISTS "Companies visibility with custom access" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;
DROP POLICY IF EXISTS "Admins can create companies" ON companies;
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
DROP POLICY IF EXISTS "Super admins can delete companies" ON companies;

-- SELECT: super_admin OU pode_ver_todas_empresas = true OU empresa na lista usuario_empresa
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR up.pode_ver_todas_empresas
          OR EXISTS (
            SELECT 1 FROM usuario_empresa ue
            WHERE ue.usuario_id = auth.uid()
              AND ue.empresa_id = companies.id
          )
        )
    )
  );

-- INSERT: super_admin OU pode_criar_empresa
CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_super_admin OR up.pode_criar_empresa)
    )
  );

-- UPDATE: super_admin OU (pode_editar_empresa E empresa visível ao usuário)
CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR (
            up.pode_editar_empresa
            AND (
              up.pode_ver_todas_empresas
              OR EXISTS (
                SELECT 1 FROM usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
                  AND ue.empresa_id = companies.id
              )
            )
          )
        )
    )
  );

-- DELETE: super_admin OU (pode_excluir_empresa E empresa visível ao usuário)
CREATE POLICY "companies_delete" ON companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR (
            up.pode_excluir_empresa
            AND (
              up.pode_ver_todas_empresas
              OR EXISTS (
                SELECT 1 FROM usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
                  AND ue.empresa_id = companies.id
              )
            )
          )
        )
    )
  );


-- ═══════════════════════════════════════════════════════
-- PARTE 8: RLS — CREDENCIAIS (tabela: credentials)
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Credentials visibility with custom access" ON credentials;
DROP POLICY IF EXISTS "Authenticated users can view credentials" ON credentials;
DROP POLICY IF EXISTS "Admins can create credentials" ON credentials;
DROP POLICY IF EXISTS "Admins can update credentials" ON credentials;
DROP POLICY IF EXISTS "Super admins can delete credentials" ON credentials;

-- SELECT:
--   • super_admin → tudo
--   • Novo sistema (tipo_credencial_id preenchido): tipo está nos visíveis do usuário
--     E empresa está acessível (pode_ver_todas ou na lista usuario_empresa)
--   • Legado de transição (tipo_credencial_id ainda NULL): mantém comportamento
--     anterior via custom_access / user_company_access até a migração final de dados
CREATE POLICY "credentials_select" ON credentials
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin

          -- Novo sistema: credencial com tipo já mapeado
          OR (
            credentials.tipo_credencial_id IS NOT NULL
            AND credentials.tipo_credencial_id IN (
              SELECT tv.tipo_credencial_id FROM tipos_visiveis(auth.uid()) tv
            )
            AND (
              up.pode_ver_todas_empresas
              OR EXISTS (
                SELECT 1 FROM usuario_empresa ue
                WHERE ue.usuario_id = auth.uid()
                  AND ue.empresa_id = credentials.company_id
              )
            )
          )

          -- Legado: credencial ainda sem tipo_credencial_id (a remover após migração de dados)
          OR (
            credentials.tipo_credencial_id IS NULL
            AND (
              NOT has_custom_access(auth.uid())
              OR (
                EXISTS (
                  SELECT 1 FROM user_company_access uca
                  WHERE uca.user_id    = auth.uid()
                    AND uca.company_id = credentials.company_id
                )
                AND NOT EXISTS (
                  SELECT 1 FROM user_credential_exceptions uce
                  WHERE uce.user_id       = auth.uid()
                    AND uce.credential_id = credentials.id
                )
              )
            )
          )
        )
    )
  );

-- INSERT: super_admin OU (pode_criar_credencial E tipo está nos visíveis do usuário)
CREATE POLICY "credentials_insert" ON credentials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR (
            up.pode_criar_credencial
            AND (
              credentials.tipo_credencial_id IS NULL
              OR credentials.tipo_credencial_id IN (
                SELECT tv.tipo_credencial_id FROM tipos_visiveis(auth.uid()) tv
              )
            )
          )
        )
    )
  );

-- UPDATE: super_admin OU (pode_editar_credencial E tipo está nos visíveis do usuário)
CREATE POLICY "credentials_update" ON credentials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR (
            up.pode_editar_credencial
            AND (
              credentials.tipo_credencial_id IS NULL
              OR credentials.tipo_credencial_id IN (
                SELECT tv.tipo_credencial_id FROM tipos_visiveis(auth.uid()) tv
              )
            )
          )
        )
    )
  );

-- DELETE: super_admin OU (pode_excluir_credencial E tipo está nos visíveis do usuário)
CREATE POLICY "credentials_delete" ON credentials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_super_admin
          OR (
            up.pode_excluir_credencial
            AND (
              credentials.tipo_credencial_id IS NULL
              OR credentials.tipo_credencial_id IN (
                SELECT tv.tipo_credencial_id FROM tipos_visiveis(auth.uid()) tv
              )
            )
          )
        )
    )
  );


-- ═══════════════════════════════════════════════════════
-- PARTE 9: RLS — CARGOS
-- ═══════════════════════════════════════════════════════

ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado (necessário para dropdowns de seleção)
CREATE POLICY "cargos_select" ON cargos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita exclusiva do super_admin
CREATE POLICY "cargos_insert" ON cargos
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "cargos_update" ON cargos
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "cargos_delete" ON cargos
  FOR DELETE USING (is_super_admin(auth.uid()));


-- ═══════════════════════════════════════════════════════
-- PARTE 10: RLS — TIPOS_CREDENCIAL
-- ═══════════════════════════════════════════════════════

ALTER TABLE tipos_credencial ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado (necessário para o campo Tipo no form de credencial)
CREATE POLICY "tipos_credencial_select" ON tipos_credencial
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita exclusiva do super_admin
CREATE POLICY "tipos_credencial_insert" ON tipos_credencial
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "tipos_credencial_update" ON tipos_credencial
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "tipos_credencial_delete" ON tipos_credencial
  FOR DELETE USING (is_super_admin(auth.uid()));


-- ═══════════════════════════════════════════════════════
-- PARTE 11: RLS — CARGO_TIPO_CREDENCIAL
-- ═══════════════════════════════════════════════════════

ALTER TABLE cargo_tipo_credencial ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado (usada internamente por tipos_visiveis())
CREATE POLICY "cargo_tipo_credencial_select" ON cargo_tipo_credencial
  FOR SELECT USING (auth.role() = 'authenticated');

-- Escrita exclusiva do super_admin
CREATE POLICY "cargo_tipo_credencial_insert" ON cargo_tipo_credencial
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "cargo_tipo_credencial_delete" ON cargo_tipo_credencial
  FOR DELETE USING (is_super_admin(auth.uid()));


-- ═══════════════════════════════════════════════════════
-- PARTE 12: RLS — USUARIO_TIPO_CREDENCIAL_EXTRA
-- ═══════════════════════════════════════════════════════

ALTER TABLE usuario_tipo_credencial_extra ENABLE ROW LEVEL SECURITY;

-- Usuário vê seus próprios extras; super_admin vê tudo (tela de gestão de usuários)
CREATE POLICY "utce_select" ON usuario_tipo_credencial_extra
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- Concessão e revogação: exclusivo do super_admin
CREATE POLICY "utce_insert" ON usuario_tipo_credencial_extra
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "utce_delete" ON usuario_tipo_credencial_extra
  FOR DELETE USING (is_super_admin(auth.uid()));


-- ═══════════════════════════════════════════════════════
-- PARTE 13: RLS — USUARIO_EMPRESA
-- ═══════════════════════════════════════════════════════

ALTER TABLE usuario_empresa ENABLE ROW LEVEL SECURITY;

-- Usuário vê sua própria lista; super_admin vê tudo (tela de gestão de usuários)
CREATE POLICY "usuario_empresa_select" ON usuario_empresa
  FOR SELECT USING (
    usuario_id = auth.uid()
    OR is_super_admin(auth.uid())
  );

-- Concessão e revogação: exclusivo do super_admin
CREATE POLICY "usuario_empresa_insert" ON usuario_empresa
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "usuario_empresa_delete" ON usuario_empresa
  FOR DELETE USING (is_super_admin(auth.uid()));


-- ═══════════════════════════════════════════════════════
-- PARTE 14: SEED — TIPOS_CREDENCIAL (taxonomia inicial — seção 5)
-- ═══════════════════════════════════════════════════════

INSERT INTO tipos_credencial (nome, categoria) VALUES
  -- Desenvolvimento & Infraestrutura
  ('Hospedagem',                                        'Desenvolvimento & Infraestrutura'),
  ('Servidor (VPS/Cloud)',                              'Desenvolvimento & Infraestrutura'),
  ('Painel de Hospedagem (cPanel/Plesk)',               'Desenvolvimento & Infraestrutura'),
  ('FTP/SSH',                                           'Desenvolvimento & Infraestrutura'),
  ('Banco de Dados',                                    'Desenvolvimento & Infraestrutura'),
  ('Registro de Domínio',                               'Desenvolvimento & Infraestrutura'),
  ('DNS/CDN',                                           'Desenvolvimento & Infraestrutura'),
  ('Repositório de Código',                             'Desenvolvimento & Infraestrutura'),
  ('Certificado SSL',                                   'Desenvolvimento & Infraestrutura'),
  -- CMS & Plataformas de Site
  ('WordPress',                                         'CMS & Plataformas de Site'),
  ('E-commerce (Shopify/Wix/outro)',                    'CMS & Plataformas de Site'),
  -- Redes Sociais
  ('Instagram',                                         'Redes Sociais'),
  ('Facebook/Meta Business Suite',                      'Redes Sociais'),
  ('TikTok',                                            'Redes Sociais'),
  ('LinkedIn',                                          'Redes Sociais'),
  ('YouTube',                                           'Redes Sociais'),
  ('Pinterest',                                         'Redes Sociais'),
  ('Twitter/X',                                         'Redes Sociais'),
  ('WhatsApp Business',                                 'Redes Sociais'),
  -- Marketing & Tráfego Pago
  ('Google Ads',                                        'Marketing & Tráfego Pago'),
  ('Meta Ads',                                          'Marketing & Tráfego Pago'),
  ('TikTok Ads',                                        'Marketing & Tráfego Pago'),
  ('LinkedIn Ads',                                      'Marketing & Tráfego Pago'),
  ('Google Analytics',                                  'Marketing & Tráfego Pago'),
  ('Google Tag Manager',                                'Marketing & Tráfego Pago'),
  ('Google Search Console',                             'Marketing & Tráfego Pago'),
  -- Email Marketing & CRM
  ('RD Station',                                        'Email Marketing & CRM'),
  ('Mailchimp/ActiveCampaign',                          'Email Marketing & CRM'),
  ('CRM (HubSpot/Salesforce/Pipedrive)',                'Email Marketing & CRM'),
  -- Design & Produção
  ('Canva',                                             'Design & Produção'),
  ('Adobe Creative Cloud',                              'Design & Produção'),
  ('Figma',                                             'Design & Produção'),
  -- Financeiro & Administrativo
  ('Gateway de Pagamento',                              'Financeiro & Administrativo'),
  ('Assinaturas de Ferramentas (SaaS)',                 'Financeiro & Administrativo'),
  -- Atendimento & Suporte
  ('Helpdesk (Zendesk/Intercom)',                       'Atendimento & Suporte'),
  -- Gestão Interna
  ('Ferramentas de Gestão (Trello/Asana/Notion/Slack)', 'Gestão Interna')
ON CONFLICT (nome) DO NOTHING;
