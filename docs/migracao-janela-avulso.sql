-- ═══════════════════════════════════════════════════════════════
-- GUARDIÃO FISCAL — Migração: janela de acesso do plano Avulso
-- (jul/2026 — decisão: Opção 2, janela de 30min vinculada à compra,
-- não crédito único travado num analysis_id específico)
--
-- COMO RODAR: cole este arquivo inteiro no Editor SQL do Supabase e execute.
-- É seguro rodar mais de uma vez (todos os comandos são idempotentes).
--
-- ORDEM DE DEPLOY IMPORTANTE:
--   1. Rode esta migração no Supabase PRIMEIRO.
--   2. Só DEPOIS faça deploy do app.js que chama iniciar_janela_avulso().
--   Se inverter a ordem, o app vai chamar uma função que ainda não existe
--   e todo desbloqueio do Avulso vai falhar até a migração rodar.
--
-- MUDANÇA MANUAL PENDENTE FORA DESTE REPOSITÓRIO (não estou vendo esse código):
--   O mp-webhook (Edge Function) precisa ser IDEMPOTENTE — o Mercado Pago pode
--   reenviar o mesmo evento de pagamento mais de uma vez (comportamento normal
--   e documentado da plataforma). O reset da janela só pode acontecer quando
--   for de fato uma compra NOVA ainda não processada, nunca em toda chamada
--   do webhook.
--
--   Pseudocódigo do que o handler precisa fazer, usando a nova coluna
--   avulso_ultimo_payment_id (adicionada nesta migração). Melhor forma:
--   UPDATE condicional único (sem SELECT antes), que é atômico por natureza
--   no Postgres — elimina qualquer corrida entre ler e escrever:
--
--     ao receber notificação de pagamento aprovado (plano = avulso):
--       payment_id := id do pagamento no payload do Mercado Pago
--
--       UPDATE profiles SET
--         plano = 'avulso',
--         avulso_started_at = NULL,
--         avulso_expires_at = NULL,
--         avulso_analysis_id = NULL,
--         avulso_ultimo_payment_id = payment_id,
--         mp_payment_id = payment_id,
--         updated_at = now()
--       WHERE id = <user_id>
--         AND avulso_ultimo_payment_id IS DISTINCT FROM payment_id;
--
--       -- Se afetou 0 linhas, esse payment_id já tinha sido processado
--       -- (reenvio do MP) — responda 200 OK do mesmo jeito, sem erro.
--
--   Isso garante: reenvio do mesmo evento não reabre uma janela já consumida
--   (idempotência), mas uma compra NOVA de fato depois da janela expirar
--   libera uma janela nova (o novo payment_id é diferente do salvo). Sendo
--   um único UPDATE com condição no WHERE, não existe janela de corrida
--   entre "checar se já processei" e "processar" — o próprio Postgres
--   resolve isso atomicamente por linha.
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────
-- 1. Novas colunas em profiles — estado da janela avulso
-- ─────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avulso_started_at  timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avulso_expires_at  timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avulso_analysis_id uuid;

-- [IDEMPOTÊNCIA DO WEBHOOK] Guarda o último payment_id do Mercado Pago já
-- processado pra esta compra avulso. O mp-webhook (fora deste repo) PRECISA
-- checar esta coluna antes de resetar a janela — ver bloco de instruções
-- mais abaixo. Sem isso, um reenvio do mesmo evento (comportamento normal e
-- documentado do Mercado Pago) reabriria uma janela já consumida.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avulso_ultimo_payment_id text;


-- ─────────────────────────────────────────
-- 1b. [BACKEND] Autorização comercial real de leitura em analyses
--
-- Antes: select_own_analyses só checava auth.uid() = user_id — qualquer
-- dono da linha podia ler, inclusive um Avulso fora da janela (a proteção
-- dependia só do JS escondendo o menu / eCarregarHistorico(), manipulável
-- via DevTools). Agora a leitura também exige plano ativo no momento da
-- consulta: Pro sempre, ou Avulso com janela ainda não expirada.
--
-- Import: isto NÃO afeta o INSERT (que continua liberado pra qualquer
-- usuário logado, indepen. de plano — é assim que a análise consegue ser
-- salva mesmo antes da janela avulso começar). Afeta só leitura posterior
-- (histórico). O registro nunca é apagado — só deixa de ser legível pelo
-- Avulso depois que a janela fecha.
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS "select_own_analyses" ON analyses;
CREATE POLICY "select_own_analyses" ON analyses FOR SELECT USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (
      (p.plano = 'pro' AND (p.expires_at IS NULL OR p.expires_at > now()))
      OR
      (p.plano = 'avulso' AND p.avulso_expires_at IS NOT NULL AND p.avulso_expires_at > now())
    )
  )
);


-- ─────────────────────────────────────────
-- 2. result_payload em analyses
-- Decisão que já estava pendente de aprovação (ver docs/decisoes.md, hipoteses.md)
-- e agora se torna necessária: sem isso, recarregar a página dentro da janela
-- de 30min perde o resultado (o motor roda 100% no browser, DEC-008 — nada é
-- reconstruível a partir do que está salvo hoje em analyses, que só tem campos
-- agregados tipo score/nivel_risco, não o Contrato do Resultado completo).
-- ─────────────────────────────────────────
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS result_payload jsonb;


-- ─────────────────────────────────────────
-- 3. Função atômica: inicia ou verifica a janela avulso
--
-- Regras (definidas por Warley, jul/2026):
--   - Só funciona para quem tem plano='avulso' e não expirado (mesma checagem
--     de _entitlementLimitesPadrao no app.js).
--   - Comprou mas nunca iniciou (avulso_started_at IS NULL) → inicia agora,
--     janela vale por 30 minutos a partir deste instante.
--   - Dentro da janela já iniciada → permite (reabrir resultado, recarregar
--     página, corrigir e reenviar o mesmo extrato — não trava num único
--     analysis_id específico, ver nota abaixo).
--   - Janela expirada → bloqueia, motivo='janela_expirada' (precisa comprar de novo).
--
-- NOTA DE DESENHO (documentar decisão, não escondida): a janela é por TEMPO,
-- não por analysis_id travado. Ou seja, tecnicamente dá pra rodar mais de uma
-- análise diferente dentro dos mesmos 30 minutos. Optamos por isso porque
-- travar num único analysis_id quebraria o caso legítimo de "corrigi o
-- arquivo e reenviei" (o app gera um novo analysis_id a cada parse, não tem
-- como saber que é uma correção do mesmo extrato vs. um extrato diferente).
-- Given a janela curta (30min), o abuso prático é baixo. Se no futuro isso
-- virar problema real (uso observado, não hipotético), a função pode evoluir
-- pra travar em analysis_id com um contador de "tentativas de correção".
--
-- SECURITY DEFINER + auth.uid(): só o próprio usuário autenticado pode
-- iniciar/consultar a própria janela — não recebe user_id como parâmetro,
-- pega de auth.uid() internamente, então não dá pra chamar isso pra outro
-- usuário nem manipulando o payload da chamada RPC pelo DevTools.
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.iniciar_janela_avulso(p_analysis_id uuid)
RETURNS TABLE(permitido boolean, expira_em timestamptz, motivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano       text;
  v_plan_exp    timestamptz;
  v_started     timestamptz;
  v_win_exp     timestamptz;
  v_now         timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'sem_usuario_autenticado'::text;
    RETURN;
  END IF;

  SELECT plano, expires_at, avulso_started_at, avulso_expires_at
    INTO v_plano, v_plan_exp, v_started, v_win_exp
    FROM profiles
    WHERE id = auth.uid()
    FOR UPDATE;  -- lock de linha: evita corrida entre abas/cliques duplicados

  IF v_plano IS DISTINCT FROM 'avulso' THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'sem_plano_avulso'::text;
    RETURN;
  END IF;

  IF v_plan_exp IS NOT NULL AND v_plan_exp < v_now THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'plano_expirado'::text;
    RETURN;
  END IF;

  -- Primeira vez usando esta compra avulso: abre a janela agora.
  IF v_started IS NULL THEN
    v_win_exp := v_now + interval '30 minutes';
    UPDATE profiles
      SET avulso_started_at = v_now,
          avulso_expires_at = v_win_exp,
          avulso_analysis_id = p_analysis_id,
          updated_at = v_now
      WHERE id = auth.uid();
    RETURN QUERY SELECT true, v_win_exp, 'janela_iniciada'::text;
    RETURN;
  END IF;

  -- Já tinha janela iniciada: só permite se ainda não expirou.
  IF v_win_exp IS NOT NULL AND v_win_exp > v_now THEN
    UPDATE profiles SET avulso_analysis_id = p_analysis_id, updated_at = v_now
      WHERE id = auth.uid();
    RETURN QUERY SELECT true, v_win_exp, 'janela_ativa'::text;
    RETURN;
  END IF;

  -- Janela existia mas já passou dos 30 minutos.
  RETURN QUERY SELECT false, v_win_exp, 'janela_expirada'::text;
END;
$$;

-- Só usuários autenticados podem chamar (Supabase já restringe RPC por padrão
-- ao role autenticado quando a função é SECURITY DEFINER + auth.uid() interno,
-- mas o GRANT explícito documenta a intenção).
GRANT EXECUTE ON FUNCTION public.iniciar_janela_avulso(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- MATRIZ DE VALIDAÇÃO — rodar contra o Supabase real antes do deploy do app.js
-- (via SQL Editor, simulando cada cenário; ou via app real com conta de teste)
-- ═══════════════════════════════════════════════════════════════
--
-- | Caso                                          | Esperado                        |
-- |------------------------------------------------|----------------------------------|
-- | Compra aprovada, nunca chamou a RPC             | iniciar_janela_avulso → permitido=true, motivo='janela_iniciada' |
-- | Chamar de novo 1s depois                        | permitido=true, motivo='janela_ativa', MESMO expira_em          |
-- | Chamar de novo 10min depois                     | permitido=true, expira_em IGUAL ao original (não somou +30min)  |
-- | Reenviar analysisId diferente dentro da janela  | permitido=true (analysisId é só auditoria, não trava)           |
-- | Duas chamadas simultâneas (2 abas)               | FOR UPDATE serializa — só uma "inicia", a outra vê janela ativa |
-- | Chamar após 30min do started_at                | permitido=false, motivo='janela_expirada'                       |
-- | Chamar com plano != 'avulso'                    | permitido=false, motivo='sem_plano_avulso'                      |
-- | SELECT em analyses, avulso com janela ativa     | retorna linhas (RLS libera)                                     |
-- | SELECT em analyses, avulso com janela expirada  | retorna 0 linhas (RLS nega, mesmo sendo dono da linha)          |
-- | SELECT em analyses, plano pro ativo             | retorna linhas sempre                                           |
-- | Webhook: mesmo payment_id chamado 2x             | 2ª chamada não afeta linha nenhuma (idempotente)                 |
-- | Webhook: payment_id novo após janela expirada   | reseta started_at/expires_at/analysis_id — nova janela liberada |
-- ═══════════════════════════════════════════════════════════════
