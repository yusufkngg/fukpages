"""Full-page templates: gallery, preview, replace/append with undo, new page
from template, and every template published and checked on three widths."""
import json
import re
import subprocess
from browser_support import ROOT, block, browser_fixture, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)
script = """
const { pageTemplates, templateDocument } = await import('./src/pageTemplateLibrary.ts');
const context = { collectionId: 'demo-collection', productIds: ['aura-one'] };
process.stdout.write(JSON.stringify(pageTemplates.map((t) => ({
  id: t.id, types: t.types, document: templateDocument(t.id, context) }))));
"""
templates = json.loads(subprocess.run(
    ['node', '--import', 'tsx', '--input-type=module', '-e', script],
    cwd=ROOT, capture_output=True, text=True, check=True).stdout)
assert len(templates) >= 8, len(templates)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    # A small local catalogue so product and collection templates show data.
    api('/stores/demo/catalog', 'PUT', {
        'version': api('/stores/demo/catalog')['version'],
        'products': [{
            'id': 'aura-one', 'title': 'Aura One', 'description': 'Sample product.',
            'currency': 'TRY', 'images': ['/assets/headphones.svg'],
            'variants': [{'id': 'aura-green', 'title': 'Green', 'price': 499000, 'stock': 5, 'options': {'Colour': 'Green'}}],
        }],
        'collections': [{'id': 'demo-collection', 'title': 'Aura collection', 'productIds': ['aura-one']}],
    })
    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    top_level = lambda: page.locator('.editable-surface > [data-node-id]').evaluate_all('els=>els.map(e=>e.dataset.label)')

    # Gallery in the editor: filters, live thumbnails, preview on three devices.
    home = document('My home', [
        block('section', 'my-header', {'sectionRole': 'header'}, [block('heading', 'my-logo', {'html': 'Brand', 'tag': 'h2'})]),
        block('section', 'my-hero', {}, [block('heading', 'my-title', {'html': 'Welcome', 'tag': 'h1'})]),
        block('section', 'my-footer', {'sectionRole': 'footer'}, [block('text', 'my-legal', {'html': '© Brand'})]),
    ])
    home['type'] = 'home'
    home_id = api('/stores/demo/pages', 'POST', {'document': home})['id']
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.locator('.page-table-row[data-page-id="' + home_id + '"]').get_by_role('button', name='Edit', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('My home')
    original = top_level()
    page.get_by_role('button', name='Templates', exact=True).click()
    filters = page.get_by_role('tablist', name='Template type').get_by_role('tab')
    assert filters.all_inner_texts()[:4] == ['All', 'Homepage', 'Product', 'Collection'], filters.all_inner_texts()
    expect(page.get_by_role('tab', name='Homepage', exact=True)).to_have_attribute('aria-selected', 'true')
    entries = page.locator('.template-gallery [data-template]')
    assert entries.count() >= 3
    expect(entries.first.locator('.template-thumbnail-render .page-surface')).to_be_visible(timeout=10000)
    page.get_by_role('tab', name='All', exact=True).click()
    expect(entries).to_have_count(len(templates))
    page.screenshot(path=str(out / 'v08-template-gallery.png'))
    entries.filter(has_text='Storefront home').locator('.template-entry-visual').click()
    preview = page.get_by_role('dialog', name='Template preview')
    expect(preview.get_by_role('heading', name='Storefront home')).to_be_visible()
    surface = preview.locator('[data-template-live-preview] .page-surface')
    expect(surface).to_have_attribute('data-device', 'desktop')
    preview.get_by_role('button', name='Preview Mobile', exact=True).click()
    expect(surface).to_have_attribute('data-device', 'mobile')
    assert surface.bounding_box()['width'] <= 391
    page.screenshot(path=str(out / 'v08-template-preview-mobile.png'))

    # Using a template on a page that already has content asks how to add it.
    preview.get_by_role('button', name='Use template', exact=True).click()
    choice = page.get_by_role('dialog', name='Apply template')
    expect(choice).to_be_visible()
    choice.get_by_role('button', name='Add its sections to the end of the page', exact=True).click()
    appended = top_level()
    assert appended[:len(original) - 1] == original[:-1], (original, appended)
    assert appended[-1] == original[-1] and len(appended) > len(original), appended
    assert original == ['my-header', 'my-hero', 'my-footer'], original
    assert 'Categories' in appended and 'Header' not in appended and 'Footer' not in appended, appended
    page.keyboard.press('Control+z')
    assert top_level() == original
    entries.filter(has_text='Storefront home').get_by_role('button', name='Use the Storefront home template').click()
    page.get_by_role('dialog', name='Apply template').get_by_role('button', name='Replace the page with this template', exact=True).click()
    replaced = top_level()
    assert replaced[0] == 'Header' and replaced[-1] == 'Footer' and 'Categories' in replaced, replaced
    page.keyboard.press('Control+s')
    expect(page.locator('.save-indicator')).to_contain_text('Saved', timeout=20000)
    stored = api('/pages/' + home_id)['document']['nodes']
    assert [n['name'] for n in stored] == replaced, ([n['name'] for n in stored], replaced)
    print('PASS: template gallery filters, live thumbnails, device preview, append/replace with undo and save', flush=True)

    # New page from a template in page management.
    page.goto(base)
    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    page.get_by_role('button', name='New page from template', exact=True).click()
    picker = page.get_by_role('dialog', name='New page from template')
    picker.get_by_role('tab', name='Product', exact=True).click()
    picker.get_by_role('button', name='Create a page with Classic product page', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Classic product page', timeout=20000)
    expect(page.locator('.document-info')).to_contain_text('Product')
    expect(page.locator('.editable-surface [data-kind=addToCart]')).to_have_count(1)
    expect(page.locator('.editable-surface [data-kind=productGallery]')).to_have_count(1)
    print('PASS: new product page created from a template opens in the editor with live product blocks', flush=True)

    # Every template publishes cleanly on mobile, tablet and desktop.
    visitor = f['browser'].new_context()
    view = visitor.new_page()
    view_errors = []
    view.on('pageerror', lambda e: view_errors.append(str(e)))
    catalog = api('/stores/demo/catalog')
    product = catalog['products'][0]['id']
    collection = catalog['collections'][0]['id']
    for template in templates:
        document = template['document']
        if document['type'] == 'home':
            # A store has one homepage: home templates replace its design.
            current = api('/pages/' + home_id)
            api('/pages/' + home_id, 'PUT', {'document': document, 'version': current['version']})
            created = home_id
        else:
            created = api('/stores/demo/pages', 'POST', {'document': document})['id']
        # Product and collection pages render the resource they are assigned to.
        url = base + '/?published=' + created
        if document['type'] == 'product':
            api('/pages/' + created + '/assignments', 'PUT', {'version': 1, 'ids': [product]})
            url = base + '/p/demo/products/' + product
        elif document['type'] == 'collection':
            api('/pages/' + created + '/assignments', 'PUT', {'version': 1, 'ids': [collection]})
            url = base + '/p/demo/collections/' + collection
        api('/pages/' + created + '/publish', 'POST', {})
        for width in (390, 768, 1280):
            view.set_viewport_size({'width': width, 'height': 900})
            view.goto(url)
            expect(view.locator('.page-surface')).to_be_visible()
            view.wait_for_load_state('networkidle')
            view.evaluate('async()=>{await document.fonts.ready;for(const img of document.images){img.loading="eager";if(!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r})}}')
            overflow = view.evaluate('()=>document.documentElement.scrollWidth-innerWidth')
            assert overflow <= 1, (template['id'], width, overflow)
            broken = view.evaluate('()=>[...document.querySelectorAll(".page-surface img")].filter(i=>!i.naturalWidth).map(i=>i.getAttribute("src"))')
            assert not broken, (template['id'], width, broken)
            assert view.locator('.page-surface h1').count() == 1, (template['id'], width, view.locator('.page-surface h1').count())
            assert view.locator('.integration-placeholder').count() == 0, (template['id'], 'unresolved product block')
        view.screenshot(path=str(out / ('v08-template-' + template['id'] + '-desktop.png')), full_page=True)
        if document['type'] in ('product', 'collection'):
            # Free the resource for the next template of the same type.
            api('/pages/' + created + '/assignments', 'PUT', {'version': 2, 'ids': []})
    assert not view_errors, view_errors
    assert not errors, errors
    print('PASS: all %d templates publish without overflow, broken media or extra h1 at 390, 768 and 1280 px' % len(templates), flush=True)
