import hashlib
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.config import ROOT, settings

DB = Path(os.environ.get('NEURAL_DB', ROOT / 'data' / 'nexo.sqlite3'))
MAX_MEMORIES = 5000


@contextmanager
def connection():
    from app.neural.profiles import selected_database
    path = selected_database.get() or DB
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db:
            yield db
    finally:
        db.close()


def initialize():
    with connection() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS memories (
          id INTEGER PRIMARY KEY, text TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
          digest TEXT NOT NULL UNIQUE, vector BLOB NOT NULL, model TEXT NOT NULL,
          dimension INTEGER NOT NULL, created TEXT NOT NULL, origin TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY, role TEXT NOT NULL, text TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '[]');
        CREATE TABLE IF NOT EXISTS network (
          id INTEGER PRIMARY KEY CHECK(id=1), weights BLOB NOT NULL, metadata TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS conversation_state (
          key TEXT PRIMARY KEY, value INTEGER NOT NULL);
        ''')
        # Upgrade existing installations without replaying old, overly restrictive answers.
        db.execute("INSERT OR IGNORE INTO conversation_state SELECT 'boundary',coalesce(max(id),0) FROM messages")


def normalized(vector):
    v = np.asarray(vector, dtype=np.float32)
    if v.ndim != 1 or not len(v) or not np.isfinite(v).all():
        raise ValueError('O modelo retornou um vetor inválido.')
    norm = np.linalg.norm(v.astype(np.float64))
    if not np.isfinite(norm) or norm < 1e-8:
        raise ValueError('O modelo retornou um vetor inválido.')
    return (v / norm).astype(np.float32)


def public(row):
    return {k: row[k] for k in ('id', 'text', 'label', 'created', 'origin', 'dimension')}


def all_memories():
    with connection() as db:
        return [public(r) for r in db.execute('SELECT * FROM memories ORDER BY id DESC')]


def rows():
    with connection() as db:
        return list(db.execute('SELECT * FROM memories ORDER BY id'))


def digest(text):
    return hashlib.sha256(' '.join(text.split()).casefold().encode()).hexdigest()


def add_many(items, vectors, origin='manual', *, return_ids=False):
    if len(items) != len(vectors):
        raise ValueError('Número incorreto de vetores.')
    prepared = [(text.strip(), label.strip(), normalized(v)) for (text, label), v in zip(items, vectors)]
    with connection() as db:
        current = db.execute('SELECT model,dimension FROM memories LIMIT 1').fetchone()
        if current and any(current['model'] != settings.embed_model or current['dimension'] != len(v) for _, _, v in prepared):
            raise ValueError('Modelo de embeddings incompatível com a base. Restaure o modelo anterior ou exporte e recrie a base.')
        count = db.execute('SELECT count(*) FROM memories').fetchone()[0]
        fresh = {digest(t) for t, _, _ in prepared} - {r[0] for r in db.execute('SELECT digest FROM memories')}
        if count + len(fresh) > MAX_MEMORIES:
            raise ValueError(f'Limite de {MAX_MEMORIES} memórias atingido.')
        added = 0
        new_ids=[]
        for text, label, vector in prepared:
            cursor = db.execute('INSERT OR IGNORE INTO memories(text,label,digest,vector,model,dimension,created,origin) VALUES(?,?,?,?,?,?,?,?)',
                (text, label, digest(text), vector.tobytes(), settings.embed_model, len(vector), datetime.now(timezone.utc).isoformat(), origin))
            added += cursor.rowcount
            if cursor.rowcount:new_ids.append(cursor.lastrowid)
        if added:
            db.execute('DELETE FROM network')
            reset_context(db)
        return new_ids if return_ids else added


def search_trace(vector, limit=5, threshold=.40, excluded_ids=None):
    started = time.perf_counter()
    excluded_ids = [] if excluded_ids is None else excluded_ids
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 20:
        raise ValueError('Use entre 1 e 20 trechos.')
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not np.isfinite(threshold) or not -1 <= threshold <= 1:
        raise ValueError('Limiar inválido.')
    if not isinstance(excluded_ids, list) or any(type(i) is not int or i < 1 for i in excluded_ids):
        raise ValueError('Identificadores de exclusão inválidos.')
    records = rows()
    v = normalized(vector)
    if any(r['model'] != settings.embed_model or r['dimension'] != len(v) for r in records):
        raise ValueError('Embeddings incompatíveis. Use o modelo original da base.')
    matrix = np.stack([normalized(np.frombuffer(r['vector'], dtype=np.float32)) for r in records]) if records else np.empty((0, len(v)))
    scores = np.clip(matrix @ v, -1, 1)
    candidates, sources = [], []
    for rank, i in enumerate(np.argsort(-scores, kind='stable'), 1):
        row, score = records[i], float(scores[i])
        reason = 'excluded' if row['id'] in excluded_ids else 'below-threshold' if score < threshold else 'top-k' if len(sources) >= limit else 'included'
        candidates.append({'id': row['id'], 'score': score, 'rank': rank, 'reason': reason})
        if reason == 'included':
            sources.append({**public(row), 'score': round(score, 4)})
    return {'config': {'limit': limit, 'threshold': threshold, 'excludedIds': sorted(set(excluded_ids))}, 'total': len(records), 'sources': sources, 'candidates': candidates, 'timings': {'totalMs': (time.perf_counter()-started)*1000}}


def retrieve(vector, limit=5, threshold=.40, excluded_ids=None):
    return search_trace(vector, limit, threshold, excluded_ids)['sources']


def history(limit=60):
    with connection() as db:
        result=[]
        for r in reversed(list(db.execute('SELECT * FROM messages ORDER BY id DESC LIMIT ?', (limit,)))):
            refs=json.loads(r['sources'])
            trace=next((s.get('trace') for s in refs if isinstance(s,dict) and s.get('kind')=='knowledge-trace'),None)
            result.append({**dict(r),'sources':[s for s in refs if not isinstance(s,dict) or s.get('kind')!='knowledge-trace'],**({'knowledge':trace} if trace else {})})
        return result


def reset_context(db):
    """Invalidate prompt history after memory changes, while preserving visible history."""
    boundary = db.execute('SELECT coalesce(max(id),0) FROM messages').fetchone()[0]
    db.execute("INSERT OR REPLACE INTO conversation_state VALUES('boundary',?)", (boundary,))


def recent_context(limit=8, char_budget=4800):
    with connection() as db:
        boundary = db.execute("SELECT value FROM conversation_state WHERE key='boundary'").fetchone()
        records = list(db.execute('SELECT role,text FROM messages WHERE id>? ORDER BY id DESC LIMIT ?', (boundary[0] if boundary else 0, limit)))
    selected, used = [], 0
    for row in records:
        content = row['text'][:1800]
        if used + len(content) > char_budget:
            break
        selected.append({'role':row['role'], 'content':content})
        used += len(content)
    selected.reverse()
    # Never start context with an orphaned assistant message.
    while selected and selected[0]['role'] != 'user':
        selected.pop(0)
    return selected


def save_turn(question, answer, sources, knowledge=None):
    sources=[*sources, *([{'id':'K:trace','kind':'knowledge-trace','trace':knowledge}] if knowledge else [])]
    with connection() as db:
        db.execute("INSERT INTO messages(role,text) VALUES('user',?)", (question,))
        db.execute("INSERT INTO messages(role,text,sources) VALUES('assistant',?,?)", (answer, json.dumps(sources, ensure_ascii=False)))
        db.execute('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT 200)')
