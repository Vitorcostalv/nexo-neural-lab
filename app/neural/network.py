"""Small MLP, two hidden layers, explicit backpropagation and Adam, CPU NumPy.

This trains a memory-topic classifier. It never modifies the language model.
"""
import io
import json
import time
from collections import Counter
from datetime import datetime, timezone

import numpy as np

from app.config import settings
from app.neural import store


def softmax(x):
    z = np.exp(x - x.max(axis=1, keepdims=True))
    return z / z.sum(axis=1, keepdims=True)


def forward(x, weights):
    a = np.maximum(x @ weights['w1'] + weights['b1'], 0)
    b = np.maximum(a @ weights['w2'] + weights['b2'], 0)
    return a, b, softmax(b @ weights['w3'] + weights['b3'])


def train(epochs=240):
    started = time.perf_counter()
    records = [r for r in store.rows() if r['label']]
    counts = Counter(r['label'] for r in records)
    if len(counts) < 2 or min(counts.values()) < 3:
        raise ValueError('Adicione pelo menos 2 categorias com 3 memórias rotuladas em cada uma. Um exemplo de cada categoria será reservado para validação.')
    if len(counts) > 32 or len(records) > 2000:
        raise ValueError('O laboratório aceita até 32 categorias e 2.000 exemplos de treinamento.')
    if any(r['model'] != settings.embed_model for r in records):
        raise ValueError('Modelo de embeddings incompatível.')
    labels = sorted(counts)
    x = np.stack([np.frombuffer(r['vector'], np.float32) for r in records])
    y = np.array([labels.index(r['label']) for r in records])
    rng = np.random.default_rng(42)
    validation = []
    for label in range(len(labels)):
        indices = np.where(y == label)[0]
        rng.shuffle(indices)
        validation.extend(indices[:max(1, len(indices)//5)])
    train_indices = np.array([i for i in range(len(y)) if i not in validation])
    tx, ty = x[train_indices], y[train_indices]
    vx, vy = x[validation], y[validation]
    dims = [x.shape[1], 64, 24, len(labels)]
    weights = {}
    for i in range(1, 4):
        weights[f'w{i}'] = (rng.normal(size=(dims[i-1], dims[i])) * np.sqrt(2 / dims[i-1])).astype(np.float32)
        weights[f'b{i}'] = np.zeros(dims[i], np.float32)
    m, v = {k: np.zeros_like(w) for k, w in weights.items()}, {k: np.zeros_like(w) for k, w in weights.items()}
    curve, best_loss, best, stale = [], float('inf'), None, 0
    for epoch in range(1, epochs+1):
        a, b, p = forward(tx, weights)
        delta = p.copy()
        delta[np.arange(len(ty)), ty] -= 1
        delta /= len(ty)
        g = {'w3': b.T @ delta, 'b3': delta.sum(axis=0)}
        d2 = (delta @ weights['w3'].T) * (b > 0)
        g.update(w2=a.T @ d2, b2=d2.sum(axis=0))
        d1 = (d2 @ weights['w2'].T) * (a > 0)
        g.update(w1=tx.T @ d1, b1=d1.sum(axis=0))
        for k in weights:
            grad = g[k] + (1e-4 * weights[k] if k.startswith('w') else 0)
            m[k] = .9*m[k] + .1*grad
            v[k] = .999*v[k] + .001*grad*grad
            weights[k] -= .008 * (m[k]/(1-.9**epoch)) / (np.sqrt(v[k]/(1-.999**epoch)) + 1e-8)
        vp = forward(vx, weights)[2]
        vl = float(-np.log(vp[np.arange(len(vy)), vy].clip(1e-8)).mean())
        if epoch == 1 or epoch % 5 == 0:
            tp = forward(tx, weights)[2]
            curve.append({'epoch': epoch, 'loss': round(float(-np.log(tp[np.arange(len(ty)), ty].clip(1e-8)).mean()), 5), 'validation_loss': round(vl, 5)})
        if vl < best_loss - 1e-5:
            best_loss, best, stale = vl, {k: w.copy() for k, w in weights.items()}, 0
        else:
            stale += 1
        if stale >= 45:
            break
    weights = best
    train_accuracy = float((forward(tx, weights)[2].argmax(1) == ty).mean())
    accuracy = float((forward(vx, weights)[2].argmax(1) == vy).mean())
    metadata = {'layers': dims, 'labels': labels, 'epochs': epoch, 'curve': curve,
                'train_samples': len(ty), 'validation_samples': len(vy), 'train_accuracy': train_accuracy,
                'validation_accuracy': accuracy, 'parameters': sum(w.size for w in weights.values()),
                'seconds': round(time.perf_counter()-started, 3), 'model': settings.embed_model,
                'trained_at': datetime.now(timezone.utc).isoformat(), 'optimizer': 'Adam', 'activation': 'ReLU'}
    buffer = io.BytesIO()
    np.savez_compressed(buffer, **weights)
    with store.connection() as db:
        db.execute('INSERT OR REPLACE INTO network VALUES(1,?,?)', (buffer.getvalue(), json.dumps(metadata)))
    return metadata


def metadata():
    with store.connection() as db:
        row = db.execute('SELECT metadata FROM network WHERE id=1').fetchone()
        return json.loads(row[0]) if row else None


def predict(vector):
    with store.connection() as db:
        row = db.execute('SELECT * FROM network WHERE id=1').fetchone()
    if not row:
        return None
    meta = json.loads(row['metadata'])
    if meta['model'] != settings.embed_model or len(vector) != meta['layers'][0]:
        return None
    with np.load(io.BytesIO(row['weights']), allow_pickle=False) as data:
        p = forward(store.normalized(vector)[None, :], data)[2][0]
    idx = int(p.argmax())
    return {'label': meta['labels'][idx], 'confidence': round(float(p[idx]), 4),
            'probabilities': {label: round(float(prob), 4) for label, prob in zip(meta['labels'], p)}}
