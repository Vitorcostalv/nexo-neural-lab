"""Author-maintained seed + a pinned-in-repository snapshot of official IBGE facts.
Not run by the app, build, or CI. Re-running deliberately refreshes country facts.
"""
import json
import gzip
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'lab-web' / 'knowledge'
catalog = json.loads((folder / 'seed.json').read_text(encoding='utf-8'))
codes = 'BR|PT|FR|GB|JP|AR|CL|UY|US|DE|IT|ES|CN|IN|AU|CA|MZ|AO'
url = 'https://servicodados.ibge.gov.br/api/v1/paises/' + codes.replace('|', '%7C')
with urllib.request.urlopen(url, timeout=30) as response:
    data = response.read()
    countries = json.loads(gzip.decompress(data) if data.startswith(b'\x1f\x8b') else data)
assert len(countries) == 18
for country in countries:
    code = country['id']['ISO-3166-1-ALPHA-2']
    name = country['nome']['abreviado']
    capital = country['governo']['capital']['nome']
    key = 'country-' + code.lower()
    aliases = [name.lower()]
    aliases += {'GB': ['reino unido', 'gra bretanha'], 'US': ['eua', 'estados unidos'], 'JP': ['japao'], 'BR': ['brasil']}.get(code, [])
    catalog['sources'][key] = {'publisher': 'IBGE', 'title': 'Países — ' + name, 'url': 'https://servicodados.ibge.gov.br/api/v1/paises/' + code}
    preposition = {'BR': 'do', 'PT': 'de', 'FR': 'da', 'GB': 'do', 'JP': 'do', 'AR': 'da', 'CL': 'do', 'UY': 'do', 'US': 'dos', 'DE': 'da', 'IT': 'da', 'ES': 'da', 'CN': 'da', 'IN': 'da', 'AU': 'da', 'CA': 'do', 'MZ': 'de', 'AO': 'de'}[code]
    rules = [{'id': 'capital', 'pattern': 'capital', 'exclude': 'empresa|personagem|ficcao', 'answer': f'A capital {preposition} {name} é {capital}.'}]
    languages = ', '.join(item['nome'] for item in country.get('linguas', []))
    if languages:
        rules.append({'id': 'language', 'pattern': 'idioma|lingua', 'exclude': 'programacao', 'answer': f'Idiomas registrados pelo IBGE para {name}: {languages}.'})
    catalog['cards'].append({'id': key, 'title': name, 'aliases': sorted(set(aliases)), 'sourceIds': [key], 'rules': rules})
(folder / 'base.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f"{len(catalog['cards'])} cards; {len(catalog['sources'])} sources; {catalog['version']}")
