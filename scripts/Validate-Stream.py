"""Measure the actual HTTP stream on the isolated QA server, not the main database."""
import json
import time
from pathlib import Path
import httpx

start=time.perf_counter();first=None;parts=[];done=None
with httpx.Client(base_url='http://127.0.0.1:8010',trust_env=False,timeout=180) as client:
    with client.stream('POST','/api/chat/stream',json={'text':'Explique em duas frases o que é uma rede neural.'},headers={'Accept-Encoding':'gzip','Accept':'text/event-stream'}) as response:
        response.raise_for_status();headers=dict(response.headers)
        for line in response.iter_lines():
            if not line.startswith('data: '):continue
            event=json.loads(line[6:])
            if event['type']=='delta':
                if first is None:first=time.perf_counter()-start
                parts.append(event['text'])
            elif event['type']=='error':raise RuntimeError(event['detail'])
            elif event['type']=='done':done=event['result']
total=time.perf_counter()-start
assert done and len(parts)>1 and first<total
assert 'content-encoding' not in headers
assert done['answer']==''.join(parts).strip()
report={'success':True,'first_text_seconds':round(first,3),'complete_seconds':round(total,3),'chunks':len(parts),'gzip_buffering':False,'content_type':headers['content-type'],'answer':done['answer'],'database':'isolated QA database on port 8010'}
(Path(__file__).resolve().parents[1]/'VALIDATION-STREAM.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='answer'},ensure_ascii=True))
