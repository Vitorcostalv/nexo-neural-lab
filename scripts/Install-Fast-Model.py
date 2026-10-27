"""Download the official small non-thinking model into the running local Ollama."""
import json
import httpx

MODEL='qwen3:4b-instruct-2507-q4_K_M'
last=-1
with httpx.Client(timeout=1200,trust_env=False) as client:
    with client.stream('POST','http://127.0.0.1:11435/api/pull',json={'model':MODEL,'stream':True}) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if not line:continue
            event=json.loads(line)
            if event.get('error'):raise RuntimeError(event['error'])
            if event.get('total',0)>100_000_000:
                percent=int(100*event.get('completed',0)/event['total'])//10*10
                if percent!=last:print(f'Download: {percent}%',flush=True);last=percent
            elif event.get('status')=='success':print('Official Instruct model installed.',flush=True)
