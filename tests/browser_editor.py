"""0.7 editor: labelled rail, single top bar, compact library, exact drop line,
section inserts, floating text toolbar, breadcrumb, save and local publish."""
import re
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)


def find(nodes, target):
    for node in nodes:
        if node['id'] == target:
            return node
        found = find(node['children'], target)
        if found:
            return found


with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    doc = document('Editor refresh', [
        block('section', 'top', {'sectionRole': 'header'}, [block('heading', 'top-title', {'html': 'Header', 'tag': 'h2'})]),
        block('section', 'hero', {}, [block('column', 'hero-col', {}, [
            block('heading', 'hero-title', {'html': 'Hero title', 'tag': 'h1'}, styles={'fontSize': '40px'}),
            block('text', 'first', {'html': 'First paragraph'}, styles={'fontSize': '18px'}),
            block('text', 'second', {'html': 'Second paragraph'}, styles={'fontSize': '18px'}),
        ], styles={'display': 'flex', 'flexDirection': 'column', 'gap': '28px', 'width': '100%'})],
            styles={'paddingTop': '48px', 'paddingBottom': '48px', 'paddingLeft': '40px', 'paddingRight': '40px'}),
        block('section', 'bottom', {'sectionRole': 'footer'}, [block('text', 'footer-text', {'html': 'Footer'})],
              styles={'paddingTop': '24px', 'paddingBottom': '24px'}),
    ])
    pid = api('/stores/demo/pages', 'POST', {'document': doc})['id']
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def open_editor():
        page.goto(base)
        page.get_by_role('button', name='Manage pages', exact=True).first.click()
        page.locator('.page-table-row[data-page-id="' + pid + '"]').get_by_role('button', name='Edit', exact=True).click()
        expect(page.get_by_label('Page name', exact=True)).to_have_value('Editor refresh')

    open_editor()
    node = lambda id: page.locator('.editable-surface [data-node-id="' + id + '"]')
    top_level = lambda: page.locator('.editable-surface > [data-node-id]').evaluate_all('els=>els.map(e=>e.dataset.nodeId)')

    # One top bar and a labelled rail with a distinct glyph per tool.
    expect(page.locator('.editor-page-bar')).to_have_count(0)
    rail = page.locator('.tool-rail [data-rail]')
    expect(rail).to_have_count(11)
    captions = rail.locator('.rail-caption').all_inner_texts()
    assert captions == ['Elements', 'Sections', 'Templates', 'Layers', 'Media', 'Brand', 'Page', 'Products', 'Theme', 'Growth', 'Accounts'], captions
    assert all(rail.nth(i).locator('.rail-caption').is_visible() for i in range(rail.count()))
    glyphs = rail.evaluate_all("els=>els.map(e=>e.querySelector('svg').getAttribute('class'))")
    assert len(set(glyphs)) == len(glyphs), glyphs
    page.get_by_role('button', name='Media', exact=True).click()
    expect(page.locator('.library-heading h2')).to_have_text('Media library')
    expect(page.get_by_role('button', name='Media', exact=True)).to_have_attribute('aria-pressed', 'true')
    switcher = page.get_by_label('Switch pages', exact=True)
    expect(switcher.locator('option[value="' + pid + '"]')).to_have_count(1)
    node('first').click()
    page.get_by_role('button', name='Design actions', exact=True).click()
    menu = page.get_by_role('menu')
    for item in ['Page management', 'Duplicate page', 'Export JSON', 'Import JSON', 'Starter templates']:
        expect(menu.get_by_role('menuitem', name=item, exact=True)).to_be_visible()
    page.keyboard.press('Escape')
    expect(menu).to_have_count(0)
    expect(node('first')).to_have_class(re.compile(r'\bselected\b'))
    print('PASS: single top bar with page switcher and page menu; labelled rail with distinct icons', flush=True)

    # Compact library: at least three columns and one glyph per element kind.
    page.get_by_role('button', name='Elements', exact=True).click()
    grid = page.locator('.element-library .palette-grid').nth(1)
    columns = grid.evaluate("g=>getComputedStyle(g).gridTemplateColumns.split(' ').length")
    assert columns >= 3, columns
    cards = page.locator('.element-library .palette-card:not([data-row-columns])')
    expect(cards).to_have_count(49)
    icons = cards.evaluate_all("els=>els.map(e=>e.querySelector('.palette-visual svg').getAttribute('class'))")
    assert len(set(icons)) == len(icons), [i for i in icons if icons.count(i) > 1]
    search = page.get_by_label('Search elements', exact=True)
    search.fill('cart')
    assert 0 < cards.count() < 5
    search.press('Escape')
    expect(cards).to_have_count(49)
    page.screenshot(path=str(out / 'v07-element-library.png'))
    print('PASS: compact grouped library, unique element icons and search', flush=True)

    # Hover shows the layer name; dragging draws one insertion line exactly where it drops.
    node('second').hover()
    assert node('second').evaluate("e=>getComputedStyle(e,'::after').content") == '"second"'

    def drag_to(source, x, y, check=None):
        box = source.bounding_box()
        page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
        page.mouse.down()
        page.mouse.move(box['x'] + box['width'] / 2 + 30, box['y'] + box['height'] / 2 + 20, steps=4)
        page.mouse.move(x, y, steps=18)
        page.wait_for_timeout(250)
        result = check() if check else None
        page.mouse.up()
        page.wait_for_timeout(300)
        return result

    first, second = node('first').bounding_box(), node('second').bounding_box()
    middle = (first['y'] + first['height'] + second['y']) / 2

    def between_paragraphs():
        line = page.locator('[data-drop-indicator]')
        expect(line).to_have_count(1)
        box = line.bounding_box()
        now_first, now_second = node('first').bounding_box(), node('second').bounding_box()
        now_middle = (now_first['y'] + now_first['height'] + now_second['y']) / 2
        assert abs(box['y'] + box['height'] / 2 - now_middle) <= 8, (box, now_middle)
        expect(line.locator('.drop-gap')).to_have_text('28')
        expect(line.locator('.drop-gap')).to_have_attribute('title', 'Spacing between items')
        assert node('hero-col').evaluate("e=>getComputedStyle(e,'::before').content") == '"hero-col"'
        assert page.locator('.editable-surface .node-slot').count() == 0
        expect(node('hero-col')).to_have_attribute('data-drop-target', '')
        assert page.locator('[data-drop-target]').count() == 1
        page.screenshot(path=str(out / 'v07-drop-line.png'))

    drag_to(page.locator('[data-palette=heading]'), first['x'] + first['width'] / 2, middle, between_paragraphs)
    expect(page.locator('[data-drop-indicator]')).to_have_count(0)
    kids = page.locator('.editable-surface [data-node-id=hero-col] > .editor-block').evaluate_all('els=>els.map(e=>e.dataset.nodeId)')
    assert len(kids) == 4 and kids[:2] == ['hero-title', 'first'] and kids[3] == 'second', kids
    new_heading = kids[2]
    expect(node(new_heading)).to_have_attribute('data-kind', 'heading')

    # Left-press anywhere on a block and drag it, like GemPages; no grip needed.
    second = node('second').bounding_box()
    page.mouse.click(10, 10)  # clear selection so the paragraph itself is picked
    start = node('first').bounding_box()

    def pressed_drag():
        expect(node('first')).to_have_class(re.compile(r'\bmoving\b'))
        expect(page.locator('.drag-chip')).to_contain_text('first')
        expect(node('hero-col')).to_have_attribute('data-drop-target', '')
        expect(page.locator('[data-drop-gap]')).to_have_text('28')
        line = page.locator('[data-drop-indicator]').bounding_box()
        assert abs(line['y'] + line['height'] / 2 - (second['y'] + second['height'])) <= 8, (line, second)
        page.screenshot(path=str(out / 'v07-press-drag.png'))

    page.mouse.move(start['x'] + 40, start['y'] + start['height'] / 2)
    page.mouse.down()
    page.mouse.move(start['x'] + 60, start['y'] + start['height'] / 2 + 10, steps=4)
    page.mouse.move(second['x'] + 60, second['y'] + second['height'] - 3, steps=16)
    page.wait_for_timeout(250)
    pressed_drag()
    page.mouse.up()
    page.wait_for_timeout(300)
    kids = page.locator('.editable-surface [data-node-id=hero-col] > .editor-block').evaluate_all('els=>els.map(e=>e.dataset.nodeId)')
    assert kids == ['hero-title', new_heading, 'second', 'first'], kids
    expect(node('first')).to_have_class(re.compile(r'\bselected\b'))
    # A plain click still only selects.
    node('second').click()
    expect(node('second')).to_have_class(re.compile(r'\bselected\b'))
    assert page.locator('.editable-surface [data-node-id=hero-col] > .editor-block').evaluate_all('els=>els.map(e=>e.dataset.nodeId)') == kids

    page.get_by_role('button', name='Sections', exact=True).click()
    preset = page.locator('[data-section-preset]').first
    hero = node('hero').bounding_box()

    def after_hero():
        line = page.locator('[data-drop-indicator]')
        expect(line).to_have_count(1)
        expect(line.locator('.drop-gap')).to_have_count(0)
        box = line.bounding_box()
        assert abs(box['y'] + box['height'] / 2 - (hero['y'] + hero['height'])) <= 8, (box, hero)
        expect(line).to_have_text('Section')

    drag_to(preset, hero['x'] + hero['width'] / 2, hero['y'] + hero['height'] - 12, after_hero)
    order = top_level()
    assert order[:2] == ['top', 'hero'] and order[-1] == 'bottom' and len(order) == 4, order
    dropped_section = order[2]
    print('PASS: hover label, press-and-drag on blocks, single insertion line with labelled target, drop lands on the line', flush=True)

    # Add-section affordance between sections.
    node('hero').hover()
    insert = page.locator('[data-section-insert=hero] .section-insert-button')
    expect(insert).to_be_visible()
    expect(insert).to_have_css('opacity', '1')
    insert.click()
    page.get_by_role('menuitem', name=re.compile('^Blank section')).click()
    order = top_level()
    assert order[:2] == ['top', 'hero'] and order[3] == dropped_section and order[-1] == 'bottom', order
    blank = order[2]
    expect(node(blank)).to_have_class(re.compile(r'\bselected\b'))
    assert page.locator('[data-section-insert=bottom]').count() == 0
    node('top').hover()
    expect(page.locator('[data-section-insert=top] .section-insert-button')).to_have_css('opacity', '1')
    page.locator('[data-section-insert=top] .section-insert-button').click()
    page.get_by_role('menuitem', name=re.compile('^Choose a ready-made section')).click()
    expect(page.locator('[data-section-preset]').first).to_be_visible()
    page.locator('[data-section-preset]').nth(1).click()
    order = top_level()
    assert order[0] == 'top' and order[2] == 'hero' and order[3] == blank and len(order) == 6, order
    print('PASS: + between sections adds a blank or ready-made section exactly there', flush=True)

    # Floating text toolbar: bold, colour, link, line break; canonical save.
    text = node('second').locator('.rich-content')
    text.dblclick()
    expect(text).to_have_attribute('contenteditable', 'true')
    toolbar = page.get_by_role('toolbar', name='Text formatting', exact=True)
    expect(toolbar).to_be_visible()
    assert toolbar.bounding_box()['y'] + toolbar.bounding_box()['height'] <= text.bounding_box()['y'] + 1
    select_word = """(word)=>{const el=document.activeElement;const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=walk.nextNode())){const i=n.textContent.indexOf(word);if(i>=0){const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+word.length);getSelection().removeAllRanges();getSelection().addRange(r);return true}}return false}"""
    assert page.evaluate(select_word, 'Second')
    toolbar.get_by_role('button', name='Bold', exact=True).click()
    expect(text.locator('b')).to_have_text('Second')
    expect(toolbar.get_by_role('button', name='Bold', exact=True)).to_have_attribute('aria-pressed', 'true')
    toolbar.get_by_role('button', name='Colour of selected text', exact=True).click()
    toolbar.get_by_role('button', name='Colour #2563eb', exact=True).click()
    assert page.evaluate(select_word, 'paragraph')
    toolbar.get_by_role('button', name='Add link', exact=True).click()
    link_input = page.get_by_label('Link address', exact=True)
    link_input.fill('javascript:alert(1)')
    link_input.press('Enter')
    expect(link_input).to_have_attribute('aria-invalid', 'true')
    link_input.fill('/pages/about')
    link_input.press('Enter')
    expect(text.locator('a')).to_have_attribute('href', '/pages/about')
    expect(text).to_have_attribute('contenteditable', 'true')
    text.press('End')
    text.press('Enter')
    page.keyboard.type('Third line')
    page.screenshot(path=str(out / 'v07-text-toolbar.png'))
    page.keyboard.press('Escape')
    expect(text).to_have_attribute('contenteditable', 'false')
    expect(page.locator('[data-text-toolbar]')).to_have_count(0)
    text.locator('a').click()
    assert page.url.rstrip('/') == base.rstrip('/'), page.url
    assert page.get_by_label('Text content', exact=True).inner_text() == 'Second paragraph\nThird line'
    page.keyboard.press('Control+s')
    expect(page.locator('.save-indicator')).to_contain_text('Saved', timeout=20000)
    stored = find(api('/pages/' + pid)['document']['nodes'], 'second')['props']['html']
    assert '<a href="/pages/about">paragraph</a>' in stored, stored
    assert re.search(r'<b><span style="color:#2563eb">Second</span></b>|<span style="color:#2563eb"><b>Second</b></span>', stored), stored
    assert stored.endswith('<br />Third line'), stored
    print('PASS: floating toolbar formats, colours and links text; Enter keeps one element; canonical HTML is saved', flush=True)

    # Breadcrumb walks the ancestors of the selection.
    node(new_heading).click()
    crumbs = page.locator('.canvas-breadcrumb .crumb button')
    expect(crumbs).to_have_count(3)
    assert crumbs.all_inner_texts()[:2] == ['hero', 'hero-col'], crumbs.all_inner_texts()
    crumbs.nth(1).click()
    expect(node('hero-col')).to_have_class(re.compile(r'\bselected\b'))
    expect(page.locator('.inspector-heading')).to_contain_text('Column')
    print('PASS: breadcrumb selects ancestors', flush=True)

    # Reopen and publish: content survives and the visitor gets a real link.
    open_editor()
    expect(node('second').locator('a')).to_have_attribute('href', '/pages/about')
    assert top_level() == order, (top_level(), order)
    page.get_by_role('button', name='Publish locally', exact=True).click()
    expect(page.get_by_role('button', name=re.compile('Update local publication|Update local'))).to_be_visible(timeout=20000)
    visitor = f['browser'].new_context(viewport={'width': 1280, 'height': 900}).new_page()
    visitor.goto(base + '/?published=' + pid)
    expect(visitor.locator('.page-surface a[href="/pages/about"]')).to_have_text('paragraph')
    expect(visitor.locator('.page-surface b').filter(has_text='Second')).to_have_count(1)
    assert visitor.locator('.page-surface .rich-content').filter(has_text='Third line').count() == 1
    assert not errors, errors
    print('PASS: reopened draft keeps structure and formatting; local publication renders the link; no browser errors', flush=True)
