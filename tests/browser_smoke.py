"""Optional real-browser checks. Requires Python Playwright and Chromium; run against Vite preview."""
import argparse
from pathlib import Path
import shutil

from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4173')
parser.add_argument('--output', default='/tmp/wherelse-smoke')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)
KEY = 'little-elsewhere-bench-v1'


def prepare(context):
    context.route('https://fonts.googleapis.com/**', lambda route: route.abort())
    context.route('https://fonts.gstatic.com/**', lambda route: route.abort())
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function("!document.getElementById('loading')")
    assert page.locator('#unsupported').evaluate("e => e.classList.contains('hidden')")
    return page, errors


def open_bench(page):
    if page.locator('#bench-button').is_visible():
        page.locator('#bench-button').click()
    else:
        page.locator('#journal-button').click()
        page.get_by_role('button', name='The Daydream Bench', exact=False).click()
        page.locator('#story-action').click()
    assert page.locator('#bench').is_visible()


def memory(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1280, 'height': 800}, device_scale_factor=.75,
                                  reduced_motion='reduce')
    page, errors = prepare(context)
    page.screenshot(path=str(output / '01-arrival.png'))
    open_bench(page)
    page.locator('[data-mood="quiet"]').click()
    assert page.locator('#bench-scene-title').inner_text() == 'We can just sit.'
    page.locator('summary').click()
    page.locator('#bench-note').fill('A thought that stays unsaved.')
    page.locator('[data-flower="lilac"]').click()
    page.locator('#bench-save').click()
    assert memory(page)['note'] == ''
    assert memory(page)['flower'] == 'lilac'
    page.locator('[data-mood="story"]').click()
    page.locator('[data-story-choice="pause"]').click()
    assert page.locator('#bench-scene-title').inner_text() == 'A moment can stay unfinished.'
    page.locator('[data-story-choice="reply"]').click()
    assert page.locator('#bench-scene-title').inner_text() == 'One honest line.'
    page.locator('#bench-note').fill('An explicitly saved test note.')
    page.locator('#remember-note').check()
    page.locator('#bench-save').click()
    assert memory(page)['note'] == 'An explicitly saved test note.'
    assert memory(page)['storyChoice'] == 'reply'
    page.screenshot(path=str(output / '02-bench-story.png'))
    for _ in range(22):
        page.keyboard.press('Tab')
        assert page.evaluate("document.getElementById('bench').contains(document.activeElement)")
    page.keyboard.press('Escape')
    assert not page.locator('#bench').is_visible()
    page.wait_for_function("document.getElementById('story-action') === document.activeElement")
    page.screenshot(path=str(output / '03-flower-world.png'))
    page.reload(wait_until='domcontentloaded')
    page.wait_for_function("!document.getElementById('loading')")
    open_bench(page)
    assert page.locator('[data-mood="story"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('#bench-scene-title').inner_text() == 'One honest line.'
    assert page.locator('#bench-note').input_value() == 'An explicitly saved test note.'
    if not page.locator('#remember-note').is_visible():
        page.locator('summary').click()
    page.locator('#remember-note').uncheck()
    page.locator('#bench-save').click()
    assert memory(page)['note'] == ''
    page.locator('#bench-forget').click()
    assert memory(page) is None
    page.locator('#bench-close').click()
    page.locator('#story-close').click()
    for title in ['The Daydream Bench', 'Whispering Waters', 'Butterfly Meadow', 'The Story Tree', 'Firefly Grove', 'The Secret Picnic']:
        page.locator('#journal-button').click()
        row = page.get_by_role('button', name=title, exact=False)
        expect(row).to_be_visible()
        row.focus()
        expect(row).to_be_focused()
        page.keyboard.press('Enter')
        expect(page.locator('#story-title')).to_have_text(title)
        page.locator('#story-close').click()
    assert page.locator('#count').inner_text() == '6 / 6'
    page.locator('#day-button').click()
    assert page.locator('body').evaluate("e => e.classList.contains('night')")
    # The reduced-motion path must freeze the canvas, not only CSS transitions.
    page.wait_for_timeout(150)
    first = page.locator('#world').screenshot()
    assert len(first) > 5000
    page.wait_for_timeout(150)
    assert first == page.locator('#world').screenshot()
    assert not errors, errors
    context.close()
    print('PASS: choices, explicit note consent, persistence, deletion, focus trap/return, all six keyboard visits, day/night, reduced motion; no JS errors.')

    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=.75,
                                 is_mobile=True, has_touch=True, reduced_motion='reduce')
    page, errors = prepare(mobile)
    page.screenshot(path=str(output / '04-mobile-arrival.png'))
    open_bench(page)
    page.locator('[data-mood="quiet"]').click()
    page.screenshot(path=str(output / '05-mobile-bench.png'))
    assert page.locator('#bench').evaluate('e => e.scrollWidth <= e.clientWidth')
    page.locator('#bench-leave').click()
    assert not errors, errors
    mobile.close()
    print('PASS: mobile arrival, bench interaction, no horizontal modal overflow.')

    blocked = browser.new_context(viewport={'width': 960, 'height': 700}, device_scale_factor=.5,
                                  reduced_motion='reduce')
    blocked.add_init_script("""Object.defineProperty(Storage.prototype, 'setItem', {value() {throw new Error('Blocked')}});
        Object.defineProperty(Storage.prototype, 'removeItem', {value() {throw new Error('Blocked')}});""")
    page, errors = prepare(blocked)
    open_bench(page)
    page.locator('#bench-save').click()
    assert 'could not save' in page.locator('#bench-status').inner_text()
    page.locator('#bench-forget').click()
    assert 'could not delete' in page.locator('#bench-status').inner_text()
    assert not errors, errors
    blocked.close()
    print('PASS: blocked storage keeps the experience usable and reports failures honestly.')

    animated = browser.new_context(viewport={'width': 1100, 'height': 760}, device_scale_factor=.5,
                                    reduced_motion='no-preference')
    page, errors = prepare(animated)
    open_bench(page)
    page.evaluate('''() => new Promise(resolve => {
        let frames=0;function tick(){if(++frames===65)resolve(true);else requestAnimationFrame(tick)}
        requestAnimationFrame(tick);
    })''')
    page.screenshot(path=str(output / '06-pip-company.png'))
    first = page.locator('#world').screenshot()
    page.wait_for_timeout(250)
    assert first != page.locator('#world').screenshot()
    page.locator('[data-mood="quiet"]').click()
    expect(page.locator('#bench-scene-title')).to_have_text('We can just sit.')
    assert not errors, errors
    animated.close()
    print('PASS: animated scene renders, Pip company/quiet paths work without reduced motion.')
    browser.close()
