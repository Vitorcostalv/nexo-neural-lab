"""Same editorial catalog and conservative routing contract as the browser edition."""
import json
import re
import unicodedata
from functools import lru_cache
from app.config import ROOT

PERSONAL = re.compile(r'\b(meu|minha|meus|minhas|eu)\b')
CREATIVE = re.compile(r'\b(escreva|crie|gere|implemente|corrija|traduza|compare|resuma|poema|codigo|funcao|script|programe)\b')
FOLLOWUP = re.compile(r'^(e (a|o) (ultima|ultimo|idade|capital)|quando (ela |ele )?(nasceu|morreu|faleceu)|qual (a )?idade( dela| dele)?|quantos anos( ela| ele)?( tem| tinha)?|explique isso( de forma mais simples)?|mais simples|por que isso)$')

def normalize(text):
    text = ''.join(c for c in unicodedata.normalize('NFKD', str(text or '')) if not unicodedata.combining(c)).lower()
    return ' '.join(re.sub(r'[^a-z0-9\s]', ' ', text).split())

@lru_cache(maxsize=1)
def catalog():
    return json.loads((ROOT/'lab-web'/'knowledge'/'base.json').read_text(encoding='utf-8'))

def candidates(text, data):
    padded = ' '+text+' '
    hits = [(max([0]+[len(normalize(a)) for a in card['aliases'] if ' '+normalize(a)+' ' in padded]), card) for card in data['cards']]
    return [card for weight, card in sorted(hits, key=lambda hit: (-hit[0], hit[1]['id'])) if weight][:3]

def lookup(question, recent, data=None):
    data = data or catalog()
    q = normalize(question)
    if PERSONAL.search(q):return {'answer':None, 'knowledge':None}
    hits = candidates(q, data)
    context_question = None
    rule_query = q
    previous = next((turn for turn in reversed(recent) if turn['role']=='user'), {})
    previous_text = previous.get('text', previous.get('content', ''))
    prev = normalize(previous_text)
    if not hits and FOLLOWUP.search(q) and len(q.split())<=12:
        users = [turn for turn in reversed(recent) if turn['role']=='user'][:6]
        for turn in users:
            text = turn.get('text',turn.get('content',''))
            normalized = normalize(text)
            if PERSONAL.search(normalized):break
            hits = candidates(normalized,data)
            if hits:
                context_question = text
                break
            if not FOLLOWUP.search(normalized):break
        if not hits and (not users or re.search(r'\b(ultima|ultimo)\b',q)):return {'answer':'De qual pessoa ou assunto você está falando? Preciso dessa informação para responder sem adivinhar.', 'knowledge':{'version':data['version'], 'method':'clarification', 'refs':[]}}
    elif hits and re.match(r'^e\b', q) and not PERSONAL.search(prev) and re.search(r'\bcapital\b', prev) and not re.search(r'idade|lingua|idioma|populacao|presidente', q):
        rule_query += ' capital'
        context_question = previous_text
    if not hits:return {'answer':None, 'knowledge':None}
    matches = [(card, next((rule for rule in card['rules'] if re.search(rule['pattern'], rule_query) and not (rule.get('exclude') and re.search(rule['exclude'], rule_query))), None)) for card in hits]
    chosen = [(card,rule) for card,rule in matches if rule]
    used = chosen or matches
    refs, seen = [], set()
    for card,rule in used:
        for source_id in (rule or {}).get('sourceIds',card['sourceIds']):
            if source_id in seen or len(refs)==6:continue
            seen.add(source_id)
            refs.append({'id':'K:'+source_id, **data['sources'][source_id], 'reviewedAt':data['reviewedAt'], 'excerpt':(rule or card['rules'][0])['answer']})
    creative = bool(CREATIVE.search(q))
    knowledge = {'version':data['version'], 'method':'model-context' if creative else 'curated-answer' if chosen else 'knowledge-gap', 'contextQuestion':context_question, 'topics':[card['id'] for card,rule in used], 'refs':refs}
    if creative:return {'answer':None, 'knowledge':knowledge}
    if chosen:
        answers=[]
        for card,rule in chosen:
            answer=rule['answer']
            if not any(old in answer or answer in old for old in answers):answers.append(answer)
        return {'answer':' '.join(answers), 'knowledge':knowledge}
    return {'answer':'Não tenho esse detalhe verificado sobre '+', '.join(card['title'] for card in hits)+' na base local. Pode especificar o que deseja saber ou fornecer uma fonte?', 'knowledge':knowledge}
