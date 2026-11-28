import asyncio
import shutil
from playwright.async_api import async_playwright

SITES = [
    'https://ananai.vercel.app/',
    'https://elamanmamataliev501-lab.github.io/ananai/',
]

async def check(browser, url):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    page = await context.new_page()
    page.set_default_timeout(40000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(url, wait_until='domcontentloaded')
    await page.locator('[data-open]').first.wait_for()
    assert await page.locator('[data-open]').count() == 24
    assert await page.locator('#toc a').count() == 14
    await page.locator('[data-open]').first.scroll_into_view_if_needed()
    await page.wait_for_function("document.querySelector('.pc img').naturalWidth > 0")
    await page.goto(url + '#model=q0621&color=0')
    await page.locator('#dm[open]').wait_for()
    await page.locator('[data-si]').last.click()
    await page.locator('[data-c]').last.click()
    await page.locator('[data-add]').click()
    await page.locator('#dm [data-close]').click()
    await page.locator('[data-cart]').click()
    assert '1 шт.' in await page.locator('#ct').inner_text()
    await page.locator('#dc [data-close]').click()
    await page.get_by_text('Для владельца', exact=True).click()
    await page.locator('#login[open]').wait_for()
    assert await page.locator('#pass').get_attribute('type') == 'password'
    assert not errors, errors
    print('PASS',url,'catalog, categories, Storage image, deep link, color, size, one-item cart, owner login',flush=True)
    await context.close()

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=shutil.which('google-chrome'), args=['--no-sandbox'])
        await asyncio.gather(*(check(browser, url) for url in SITES))
        await browser.close()

asyncio.run(main())
