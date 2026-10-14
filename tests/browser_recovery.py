"""F6/F7: the editor's load error states and finding an unsaved copy from a
closed tab in a new tab."""
from browser_support import ROOT, browser_fixture, block, document, expect

out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(ui_language='en') as f:
    api, base = f['api'], f['base']
    pid = api('/stores/demo/pages', 'POST', {'document': document('Recovery page', [
        block('section', 's', {}, [block('heading', 'h', {'html': 'Recovery title', 'tag': 'h1'})]),
    ])})['id']
    before = api('/pages/' + pid)['version']

    def open_editor(page):
        page.goto(base)
        page.get_by_role('button', name='Manage pages', exact=True).first.click()
        page.locator('.page-table-row[data-page-id="' + pid + '"]').get_by_role('button', name='Edit', exact=True).click()

    # F6: a failing load shows an error with retry instead of an endless spinner.
    page = f['owner'].new_page()
    failing = {'on': True}
    def fail(route):
        if failing['on'] and route.request.method == 'GET':
            route.fulfill(status=500, content_type='application/json', body='{"error":"Storage is unavailable."}')
        else:
            route.continue_()
    page.route('**/api/pages/' + pid, fail)
    open_editor(page)
    error = page.locator('[data-load-error]')
    expect(error).to_be_visible()
    expect(error).to_contain_text('Could not open page')
    expect(error).to_contain_text('Storage is unavailable.')
    page.screenshot(path=str(out / 'v12-load-error.png'))
    failing['on'] = False
    error.get_by_role('button', name='Try again', exact=True).click()
    expect(page.get_by_label('Page name', exact=True)).to_have_value('Recovery page')
    print('PASS: a failed load shows the reason, retry opens the page', flush=True)

    # 404 offers only the way back.
    lost = f['owner'].new_page()
    lost.route('**/api/pages/' + pid, lambda r: r.fulfill(status=404, content_type='application/json', body='{"error":"Page not found."}') if r.request.method == 'GET' else r.continue_())
    open_editor(lost)
    expect(lost.locator('[data-load-error]')).to_contain_text('Page not found')
    expect(lost.locator('[data-load-error]').get_by_role('button', name='Try again')).to_have_count(0)
    lost.locator('[data-load-error]').get_by_role('button', name='Back to dashboard', exact=True).click()
    expect(lost.locator('[data-load-error]')).to_have_count(0)
    expect(lost.locator('.page-table-row[data-page-id="' + pid + '"]')).to_be_visible()
    lost.close()
    print('PASS: a missing page offers the way back to the dashboard', flush=True)

    # F7: an edit that could not be saved survives closing the tab.
    page.route('**/api/pages/' + pid, lambda r: r.abort() if r.request.method == 'PUT' else r.continue_())
    name = page.get_by_label('Page name', exact=True)
    name.fill('Unsaved rename')
    page.wait_for_timeout(2500)
    page.close()
    assert api('/pages/' + pid)['version'] == before
    fresh = f['owner'].new_page()
    open_editor(fresh)
    dialog = fresh.get_by_role('dialog', name='Recover unsaved draft')
    expect(dialog).to_be_visible()
    fresh.screenshot(path=str(out / 'v12-recover-new-tab.png'))
    dialog.get_by_role('button', name='Recover draft', exact=True).click()
    expect(fresh.get_by_label('Page name', exact=True)).to_have_value('Unsaved rename')
    for _ in range(40):
        if api('/pages/' + pid)['document']['name'] == 'Unsaved rename': break
        fresh.wait_for_timeout(250)
    assert api('/pages/' + pid)['document']['name'] == 'Unsaved rename'
    # Once saved nothing is offered again.
    fresh.close()
    again = f['owner'].new_page()
    open_editor(again)
    expect(again.get_by_label('Page name', exact=True)).to_have_value('Unsaved rename')
    again.wait_for_timeout(800)
    expect(again.get_by_role('dialog', name='Recover unsaved draft')).to_have_count(0)
    print('PASS: a copy from a closed tab is recovered in a new tab and saved once', flush=True)
