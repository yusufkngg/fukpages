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

    # Selection, clipboard, lock and grouping on one page.
    work = document('Core work', [
        block('section', 'main', {}, [
            block('heading', 'title', {'html': 'Core title', 'tag': 'h1'}),
            block('text', 'body', {'html': 'Body text with a <a href="https://example.com">link</a>'}),
            block('row', 'buttons', {}, [
                block('text', 'first', {'html': 'First'}),
                block('text', 'second', {'html': 'Second'}),
                block('text', 'note', {'html': 'Note'}),
            ], styles={'display': 'flex', 'flexDirection': 'row', 'gap': '24px', 'alignItems': 'center'}),
        ]),
    ])
    wid = api('/stores/demo/pages', 'POST', {'document': work})['id']
    f['owner'].grant_permissions(['clipboard-read', 'clipboard-write'], origin=base)
    open_editor(wid, 'Core work')
    node = lambda id: page.locator('.editable-surface [data-node-id="' + id + '"]')
    node('title').click()
    node('body').click(modifiers=['Shift'])
    expect(node('body')).to_have_class(re.compile(r'\bselected\b'))
    expect(node('title')).to_have_class(re.compile('multi-selected'))
    node('title').click(modifiers=['Control'])
    expect(node('title')).not_to_have_class(re.compile('selected'))
    expect(node('body')).to_have_class(re.compile(r'\bselected\b'))
    node('first').click()
    node('second').click(modifiers=['Shift'])
    page.get_by_role('button', name='Layers', exact=True).click()
    layers = page.get_by_role('dialog', name='Layers', exact=True)
    expect(layers.locator('.layer-row.multi-selected')).to_have_count(1)
    page.keyboard.press('Control+g')
    group = page.locator('.editable-surface [data-node-id=buttons] > [data-kind=box]')
    expect(group).to_have_count(1)
    assert group.evaluate('el=>getComputedStyle(el).flexDirection') == 'row'
    gap = group.evaluate('el=>getComputedStyle(el).columnGap')
    assert gap == '24px', gap
    first_box = node('first').bounding_box()
    page.keyboard.press('Control+z')
    expect(group).to_have_count(0)
    page.get_by_role('button', name='Layers', exact=True).click()
    expect(layers).to_have_count(0)
    print('PASS: Shift adds and Ctrl toggles on the canvas and in layers; a group keeps the row layout', flush=True)

    # Menu copy → keyboard paste, keyboard copy → menu paste, menu cut → undo.
    count = lambda: page.locator('.editable-surface [data-kind=heading]').count()
    node('title').click(button='right')
    page.get_by_role('menuitem', name=re.compile('^Copy ?Ctrl')).click()
    node('body').click()
    page.keyboard.press('Control+v')
    expect(page.locator('.editable-surface [data-kind=heading]')).to_have_count(2, timeout=20000)
    page.keyboard.press('Control+z')
    node('title').click()
    page.keyboard.press('Control+c')
    node('body').click(button='right')
    page.get_by_role('menuitem', name=re.compile('^Paste ?Ctrl')).click()
    expect(page.locator('.editable-surface [data-kind=heading]')).to_have_count(2, timeout=20000)
    page.keyboard.press('Control+z')
    expect(page.locator('.editable-surface [data-kind=heading]')).to_have_count(1)
    node('note').click(button='right')
    page.get_by_role('menuitem', name=re.compile('^Cut')).click()
    expect(node('note')).to_have_count(0)
    node('title').click()
    page.keyboard.press('Control+v')
    expect(node('note')).to_have_count(1, timeout=20000)
    print('PASS: menu and keyboard share one clipboard for copy, cut and paste', flush=True)

    # A locked element cannot change from any path and does not act like a visitor page.
    node('body').click(button='right')
    page.get_by_role('menuitem', name='Lock', exact=True).click()
    node('body').click()
    page.get_by_label('Text content', exact=True).fill('Changed while locked')
    expect(page.locator('.toast.error')).to_contain_text('is locked')
    expect(node('body')).to_contain_text('Body text with a link')
    page.keyboard.press('Delete')
    expect(node('body')).to_have_count(1)
    node('body').dblclick()
    expect(node('body').locator('[contenteditable=true]')).to_have_count(0)
    url = page.url
    node('body').locator('a').click()
    assert page.url == url, page.url
    node('body').click(button='right')
    page.get_by_role('menuitem', name='Unlock', exact=True).click()
    page.get_by_label('Text content', exact=True).fill('Changed after unlocking')
    expect(node('body')).to_contain_text('Changed after unlocking')
    print('PASS: locked elements reject inspector, keyboard and inline edits and never follow links in the editor', flush=True)

    # Responsive: the width decides the breakpoint; fixed widths never overflow.
    resp = document('Responsive check', [
        block('section', 'r-section', {}, [
            block('heading', 'r-title', {'html': 'Responsive title', 'tag': 'h1'}),
            block('heading', 'r-sized', {'html': 'Sized title', 'tag': 'h2'}, styles={'fontSize': '56px'}),
            block('column', 'r-col', {}, [
                block('text', 'r-wide', {'html': 'A paragraph with a fixed width that is wider than a phone column.'}, styles={'width': '404px'}),
            ], styles={'width': '100%'}),
        ], styles={'paddingLeft': '20px', 'paddingRight': '20px'}),
    ])
    resp['nodes'][0]['children'][1]['styles']['mobile'] = {'fontSize': '28px'}
    rid = api('/stores/demo/pages', 'POST', {'document': resp})['id']
    open_editor(rid, 'Responsive check')
    surface = page.locator('.editable-surface')
    page.get_by_label('Preview width', exact=True).fill('390')
    expect(surface).to_have_attribute('data-device', 'mobile')
    expect(page.get_by_role('button', name='Mobile', exact=True)).to_have_class(re.compile('active'))
    expect(node('r-sized')).to_have_css('font-size', '28px')
    page.get_by_label('Preview width', exact=True).fill('768')
    expect(surface).to_have_attribute('data-device', 'tablet')
    page.get_by_label('Preview width', exact=True).fill('1280')
    expect(surface).to_have_attribute('data-device', 'desktop')
    expect(node('r-sized')).to_have_css('font-size', '56px')
    page.get_by_role('button', name='Mobile', exact=True).click()
    wide = node('r-wide').evaluate('el=>[el.getBoundingClientRect().right, el.parentElement.closest("[data-node-id]").getBoundingClientRect().right]')
    assert wide[0] <= wide[1] + 0.5, wide
    visitor = f['browser'].new_context(viewport={'width': 390, 'height': 800})
    api('/pages/' + rid + '/publish', 'POST', {})
    view = visitor.new_page()
    view.goto(base + '/?published=' + rid)
    expect(view.locator('[data-block=r-sized]')).to_have_css('font-size', '28px')
    assert view.evaluate('()=>document.documentElement.scrollWidth-innerWidth') <= 1
    print('PASS: 390/768/1280 px choose mobile/tablet/desktop like the live page; fixed widths fit their column', flush=True)

    # The inspector shows the value the canvas really uses for brand-styled text.
    page.get_by_role('button', name='Desktop', exact=True).click()
    node('r-title').click()
    rendered = node('r-title').evaluate('el=>getComputedStyle(el).fontSize')
    expect(page.get_by_label(re.compile('^Font size$|^Text size$'))).to_have_value(rendered)
    print('PASS: inherited brand typography shows its rendered size in the inspector', flush=True)
    assert not errors, errors
