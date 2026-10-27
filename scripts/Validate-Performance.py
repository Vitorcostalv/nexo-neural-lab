"""Compare warm local models and measure first visible text, without user data."""
import asyncio
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import ollama_client as ollama
from app.config import settings
from app.neural.conversation import build_messages

QUERIES=[
    'Explique em duas frases o que é uma rede neural.',
    'Quanto é 15% de 200? Responda em uma frase.',
    'Escreva uma função Python curta que soma dois números.',
]

async def main():
    models=['qwen3:8b','qwen3:4b-instruct-2507-q4_K_M'];results=[]
    for model in models:
        settings.chat_model=model
        await ollama.request('/api/generate',{'model':model,'prompt':'','keep_alive':'15m','options':{'num_ctx':settings.context_tokens}})
        for query in QUERIES:
            start=time.perf_counter();first=None;pieces=[]
            async for chunk in ollama.generate_stream_unlocked(build_messages(query,[],[])):
                if first is None:first=time.perf_counter()-start
                pieces.append(chunk)
            item={'model':model,'query':query,'first_text_seconds':round(first,3),'complete_seconds':round(time.perf_counter()-start,3),'answer':''.join(pieces).strip()}
            results.append(item);print(json.dumps({k:v for k,v in item.items() if k!='answer'},ensure_ascii=True),flush=True)
        if model==models[0]:await ollama.request('/api/generate',{'model':model,'keep_alive':0})
    report={'warm_models':True,'baseline_ui_waited_for_complete_answer':True,'new_ui_streams':True,'results':results}
    (Path(__file__).resolve().parents[1]/'VALIDATION-PERFORMANCE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':asyncio.run(main())
