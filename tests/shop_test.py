import asyncio
import shutil
import time
from urllib.parse import parse_qs, urlsplit
from playwright.async_api import async_playwright, expect

sites = ['https://ananai.vercel.app/', 'https://elamanmamataliev501-lab.github.io/ananai/']
empty = 'Тест "пусто", & (0)'
race = 'Освободившийся раздел'

async def check(browser, url):
    page = await browser.new_page(viewport={'width':390,'height':844})
    # Confirm the published shop still loads using the public catalog, before testing edits in isolation.
    await page.goto(url, wait_until='domcontentloaded')
    await expect(page.locator('#toc a').first).to_be_visible(timeout=40000)
    assert await page.get_by_role('button', name='Удалить раздел', exact=False).count() == 0
    first=await page.locator('#toc a span').first.inner_text()
    base='https://iusvdyjeimqrgtomojux.supabase.co/rest/v1/ananai_categories'
    lookup=await page.request.get(base, params={'select':'name','name':'eq.'+first}, headers={'apikey':'sb_publishable_mBm_AmV5TFt4fCoPS8iQng_vR0TXcEe'})
    assert lookup.ok and (await lookup.json())==[{'name':first}]
    sections = [{'name':'С товарами','total':3}, {'name':empty,'total':0}, {'name':race,'total':0}]
    deletions = []
    revision = 1
    async def api(route):
        nonlocal revision
        req = route.request
        u = urlsplit(req.url)
        cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET, POST, DELETE, OPTIONS'}
        if req.method=='OPTIONS':
            return await route.fulfill(status=204, headers=cors)
        status=200
        if u.path.endswith('/token'):
            body={'user':{'id':'sample-user'},'expires_at':int(time.time())+3600,'access_token':'fixture'}
        elif u.path.endswith('/admins'):
            body=[{'user_id':'sample-user'}]
        elif u.path.endswith('/ananai_revision'):
            body=[{'revision':revision}]
        elif u.path.endswith('/ananai_settings'):
            body=[{'version':1,'texts':[]}]
        elif u.path.endswith('/ananai_sections'):
            body=[{**s,'position':n} for n,s in enumerate(sections)]
        elif u.path.endswith('/ananai_categories') and req.method=='DELETE':
            assert req.headers['authorization']=='Bearer fixture'
            name=parse_qs(u.query)['name'][0]
            assert name.startswith('eq.')
            exact=name[3:]
            deletions.append(exact)
            if exact==race:
                sections[-1]['total']=1
                body={'code':'23503','message':'Referenced by products'}
                status=409
            else:
                assert exact==empty
                sections[:]=[s for s in sections if s['name']!=exact]
                body=[{'name':exact}]
            revision+=1
        else:
            body=[]
        await route.fulfill(status=status,json=body,headers=cors)
    await page.route('https://iusvdyjeimqrgtomojux.supabase.co/**',api)
    await page.goto(url+'#admin',wait_until='domcontentloaded')
    await page.reload(wait_until='domcontentloaded')
    await page.locator('#email').fill('owner@example.invalid')
    await page.locator('#pass').fill('fixture')
    await page.locator('#loginForm button').click()
    delete=page.get_by_role('button',name=f'Удалить раздел «{empty}»',exact=True)
    await expect(delete).to_be_visible()
    await expect(page.locator('[data-remove-section]')).to_have_count(2)
    await page.locator('#toc a').filter(has_text=empty).click()
    await expect(page.locator('#category')).to_have_value(empty)
    async def cancel(dialog):
        assert empty in dialog.message
        await dialog.dismiss()
    page.once('dialog',cancel)
    await delete.click()
    assert not deletions
    async def confirm(dialog):
        await dialog.accept()
    page.once('dialog',confirm)
    await delete.click()
    await expect(page.locator('#toc a').filter(has_text=empty)).to_have_count(0)
    await expect(page.locator('#category')).to_have_value('')
    assert urlsplit(page.url).fragment=='toc'
    assert deletions==[empty]
    race_button=page.get_by_role('button',name=f'Удалить раздел «{race}»',exact=True)
    page.once('dialog',confirm)
    await race_button.click()
    await expect(page.locator('#abn')).to_contain_text('уже есть товары')
    await expect(race_button).to_have_count(0)
    await expect(page.locator('#toc a').filter(has_text=race)).to_contain_text('1 модель')
    print('PASS mobile live shop and isolated owner controls: guest visibility, cancel, confirmed empty removal, selection reset, occupied protection:',url,flush=True)
    await page.close()

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=shutil.which('google-chrome'),args=['--no-sandbox'])
        await asyncio.gather(*(check(browser,url) for url in sites))
        await browser.close()

asyncio.run(main())
