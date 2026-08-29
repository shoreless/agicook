-- One row per completed quiz. No IP, no cookie, no identifier — a result and
-- the nine option-indices that produced it, so the scoring can be retuned later.
CREATE TABLE IF NOT EXISTS responses (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      TEXT NOT NULL DEFAULT (datetime('now')),
  version TEXT NOT NULL,
  result  TEXT NOT NULL,
  answers TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_responses_ver_result ON responses(version, result);
