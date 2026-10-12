"""Real Chromium smoke test. Temporary credentials/data are removed on exit."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import os
import secrets
import signal
import socket
import subprocess
import sys
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.local' / 'validation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

with TemporaryDirectory(prefix='fukpages-browser-') as temporary:
    password = secrets.token_urlsafe(32)
    # Hash the test-only credential without exposing it to a shell or log.
    hashed = subprocess.run(['node', '--input-type=module', '-e', "import {hashPassword} from './server/auth.mjs'; let p=''; for await (const c of process.stdin) p+=c; process.stdout.write(hashPassword(p));"], cwd=ROOT, input=password, text=True, capture_output=True, check=True).stdout
    port = free_port()
    environment = dict(os.environ, PORT=str(port), DATA_DIR=temporary, OWNER_PASSWORD_HASH=hashed, NODE_ENV='test')
    logs = open(Path(temporary) / 'server.log', 'w')
    development = '--dev' in sys.argv
    ui_port = free_port() if development else port
    environment['VITE_PORT'] = str(ui_port)
    command = ['npm', 'run', 'dev'] if development else ['node', 'server/index.mjs']
    server = subprocess.Popen(command, cwd=ROOT, env=environment, stdout=logs, stderr=logs, start_new_session=True)
    try:
        base = f'http://127.0.0.1:{ui_port}'
        for _ in range(100):
            try:
                with urlopen(base + '/api/health', timeout=1) as response:
                    if response.status == 200: break
            except Exception: time.sleep(.1)
        else: raise AssertionError('Test server failed to start')
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1680, 'height': 1050})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(base)
            expect(page.get_by_role('heading', name='Stüdyona hoş geldin.')).to_be_visible()
            assert page.request.get(base + '/api/stores').status == 401
            page.get_by_label('Şifre', exact=True).fill(password)
            page.get_by_role('button', name='Stüdyoya gir').click()
            expect(page.get_by_role('heading', name='Tasarımlarının kontrolü sende.')).to_be_visible()
            page.screenshot(path=str(ARTIFACTS / 'dashboard.png'), full_page=True)
            page.get_by_role('button', name='Editörü aç').click()
            expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Product launch')
            expect(page.locator('.editor-block.selected')).to_have_count(1)
            page.screenshot(path=str(ARTIFACTS / 'editor-desktop.png'), full_page=True)
            print('PASS: owner login, management dashboard, editor startup')
            heading = page.locator('[data-kind="heading"]:has(h1)')
            heading_id = heading.get_attribute('data-node-id')
            page.get_by_label('Yazı boyutu', exact=True).fill('62px')
            expect(heading).to_have_css('font-size', '62px')
            page.get_by_role('button', name='Mobil', exact=True).click()
            page.get_by_label('Yazı boyutu', exact=True).fill('27px')
            expect(heading).to_have_css('font-size', '27px')
            page.screenshot(path=str(ARTIFACTS / 'editor-mobile.png'), full_page=True)
            page.get_by_role('button', name='Tablet', exact=True).click()
            page.get_by_label('Yazı boyutu', exact=True).fill('45px')
            expect(heading).to_have_css('font-size', '45px')
            page.get_by_role('button', name='Masaüstü', exact=True).click()
            expect(heading).to_have_css('font-size', '62px')
            page.get_by_role('button', name='Mobil', exact=True).click()
            expect(heading).to_have_css('font-size', '27px')
            page.get_by_role('button', name='Masaüstü', exact=True).click()
            print('PASS: independent desktop/tablet/mobile styles')
            page.locator('[data-palette="box"]').click()
            box = page.locator('.editor-block.selected[data-kind="box"]')
            box_id = box.get_attribute('data-node-id')
            destination = page.locator(f'[data-node-id="{box_id}"]')
            destination.scroll_into_view_if_needed()
            source = page.locator('[data-palette="button"]')
            def drag(source, target):
                source.scroll_into_view_if_needed()
                a, b = source.bounding_box(), target.bounding_box()
                page.mouse.move(a['x'] + a['width']/2, a['y'] + a['height']/2)
                page.mouse.down()
                page.mouse.move(a['x'] + a['width']/2 + 12, a['y'] + a['height']/2 + 12, steps=4)
                page.wait_for_timeout(100)
                b = target.bounding_box()
                page.mouse.move(b['x'] + b['width']/2, b['y'] + b['height']/2, steps=24)
                page.wait_for_timeout(200)
                page.mouse.up()
            drag(source, destination)
            expect(destination.locator('[data-kind="button"]')).to_have_count(1)
            heading.click()
            drag(heading.get_by_title('Öğeyi sürükle'), destination)
            expect(destination.locator('[data-kind="heading"]')).to_have_count(1)
            page.get_by_role('button', name='Geri al', exact=True).click()
            expect(destination.locator('[data-kind="heading"]')).to_have_count(0)
            page.get_by_role('button', name='İleri al', exact=True).click()
            expect(destination.locator('[data-kind="heading"]')).to_have_count(1)
            page.locator('.inspector-heading').click()
            page.keyboard.press('Control+d')
            expect(destination.locator('[data-kind="heading"]')).to_have_count(2)
            page.keyboard.press('Delete')
            expect(destination.locator('[data-kind="heading"]')).to_have_count(1)
            print('PASS: real drag-and-drop, nested reparenting, undo/redo, duplicate/delete')
            heading = page.locator(f'[data-node-id="{heading_id}"]')
            heading.click()
            text = heading.locator('.rich-content')
            text.dblclick()
            text.fill('EVERY DETAIL. FULLY YOURS.')
            page.wait_for_timeout(1800)
            expect(text).to_have_text('EVERY DETAIL. FULLY YOURS.')
            page.get_by_role('button', name='İçerik', exact=True).click()
            expect(page.get_by_label('Metin içeriği')).to_have_value('EVERY DETAIL. FULLY YOURS.')
            page.get_by_role('button', name='Kaydet', exact=True).click()
            expect(page.locator('.save-indicator')).to_have_text('Kaydedildi', timeout=10000)
            list_response = page.request.get(base + '/api/stores/demo/pages').json()
            page_id = list_response[0]['id']
            stored = page.request.get(base + '/api/pages/' + page_id).json()
            def find(nodes, target):
                for node in nodes:
                    if node['id'] == target: return node
                    result = find(node['children'], target)
                    if result: return result
            persisted = find(stored['document']['nodes'], heading_id)
            assert persisted['styles']['desktop']['fontSize'] == '62px'
            assert persisted['styles']['tablet']['fontSize'] == '45px'
            assert persisted['styles']['mobile']['fontSize'] == '27px'
            assert persisted['props']['html'] == 'EVERY DETAIL. FULLY YOURS.'
            page.get_by_role('button', name='Önizle', exact=True).click()
            expect(page.locator('.preview-modal')).to_be_visible()
            assert page.locator('.preview-modal .editor-block').count() == 0
            page.get_by_role('button', name='Önizlemeyi kapat').click()
            page.get_by_role('button', name='Yerel yayın', exact=True).click()
            expect(page.get_by_role('button', name='Yerel yayın güncelle')).to_be_visible()
            visitor = browser.new_context(viewport={'width': 390, 'height': 844})
            public = visitor.new_page()
            public.goto(base + '/?published=' + page_id)
            expect(public.get_by_role('heading', name='EVERY DETAIL. FULLY YOURS.')).to_be_visible()
            print('PASS: inline editing, persisted draft, clean preview and public local publication')
            page.get_by_title('Mağazalara dön').click()
            page.reload()
            page.get_by_role('button', name='Mağaza ayrıntıları').click()
            page.get_by_role('button', name='Düzenle', exact=True).click()
            expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Product launch')
            expect(page.locator('[data-kind="heading"]:has(h1) .rich-content')).to_have_text('EVERY DETAIL. FULLY YOURS.')
            page.get_by_title('Mağazalara dön').click()
            page.get_by_role('button', name='Devre dışı bırak', exact=True).click()
            expect(page.get_by_role('heading', name='Aura Studio devre dışı bırakılsın mı?')).to_be_visible()
            page.locator('.dialog').get_by_role('button', name='Devre dışı bırak', exact=True).click()
            expect(page.get_by_role('button', name='Etkinleştir', exact=True)).to_be_visible()
            public.reload()
            expect(public.get_by_text('Bu sayfa yayında değil.', exact=True)).to_be_visible()
            print('PASS: reload/reopen persistence and store suspension removes local public pages')
            assert errors == [], errors
            print('PASS: no uncaught browser errors')
            visitor.close(); context.close(); browser.close()
    finally:
        os.killpg(server.pid, signal.SIGTERM)
        server.wait(timeout=10)
        logs.close()
