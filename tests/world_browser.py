"""Full world and multi-account postcard browser checks; uses an isolated temporary backend."""
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

OUT=Path('/tmp/wherelse-world-browser')
OUT.mkdir(exist_ok=True)
BASE='http://127.0.0.1:8790'
member_code=secrets.token_urlsafe(24)
moderator_code=secrets.token_urlsafe(32)

with tempfile.TemporaryDirectory(prefix='wherelse-browser-') as data:
    runtime_env={**os.environ,'COMMUNITY_DATA_DIR':data,'COMMUNITY_ORIGIN':BASE,'PORT':'8790','HOST':'127.0.0.1',
                 'COMMUNITY_INVITE_CODE':member_code,'COMMUNITY_MODERATOR_CODE':moderator_code}
    server=subprocess.Popen([shutil.which('node'),'server/start.mjs'],env=runtime_env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for attempt in range(80):
            try:
                if urllib.request.urlopen(BASE+'/api/health',timeout=1).status==200: break
            except OSError:
                if server.poll() is not None: raise RuntimeError('Test backend did not start')
                time.sleep(.1)
        else: raise RuntimeError('Test backend did not become ready')
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,
                                     args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            errors=[]
            def fresh(width=1100,height=800):
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=.5,reduced_motion='reduce')
                context.route('https://fonts.googleapis.com/**',lambda route:route.abort())
                context.route('https://fonts.gstatic.com/**',lambda route:route.abort())
                page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(BASE,wait_until='domcontentloaded')
                page.wait_for_function("() => !document.getElementById('loading')")
                assert page.locator('#unsupported').evaluate("e=>e.classList.contains('hidden')")
                return context,page
            def visit(page,title):
                page.locator('#journal-button').click()
                page.get_by_role('button',name=title,exact=False).click()
                page.locator('#story-action').click()
            def garden(page):
                page.locator('#menu-button').click();page.locator('#community-button').click()
                expect(page.locator('#community-auth')).to_be_visible()
                expect(page.locator('#community-status')).to_contain_text('Sign in')
            def join(page,alias,code):
                page.locator('#community-auth-switch').click()
                page.locator('#community-handle').fill(alias)
                page.locator('#community-password').fill('Browser test passphrase 123!')
                page.locator('#community-invite').fill(code)
                page.locator('#community-auth-submit').click()
                expect(page.locator('#community-member')).to_be_visible()
                expect(page.locator('#community-status')).to_contain_text('Welcome')
            def post(page,text,audience='private'):
                page.locator('#postcard-body').fill(text);page.locator('#postcard-audience').select_option(audience)
                page.locator('#postcard-preview').click()
                expect(page.locator('#postcard-review')).to_be_visible()
                expect(page.locator('#postcard-review-body')).to_have_text(text)
                page.locator('#postcard-confirm').click()
                expect(page.locator('#postcard-review')).to_be_hidden()
                expect(page.locator('#postcard-feed')).to_contain_text(text)

            context,alice=fresh()
            alice.screenshot(path=str(OUT/'00-world-arrival.png'))
            visit(alice,'Whispering Waters')
            alice.locator('#water-thought').fill('A thought never shared with the garden.')
            alice.locator('#water-keep').click()
            expect(alice.locator('#water-status')).to_contain_text('Kept on this browser')
            alice.locator('#waters').screenshot(path=str(OUT/'01-waters.png'))
            alice.locator('#water-sound').check()
            alice.locator('#water-release').click()
            expect(alice.locator('#water-thought')).to_have_value('')
            assert alice.evaluate("localStorage.getItem('little-elsewhere-waters-v1')") is None
            expect(alice.locator('#water-status')).to_contain_text('cleared')
            alice.screenshot(path=str(OUT/'01b-boat-world.png'))
            alice.locator('#waters [data-close]').first.click()
            visit(alice,'The Story Tree')
            alice.get_by_role('button',name='Ask about the seat by the window').click()
            alice.get_by_role('button',name='A name to say hello to next time').click()
            expect(alice.locator('#library-node-title')).to_have_text('A beginning can be small.')
            alice.locator('#library').screenshot(path=str(OUT/'02-story-tree.png'))
            alice.locator('#library [data-close]').first.click()
            alice.reload(wait_until='domcontentloaded');alice.wait_for_function("() => !document.getElementById('loading')")
            visit(alice,'The Story Tree')
            expect(alice.locator('#library-node-title')).to_have_text('A beginning can be small.')
            for story_id,title in [('result','A number on a page'),('friend','Between the messages'),('win','The ordinary brave thing')]:
                alice.get_by_role('button',name=title,exact=True).click()
                assert alice.locator('#library-options button').count()==2
                alice.locator('#library-options button').first.click()
                assert alice.locator('#library-options button').count()==0
            alice.locator('#library [data-close]').first.click()
            alice.locator('#menu-button').click()
            for quality in ['low','high','balanced']:
                alice.locator('#graphics-quality').select_option(quality)
                assert alice.evaluate("localStorage.getItem('little-elsewhere-graphics')")==quality
            alice.locator('#close-menu').click()
            alice.locator('#journal-button').click();alice.get_by_role('button',name='Firefly Grove',exact=False).click()
            alice.locator('#story-action').click();alice.locator('#day-button').click()
            alice.screenshot(path=str(OUT/'02b-night-grove.png'));alice.locator('#day-button').click()
            print('PASS: Waters save/release, all four Story Tree stories, recall, graphics tiers.')

            garden(alice);join(alice,'alice',member_code)
            post(alice,'Only Alice should see this. <img src=x onerror=alert(1)>')
            assert alice.locator('#postcard-feed img').count()==0
            post(alice,'A small community victory.','community')
            expect(alice.locator('#community-status')).to_contain_text('not visible')
            alice.locator('#community').screenshot(path=str(OUT/'03-private-and-pending.png'))
            bob_context,bob=fresh();garden(bob);join(bob,'bob',member_code)
            expect(bob.locator('#postcard-feed')).not_to_contain_text('Only Alice')
            expect(bob.locator('#postcard-feed')).not_to_contain_text('community victory')
            mod_context,mod=fresh();garden(mod);join(mod,'keeper',moderator_code)
            expect(mod.locator('#moderation-pending')).to_contain_text('A small community victory.')
            expect(mod.locator('#moderation-pending')).not_to_contain_text('Only Alice')
            mod.locator('#community-moderation').screenshot(path=str(OUT/'04-moderator-desk.png'))
            mod.get_by_role('button',name='Approve',exact=True).click()
            expect(mod.locator('#moderation-pending')).to_contain_text('No postcards')
            bob.locator('#community-refresh').click()
            expect(bob.locator('#postcard-feed')).to_contain_text('A small community victory.')
            bob.get_by_role('button',name='I hear you',exact=True).click()
            expect(bob.get_by_role('button',name='I hear you',exact=True)).to_have_attribute('aria-pressed','true')
            bob.get_by_role('button',name='Block member',exact=True).click()
            expect(bob.locator('#postcard-feed')).not_to_contain_text('community victory')
            bob.locator('#community-blocks').locator('..').locator('summary').click()
            bob.get_by_role('button',name='Unblock',exact=True).click()
            expect(bob.locator('#postcard-feed')).to_contain_text('community victory')
            bob.get_by_role('button',name='Report and hide',exact=True).click()
            expect(bob.locator('#postcard-feed')).not_to_contain_text('community victory')
            mod.locator('#community-refresh').click()
            expect(mod.locator('#moderation-reports')).to_contain_text('reported by bob')
            mod.get_by_role('button',name='Remove postcard',exact=True).click()
            expect(mod.locator('#moderation-reports')).to_contain_text('No open reports')
            alice.locator('#community-refresh').click()
            expect(alice.locator('#postcard-feed')).to_contain_text('removed by a moderator')
            alice.locator('#postcard-feed article').filter(has_text='Only Alice').get_by_role('button',name='Delete postcard').click()
            expect(alice.locator('#postcard-feed')).not_to_contain_text('Only Alice')
            print('PASS: separate accounts enforce private/pending/approved visibility, response, block/unblock, report, moderator removal and owner deletion.')
            bob_context.close();mod_context.close();context.close()
            mobile_context,mobile=fresh(390,844)
            visit(mobile,'Whispering Waters');mobile.locator('#waters').screenshot(path=str(OUT/'05-mobile-waters.png'))
            assert mobile.locator('#waters').evaluate('e=>e.scrollWidth<=e.clientWidth')
            mobile.locator('#waters [data-close]').first.click()
            garden(mobile);mobile.locator('#community').screenshot(path=str(OUT/'06-mobile-community.png'))
            assert mobile.locator('#community').evaluate('e=>e.scrollWidth<=e.clientWidth')
            mobile_context.close();assert not errors,errors
            browser.close();print('PASS: mobile activity/community layouts; no uncaught JavaScript errors.')
    finally:
        server.terminate()
        try:server.wait(timeout=10)
        except subprocess.TimeoutExpired:server.kill();server.wait()
