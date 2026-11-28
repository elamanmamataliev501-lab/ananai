import asyncio,base64,hashlib,json,os,re,threading,time,uuid
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.async_api import async_playwright

import shutil,urllib.request,urllib.parse
DIR=Path(os.environ['RUNNER_TEMP'])
repo=Path.cwd()
def json_request(url,headers):
 with urllib.request.urlopen(urllib.request.Request(url,headers=headers)) as r:return json.load(r)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
http=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(repo)));threading.Thread(target=http.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{http.server_port}/'

async def bridge(route):
 if urlsplit(route.request.url).hostname=='wa.me':
  (DIR/'whatsapp.json').write_text(json.dumps(parse_qs(urlsplit(route.request.url).query)));return await route.fulfill(status=200,body='WhatsApp handoff captured')
 return await route.continue_()
async def main():
 async with async_playwright() as pw:
  browser=await pw.chromium.launch(executable_path=shutil.which('google-chrome'),args=['--no-sandbox']);errors=[]
  async def context():
   c=await browser.new_context(viewport={'width':390,'height':844});await c.route('https://wa.me/**',bridge);p=await c.new_page();p.set_default_timeout(75000);p.on('pageerror',lambda e:errors.append(str(e)));return c,p
  a,p=await context();b,v=await context()
  await asyncio.gather(p.goto(url),v.goto(url));await p.locator('[data-open]').first.wait_for();assert await p.locator('[data-open]').count()==24
  await p.locator('#next').click();await p.wait_for_function("document.querySelector('#pageInfo').textContent.includes('2')");await p.locator('#prev').click()
  await p.locator('#catalogSearch').fill('НЕСУЩЕСТВУЮЩАЯПОЗИЦИЯ');await p.get_by_text('Ничего не найдено.',exact=False).wait_for()
  await p.locator('#clearSearch').click();await p.locator('#catalogSort').select_option('priceUp');await p.wait_for_function("document.querySelector('.pp')?.textContent.includes('40')")
  await p.locator('#toc a').first.click();await p.wait_for_function("document.querySelector('#category').value.length>0");print('PASS mobile catalog / pages / search / sorting / sections',flush=True)
  await p.goto(url+'#model=q0621&color=0');await p.locator('#dm[open]').wait_for();await p.locator('[data-add]').click();assert 'размер' in await p.locator('#note').inner_text()
  color=p.locator('[data-c]').last;await color.click();colorName=await color.get_attribute('aria-label');size=p.locator('[data-si]').last;await size.click();sizeName=await size.locator('b').inner_text();assert await p.locator('#qi').input_value()=='1'
  await p.locator('[data-add]').click();await p.locator('#dm [data-close]').click();await p.locator('[data-cart]').click();assert colorName in await p.locator('#cl').inner_text() and sizeName in await p.locator('#cl').inner_text()
  await p.locator('[data-cq][data-d="1"]').click();await p.locator('[data-cq][data-d="-1"]').click()
  await p.locator('#cn').fill('Тест Ananai');await p.locator('#phone').fill('+996000000000');await p.locator('#city').fill('Бишкек');await p.locator('#method').select_option('Курьером');assert await p.locator('#address').is_visible();await p.locator('#address').fill('Тест 1');await p.locator('#method').select_option('Пункт выдачи');assert await p.locator('#point').is_visible();await p.locator('#point').fill('Пункт теста')
  async with p.expect_download() as dl:await p.locator('#receipt').click()
  f=await (await dl.value).path();assert 'data:image/' in Path(f).read_text()
  async with p.expect_download():await p.locator('#pictures').click()
  await p.locator('#deliveryForm button[type=submit]').click();await p.wait_for_url('https://wa.me/**');msg=json.loads((DIR/'whatsapp.json').read_text())['text'][0];assert colorName in msg and sizeName in msg and '1 шт.' in msg
  print('PASS single item, variants, cart, delivery form, photo receipt, share fallback and WhatsApp handoff',flush=True)
  await p.goto(url);await p.locator('[data-cart]').click();assert colorName in await p.locator('#cl').inner_text();await p.locator('[data-rm]').click();await p.locator('#dc [data-close]').click()
  await p.get_by_text('Для владельца',exact=True).click();oidc=json_request(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']+'&audience=ananai-qa',{'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})['value'];credentials=json_request('https://iusvdyjeimqrgtomojux.supabase.co/functions/v1/ananai-qa-session',{'Authorization':'Bearer '+oidc});await p.locator('#email').fill(credentials['email']);await p.locator('#pass').fill(credentials['password']);await p.locator('#loginForm button').click()
  await p.locator('[data-new]').wait_for();await p.locator('[data-new]').click();await p.locator('[data-f=name]').fill('Ananai QA временный');await p.locator('[data-f=price]').fill('123');await p.locator('[data-f=sizes]').fill('62, 68');await p.locator('[data-ac]').click();await p.locator('[data-cf=name]').fill('Красный')
  await p.locator('[data-file=main]').set_input_files({'name':'test.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ0kAAAAASUVORK5CYII=')});await p.locator('#de img.prev').wait_for();await p.locator('[data-save]').click();await p.locator('#de').wait_for(state='hidden');await v.locator('#catalogSearch').fill('Ananai QA временный');await v.locator('[data-open]').filter(has_text='Ananai QA временный').wait_for();assert '123' in await v.locator('.pp').first.inner_text();await v.wait_for_function("document.querySelector('.pc img')?.naturalWidth > 0")
  await p.locator('#catalogSearch').fill('Ananai QA временный');await p.locator('[data-open]').filter(has_text='Ananai QA временный').wait_for();await p.locator('[data-edit]').first.click();await p.locator('[data-f=price]').fill('456');await p.locator('[data-save]').click();await p.locator('#de').wait_for(state='hidden')
  await v.wait_for_function("document.querySelector('.pp')?.textContent.includes('456')",timeout=90000)
  print('PASS real owner Auth / Storage upload / create / edit / automatic update in second independent customer session',flush=True)
  await p.locator('[data-copyedit]').click();await p.locator('#textForm button').click();await p.locator('#siteTexts').wait_for(state='hidden')
  async with p.expect_download() as backup:await p.locator('[data-backup]').click()
  f=await (await backup.value).path();data=json.loads(Path(f).read_text());assert len(data['items'])==175
  # Exercise import on just the disposable product. Other catalog rows remain untouched.
  data['items']=[i for i in data['items'] if i['name']=='Ananai QA временный'];data['categories']=[s for s in data['categories'] if s['name']==data['items'][0]['cat']];del data['texts']
  p.on('dialog',lambda d:asyncio.create_task(d.accept()));await p.locator('#backupFile').set_input_files({'name':'qa.json','mimeType':'application/json','buffer':json.dumps(data).encode()});await p.wait_for_function("document.querySelector('#abn').textContent.includes('Импортировано')")
  await p.locator('[data-pw]').click();await p.locator('#oldPassword').fill(credentials['password']);await p.locator('#newPassword').fill(credentials['password']+'a');await p.locator('#passwordForm button').click();await p.locator('#passwordDialog').wait_for(state='hidden')
  await p.locator('[data-del]').first.click();await v.get_by_text('Ничего не найдено.',exact=False).wait_for(timeout=90000);await p.locator('[data-exit]').click();await p.locator('#ab').wait_for(state='hidden')
  print('PASS owner copy edits / backup and restore / password change / delete / sign out',flush=True);assert not errors,errors
  await browser.close()
try:asyncio.run(main())
finally:http.shutdown()
