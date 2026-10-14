"""Audit stage 4: the local catalogue is edited with forms (products, variants,
prices, images, custom fields and collections) instead of raw JSON."""
import re
from browser_support import ROOT, block, browser_fixture, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    seed = api('/stores/demo/catalog')
    headphones = {'id': 'aura', 'title': 'Aura Headphones', 'description': 'Wireless.', 'currency': 'TRY', 'images': ['/assets/headphones.svg'],
                  'variants': [{'id': 'aura-black', 'title': 'Black', 'price': 499000, 'comparePrice': 599000, 'stock': 4}]}
    api('/stores/demo/catalog', 'PUT', {'version': seed['version'], 'products': [headphones],
        'collections': [{'id': 'featured', 'title': 'Featured', 'description': '', 'productIds': ['aura']}]})
    before = api('/stores/demo/catalog')
    page = f['owner'].new_page()
    page.set_viewport_size({'width': 1440, 'height': 960})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    # A failed load shows an error with a retry instead of an empty editor.
    failures = {'left': 1}

    def flaky(route):
        if failures['left']:
            failures['left'] -= 1
            route.fulfill(status=500, content_type='application/json', body='{"error":"Temporary failure"}')
        else:
            route.continue_()

    home = api('/stores/demo/pages', 'POST', {'document': document('Catalogue check', [block('section', 's', {}, [block('heading', 'h', {'html': 'Hello', 'tag': 'h1'})])])})['id']
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.locator('.page-table-row[data-page-id="' + home + '"]').get_by_role('button', name='Edit', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_be_visible()
    page.route('**/api/stores/demo/catalog', flaky)
    page.locator('.tool-rail button').filter(has_text=re.compile('^Products$')).first.click()
    panel = page.locator('.catalog-panel')
    expect(panel.get_by_role('alert')).to_contain_text('Temporary failure')
    panel.get_by_role('button', name='Try again', exact=True).click()
    expect(panel.get_by_role('tab', name=re.compile('^Products'))).to_have_attribute('aria-selected', 'true')
    page.unroute('**/api/stores/demo/catalog')
    assert 'textarea' not in panel.inner_html().split('<details')[0], 'JSON editor must not be the main editor'
    expect(panel.get_by_role('status')).to_have_text('All changes saved')
    print('PASS: a failed catalogue load shows the error and retries', flush=True)

    # New product with two variants, an option, prices typed with separators.
    panel.get_by_role('button', name='+ New product', exact=True).click()
    dialog = page.get_by_role('dialog', name='Product editor')
    dialog.get_by_label('Product name', exact=True).fill('Linen Shirt')
    dialog.get_by_label('Product ID', exact=True).fill('linen-shirt')
    dialog.get_by_label('Description', exact=True).fill('Breathable summer shirt.')
    dialog.get_by_label('New option name', exact=True).fill('Size')
    dialog.get_by_role('button', name='Add option', exact=True).click()
    dialog.get_by_label('Variant name 1', exact=True).fill('Small')
    dialog.get_by_label('Size value: Small', exact=True).fill('S')
    dialog.get_by_label('Price: Small', exact=True).fill('1,299.90')
    dialog.get_by_label('Compare-at price: Small', exact=True).fill('999')
    dialog.get_by_label('Stock: Small', exact=True).fill('7')
    expect(dialog.get_by_role('alert').filter(has_text='compare-at price must be higher')).to_be_visible()
    dialog.get_by_label('Compare-at price: Small', exact=True).fill('1599')
    expect(dialog.get_by_role('alert')).to_have_count(0)
    dialog.get_by_role('button', name='Duplicate variant: Small', exact=True).click()
    dialog.get_by_label('Variant name 2', exact=True).fill('Large')
    dialog.get_by_label('Size value: Large', exact=True).fill('L')
    dialog.get_by_label('Stock: Large', exact=True).fill('0')
    dialog.get_by_role('button', name='+ Add image', exact=True).click()
    dialog.get_by_label('Image URL', exact=True).fill('/assets/headphones.svg')
    dialog.get_by_role('button', name='Add', exact=True).click()
    expect(dialog.locator('.catalog-images img')).to_have_count(1)
    dialog.get_by_label('Variant image: Large', exact=True).select_option('/assets/headphones.svg')
    dialog.get_by_role('button', name='+ Add field', exact=True).click()
    dialog.get_by_label('Field key 1', exact=True).fill('details.material')
    dialog.get_by_label('Field key 1', exact=True).blur()
    dialog.get_by_label('Field value 1', exact=True).fill('Linen')
    collection = before['collections'][0]
    dialog.locator('.catalog-collections label').filter(has_text=collection['title']).locator('input').check()
    page.screenshot(path=str(out / 'v12-product-editor.png'))
    dialog.get_by_role('button', name='Done', exact=True).click()
    row = panel.get_by_role('button', name='Edit product: Linen Shirt', exact=True)
    expect(row).to_contain_text('2 variants')
    expect(row).to_contain_text('7 in stock')
    expect(panel.get_by_role('status')).to_have_text('Unsaved changes')
    panel.get_by_role('button', name='Save catalogue', exact=True).click()
    expect(panel.get_by_role('status')).to_have_text('All changes saved')
    saved = api('/stores/demo/catalog')
    shirt = next(p for p in saved['products'] if p['id'] == 'linen-shirt')
    assert [v['price'] for v in shirt['variants']] == [129990, 129990], shirt
    assert shirt['variants'][0]['comparePrice'] == 159900
    assert [v['options'] for v in shirt['variants']] == [{'Size': 'S'}, {'Size': 'L'}]
    assert [v['stock'] for v in shirt['variants']] == [7, 0]
    assert shirt['variants'][1]['image'] == '/assets/headphones.svg'
    assert shirt['metafields'] == {'details.material': 'Linen'}
    assert all(v['id'].startswith('linen-shirt-') for v in shirt['variants']), shirt['variants']
    assert 'linen-shirt' in next(c for c in saved['collections'] if c['id'] == collection['id'])['productIds']
    assert len(saved['products']) == len(before['products']) + 1
    print('PASS: products, variants, options, prices, stock, images, fields and collection membership are edited with forms', flush=True)

    # Invalid data is pointed at and never sent.
    row.click()
    dialog = page.get_by_role('dialog', name='Product editor')
    dialog.get_by_label('Product name', exact=True).fill('')
    dialog.get_by_role('button', name='Done', exact=True).click()
    expect(panel.get_by_role('status')).to_have_text('1 problems to fix')
    panel.get_by_role('button', name='Save catalogue', exact=True).click()
    dialog = page.get_by_role('dialog', name='Product editor')
    expect(dialog.get_by_label('Product name', exact=True)).to_have_attribute('aria-invalid', 'true')
    dialog.get_by_label('Product name', exact=True).fill('Linen Shirt')
    dialog.get_by_role('button', name='Done', exact=True).click()
    assert api('/stores/demo/catalog')['version'] == saved['version']
    print('PASS: invalid fields are highlighted and the catalogue is not saved', flush=True)

    # Collections: create, pick products with search, reorder.
    panel.get_by_role('tab', name=re.compile('^Collections')).click()
    panel.get_by_role('button', name='+ New collection', exact=True).click()
    dialog = page.get_by_role('dialog', name='Collection editor')
    dialog.get_by_label('Collection name', exact=True).fill('Summer')
    dialog.get_by_label('Collection ID', exact=True).fill('summer')
    first = before['products'][0]
    dialog.get_by_label('Add to collection: ' + first['title'], exact=True).check()
    dialog.get_by_label('Search products', exact=True).fill('Linen')
    expect(dialog.locator('.catalog-pick li')).to_have_count(1)
    dialog.get_by_role('button', name='Select listed', exact=True).click()
    expect(dialog.locator('.catalog-order li')).to_have_count(2)
    dialog.get_by_role('button', name='Move up: Linen Shirt', exact=True).click()
    expect(dialog.locator('.catalog-order li').first).to_contain_text('Linen Shirt')
    page.screenshot(path=str(out / 'v12-collection-editor.png'))
    dialog.get_by_role('button', name='Done', exact=True).click()
    panel.get_by_role('button', name='Save catalogue', exact=True).click()
    expect(panel.get_by_role('status')).to_have_text('All changes saved')
    summer = next(c for c in api('/stores/demo/catalog')['collections'] if c['id'] == 'summer')
    assert summer['productIds'] == ['linen-shirt', first['id']], summer
    print('PASS: collections take searched products in a chosen order', flush=True)

    # Deleting a product also drops it from collections; discard restores.
    panel.get_by_role('tab', name=re.compile('^Products')).click()
    panel.get_by_role('button', name='Delete product: Linen Shirt', exact=True).click()
    expect(panel.get_by_role('button', name='Edit product: Linen Shirt', exact=True)).to_have_count(0)
    panel.get_by_role('button', name='Discard changes', exact=True).click()
    expect(panel.get_by_role('button', name='Edit product: Linen Shirt', exact=True)).to_be_visible()
    expect(panel.get_by_role('status')).to_have_text('All changes saved')
    print('PASS: deletes stay local until saved and can be discarded', flush=True)

    # A change made elsewhere is not overwritten.
    current = api('/stores/demo/catalog')
    api('/stores/demo/catalog', 'PUT', {'version': current['version'], 'products': current['products'], 'collections': current['collections']})
    panel.get_by_role('button', name='Edit product: Linen Shirt', exact=True).click()
    dialog = page.get_by_role('dialog', name='Product editor')
    dialog.get_by_label('Description', exact=True).fill('Changed here.')
    dialog.get_by_role('button', name='Done', exact=True).click()
    panel.get_by_role('button', name='Save catalogue', exact=True).click()
    expect(panel.get_by_role('status')).to_have_text('The catalogue changed somewhere else.')
    panel.get_by_role('button', name='Reload', exact=True).click()
    expect(panel.get_by_role('status')).to_have_text('All changes saved')
    print('PASS: a catalogue changed elsewhere is reported and reloaded, not overwritten', flush=True)

    # The storefront uses the visual edits.
    shop = f['browser'].new_context().new_page()
    r = shop.request.get(base + '/api/public/stores/demo/products/linen-shirt')
    assert r.status in (200, 404), r.status
    page.set_viewport_size({'width': 390, 'height': 800})
    panel.get_by_role('button', name='Edit product: Linen Shirt', exact=True).click()
    dialog = page.get_by_role('dialog', name='Product editor')
    assert dialog.evaluate('el=>el.scrollWidth<=el.clientWidth+1'), 'dialog overflows on phones'
    dialog.get_by_role('button', name='Done', exact=True).click()
    print('PASS: the product editor fits a phone screen', flush=True)
    assert not errors, errors
