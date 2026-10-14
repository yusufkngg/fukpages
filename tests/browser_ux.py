"""Audit stage 5c: loading states, page names, dates, the split Page panel,
element-linked overflow results and the media empty state."""
import re
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    wide = block('section', 'sec', {}, [
        block('heading', 'title', {'html': 'Overflow check', 'tag': 'h1'}),
        block('box', 'card', {}, [block('text', 'wide', {'html': 'Fixed width text'})]),
    ])
    wide['children'][1]['styles']['mobile'] = {'display': 'flex', 'flexDirection': 'row'}
    wide['children'][1]['children'][0]['styles']['mobile'] = {'width': '640px', 'minWidth': '640px', 'flexShrink': '0'}
    first = api('/stores/demo/pages', 'POST', {'document': document('Twin launch', [wide])})['id']
    second = api('/stores/demo/pages', 'POST', {'document': document('Twin launch', [block('section', 'o', {}, [block('heading', 'h', {'html': 'Other', 'tag': 'h1'})])])})['id']
    doc = api('/pages/' + second)
    doc['document']['seo'] = {'slug': 'twin-b', 'title': '', 'description': '', 'image': '', 'noindex': False}
    api('/pages/' + second, 'PUT', {'document': doc['document'], 'version': doc['version']})

    page = f['owner'].new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # L5: while the store list is loading the dashboard shows placeholders,
    # not "0 workspaces" or "No matching workspace".
    page.route('**/api/stores', lambda r: (page.wait_for_timeout(1500), r.continue_()))
    page.goto(base)
    expect(page.locator('[data-stores-loading]')).to_be_visible()
    expect(page.get_by_text('No matching workspace')).to_have_count(0)
    page.screenshot(path=str(out / 'v12-dashboard-loading.png'))
    expect(page.locator('[data-stores-loading]')).to_have_count(0, timeout=10000)
    expect(page.locator('.store-card').first).to_be_visible()
    page.unroute('**/api/stores')
    print('PASS: dashboard shows loading placeholders before the store list arrives', flush=True)

    page.get_by_role('button', name='Manage pages', exact=True).first.click()
    row = page.locator('.page-table-row[data-page-id="' + second + '"]')
    expect(row).to_contain_text('/twin-b')
    # L4: one time format with an explicit zone everywhere.
    assert re.search(r'(UTC|GMT)', row.inner_text()), row.inner_text()
    page.locator('.page-table-row[data-page-id="' + first + '"]').get_by_role('button', name='Edit', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Twin launch')
    switcher = page.get_by_label('Switch pages', exact=True)
    labels = switcher.locator('option').all_inner_texts()
    twins = [l for l in labels if l.startswith('Twin launch')]
    assert len(twins) == 2 and len(set(twins)) == 2, twins
    assert any('/twin-b' in l for l in twins) and all(('Draft' in l) for l in twins), twins
    print('PASS: same-named pages are told apart by status and address; dates carry a zone', flush=True)

    # Page panel is split into tasks.
    page.get_by_role('button', name='Page', exact=True).click()
    tabs = page.get_by_role('tablist', name='Page settings')
    expect(tabs.get_by_role('tab')).to_have_count(5)
    expect(page.get_by_label('SEO slug', exact=True)).to_be_visible()
    tabs.get_by_role('tab', name='History').click()
    expect(page.get_by_label('SEO slug', exact=True)).to_have_count(0)
    tabs.get_by_role('tab', name='Quality').click()
    # L3: overflow results name the element, device and size, select it and
    # offer to remove the fixed width on that device.
    page.get_by_role('button', name='Mobile', exact=True).click()
    page.wait_for_timeout(400)
    page.locator('[data-overflow-check]').click()
    results = page.locator('[data-overflow-results]')
    expect(results).to_contain_text('Mobile')
    print('overflow items:', results.locator('[data-overflow-item]').all_inner_texts(), flush=True)
    item = results.locator('[data-overflow-item]').filter(has_text='wide')
    expect(item).to_contain_text('wide')
    expect(item).to_contain_text('640')
    expect(page.locator('[data-quality-status]')).to_contain_text('warning')
    page.screenshot(path=str(out / 'v12-overflow-results.png'))
    item.get_by_role('button').first.click()
    expect(page.locator('.editable-surface [data-node-id=wide]')).to_have_class(re.compile(r'\bselected\b'))
    item.get_by_role('button', name='Remove the fixed width on this device').click()
    page.locator('[data-overflow-check]').click()
    expect(results).to_contain_text('nothing overflows')
    for _ in range(40):
        saved = api('/pages/' + first)['document']
        mobile = saved['nodes'][0]['children'][1]['children'][0]['styles']['mobile']
        if 'width' not in mobile and 'minWidth' not in mobile: break
        page.wait_for_timeout(250)
    assert 'width' not in mobile and 'minWidth' not in mobile, mobile
    print('PASS: overflow results point at the element and fix its device width', flush=True)

    # L6: an empty media search offers a way back.
    page.get_by_role('button', name='Media', exact=True).click()
    page.get_by_label('Search media', exact=True).fill('zzzz-no-such-file')
    empty = page.locator('[data-media-empty]')
    expect(empty).to_contain_text('No images match your search.')
    empty.get_by_role('button', name='Clear search').click()
    expect(page.get_by_label('Search media', exact=True)).to_have_value('')
    expect(page.locator('[data-media-storage]')).to_contain_text('In use')
    print('PASS: media search empty state and storage summary', flush=True)
    assert not errors, errors
