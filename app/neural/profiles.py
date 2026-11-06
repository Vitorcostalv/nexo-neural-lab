"""Named local spaces. No passwords or access control; API authorization is unchanged."""
import base64
import contextvars
import json
import re
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from app.neural import store

selected_database = contextvars.ContextVar('nexo_profile_database', default=None)
router = APIRouter(prefix='/api/profiles')
TABLES = {'memories': ['id','text','label','digest','vector','model','dimension','created','origin'],
          'messages': ['id','role','text','sources'], 'network': ['id','weights','metadata'],
          'conversation_state': ['key','value']}

def registry_path():
    return store.DB.with_name(store.DB.stem + '-profiles.sqlite3')

@contextmanager
def registry():
    path=registry_path();path.parent.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(path,timeout=15);db.row_factory=sqlite3.Row
    db.execute('CREATE TABLE IF NOT EXISTS profiles(id TEXT PRIMARY KEY,name TEXT NOT NULL,path TEXT NOT NULL,deleted INTEGER DEFAULT 0)')
    db.execute('CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,profile_id TEXT NOT NULL,path TEXT NOT NULL)')
    try:
        with db:yield db
    finally:db.close()

def profile_path(identifier):
    folder=store.DB.parent/(store.DB.stem+'-spaces');folder.mkdir(parents=True,exist_ok=True)
    return folder/(identifier+'.sqlite3')

def initialize_path(path):
    token=selected_database.set(path)
    try:store.initialize()
    finally:selected_database.reset(token)

def ensure_profiles():
    with registry() as db:
        if db.execute('SELECT count(*) FROM profiles').fetchone()[0]:return
        target=profile_path('legacy-local')
        # sqlite backup includes WAL pages. Never mutate or rename the legacy source.
        if store.DB.exists():
            source=sqlite3.connect(store.DB);destination=sqlite3.connect(target)
            try:source.backup(destination)
            finally:source.close();destination.close()
        initialize_path(target)
        db.execute('INSERT INTO profiles(id,name,path) VALUES(?,?,?)',('legacy-local','Dados anteriores',str(target)))

def resolve_profile(identifier,generation=None):
    ensure_profiles()
    with registry() as db:
        row=db.execute('SELECT * FROM profiles WHERE id=? AND deleted=0',(identifier,)).fetchone()
        if not row:raise HTTPException(404,'Perfil local não encontrado. Atualize a lista de perfis.')
        if generation:
            gen=db.execute('SELECT path FROM generations WHERE id=? AND profile_id=?',(generation,identifier)).fetchone()
            if not gen:raise HTTPException(404,'Restauração local não encontrada.')
            return Path(gen['path'])
        return Path(row['path'])

async def bind_profile(request:Request):
    identifier=request.headers.get('x-nexo-profile')
    # After migration, legacy API calls refer to the initial space, never a newly typed name.
    if not identifier and registry_path().exists() and request.url.path.startswith('/api/') and not request.url.path.startswith('/api/profiles'):
        with registry() as db:
            row=db.execute("SELECT id FROM profiles WHERE id='legacy-local' AND deleted=0").fetchone()
        if not row:raise HTTPException(409,'Selecione um perfil pelo cabeçalho X-Nexo-Profile.')
        identifier=row['id']
    token=selected_database.set(resolve_profile(identifier,request.headers.get('x-nexo-generation')) if identifier else None)
    try:yield
    finally:selected_database.reset(token)

class Name(BaseModel):
    name:str=Field(min_length=1,max_length=48)

def valid_name(name):
    name=name.strip()
    if not name or re.search(r'[\x00-\x1f]',name):raise HTTPException(422,'Nome inválido.')
    return name

def idle():
    from app.neural.api import operation_lock
    if operation_lock.locked():raise HTTPException(409,'Aguarde a operação atual antes de alterar perfis.')

@router.get('')
def profiles():
    ensure_profiles()
    with registry() as db:return [dict(id=r['id'],name=r['name']) for r in db.execute('SELECT * FROM profiles WHERE deleted=0 ORDER BY rowid')]

@router.post('')
def create(body:Name):
    idle();name=valid_name(body.name);identifier=str(uuid.uuid4());path=profile_path(identifier);initialize_path(path)
    with registry() as db:db.execute('INSERT INTO profiles(id,name,path) VALUES(?,?,?)',(identifier,name,str(path)))
    return {'id':identifier,'name':body.name.strip()}

@router.patch('/{identifier}')
def rename(identifier:str,body:Name):
    idle();resolve_profile(identifier)
    with registry() as db:db.execute('UPDATE profiles SET name=? WHERE id=?',(valid_name(body.name),identifier))
    return {'id':identifier,'name':body.name.strip()}

@router.delete('/{identifier}')
def remove(identifier:str,body:dict):
    idle();path=resolve_profile(identifier)
    with registry() as db:
        row=db.execute('SELECT name FROM profiles WHERE id=?',(identifier,)).fetchone()
        if body.get('confirmation')!='EXCLUIR '+row['name']:raise HTTPException(422,'Confirmação incorreta.')
        db.execute('UPDATE profiles SET deleted=1 WHERE id=?',(identifier,))
        paths=[path,*[Path(r['path']) for r in db.execute('SELECT path FROM generations WHERE profile_id=?',(identifier,))]]
        if identifier=='legacy-local':paths.append(store.DB)
        db.execute('DELETE FROM generations WHERE profile_id=?',(identifier,))
    for path in paths:
        for suffix in ('','-wal','-shm'):
            try:Path(str(path)+suffix).unlink(missing_ok=True)
            except PermissionError:pass # tombstone prevents subsequent API access
    return {'deleted':True}

def dump_native(path):
    db=sqlite3.connect(path);db.row_factory=sqlite3.Row
    try:
        db.execute('BEGIN')
        return {table:[{k:({'base64':base64.b64encode(r[k]).decode()} if isinstance(r[k],bytes) else r[k]) for k in columns} for r in db.execute('SELECT * FROM '+table+' ORDER BY '+columns[0])] for table,columns in TABLES.items()}
    finally:db.close()

@router.get('/{identifier}/snapshot')
def snapshot(identifier:str,request:Request):
    idle();path=resolve_profile(identifier,request.headers.get('x-nexo-generation'))
    return {'edition':'python-sqlite-v1','embedding':store.settings.embed_model,'tables':dump_native(path)}

def validate_native(payload):
    if payload.get('edition')!='python-sqlite-v1' or payload.get('embedding')!=store.settings.embed_model:raise HTTPException(422,'Backup Python exige o mesmo modelo de embeddings. Restaure na edição de origem.')
    tables=payload.get('tables')
    if not isinstance(tables,dict) or set(tables)!=set(TABLES):raise HTTPException(422,'Tabelas inválidas.')
    if len(json.dumps(payload))>100*1024*1024:raise HTTPException(413,'Backup local excede 100 MB.')
    limits={'memories':5000,'messages':10000,'network':1,'conversation_state':10}
    decoded={}
    for table,columns in TABLES.items():
        rows=tables[table]
        if not isinstance(rows,list) or len(rows)>limits[table]:raise HTTPException(422,'Capacidade excedida: '+table)
        seen=set();decoded[table]=[]
        for row in rows:
            if not isinstance(row,dict) or set(row)!=set(columns):raise HTTPException(422,'Registro inválido: '+table)
            identifier=row[columns[0]]
            if table=='conversation_state':
                if not isinstance(identifier,str) or len(identifier)>100:raise HTTPException(422,'Chave inválida.')
            elif type(identifier) is not int or identifier<1 or identifier>2**53-1:raise HTTPException(422,'ID inválido.')
            if identifier in seen:raise HTTPException(422,'ID duplicado.')
            seen.add(row[columns[0]]);item={}
            for k,v in row.items():
                if isinstance(v,dict):
                    if k not in ('vector','weights') or set(v)!={'base64'}:raise HTTPException(422,'Binário inesperado.')
                    try:v=base64.b64decode(v['base64'],validate=True)
                    except (ValueError,TypeError):raise HTTPException(422,'Binário inválido.')
                item[k]=v
            if table=='memories':
                import numpy as np
                if not isinstance(item['text'],str) or not item['text'].strip() or len(item['text'])>6000 or not isinstance(item['label'],str) or len(item['label'])>48 or item['digest']!=store.digest(item['text']) or item['model']!=store.settings.embed_model:raise HTTPException(422,'Memória inválida.')
                try:v=np.frombuffer(item['vector'],dtype=np.float32);store.normalized(v)
                except (ValueError,TypeError):raise HTTPException(422,'Vetor inválido.')
                if type(item['dimension']) is not int or not 1<=item['dimension']<=8192 or len(v)!=item['dimension']:raise HTTPException(422,'Dimensão inválida.')
            if table=='conversation_state' and (type(item['value']) is not int or not 0<=item['value']<=2**53-1):raise HTTPException(422,'Limite de contexto inválido.')
            if table=='messages':
                if item['role'] not in ('user','assistant') or not isinstance(item['text'],str) or len(item['text'])>100000 or not isinstance(item['sources'],str):raise HTTPException(422,'Mensagem inválida.')
                try:
                    sources=json.loads(item['sources'])
                    if not isinstance(sources,list) or len(sources)>20:raise ValueError()
                except (ValueError,TypeError):raise HTTPException(422,'Fontes da mensagem inválidas.')
            if table=='network':
                # Validate numeric arrays without unpickling arbitrary imported objects.
                import io
                import zipfile
                import numpy as np
                try:
                    with zipfile.ZipFile(io.BytesIO(item['weights'])) as zipped:
                        if sum(f.file_size for f in zipped.infolist())>4*1024*1024:raise ValueError()
                    with np.load(io.BytesIO(item['weights']),allow_pickle=False) as archive:
                        if set(archive.files)!={'w1','b1','w2','b2','w3','b3'} or any(not np.isfinite(archive[key]).all() for key in archive.files):raise ValueError()
                        metadata=json.loads(item['metadata']);classes=len(metadata['labels']);dimension=archive['w1'].shape[0]
                        shapes={'w1':(dimension,64),'b1':(64,),'w2':(64,24),'b2':(24,),'w3':(24,classes),'b3':(classes,)}
                        if not 2<=classes<=32 or not 1<=dimension<=8192 or any(archive[k].shape!=v for k,v in shapes.items()):raise ValueError()
                except (ValueError,TypeError,KeyError,IndexError,zipfile.BadZipFile):raise HTTPException(422,'Classificador inválido.')
            decoded[table].append(item)
    if len({r['dimension'] for r in decoded['memories']})>1:raise HTTPException(422,'Dimensões incompatíveis na mesma base.')
    return decoded

@router.post('/{identifier}/stage')
def stage(identifier:str,body:dict,request:Request):
    idle();current=resolve_profile(identifier,request.headers.get('x-nexo-generation'));decoded=validate_native(body.get('snapshot',{}));generation=str(uuid.uuid4());path=profile_path(generation)
    try:
        if body.get('merge'):
            source=sqlite3.connect(current);destination=sqlite3.connect(path)
            try:source.backup(destination)
            finally:source.close();destination.close()
        else:initialize_path(path)
        db=sqlite3.connect(path);db.row_factory=sqlite3.Row
        try:
            with db:
                if body.get('merge') and (decoded['network'] or db.execute('SELECT 1 FROM network LIMIT 1').fetchone()):
                    existing=[dict(r) for r in db.execute('SELECT * FROM memories ORDER BY id')]
                    if existing!=sorted(decoded['memories'],key=lambda r:r['id']):raise HTTPException(409,'Mesclar bases distintas com MLP treinado exige novo perfil, para preservar os pesos e sua base de origem.')
                if not body.get('merge'):
                    for table in TABLES:db.execute('DELETE FROM '+table)
                for table,columns in TABLES.items():
                    for row in decoded[table]:
                        old=db.execute('SELECT * FROM '+table+' WHERE '+columns[0]+'=?',(row[columns[0]],)).fetchone()
                        if old and dict(old)!=row:raise HTTPException(409,'Conflito de IDs no SQLite. Restaure em novo perfil.')
                        if not old:db.execute('INSERT INTO '+table+'('+','.join(columns)+') VALUES('+','.join('?' for _ in columns)+')',tuple(row[c] for c in columns))
                if db.execute('SELECT count(*) FROM memories').fetchone()[0]>5000 or db.execute('SELECT count(*) FROM messages').fetchone()[0]>10000:raise HTTPException(422,'Capacidade excedida.')
        finally:db.close()
        with registry() as registry_db:registry_db.execute('INSERT INTO generations VALUES(?,?,?)',(generation,identifier,str(path)))
        return {'generation':generation}
    except BaseException:
        path.unlink(missing_ok=True);raise
