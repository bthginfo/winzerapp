CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE app.search_embedding (
 tenant_id uuid NOT NULL REFERENCES app.tenant(id),connection_id uuid NOT NULL,model text NOT NULL,document_id text NOT NULL,content_hash text NOT NULL,embedding public.vector(1536) NOT NULL,indexed_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL,
 PRIMARY KEY(tenant_id,connection_id,model,document_id),FOREIGN KEY(tenant_id,connection_id) REFERENCES app.connection(tenant_id,id)
);
ALTER TABLE app.search_embedding ENABLE ROW LEVEL SECURITY;ALTER TABLE app.search_embedding FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_access ON app.search_embedding USING(app.current_member(tenant_id) AND app.role()<>'external');
CREATE FUNCTION app.index_embedding(tid uuid,actor text,cid uuid,model_name text,doc text,hash text,vector_json text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,app,public AS $$
BEGIN
 PERFORM set_config('app.tenant_id',tid::text,true);PERFORM set_config('app.actor_id',actor,true);IF NOT app.is_member(tid) OR app.role()='external' THEN PERFORM app.fail('FORBIDDEN');END IF;
 IF NOT EXISTS(SELECT 1 FROM app.connection WHERE tenant_id=tid AND id=cid AND enabled AND adapter='openai-compatible' AND configuration->>'embedding_model'=model_name AND configuration->>'cost_consent'='true' AND configuration->>'data_consent'='true') THEN PERFORM app.fail('AI_CONSENT_REQUIRED');END IF;
 INSERT INTO app.search_embedding(tenant_id,connection_id,model,document_id,content_hash,embedding,created_by) VALUES(tid,cid,model_name,doc,hash,vector_json::public.vector,actor) ON CONFLICT(tenant_id,connection_id,model,document_id) DO UPDATE SET content_hash=excluded.content_hash,embedding=excluded.embedding,indexed_at=now(),created_by=excluded.created_by;
END $$;
REVOKE ALL ON FUNCTION app.index_embedding(uuid,text,uuid,text,text,text,text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION app.index_embedding(uuid,text,uuid,text,text,text,text) TO vinea_runtime;
