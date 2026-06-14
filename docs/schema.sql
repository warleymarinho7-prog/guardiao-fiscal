-- ═══════════════════════════════════════════════════════════════
-- GUARDIÃO FISCAL — Schema completo do banco de dados
-- Supabase (PostgreSQL)
-- Atualizado: jun/2026
--
-- Para recriar do zero: rode este arquivo no Editor SQL do Supabase.
-- Ordem importa: profiles → analyses → resto.
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────
-- 1. PROFILES
-- Criado automaticamente pelo trigger on_auth_user_created
-- quando um usuário se cadastra via Supabase Auth.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome             text,
  plano            text DEFAULT 'gratuito',
  created_at       timestamptz DEFAULT now(),
  plano_ativo_em   timestamptz,
  expires_at       timestamptz,
  updated_at       timestamptz,
  mp_payment_id    text,
  mp_subscription_id text
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='select_own_profile') THEN
    CREATE POLICY "select_own_profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='update_own_profile') THEN
    CREATE POLICY "update_own_profile" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='insert_own_profile') THEN
    CREATE POLICY "insert_own_profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Trigger: cria profile automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'nome')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ─────────────────────────────────────────
-- 2. ANALYSES
-- Resultado de cada análise de extrato.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score            smallint NOT NULL,
  nivel_risco      text NOT NULL,
  perfil_usuario   text,
  renda_declarada  numeric,
  total_creditos   bigint,
  total_debitos    bigint,
  total_txns       integer,
  pix_total        bigint,
  especie_total    bigint,
  num_alertas      smallint,
  num_fontes       smallint,
  versao_engine    text DEFAULT 'v8.0',
  created_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analyses' AND policyname='select_own_analyses') THEN
    CREATE POLICY "select_own_analyses" ON analyses FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analyses' AND policyname='insert_own_analyses') THEN
    CREATE POLICY "insert_own_analyses" ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 3. QUIZ_RESPONSES
-- Respostas do quiz da landing page.
-- Inclui perfil selecionado, risco, score e email opcional.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_responses (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  perfil       text,
  risco        text,
  score        integer,
  dor          text,
  respostas    jsonb,
  concluido    boolean DEFAULT false,
  abandonou_em integer,
  session_id   text,
  email        text,
  whatsapp     text
);

ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quiz_responses' AND policyname='insert_quiz_response') THEN
    CREATE POLICY "insert_quiz_response" ON quiz_responses FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quiz_responses' AND policyname='update_quiz_response') THEN
    CREATE POLICY "update_quiz_response" ON quiz_responses FOR UPDATE USING (true);
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 4. EVENTOS
-- Tracking de eventos de produto (funil, engajamento).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sessao_id    text NOT NULL,
  evento       text NOT NULL,
  propriedades jsonb DEFAULT '{}'
);

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eventos' AND policyname='insert_evento') THEN
    CREATE POLICY "insert_evento" ON eventos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='eventos' AND policyname='select_own_eventos') THEN
    CREATE POLICY "select_own_eventos" ON eventos FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 5. FEEDBACKS
-- Feedbacks enviados pelo botão no site.
-- INSERT aberto (anônimo permitido).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedbacks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo       text,
  mensagem   text NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email      text,
  pagina     text,
  criado_em  timestamptz DEFAULT now()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedbacks' AND policyname='insert_feedback') THEN
    CREATE POLICY "insert_feedback" ON feedbacks FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feedbacks' AND policyname='owner_read_feedback') THEN
    CREATE POLICY "owner_read_feedback" ON feedbacks FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- ─────────────────────────────────────────
-- 6. ACCESS_LOGS
-- Log de auditoria LGPD — registra cada análise realizada.
-- Nunca armazena conteúdo do extrato, só metadados.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email          text,
  evento         text,
  num_arquivos   integer,
  tamanho_bytes  bigint,
  ip_hint        text,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='access_logs' AND policyname='insert_log') THEN
    CREATE POLICY "insert_log" ON access_logs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='access_logs' AND policyname='owner_read_log') THEN
    CREATE POLICY "owner_read_log" ON access_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- QUERIES DE MONITORAMENTO
-- Copie e rode individualmente no Editor SQL quando precisar.
-- Nunca fazem parte da migração — só leitura.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- QUIZ — Leads recentes
-- ─────────────────────────────────────────
-- SELECT created_at, perfil, risco, score, email, concluido
-- FROM quiz_responses
-- ORDER BY created_at DESC
-- LIMIT 50;

-- ─────────────────────────────────────────
-- QUIZ — Resumo por perfil e risco
-- ─────────────────────────────────────────
-- SELECT perfil, risco, count(*) as total
-- FROM quiz_responses
-- WHERE concluido = true
-- GROUP BY perfil, risco
-- ORDER BY total DESC;

-- ─────────────────────────────────────────
-- FEEDBACKS — Recentes
-- ─────────────────────────────────────────
-- SELECT criado_em, tipo, mensagem, email, pagina
-- FROM feedbacks
-- ORDER BY criado_em DESC
-- LIMIT 50;

-- ─────────────────────────────────────────
-- ANÁLISES — Histórico de extratos analisados
-- ─────────────────────────────────────────
-- SELECT created_at, nivel_risco, score, perfil_usuario, renda_declarada, num_alertas
-- FROM analyses
-- ORDER BY created_at DESC
-- LIMIT 50;

-- ─────────────────────────────────────────
-- ANÁLISES — Resumo por nível de risco
-- ─────────────────────────────────────────
-- SELECT nivel_risco, count(*) as total
-- FROM analyses
-- GROUP BY nivel_risco
-- ORDER BY total DESC;

-- ─────────────────────────────────────────
-- ACCESS LOGS — Auditoria LGPD recente
-- ─────────────────────────────────────────
-- SELECT created_at, email, evento, num_arquivos, tamanho_bytes
-- FROM access_logs
-- ORDER BY created_at DESC
-- LIMIT 50;

-- ─────────────────────────────────────────
-- RLS — Verificar políticas de todas as tabelas
-- ─────────────────────────────────────────
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
