import json, os, urllib.request
from pathlib import Path
from datetime import datetime, timezone

api_key = os.environ['DEEPSEEK_API_KEY']
root = Path(__file__).resolve().parents[1]
data = root / 'data'
data.mkdir(exist_ok=True)
pool_path = data / 'pool.json'

# A deliberately broad editorial taxonomy so the page does not feel repetitive.
topics = [
    'amore','vita','motivazione','disciplina','coraggio','successo','fallimento','resilienza',
    'cambiamento','crescita personale','autostima','felicità','gratitudine','amicizia','famiglia',
    'solitudine','tempo','pazienza','sogni','ambizione','lavoro','leadership','libertà','viaggio',
    'nostalgia','speranza','delusione','ironia','filosofia','minimalismo','pace','forza','sport',
    'giovinezza','maturità','scelte','destino','consapevolezza','perdono','relazioni'
]

existing = json.loads(pool_path.read_text('utf-8')) if pool_path.exists() else []
used = {x.get('quote','').strip() for x in existing if x.get('quote')}
used_list = list(used)[-300:]

prompt = f'''Sei il curatore editoriale di una pagina Instagram italiana chiamata "Dimmelo con una citazione".
Genera 30 contenuti nuovi e molto diversi tra loro, distribuiti su più temi della lista:
{json.dumps(topics, ensure_ascii=False)}

Regole fondamentali:
- una sola citazione per elemento;
- niente doppioni rispetto alle citazioni già presenti sotto;
- usa solo citazioni realmente attribuibili con alta confidenza;
- non inventare citazioni e non inventare attribuzioni;
- se una frase è di origine incerta, NON usarla;
- privilegia autori classici e contemporanei molto noti e citazioni brevi;
- evita di usare sempre gli stessi 5 autori;
- category deve corrispondere a uno dei temi, o a un tema molto vicino;
- caption breve, naturale, non banale, in italiano;
- hashtags: 5-8 hashtag italiani pertinenti.

Citazioni già presenti da evitare:
{json.dumps(used_list, ensure_ascii=False)}

Restituisci SOLO JSON valido nel formato:
{{"posts":[{{"quote":"...","author":"...","category":"...","caption":"...","hashtags":["#..."]}}]}}
'''

payload = json.dumps({
    'model': 'deepseek-chat',
    'messages': [
        {'role':'system','content':'Rispondi esclusivamente con JSON valido.'},
        {'role':'user','content':prompt}
    ],
    'temperature': 0.7,
    'response_format': {'type':'json_object'}
}).encode()

req = urllib.request.Request(
    'https://api.deepseek.com/chat/completions',
    data=payload,
    headers={'Authorization': f'Bearer {api_key}', 'Content-Type':'application/json'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=120) as r:
    result = json.loads(r.read().decode())

raw = json.loads(result['choices'][0]['message']['content'])
posts = raw.get('posts') or []

clean = []
seen = set(used)
for post in posts:
    quote = str(post.get('quote','')).strip()
    author = str(post.get('author','')).strip()
    category = str(post.get('category','')).strip().lower()
    caption = str(post.get('caption','')).strip()
    hashtags = post.get('hashtags', [])
    if not quote or not author or not caption or not category or quote in seen:
        continue
    if not isinstance(hashtags, list):
        hashtags = [str(hashtags)]
    hashtags = [str(h).strip() for h in hashtags if str(h).strip()]
    clean.append({
        'quote': quote,
        'author': author,
        'category': category,
        'caption': caption,
        'hashtags': hashtags[:8],
        'generated_at': datetime.now(timezone.utc).isoformat()
    })
    seen.add(quote)

# Keep the newest candidates while preserving a useful backlog.
merged = existing + clean
pool_path.write_text(json.dumps(merged[-500:], ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Added {len(clean)} new posts. Pool size: {len(merged[-500:])}')
