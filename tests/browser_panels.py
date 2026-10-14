"""Audit stage 4: tabs and carousels made of real child elements (each tab or
slide holds editable blocks), icon links for every icon type, inspector rich
text that keeps formatting and a cleaner inspector."""
import re
from browser_support import ROOT, block, browser_fixture, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    legacy_tabs = block('tabs', 'old-tabs', {'items': 'Details|Soft cotton\nCare|Machine wash'})
    legacy_tabs['children'] = []
    legacy_carousel = block('carousel', 'old-carousel', {'images': '/assets/headphones.svg\n/assets/templates/arches.svg', 'items': 'First slide\nSecond slide'})
    legacy_carousel['children'] = []
    pid = api('/stores/demo/pages', 'POST', {'document': document('Panels', [
        block('section', 'sec', {}, [
            legacy_tabs,
            legacy_carousel,
            block('text', 'rich', {'html': 'Plain <b>bold</b> and <a href="/about">link</a>'}),
            block('icon', 'img-icon', {'src': '/assets/headphones.svg', 'alt': 'Support', 'href': '/contact'}),
            block('image', 'pic', {'src': '/assets/headphones.svg', 'alt': 'Pic'}),
        ]),
    ])})['id']
    page = f['owner'].new_page()
    page.set_viewport_size({'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.locator('.page-table-row[data-page-id="' + pid + '"]').get_by_role('button', name='Edit', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Panels')
    canvas = page.locator('.editable-surface')
    node = lambda i: canvas.locator('[data-node-id="' + i + '"]').first

    # Older text-line tabs open as real panels with editable elements.
    tabs = node('old-tabs')
    expect(tabs.get_by_role('tab')).to_have_count(2)
    expect(tabs.get_by_role('tab', name='Details')).to_have_attribute('aria-selected', 'true')
    expect(tabs.locator('.panel-track > .editor-block:not([data-panel-hidden])')).to_contain_text('Soft cotton')
    tabs.get_by_role('tab', name='Care').click()
    visible = tabs.locator('.panel-track > .editor-block:not([data-panel-hidden])')
    expect(visible).to_have_count(1)
    expect(visible).to_contain_text('Machine wash')
    care_text = visible.locator('.editor-block[data-kind=text]')
    care_text.click()
    expect(page.locator('.inspector-heading')).to_have_text('Text')
    page.get_by_label('Text content', exact=True).fill('Wash cold')
    expect(visible).to_contain_text('Wash cold')
    print('PASS: legacy tabs become panels whose text is an ordinary selectable element', flush=True)

    # Panels are managed in the inspector; a new tab gets its own elements.
    tabs.get_by_role('tab', name='Details').click()
    expect(page.locator('.inspector-heading')).to_have_text('Tabs')
    settings = page.locator('[data-panel-settings]')
    expect(settings).to_be_visible()
    settings.get_by_label('Tab title 1', exact=True).fill('Material')
    expect(tabs.get_by_role('tab', name='Material')).to_be_visible()
    settings.get_by_role('button', name='Add tab', exact=True).click()
    expect(tabs.get_by_role('tab')).to_have_count(3)
    expect(tabs.get_by_role('tab', name='Tab 3')).to_have_attribute('aria-selected', 'true')
    settings.get_by_role('button', name='Move up: Tab 3', exact=True).click()
    expect(tabs.get_by_role('tab').nth(1)).to_have_text('Tab 3')
    settings.get_by_role('button', name='Delete: Tab 3', exact=True).click()
    expect(tabs.get_by_role('tab')).to_have_count(2)
    page.screenshot(path=str(out / 'v12-tabs-editor.png'))
    print('PASS: tabs are renamed, added, reordered and deleted from the inspector', flush=True)

    # Carousel slides are real elements too.
    carousel = node('old-carousel')
    slides = carousel.locator('.panel-track > .editor-block')
    expect(slides).to_have_count(2)
    expect(carousel.locator('.panel-track > .editor-block:not([data-panel-hidden])')).to_contain_text('First slide')
    carousel.get_by_role('button', name='Next slide', exact=True).click()
    shown = carousel.locator('.panel-track > .editor-block:not([data-panel-hidden])')
    expect(shown).to_contain_text('Second slide')
    expect(shown.locator('.editor-block[data-kind=image] img')).to_have_attribute('src', re.compile('arches'))
    print('PASS: carousel slides hold separate image and text elements', flush=True)

    # Rich text in the inspector keeps bold and links.
    node('rich').click()
    field = page.get_by_label('Text content', exact=True)
    expect(field.locator('b')).to_have_text('bold')
    field.click()
    page.keyboard.press('End')
    page.keyboard.type(' more')
    expect(node('rich').locator('b')).to_have_text('bold')
    expect(node('rich').locator('a')).to_have_attribute('href', '/about')
    expect(node('rich')).to_contain_text('more')
    field.press('Control+a')
    page.locator('.rich-field-tools').get_by_role('button', name='Italicise selection', exact=True).click()
    expect(node('rich').locator('i, em').first).to_be_visible()
    print('PASS: inspector text editing keeps bold, links and adds italic', flush=True)

    # Inspector cleanup: no typography for images, one content section.
    node('pic').click()
    insp = page.locator('.inspector-scroll')
    expect(insp.locator('summary', has_text='Typography')).to_have_count(0)
    expect(insp.locator('summary', has_text='Content and behaviour')).to_have_count(1)
    print('PASS: image inspector has no typography and a single content section', flush=True)

    # Focus mode gives the canvas the whole width and comes back.
    before = page.locator('.canvas-area').evaluate('el=>el.getBoundingClientRect().width')
    page.get_by_role('button', name='Focus mode', exact=True).click()
    expect(page.locator('.library')).to_be_hidden()
    expect(page.locator('.inspector-container')).to_be_hidden()
    wider = page.locator('.canvas-area').evaluate('el=>el.getBoundingClientRect().width')
    assert wider > before + 300, (before, wider)
    page.locator('.canvas-footer').click(position={'x': 2, 'y': 2})
    page.keyboard.press('Backslash')
    expect(page.locator('.library')).to_be_visible()
    print('PASS: focus mode hides the side panels and the backslash key brings them back', flush=True)

    page.keyboard.press('Control+s')
    expect(page.locator('.save-indicator')).to_contain_text('Saved', timeout=20000)
    stored = api('/pages/' + pid)['document']
    sec = stored['nodes'][0]
    stored_tabs = next(n for n in sec['children'] if n['kind'] == 'tabs')
    assert [c['props'].get('panelTitle') for c in stored_tabs['children']] == ['Material', 'Care'], stored_tabs['children']
    assert stored_tabs['children'][1]['children'][0]['props']['html'] == 'Wash cold'

    # Live page: tabs switch with the keyboard, slides with buttons, icons link.
    api('/pages/' + pid + '/publish', 'POST', {})
    visitor = f['browser'].new_context(viewport={'width': 1280, 'height': 900}).new_page()
    visitor.on('pageerror', lambda e: errors.append(str(e)))
    visitor.goto(base + '/?published=' + pid)
    live_tabs = visitor.locator('[data-block="' + stored_tabs['id'] + '"]')
    expect(live_tabs.get_by_role('tab', name='Material')).to_have_attribute('aria-selected', 'true')
    live_tabs.get_by_role('tab', name='Material').focus()
    visitor.keyboard.press('ArrowRight')
    expect(live_tabs.get_by_role('tab', name='Care')).to_have_attribute('aria-selected', 'true')
    expect(live_tabs.locator('.panel-track > [data-block]:not([data-panel-hidden])')).to_have_text('Wash cold')
    live_carousel = visitor.locator('.panel-carousel')
    live_carousel.get_by_role('button', name='Slide 2', exact=True).click()
    expect(live_carousel.locator('.panel-track > [data-block]:not([data-panel-hidden])')).to_contain_text('Second slide')
    icon_link = visitor.locator('[data-block=img-icon] a.icon-link')
    expect(icon_link).to_have_attribute('href', '/contact')
    expect(icon_link.locator('img')).to_be_visible()
    visitor.set_viewport_size({'width': 390, 'height': 800})
    assert visitor.evaluate('()=>document.documentElement.scrollWidth-innerWidth') <= 1
    print('PASS: published tabs, slides and image icons work for visitors, also on phones', flush=True)
    assert not errors, errors
