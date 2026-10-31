# Builds blog/ from content/*.md.
# SITE_URL is the public origin plus project path (no trailing slash).
# Asset and nav links use that path so the site works at /ilteodongne-web/.
# Every HTML page is noindex. robots.txt disallows crawlers. No sitemap.
import html, os, re
from urllib.parse import urlparse

BASE = os.environ.get('SITE_URL', 'https://bon9ineai-wq.github.io/ilteodongne-web').rstrip('/')
prefix = urlparse(BASE).path.rstrip('/')
ROOT = f'{prefix}/' if prefix else '/'
ASSET = '20261031g'

# The approved 평택 원룸 월세 post is published. Search indexing stays off site-wide.
POSTS = [dict(slug='pyeongtaek-oneroom-rent', src='content/pyeongtaek-oneroom-rent.md', draft=False)]
BLOCKED_SLUGS = set()
BLOCKED_PARTS = ('평택_원룸_월세_시세_초안',)

HEAD = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title><meta name="description" content="{d}"><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="{url}">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}"><meta property="og:type" content="{ogt}"><meta property="og:url" content="{url}">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"><link rel="stylesheet" href="{root}app.css?v={asset}"><link rel="stylesheet" href="{root}blog.css?v={asset}"></head><body>
<header><a class="logo" href="{root}">일터<b>동네</b></a><nav><a href="{root}">직장 찾기</a><a class="on" href="{root}blog/">동네 이야기</a></nav></header><main class="post">'''
CTA = '<div class="cta"><b>이 동네 주변엔 어떤 회사가 있을까?</b><p>직종을 고르면 천안·아산·평택 회사·공장을 지도에서 보여드려요.</p><a href="{root}?c=제조/생산">회사 지도 보기 →</a></div>'

def blocked(slug, src, text=''):
    if slug in BLOCKED_SLUGS:
        return True
    blob = f'{slug}\n{src}\n{text[:500]}'
    return any(part in blob for part in BLOCKED_PARTS)

def publishable(md):
    # Drop editor notes. The page is published, and noindex is applied to every HTML page.
    md = re.sub(r'<!--.*?-->', '', md, flags=re.S)
    md = re.sub(r'^> \*\*초안.*\n?', '', md, flags=re.M)
    md = re.sub(r'^\*\*메타 설명[^*]*\*\*.*\n?', '', md, flags=re.M)
    md = re.sub(r'^\*\*키워드:\*\*.*\n?', '', md, flags=re.M)
    md = md.replace('**[일터동네 앱 바로가기 — 링크 미정]**', f'[일터동네에서 회사 지도 보기]({ROOT})')
    md = re.split(r'\n## 작성 메모', md)[0]
    return md.strip() + '\n'

def main():
    import markdown
    os.makedirs('blog', exist_ok=True)
    items = []
    for p in POSTS:
        src = p.get('src', '')
        slug = p.get('slug', '')
        if p.get('draft') or blocked(slug, src):
            print('skip unpublished', slug or src)
            continue
        raw = open(src, encoding='utf-8').read()
        if blocked(slug, src, raw[:80]):
            print('skip unpublished', slug or src)
            continue
        title = re.search(r'^# (.+)$', raw, re.M).group(1).strip()
        m = re.search(r'\*\*메타 설명[^*]*\*\*\s*(.+)', raw)
        desc = m.group(1).strip() if m else title
        md = publishable(raw)
        body = markdown.markdown(re.sub(r'^# .+\n', '', md, count=1, flags=re.M), extensions=['tables'])
        url = f'{BASE}/blog/{slug}/'
        os.makedirs(f'blog/{slug}', exist_ok=True)
        page = HEAD.format(t=html.escape(title) + ' | 일터동네', d=html.escape(desc), url=url, ogt='article', root=ROOT, asset=ASSET)
        page += f'<article><h1>{html.escape(title)}</h1>{body}</article>' + CTA.format(root=ROOT) + '</main></body></html>'
        open(f'blog/{slug}/index.html', 'w', encoding='utf-8').write(page)
        items.append((p, title, desc))
    li = ''.join(
        f'<li><a href="{ROOT}blog/{p["slug"]}/"><b>{html.escape(t)}</b><small>{html.escape(d[:90])}…</small></a></li>'
        for p, t, d in items
    )
    blog = HEAD.format(
        t='동네 이야기 | 일터동네',
        d='천안·아산·평택 동네별 월세·회사·인프라 이야기',
        url=BASE + '/blog/',
        ogt='website',
        root=ROOT,
        asset=ASSET,
    )
    blog += f'<h1>동네 이야기</h1><ul class="plist">{li}</ul>' + CTA.format(root=ROOT) + '</main></body></html>'
    open('blog/index.html', 'w', encoding='utf-8').write(blog)
    if os.path.exists('sitemap.xml'):
        os.remove('sitemap.xml')
    open('robots.txt', 'w', encoding='utf-8').write('User-agent: *\nDisallow: /\n')
    print('built', len(items), 'site', BASE, 'root', ROOT)

if __name__ == '__main__':
    main()
