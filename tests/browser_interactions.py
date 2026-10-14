"""0.10 page-builder interactions: no stray text selection, double-click and
Enter open the right editor, the icon library, element toolbar, context menu
and keyboard delete/undo — then the vector icon survives save and publish."""
import re
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    doc = document('Interactions', [
        block('section', 'hero', {}, [
            block('heading', 'title', {'html': 'Interaction title', 'tag': 'h1'}, styles={'fontSize': '40px'}),
            block('text', 'body', {'html': 'Body copy'}, styles={'fontSize': '18px'}),
            block('row', 'icons', {}, [
                block('icon', 'glyph', {'text': '★'}, styles={'fontSize': '32px', 'color': '#17241c', 'width': 'fit-content'}),
                block('icon', 'shipping', {'text': '✓'}, styles={'fontSize': '32px', 'color': '#17241c', 'width': 'fit-content'}),
            ], styles={'display': 'flex', 'flexDirection': 'row', 'gap': '16px'}),
            block('image', 'photo', {'src': '/assets/headphones.svg', 'alt': 'Headphones'}, styles={'width': '240px'}),
        ], styles={'paddingTop': '48px', 'paddingBottom': '48px', 'paddingLeft': '40px', 'paddingRight': '40px'}),
    ])
    pid = api('/stores/demo/pages', 'POST', {'document': doc})['id']
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    node = lambda id: page.locator('.editable-surface [data-node-id="' + id + '"]')
    selected_text = lambda: page.evaluate('()=>String(getSelection())')

    def open_editor():
        page.goto(base)
        page.get_by_role('button', name='Manage pages', exact=True).first.click()
        page.locator('.page-table-row[data-page-id="' + pid + '"]').get_by_role('button', name='Edit', exact=True).click()
        expect(page.get_by_label('Page name', exact=True)).to_have_value('Interactions')

    open_editor()

    # An icon is an element, not text: no caret, no highlighted glyph.
    shipping = node('shipping')
    shipping.click()
    expect(shipping).to_have_class(re.compile('selected'))
    expect(page.locator('[data-icon-settings]')).to_be_visible()
    expect(page.locator('.inspector .simple-text-controls')).to_have_count(0)
    shipping.dblclick()
    assert selected_text() == '', repr(selected_text())
    library = page.get_by_role('dialog', name='Icon library')
    expect(library).to_be_visible()
    expect(library.get_by_role('tab', name='Popular', exact=True)).to_have_attribute('aria-selected', 'true')
    expect(library.get_by_role('tab', name=re.compile(r'^All \(\d{4}\)$'))).to_be_visible(timeout=20000)
    # Keys pressed inside the library never reach the canvas.
    library.get_by_role('tab', name='E-commerce', exact=True).focus()
    page.keyboard.press('Backspace')
    page.keyboard.press('Delete')
    expect(shipping).to_have_count(1)
    expect(library).to_be_visible()
    library.get_by_label('Search icons', exact=True).fill('shield')
    expect(library.get_by_role('listitem', name='Icon: shield-check', exact=True)).to_be_visible()
    library.get_by_label('Search icons', exact=True).fill('kargo')
    expect(library.get_by_role('listitem').first).to_have_attribute('aria-label', 'Icon: truck')
    page.screenshot(path=str(out / 'v10-icon-library.png'))
    library.get_by_role('listitem', name='Icon: truck', exact=True).click()
    expect(library).to_be_hidden()
    expect(shipping.locator('svg.vector-icon')).to_have_count(1)
    expect(page.locator('.icon-current b')).to_have_text('Truck')
    page.get_by_label('Icon size', exact=True).fill('44px')
    expect(shipping).to_have_css('font-size', '44px')
    page.get_by_label('Icon colour', exact=True).fill('#c2410c')
    expect(shipping.locator('svg.vector-icon')).to_have_css('color', 'rgb(194, 65, 12)')
    page.get_by_label('Stroke width', exact=True).evaluate(
        "(el)=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,'1.5');el.dispatchEvent(new Event('input',{bubbles:true}))}")
    expect(shipping.locator('svg.vector-icon')).to_have_attribute('stroke-width', '1.5')
    page.screenshot(path=str(out / 'v10-icon-settings.png'))
    print('PASS: icons select like elements, open a searchable vector library on double-click and take size, colour and stroke', flush=True)

    # Older symbol icons convert to the matching vector icon and stay solid.
    node('glyph').click()
    page.get_by_role('button', name='Convert to a vector icon', exact=True).click()
    expect(node('glyph').locator('svg.vector-icon')).to_have_attribute('fill', 'currentColor')
    print('PASS: a text symbol icon converts to a solid vector icon', flush=True)

    # Enter edits text; Escape leaves editing; double-click on an image opens media.
    node('body').click()
    page.keyboard.press('Enter')
    editable = node('body').locator('.rich-content[contenteditable="true"]')
    expect(editable).to_be_focused()
    page.keyboard.type(' and more')
    page.keyboard.press('Escape')
    expect(node('body').locator('.rich-content[contenteditable="true"]')).to_have_count(0)
    expect(node('body')).to_contain_text('Body copy and more')
    node('photo').dblclick()
    assert selected_text() == ''
    expect(page.locator('.library .media-grid')).to_have_count(1)
    expect(page.locator('.library select').filter(has=page.locator('option[value=replace]'))).to_have_value('replace')
    expect(page.locator('.toast')).to_contain_text('media library')
    print('PASS: Enter edits text, Escape leaves it, double-clicking an image opens the media library', flush=True)

    # Element toolbar: move up/down; context menu: duplicate, hide, delete.
    order = lambda: page.locator('.editable-surface [data-node-id=hero] > .section-content > [data-node-id]').evaluate_all('els=>els.map(e=>e.dataset.nodeId)')
    first_order = order()
    node('body').click()
    toolbar = page.get_by_role('toolbar', name=re.compile('tools$'))
    toolbar.get_by_role('button', name='Move up', exact=True).click()
    assert order()[:2] == ['body', 'title'], order()
    page.get_by_role('toolbar', name=re.compile('tools$')).get_by_role('button', name='Move down', exact=True).click()
    assert order() == first_order, order()
    node('title').click(button='right')
    menu = page.get_by_role('menu')
    expect(menu).to_be_visible()
    expect(menu.get_by_role('menuitem', name=re.compile('^Edit text'))).to_be_focused()
    expect(menu.get_by_role('menuitem', name=re.compile('^Move up'))).to_be_disabled()
    page.screenshot(path=str(out / 'v10-context-menu.png'))
    page.keyboard.press('Escape')
    expect(menu).to_have_count(0)
    expect(node('title')).to_have_class(re.compile('selected'))
    node('title').click(button='right')
    page.get_by_role('menuitem', name=re.compile('^Duplicate')).click()
    expect(page.locator('.editable-surface [data-kind=heading]')).to_have_count(2)
    page.keyboard.press('Control+z')
    expect(page.locator('.editable-surface [data-kind=heading]')).to_have_count(1)
    node('photo').click(button='right')
    page.get_by_role('menuitem', name='Hide on Desktop', exact=True).click()
    expect(node('photo')).to_have_count(0)
    page.keyboard.press('Control+z')
    expect(node('photo')).to_be_visible()
    node('photo').click()
    page.keyboard.press('Delete')
    expect(node('photo')).to_have_count(0)
    page.keyboard.press('Control+z')
    expect(node('photo')).to_be_visible()
    print('PASS: toolbar move up/down, context menu with keyboard focus, duplicate/hide and Delete all undo', flush=True)

    # The vector icon is saved, reopened and published as SVG.
    page.keyboard.press('Control+s')
    expect(page.locator('.save-indicator')).to_contain_text('Saved', timeout=20000)
    stored = api('/pages/' + pid)['document']['nodes'][0]['children'][2]['children'][1]['props']
    assert stored['icon'] == 'lucide:truck' and stored['strokeWidth'] == '1.5', stored
    open_editor()
    expect(node('shipping').locator('svg.vector-icon')).to_have_count(1)
    api('/pages/' + pid + '/publish', 'POST', {})
    visitor = f['browser'].new_context()
    view = visitor.new_page()
    view.goto(base + '/?published=' + pid)
    icon = view.locator('[data-block=shipping] svg.vector-icon')
    expect(icon).to_be_visible()
    expect(icon).to_have_css('color', 'rgb(194, 65, 12)')
    assert view.locator('[data-block=shipping] svg *').count() >= 2
    print('PASS: vector icons save, reopen and publish as inline SVG', flush=True)
    assert not errors, errors
