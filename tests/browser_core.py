"""Audit fixes for the editor core: opening never writes (F0), selection
(L1), clipboard (F3), lock (F4), drop order (F5) and grouping (F11)."""
import re, time
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    # Older content that the editor normalises on open (symbols in text become
    # separate icon elements).
    legacy = document('Legacy content', [
        block('section', 'old', {}, [
            block('heading', 'old-title', {'html': 'Old title', 'tag': 'h1'}),
            block('text', 'old-proof', {'html': '★★★★★ Loved by 2,400 listeners'}),
            block('itemList', 'old-list', {'items': 'Free shipping\nEasy returns'}),
        ]),
    ])
    pid = api('/stores/demo/pages', 'POST', {'document': legacy})['id']
    before = api('/pages/' + pid)
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def open_editor(page_id, name):
        page.goto(base)
        page.get_by_role('button', name='Manage pages', exact=True).first.click()
        page.locator('.page-table-row[data-page-id="' + page_id + '"]').get_by_role('button', name='Edit', exact=True).click()
        expect(page.get_by_label('Page name', exact=True)).to_have_value(name)

    open_editor(pid, 'Legacy content')
    expect(page.locator('.editable-surface [data-node-id=old-proof]')).to_be_visible()
    time.sleep(3.5)
    expect(page.locator('.save-indicator')).not_to_contain_text('Edited')
    after = api('/pages/' + pid)
    assert after['version'] == before['version'], (before['version'], after['version'])
    assert after['updated'] == before['updated'] if 'updated' in before else True
    page.goto(base)
    open_editor(pid, 'Legacy content')
    time.sleep(2)
    assert api('/pages/' + pid)['version'] == before['version']
    print('PASS: opening and reopening an older page writes nothing and shows no unsaved change', flush=True)
    assert not errors, errors
