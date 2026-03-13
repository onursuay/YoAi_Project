CREATE TABLE yoai_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'seo_article',
  title TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_url TEXT,
  word_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_yoai_articles_user ON yoai_articles(user_id);
CREATE INDEX idx_yoai_articles_status ON yoai_articles(status);
