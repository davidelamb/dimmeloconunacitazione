import json, os, re, urllib.request
from pathlib import Path

api_key = os.environ['DEEPSEEK_API_KEY']
topic = os.environ.get('TOPIC', 'vita').strip() or 'vita'
root = Path(__file__).resolve().parents[1]
data = root / 'data'
data.mkdir(exist_ok=True)
history_path = data / 'history.json'
latest_path = data / 'latest.json'

history = json.loads(history_path.read_text('utf-8')) if history_path.exists() else []
used = [x.get('quote','') for x in history]

prompt = f'''Sei il curatore della pagina Instagram italiana "Dimmelo con una citazione".
Prepara UNA citazione reale e verificabile sul tema: {topic}.
Non inventare citazioni, non inventare attribuzioni e non usare frasi virali di provenienza dubbia.
Se non sei ragionevolmente sicuro dell'attribuzione, scegli un autore/frase di cui sei sicuro.
Non scegliere nessuna di queste citazioni già usate: {json.dumps(used[-100:], ensure_ascii=False)}.
Restituisci SOLO JSON con queste chiavi: quote, author, category, caption, hashtags.
La caption deve essere breve, naturale e adatta a Instagram. Hashtags deve essere un array di 5-8 hashtag italiani.
'''

payload = json.dumps({
    'model': 'deepseek-chat',
    'messages': [
        {'role':'system','content':'Rispondi esclusivamente con JSON valido.'},
        {'role':'user','content':prompt}
    ],
    'temperature': 0.6,
    'response_format': {'type':'json_object'}
}).encode()

req = urllib.request.Request(
    'https://api.deepseek.com/chat/completions',
    data=payload,
    headers={'Authorization': f'Bearer {api_key}', 'Content-Type':'application/json'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=60) as r:
    result = json.loads(r.read().decode())

content = result['choices'][0]['message']['content']
post = json.loads(content)
required = ['quote','author','category','caption','hashtags']
if any(not post.get(k) for k in required):
    raise ValueError('DeepSeek returned incomplete JSON')
if post['quote'] in used:
    raise ValueError('Duplicate quote returned')

post['hashtags'] = post['hashtags'] if isinstance(post['hashtags'], list) else re.findall(r'#[\wÀ-ÿ]+', str(post['hashtags']))
post['generated_at'] = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
post['topic_requested'] = topic
latest_path.write_text(json.dumps(post, ensure_ascii=False, indent=2), encoding='utf-8')
history.append(post)
history_path.write_text(json.dumps(history[-500:], ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(post, ensure_ascii=False, indent=2))
