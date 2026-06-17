-- ═══════════════════════════════════════════════════════
-- MIGRATION 005 — Migrar credentials.type → tipo_credencial_id
-- ═══════════════════════════════════════════════════════
--
-- FASE 1: mapear os valores antigos da coluna 'type' (TEXT enum)
--          para os IDs correspondentes em tipos_credencial.
--          Executa somente nas linhas ainda sem tipo_credencial_id.
--
-- FASE 2: remover a coluna 'type' e o índice associado.
--          Execute APÓS confirmar que a Fase 1 está correta e que
--          o código da aplicação já foi atualizado.
-- ═══════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────
-- FASE 1 — Mapeamento de dados (seguro de rodar múltiplas vezes)
-- ───────────────────────────────────────────────────────

-- hospedagem → Hospedagem
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'Hospedagem' LIMIT 1
)
WHERE type = 'hospedagem'
  AND tipo_credencial_id IS NULL;

-- servidor → Servidor (VPS/Cloud)
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'Servidor (VPS/Cloud)' LIMIT 1
)
WHERE type = 'servidor'
  AND tipo_credencial_id IS NULL;

-- registro.br → Registro de Domínio
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'Registro de Domínio' LIMIT 1
)
WHERE type = 'registro.br'
  AND tipo_credencial_id IS NULL;

-- wordpress → WordPress
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'WordPress' LIMIT 1
)
WHERE type = 'wordpress'
  AND tipo_credencial_id IS NULL;

-- rd_station → RD Station
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'RD Station' LIMIT 1
)
WHERE type = 'rd_station'
  AND tipo_credencial_id IS NULL;

-- ftp_ssh → FTP/SSH
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'FTP/SSH' LIMIT 1
)
WHERE type = 'ftp_ssh'
  AND tipo_credencial_id IS NULL;

-- mysql → Banco de Dados
UPDATE credentials
SET tipo_credencial_id = (
  SELECT id FROM tipos_credencial WHERE nome = 'Banco de Dados' LIMIT 1
)
WHERE type = 'mysql'
  AND tipo_credencial_id IS NULL;

-- Verificação: credenciais que ainda não têm tipo_credencial_id após o mapeamento
-- (devem ser zero; se houver, o tipo antigo não estava coberto pelo mapeamento acima)
SELECT type, COUNT(*) AS restantes
FROM credentials
WHERE tipo_credencial_id IS NULL
GROUP BY type;

-- Torna a coluna nullable e sem CHECK: o código já não envia mais 'type' em novos
-- registros. Esta alteração permite que o app seja implantado antes da Fase 2.
ALTER TABLE credentials
  ALTER COLUMN type DROP NOT NULL;

ALTER TABLE credentials
  DROP CONSTRAINT IF EXISTS credentials_type_check;


-- ───────────────────────────────────────────────────────
-- FASE 2 — Remover coluna legada (somente após confirmar Fase 1)
-- ───────────────────────────────────────────────────────
-- Execute após verificar que a query de verificação acima
-- retornou zero linhas e que o app já está com a nova versão.

DROP INDEX IF EXISTS idx_credentials_type;
ALTER TABLE credentials DROP COLUMN IF EXISTS type;
