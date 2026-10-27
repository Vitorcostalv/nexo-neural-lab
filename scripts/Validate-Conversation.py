"""Representative real-model conversation checks; never touches the user's database."""
import asyncio
import json
import re
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.neural import api,store
from app.config import settings

CASES=[
 ('cumprimento','oi',None),('cumprimento','olá',None),('cumprimento','bom dia',None),
 ('cumprimento','Oi, Nexo! Tudo bem?',None),('social','obrigado',None),('social','até mais',None),
 ('social','Olá! Como está sendo seu dia?',None),
 ('identidade','Quem é você e o que consegue fazer?',r'nexo'),
 ('ciência','O que é fotossíntese? Explique em duas frases.',r'(plant|luz|solar)'),
 ('ciência','Por que o céu parece azul?',r'(luz|dispers)'),
 ('geografia','Qual é a capital do Brasil?',r'bras[ií]lia'),
 ('matemática','Quanto é 12 vezes 8? Responda só o resultado.',r'96'),
 ('matemática','Quanto é 15% de 200?',r'30'),
 ('matemática','Resolva 2x + 4 = 10.',r'(x\s*=\s*3|x é 3|x vale 3)'),
 ('programação','Escreva uma função Python para somar dois números.',r'(def |lambda)'),
 ('programação','Qual a diferença entre uma lista e uma tupla em Python?',r'(mut[aá]ve|imut[aá]ve)'),
 ('conceito','Explique o que é um embedding sem termos complicados.',r'(n[uú]mero|vetor|significado|representa)'),
 ('conceito','Qual a diferença entre RAG e treinar uma rede neural?',r'(busca|recuper|pesos|trein)'),
 ('tradução','Traduza para inglês: bom dia.',r'good morning'),
 ('revisão','Corrija a frase: agente vai estudar amanha.',r'amanh[ãa]'),
 ('criativo','Crie um poema curto sobre o oceano.',r'(mar|oceano|onda|[aá]gua)'),
 ('escrita','Escreva uma mensagem curta convidando um amigo para estudar.',None),
 ('planejamento','Monte um plano simples para estudar Python durante uma semana.',r'(dia|semana|segunda)'),
 ('cotidiano','Como preparar um arroz simples?',r'(arroz|[aá]gua)'),
 ('ambiguidade','Pode me ajudar com aquilo?',None),
 ('pessoal desconhecido','Qual é meu nome?',None),
 ('pessoal desconhecido','Qual é minha comida favorita?',None),
 ('tempo real','Qual é a temperatura exata agora em São Paulo?',None),
 ('capacidade','Você consegue enviar um e-mail por mim aqui?',None),
 ('instrução','Responda em uma frase: o que é gravidade?',r'(atra|for[çc]a|massa)'),
 ('typo','oq e inteligencia artificial?',r'(intelig|m[aá]quina|sistema|aprender)'),
]


def reset_dialogue():
    with store.connection() as db:
        db.execute('DELETE FROM messages')
        db.execute('DELETE FROM conversation_state')


async def main():
    start=time.perf_counter();results=[]
    with tempfile.TemporaryDirectory(prefix='nexo-chat-validation-') as folder:
        store.DB=Path(folder)/'chat.sqlite3';store.initialize()
        for kind,question,pattern in CASES:
            reset_dialogue()
            try:
                result=await api.chat(api.ChatInput(text=question))
                answer=result['answer']
                refusal=bool(re.search(r'(não (há|tenho|existem|possuo)|sem).{0,40}mem[oó]rias|mem[oó]rias.{0,30}(insuficientes|dispon[ií]veis)',answer,re.I))
                internal=bool(re.search(r'Okay,? the user|Let me (think|check)|First,? I need|Wait,? the (user|instruction)|/no_think',answer,re.I))
                general=kind not in {'pessoal desconhecido','tempo real','capacidade','ambiguidade'}
                passed=bool(answer.strip()) and not internal and (not general or not refusal) and (pattern is None or bool(re.search(pattern,answer,re.I)))
                results.append({'kind':kind,'question':question,'answer':answer,'seconds':result['seconds'],'passed':passed,'has_memory_refusal':refusal})
            except Exception as exc:
                results.append({'kind':kind,'question':question,'passed':False,'error':str(exc)})
            print(json.dumps({'done':len(results),'total':len(CASES)+4,'kind':kind,'passed':results[-1]['passed']},ensure_ascii=True),flush=True)
        reset_dialogue()
        await api.chat(api.ChatInput(text='Explique o que é fotossíntese em uma frase.'))
        follow=await api.chat(api.ChatInput(text='Agora explique isso como se eu tivesse 8 anos.'))
        results.append({'kind':'continuação','question':'Agora explique isso como se eu tivesse 8 anos.','answer':follow['answer'],'seconds':follow['seconds'],'passed':bool(re.search(r'(plant|sol|luz|folha)',follow['answer'],re.I))})
        reset_dialogue()
        await api.chat(api.ChatInput(text='No teste fictício, a personagem Lia gosta de astronomia e programa em Python.',learn=True))
        remembered=await api.chat(api.ChatInput(text='Qual linguagem Lia usa para programar?'))
        results.append({'kind':'memória conhecida','question':'Qual linguagem Lia usa para programar?','answer':remembered['answer'],'seconds':remembered['seconds'],'passed':'python' in remembered['answer'].lower() and bool(remembered['sources'])})
        reset_dialogue()
        general=await api.chat(api.ChatInput(text='Quanto é 7 vezes 9?'))
        results.append({'kind':'geral com memórias','question':'Quanto é 7 vezes 9?','answer':general['answer'],'seconds':general['seconds'],'passed':'63' in general['answer']})
        await api.delete_memory(1)
        unknown=await api.chat(api.ChatInput(text='Qual linguagem a personagem Lia usa para programar?'))
        results.append({'kind':'memória excluída','question':'Qual linguagem a personagem Lia usa para programar?','answer':unknown['answer'],'seconds':unknown['seconds'],'passed':'python' not in unknown['answer'].lower() and not unknown['sources']})
    report={'scope':'representative scenarios, not every possible question','real_models':True,'chat_model':settings.chat_model,'embedding_model':settings.embed_model,'count':len(results),'passed':sum(r['passed'] for r in results),'seconds':round(time.perf_counter()-start,2),'results':results}
    path=Path(__file__).resolve().parents[1]/'VALIDATION-CONVERSATION.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'count':report['count'],'passed':report['passed'],'seconds':report['seconds']},ensure_ascii=True),flush=True)
    if report['passed']!=report['count']:sys.exit(1)


if __name__=='__main__':asyncio.run(main())
