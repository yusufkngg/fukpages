"""Default English studio, language switching and the user-requested editing controls."""
import json,re
from browser_support import ROOT,browser_fixture,expect
out=ROOT/'.local/validation';out.mkdir(parents=True,exist_ok=True)
with browser_fixture(netlify=True,ui_language=None) as f:
    browser=f['browser'];owner=f['owner'];owner.grant_permissions(['clipboard-read','clipboard-write'])
    visitor=browser.new_context(viewport={'width':1440,'height':1000});login=visitor.new_page();login.goto(f['base'])
    expect(login.get_by_label('Username',exact=True)).to_be_visible();expect(login.get_by_label('Password',exact=True)).to_be_visible()
    login.get_by_label('Password',exact=True).fill('incorrect-test-password');login.get_by_role('button',name='Enter studio',exact=True).click();expect(login.locator('.form-error')).to_contain_text('Incorrect username or password.')
    page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f['base'])
    csrf=page.evaluate("async()=>(await (await fetch('/api/auth/status')).json()).csrf")
    def api(path,method='GET',body=None):
        return page.evaluate("""async({path,method,body,csrf})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===null?{}:{body:JSON.stringify(body)})});if(!r.ok)throw new Error(path+' '+r.status+' '+await r.text());return r.status===204?null:r.json();}""",dict(path=path,method=method,body=body,csrf=csrf))
    expect(page.get_by_role('button',name='Manage pages',exact=True).first).to_be_visible();page.get_by_role('button',name='Manage pages',exact=True).first.click()
    expect(page.get_by_role('tab',name=re.compile('Product pages'))).to_be_visible()
    page.locator('.page-table-row[data-page-id=demo-home]').get_by_role('button',name='Edit',exact=True).click()
    expect(page.get_by_label('Page name',exact=True)).to_be_visible()
    print('PASS: fresh browser defaults to English; login errors, dashboard and page overview use English',flush=True)

    heading=page.locator('.editor-block[data-kind=heading]:has(h1)').first;heading_id=heading.get_attribute('data-node-id');heading.click()
    expect(heading.locator('.rich-content')).to_have_attribute('contenteditable','false');assert heading.locator('.rich-content').evaluate('(el)=>getComputedStyle(el).cursor')=='default'
    expect(page.locator('.inspector-tabs button')).to_have_count(2)
    assert page.locator('.inspector-container').bounding_box()['x']<page.locator('.canvas-scroll').bounding_box()['x']
    heading.locator('.rich-content').dblclick();expect(heading.locator('.rich-content')).to_have_attribute('contenteditable','true');heading.locator('.rich-content').fill('User text / Özel içerik');heading.locator('.rich-content').press('Escape');expect(heading.locator('.rich-content')).to_have_attribute('contenteditable','false')
    bold=page.get_by_role('button',name='Bold',exact=True);expect(bold).to_have_attribute('aria-pressed','true');bold.click();expect(heading).to_have_css('font-weight','400');bold.click();expect(heading).to_have_css('font-weight','700')
    page.get_by_label('Font size',exact=True).fill('23');page.get_by_label('Font size',exact=True).press('Tab');expect(heading).to_have_css('font-size','23px')
    page.keyboard.press('Control+s');expect(page.locator('.save-indicator')).to_contain_text('Saved',timeout=20000)
    original=api('/pages/demo-home')['document']
    page.locator('.topbar-end .ui-settings-button').click();page.get_by_role('dialog').get_by_label('Language',exact=True).select_option('tr')
    expect(page.locator('.inspector-tabs')).to_contain_text('Ayarlar');expect(heading).to_contain_text('User text / Özel içerik')
    page.get_by_role('dialog').get_by_role('button',name='Kapat',exact=True).click();assert api('/pages/demo-home')['document']==original
    page.reload();expect(page.get_by_role('button',name='Sayfaları yönet',exact=True).first).to_be_visible();assert page.evaluate("localStorage.getItem('fp-ui-language')")=='tr'
    page.get_by_role('button',name='Sayfaları yönet',exact=True).first.click();page.locator('.page-table-row[data-page-id=demo-home]').get_by_role('button',name='Düzenle',exact=True).click();expect(page.get_by_label('Sayfa adı',exact=True)).to_be_visible();page.get_by_role('button',name='Öğeler',exact=True).click();expect(page.locator('[data-palette=button]')).to_be_visible();page.locator('.studio-topbar .ui-settings-button').click();page.get_by_role('dialog').get_by_label('Dil',exact=True).select_option('en');page.get_by_role('dialog').get_by_role('button',name='Close',exact=True).click()
    expect(page.get_by_label('Page name',exact=True)).to_be_visible();page.locator('[data-node-id="'+heading_id+'"]').click();page.screenshot(path=str(out/'english-text-settings.png'))
    print('PASS: one left settings panel, two tabs, text formatting, double-click-only editing and persistent language selection without changing customer content',flush=True)

    page.get_by_role('button',name='Elements',exact=True).click();page.screenshot(path=str(out/'english-elements.png'));page.locator('[data-row-columns="0"]').click();row=page.locator('.editor-block[data-kind=row].selected');row_id=row.get_attribute('data-node-id')
    page.get_by_role('button',name='Elements',exact=True).click();page.locator('[data-palette=text]').click();page.get_by_label('Text content',exact=True).fill('Verified reviews')
    page.get_by_role('button',name='Elements',exact=True).click();page.locator('[data-palette=icon]').click();icon=page.locator('.editor-block[data-kind=icon].selected');icon_id=icon.get_attribute('data-node-id');page.get_by_role('button',name='Icon ∞',exact=True).click()
    row=page.locator('[data-node-id="'+row_id+'"]');expect(row.locator(':scope > .editor-block[data-kind=text]')).to_have_count(1);expect(row.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(1)
    assert icon.bounding_box()['width']<70 and icon.bounding_box()['width']<row.bounding_box()['width']/2
    icon.focus();page.keyboard.press('Control+x');expect(page.locator('[data-node-id="'+icon_id+'"]')).to_have_count(0);page.keyboard.press('Control+v');expect(page.locator('[data-node-id="'+icon_id+'"]')).to_be_visible(timeout=20000)
    page.keyboard.press('Control+d');expect(row.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(2);page.keyboard.press('Control+z');expect(row.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(1);page.keyboard.press('Control+y');expect(row.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(2)
    print('PASS: inline row contains text and icon, icon frame fits the glyph, native cut/paste preserves IDs and duplicate/undo/redo shortcuts work',flush=True)

    page.get_by_role('button',name='Layers',exact=True).click();panel=page.get_by_role('dialog',name='Layers',exact=True);expect(panel).to_be_visible()
    header=panel.locator(':scope > header').bounding_box();before=panel.bounding_box();page.mouse.move(header['x']+50,header['y']+15);page.mouse.down();page.mouse.move(header['x']+120,header['y']+55,steps=10);page.mouse.up();assert panel.bounding_box()['x']>before['x']+50
    box=panel.bounding_box();page.mouse.move(box['x']+box['width']-4,box['y']+box['height']-4);page.mouse.down();page.mouse.move(box['x']+box['width']+36,box['y']+box['height']+46,steps=10);page.mouse.up();assert panel.bounding_box()['height']>box['height']+25;page.screenshot(path=str(out/'english-layers.png'))
    panel.get_by_label('Search layers',exact=True).fill('User text');layer=panel.locator('.layer-row[data-layer-id="'+heading_id+'"]')
    expect(layer).to_be_visible();layer.locator('.layer-visibility').click();expect(page.locator('[data-node-id="'+heading_id+'"]')).to_have_count(0);layer.locator('.layer-visibility').click();expect(page.locator('[data-node-id="'+heading_id+'"]')).to_be_visible();panel.get_by_role('button',name='Close',exact=True).click()
    print('PASS: floating layer tree moves, searches nested nodes and controls per-device visibility',flush=True)

    page.get_by_role('button',name='Brand',exact=True).click();expect(page.get_by_role('heading',name='Global Styles',exact=True)).to_be_visible();page.get_by_label('Global font heading',exact=True).select_option('Georgia, serif');page.get_by_label('Spacing md',exact=True).fill('28');page.keyboard.press('Control+s');expect(page.locator('.toast')).to_contain_text('Brand kit saved',timeout=20000)
    page.screenshot(path=str(out/'english-global-styles.png'));brand=api('/stores/demo/brand')['brand'];assert brand['fonts']['heading']=='Georgia, serif' and brand['spacing']['md']==28
    print('PASS: simple global colours/fonts/typography/spacing save with Ctrl+S and persist',flush=True)

    page.get_by_role('button',name='Elements',exact=True).click();page.locator('[data-palette=accordion]').click();accordion=page.locator('.editor-block[data-kind=accordion].selected');accordion_id=accordion.get_attribute('data-node-id');page.get_by_role('button',name='Add item',exact=True).click();expect(accordion.locator('details')).to_have_count(2)
    editor=page.locator('.accordion-item-editor').last;editor.locator('summary').click();page.get_by_label('Item title 2',exact=True).fill('Can I customise it?');page.get_by_label('Item content 2',exact=True).fill('Yes. Every item is editable.');page.get_by_role('button',name='Duplicate item 2',exact=True).click();expect(accordion.locator('details')).to_have_count(3)
    page.get_by_role('button',name='Save',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Saved',timeout=20000)
    page.screenshot(path=str(out/'english-studio.png'))
    page.get_by_role('button',name='Page',exact=True).click();page.get_by_role('button',name='Save SEO and update publication',exact=True).click();expect(page.locator('[data-seo-publication]')).to_be_visible(timeout=20000)
    public=visitor.new_page();public.goto(f['base']+'/p/demo/home');expect(public.locator('[data-block="'+accordion_id+'"] details')).to_have_count(3);public.locator('[data-block="'+accordion_id+'"] summary').nth(1).click();expect(public.locator('[data-block="'+accordion_id+'"] details').nth(1)).to_contain_text('Every item is editable.')
    assert not errors,errors
    (out/'ui-validation.json').write_text(json.dumps({'version':'0.5.0','checks':['default-English','English-errors','language-persistence','content-preservation','left-settings','text-format','double-click','inline-row','fitted-icon','native-cut','paste-IDs','duplicate','undo','redo','floating-layers','layer-visibility','global-styles','accordion-items','published-accordion'],'pageErrors':errors},indent=2))
    print('PASS: editable accordion items duplicate, persist and publish; no uncaught browser errors',flush=True)
