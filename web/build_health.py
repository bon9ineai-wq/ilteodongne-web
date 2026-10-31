# Rebuilds pharmacy and clinic entries in data/infra.json from the
# 국립중앙의료원 extract. Bus stops and convenience stores stay as they are.
# Usage: python3 build_health.py pharmacies.json clinics.json
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
INFRA = ROOT / 'data' / 'infra.json'
KEEP_TYPES = {
    '의원', '치과의원', '치과병원', '한의원', '한방병원',
    '병원', '요양병원', '종합병원', '보건소',
}

def compact_hours(hours):
    if not hours:
        return None
    out = {}
    for day, span in hours.items():
        if not span:
            continue
        open_, close = span.get('open'), span.get('close')
        if open_ and close:
            out[day] = [open_, close]
    return out or None

def compact(rec, with_type):
    item = {
        'n': rec['name'],
        'lat': round(float(rec['lat']), 5),
        'lon': round(float(rec['lon']), 5),
    }
    if with_type:
        item['t'] = rec.get('type') or ''
    hours = compact_hours(rec.get('hours'))
    if hours:
        item['h'] = hours
    if rec.get('night_open'):
        item['night'] = 1
    if rec.get('sat_open'):
        item['sat'] = 1
    if rec.get('sun_open'):
        item['sun'] = 1
    if rec.get('holiday_open'):
        item['hol'] = 1
    if rec.get('emergency'):
        item['em'] = 1
    return item

def main():
    pharmacies = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    clinics = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
    infra = json.loads(INFRA.read_text(encoding='utf-8'))
    infra.pop('hospital', None)
    infra.pop('pharmacy', None)
    infra['pharmacy'] = [compact(r, False) for r in pharmacies if r.get('lat') is not None and r.get('lon') is not None]
    infra['clinic'] = [compact(r, True) for r in clinics if r.get('type') in KEEP_TYPES and r.get('lat') is not None]
    INFRA.write_text(json.dumps(infra, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('pharmacy', len(infra['pharmacy']), 'clinic', len(infra['clinic']),
          'bus', len(infra.get('bus') or []), 'convenience', len(infra.get('convenience') or []),
          'bytes', INFRA.stat().st_size)

if __name__ == '__main__':
    main()
