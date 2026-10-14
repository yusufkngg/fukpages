"""0.11 collection and product page assignments: the first page is the default
for every product/collection, copies take specific items, the collection list
looks like a storefront and both routes publish correctly."""
import re
from browser_support import ROOT, browser_fixture, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)


def product(n):
    return {'id': 'p%d' % n, 'title': 'Product %d' % n, 'description': 'Sample product %d.' % n, 'currency': 'TRY',
            'images': ['/assets/headphones.svg'],
            'variants': [{'id': 'p%d-v' % n, 'title': 'Standard', 'price': 10000 * n,
                          'comparePrice': 15000 * n if n % 2 else 0, 'stock': 0 if n == 6 else 5}]}


with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    api('/stores/demo/catalog', 'PUT', {
        'version': api('/stores/demo/catalog')['version'],
        'products': [product(n) for n in range(1, 11)],
        'collections': [
            {'id': 'new', 'title': 'New arrivals', 'description': 'Fresh picks for the season.', 'productIds': ['p%d' % n for n in range(1, 11)]},
            {'id': 'best', 'title': 'Best sellers', 'description': 'Most loved.', 'productIds': ['p2', 'p4']},
        ],
    })
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()

    # A new collection page covers every collection by default.
    page.get_by_role('button', name='+ New collection page', exact=True).click()
    row = page.locator('.page-table-row').filter(has_text='New collection page')
    expect(row).to_contain_text('All collections · default')
    row.get_by_role('button', name='Edit', exact=True).click()
    view = page.locator('.editable-surface .collection-view')
    expect(view.locator('.collection-title')).to_have_text('New arrivals')
    expect(view.locator('.collection-toolbar')).to_contain_text('10 products')
    expect(view.locator('.collection-card')).to_have_count(10)
    expect(view.locator('.collection-badge').first).to_have_text('-%33')
    expect(view.locator('.collection-pagination')).to_have_count(0)
    page.get_by_label('Preview collection', exact=True).select_option('best')
    expect(view.locator('.collection-title')).to_have_text('Best sellers')
    page.get_by_label('Preview collection', exact=True).select_option('new')
    page.locator('.editable-surface [data-kind=collectionGrid]').click()
    settings = page.locator('[data-collection-settings]')
    expect(settings).to_be_visible()
    settings.get_by_role('radio', name='3', exact=True).click()
    columns = view.locator('.collection-grid').evaluate('el=>getComputedStyle(el).gridTemplateColumns.split(" ").length')
    assert columns == 3, columns
    settings.get_by_label('Products per page', exact=True).fill('6')
    expect(view.locator('.collection-card')).to_have_count(6)
    expect(view.locator('.collection-pagination button[aria-current=page]')).to_have_text('1')
    expect(view.locator('.collection-card').filter(has_text='Product 6')).to_contain_text('Sold out')
    view.locator('.collection-pagination').get_by_role('button', name='2', exact=True).click()
    expect(view.locator('.collection-card')).to_have_count(4)
    view.get_by_label('Product order', exact=True).select_option('price-desc')
    expect(view.locator('.collection-card-title').first).to_have_text('Product 10')
    settings.get_by_label('Add to cart button', exact=True).uncheck()
    expect(view.locator('.collection-add')).to_have_count(0)
    page.set_viewport_size({'width': 1680, 'height': 1050})
    page.screenshot(path=str(out / 'v11-collection-editor.png'))
    page.keyboard.press('Control+s')
    expect(page.locator('.save-indicator')).to_contain_text('Saved', timeout=20000)
    collection_page = [p for p in api('/stores/demo/page-overview') if p['type'] == 'collection'][0]
    api('/pages/' + collection_page['id'] + '/publish', 'POST', {})
    visitor = f['browser'].new_context(viewport={'width': 1280, 'height': 900})
    shop = visitor.new_page()
    shop.on('pageerror', lambda e: errors.append(str(e)))
    shop.goto(base + '/p/demo/collections/best')
    expect(shop.locator('.collection-title')).to_have_text('Best sellers')
    expect(shop.locator('.collection-card')).to_have_count(2)
    expect(shop.locator('.collection-card-title a').first).to_have_attribute('href', '/p/demo/products/p2')
    shop.set_viewport_size({'width': 390, 'height': 900})
    assert shop.evaluate('()=>document.documentElement.scrollWidth-innerWidth') <= 1
    print('PASS: a collection page is the default for every collection and renders a storefront product list with columns, paging, sorting and badges', flush=True)

    # Product pages: the first one is for all products; a copy takes five.
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.get_by_role('button', name='+ New product page', exact=True).click()
    general = page.locator('.page-table-row').filter(has_text='New product page').first
    expect(general).to_contain_text('All products · default')
    general_id = general.get_attribute('data-page-id')
    page.get_by_role('tab', name=re.compile('^Product pages')).click()
    page.get_by_role('button', name='Duplicate New product page', exact=True).click()
    dialog = page.get_by_role('dialog', name='Page assignments')
    expect(dialog).to_contain_text('Current default: “New product page”.')
    expect(dialog.get_by_label('All products · default', exact=True)).to_be_disabled()
    dialog.get_by_label('Search products', exact=True).fill('Product 1')
    expect(dialog.locator('.assignment-options label')).to_have_count(2)
    dialog.get_by_label('Search products', exact=True).fill('')
    for n in range(1, 6):
        dialog.get_by_label('Assign: Product %d' % n, exact=True).check()
    expect(dialog).to_contain_text('5 products selected')
    page.screenshot(path=str(out / 'v11-product-assignments.png'))
    dialog.get_by_role('button', name='Save assignments', exact=True).click()
    expect(dialog).to_be_hidden()
    overview = api('/stores/demo/page-overview')
    special = next(p for p in overview if p['type'] == 'product' and p['id'] != general_id)
    assert sorted(special['assignments']) == ['p1', 'p2', 'p3', 'p4', 'p5'], special
    for p in (general_id, special['id']):
        api('/pages/' + p + '/publish', 'POST', {})
    route = lambda id: visitor.request.get(base + '/api/public/stores/demo/products/' + id).json()['pageId']
    assert route('p3') == special['id']
    assert route('p8') == general_id
    print('PASS: copies take specific products while the first product page stays the default for the rest', flush=True)

    # The default can move to another page from the dialog.
    page.locator('.page-table-row[data-page-id="' + special['id'] + '"]').get_by_role('button', name='Assignments', exact=True).click()
    dialog = page.get_by_role('dialog', name='Page assignments')
    dialog.get_by_role('button', name='Make this page the default', exact=True).click()
    expect(dialog.get_by_label('All products · default', exact=True)).to_be_checked()
    dialog.get_by_role('button', name='Save assignments', exact=True).click()
    expect(page.locator('.page-table-row[data-page-id="' + special['id'] + '"]')).to_contain_text('All products · default')
    assert route('p8') == special['id']
    print('PASS: the default product page moves with one click', flush=True)
    assert not errors, errors
