"""0.9 page rules: one homepage per store, the store card opens the existing
homepage instead of adding pages, product designs are copied for other
products, older extra homepages are cleaned up, and the trash restores or
deletes pages."""
import re
import subprocess
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)


def product(id, title):
    return {'id': id, 'title': title, 'description': '', 'currency': 'TRY', 'images': ['/assets/headphones.svg'],
            'variants': [{'id': id + '-v', 'title': 'Standard', 'price': 199000, 'stock': 5}]}


with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    api('/stores/demo/catalog', 'PUT', {
        'version': api('/stores/demo/catalog')['version'],
        'products': [product('p1', 'Aura One'), product('p2', 'Aura Two'), product('p3', 'Aura Three')],
        'collections': [],
    })
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    count = lambda: len(api('/stores/demo/pages'))

    # The store card opens the store; only an empty store gets its homepage.
    assert count() == 0
    for attempt in range(3):
        page.goto(base)
        page.get_by_role('button', name='Open editor', exact=True).first.click()
        expect(page.get_by_label('Page name', exact=True)).to_have_value('Homepage')
        assert count() == 1, (attempt, api('/stores/demo/pages'))
    home = api('/stores/demo/pages')[0]
    assert home['type'] == 'home'
    assert api('/stores/demo/page-overview')[0]['assignments'] == ['home']
    page.get_by_role('button', name='Design actions', exact=True).click()
    duplicate_item = page.get_by_role('menuitem', name='Duplicate page', exact=True)
    expect(duplicate_item).to_be_disabled()
    expect(duplicate_item).to_have_attribute('title', re.compile('one homepage'))
    page.keyboard.press('Escape')
    print('PASS: Open editor reuses the homepage; the homepage cannot be duplicated', flush=True)

    # Dashboard and page management refuse a second homepage.
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    home_option = page.get_by_label('New page type', exact=True).locator('option[value=home]')
    expect(home_option).to_be_disabled()
    expect(home_option).to_have_text(re.compile('already exists'))
    expect(page.get_by_role('button', name='+ New homepage', exact=True)).to_be_disabled()
    home_row = page.locator('.page-table-row[data-page-id="' + home['id'] + '"]')
    expect(home_row).to_contain_text('Store homepage')
    expect(home_row.get_by_role('button', name=re.compile('^Duplicate'))).to_have_count(0)
    page.get_by_role('button', name='New page from template', exact=True).click()
    picker = page.get_by_role('dialog', name='New page from template')
    storefront = picker.locator('[data-template=storefront-home]')
    expect(storefront.locator('.template-type-note')).to_contain_text('already has a homepage')
    picker.get_by_role('button', name='Close New page from template', exact=True).click()
    print('PASS: homepage option, button and template type are blocked while a homepage exists', flush=True)

    # A product design is copied and given other products.
    design = api('/stores/demo/pages', 'POST', {'document': dict(document('Product design', [
        block('section', 'buy', {}, [block('productField', 'title', {'field': 'title', 'tag': 'h1'})])]), type='product')})
    api('/pages/' + design['id'] + '/assignments', 'PUT', {'version': 1, 'ids': ['p1']})
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.get_by_role('tab', name=re.compile('^Product pages')).click()
    page.get_by_role('button', name='Duplicate Product design', exact=True).click()
    dialog = page.get_by_role('dialog', name='Page assignments')
    expect(dialog).to_contain_text('Copy created. Choose the products that will use this design.')
    expect(dialog.get_by_label('Assign: Aura One', exact=True)).to_be_disabled()
    expect(dialog).to_contain_text('Used by “Product design”')
    dialog.get_by_label('Assign: Aura Two', exact=True).check()
    page.screenshot(path=str(out / 'v09-copy-assignments.png'))
    dialog.get_by_role('button', name='Save assignments', exact=True).click()
    expect(dialog).to_be_hidden()
    rows = page.locator('.page-table-row')
    expect(rows).to_have_count(2)
    expect(rows.filter(has_text='Aura Two')).to_have_count(1)
    copy = next(p for p in api('/stores/demo/page-overview') if p['id'] != design['id'] and p['type'] == 'product')
    assert copy['assignments'] == ['p2'] and copy['name'] == 'Product design · Copy', copy

    # The same from the editor menu: the dialog comes first, then the copy opens.
    page.locator('.page-table-row[data-page-id="' + design['id'] + '"]').get_by_role('button', name='Edit', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Product design')
    page.get_by_role('button', name='Design actions', exact=True).click()
    page.get_by_role('menuitem', name='Duplicate page', exact=True).click()
    dialog = page.get_by_role('dialog', name='Page assignments')
    expect(dialog.get_by_label('Assign: Aura Two', exact=True)).to_be_disabled()
    dialog.get_by_label('Assign: Aura Three', exact=True).check()
    dialog.get_by_role('button', name='Save assignments', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Product design · Copy')
    third = [p for p in api('/stores/demo/page-overview') if p['type'] == 'product']
    assert sorted(p['assignments'][0] for p in third) == ['p1', 'p2', 'p3'], third
    print('PASS: product designs are copied and assigned to other products; used products are locked', flush=True)

    # Older data: an extra homepage and repeated landing drafts.
    legacy = dict(document('Old homepage', [block('section', 'old', {}, [block('heading', 'old-title', {'html': 'Old', 'tag': 'h1'})])]), type='home')
    subprocess.run(['node', '--input-type=module', '-e', """
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[1]);
db.prepare("INSERT INTO pages VALUES('legacy-home','demo',?,1,?)").run(process.argv[2], Date.now());
db.close();
""", str(f['temp'] / 'fukpages.sqlite'), __import__('json').dumps(legacy)], cwd=ROOT, check=True)
    drafts = [api('/stores/demo/pages', 'POST', {'document': document('Aura · Product launch', [block('section', 's' + str(i), {}, [])])})['id'] for i in range(3)]
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    banner = page.locator('.page-rule-banner')
    expect(banner).to_contain_text('This store has 2 homepages.')
    expect(banner).to_contain_text('“Homepage” stays the homepage')
    extra = page.locator('.page-table-row[data-page-id=legacy-home]')
    expect(extra).to_contain_text('Extra homepage')
    page.screenshot(path=str(out / 'v09-page-manager.png'))
    extra.get_by_role('button', name='Convert to landing page', exact=True).click()
    expect(banner).to_have_count(0)
    page.get_by_role('tab', name=re.compile('^Other')).click()
    expect(page.locator('.page-table-row[data-page-id=legacy-home]')).to_contain_text('Landing page')
    print('PASS: an extra homepage from older data is flagged and converted to a landing page', flush=True)

    # Bulk trash, restore and permanent delete.
    for id in drafts:
        page.locator('.page-table-row[data-page-id="' + id + '"]').get_by_role('checkbox').check()
    bulk = page.get_by_role('region', name='Selected pages')
    expect(bulk).to_contain_text('3 pages selected')
    bulk.get_by_role('button', name='Move to trash', exact=True).click()
    confirm = page.get_by_role('dialog', name='Move to trash')
    expect(confirm).to_contain_text('Move 3 pages to the trash?')
    box = confirm.locator('.dialog-content').bounding_box()
    viewport = page.viewport_size
    assert abs(box['x'] + box['width'] / 2 - viewport['width'] / 2) < 2, box
    page.screenshot(path=str(out / 'v09-confirm.png'))
    confirm.get_by_role('button', name='Move to trash', exact=True).click()
    expect(page.locator('.page-table-row').filter(has_text='Aura · Product launch')).to_have_count(0)
    assert not any(p['id'] in drafts for p in api('/stores/demo/pages'))
    trash_tab = page.get_by_role('tab', name=re.compile('^Trash'))
    expect(trash_tab).to_contain_text('3')
    trash_tab.click()
    trashed = page.locator('.page-trash [data-trash-id]')
    expect(trashed).to_have_count(3)
    page.screenshot(path=str(out / 'v09-trash.png'))
    trashed.first.get_by_role('button', name=re.compile('^Restore ')).click()
    expect(trashed).to_have_count(2)
    page.locator('.page-trash [data-trash-id]').first.get_by_role('button', name=re.compile('^Delete .* permanently$')).click()
    page.get_by_role('dialog', name='Delete permanently').get_by_role('button', name='Delete permanently', exact=True).click()
    expect(trashed).to_have_count(1)
    assert len(api('/stores/demo/trash')) == 1
    assert sum(p['name'] == 'Aura · Product launch' for p in api('/stores/demo/pages')) == 1
    print('PASS: bulk move to trash, restore and permanent delete', flush=True)

    # Trashing the homepage frees the role for a new one.
    page.get_by_role('tab', name=re.compile('^Homepage')).click()
    page.locator('.page-table-row[data-page-id="' + home['id'] + '"]').get_by_role('button', name='Move Homepage to the trash', exact=True).click()
    confirm = page.get_by_role('dialog', name='Move to trash')
    expect(confirm).to_contain_text("The store's homepage will be moved too.")
    confirm.get_by_role('button', name='Move to trash', exact=True).click()
    expect(page.get_by_role('button', name='+ New homepage', exact=True)).to_be_enabled()
    expect(page.get_by_label('New page type', exact=True).locator('option[value=home]')).to_be_enabled()
    page.get_by_role('button', name='+ New homepage', exact=True).click()
    expect(page.locator('.page-table-row').filter(has_text='Store homepage')).to_have_count(1)
    page.get_by_role('tab', name=re.compile('^Trash')).click()
    page.get_by_role('button', name='Restore Homepage', exact=True).click()
    expect(page.locator('.toast.error')).to_contain_text('This store already has a homepage: “Homepage”')
    print('PASS: trashing the homepage allows a new one; the old one cannot be restored next to it', flush=True)

    # The table keeps its columns aligned and never scrolls sideways.
    page.get_by_role('button', name='Dismiss notification', exact=True).click()
    page.get_by_role('tab', name=re.compile('^All')).click()
    for width in (1680, 1180, 960, 760):
        page.set_viewport_size({'width': width, 'height': 1000})
        assert page.evaluate('()=>document.documentElement.scrollWidth-innerWidth') <= 1, width
        if width > 900:
            lefts = page.locator('.page-manager .page-table > div').evaluate_all(
                'rows=>rows.map(r=>[...r.children].filter(c=>getComputedStyle(c).display!=="none").map(c=>Math.round(c.getBoundingClientRect().left)).join(","))')
            assert len(set(lefts)) == 1, (width, lefts)
        page.screenshot(path=str(out / ('v09-page-manager-%d.png' % width)))
    print('PASS: aligned page table from 1680 px down to 760 px without horizontal scroll', flush=True)
    assert not errors, errors
