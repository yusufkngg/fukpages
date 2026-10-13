"""Public demo: full-width section backgrounds, centered content and real breakpoints."""
import json
from browser_support import ROOT, browser_fixture, block, document, expect

widths = [4256, 3840, 2560, 1920, 1440, 1024, 901, 900, 820, 601, 600, 390, 320]
out = ROOT / '.local/validation'
out.mkdir(parents=True, exist_ok=True)

with browser_fixture(netlify=True) as f:
    # Chromium treats loopback as trustworthy for Secure cookies; the request
    # driver intentionally does not send them over HTTP. Use browser fetch for
    # private fixture mutations, retaining production cookie protection.
    controls = f['owner'].new_page()
    controls.goto(f['base'])
    expect(controls.get_by_role('button',name='Sayfaları yönet',exact=True).first).to_be_visible()
    csrf = controls.evaluate("async()=>(await (await fetch('/api/auth/status')).json()).csrf")
    def api(path, method='GET', body=None):
        return controls.evaluate("""async({path,method,body,csrf})=>{
            const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===null?{}:{body:JSON.stringify(body)})});
            if(!r.ok)throw new Error(path+' HTTP '+r.status);
            return r.status===204?null:r.json();
        }""",dict(path=path,method=method,body=body,csrf=csrf))
    context = f['browser'].new_context(viewport={'width':1920,'height':1080})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    demo = api('/public/stores/demo/pages/demo-store')
    page.goto(f['base'] + '/p/demo/demo-store')
    expect(page.get_by_role('heading', name='Aura One. Kendi ritmini bul.')).to_be_visible()
    results = []
    for width in widths:
        page.set_viewport_size({'width':width,'height':1080})
        device = 'mobile' if width <= 600 else 'tablet' if width <= 900 else 'desktop'
        expect(page.locator('.page-surface')).to_have_attribute('data-device', device)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), width
        for section in demo['document']['nodes']:
            root = page.locator('[data-block="' + section['id'] + '"]')
            row = root.locator('[data-block="' + section['children'][0]['id'] + '"]')
            bounds = root.bounding_box()
            content = row.bounding_box()
            assert bounds and content
            assert abs(bounds['x']) <= 1 and abs(bounds['width'] - width) <= 1, (width, 'section background', bounds)
            assert abs(content['x'] + content['width']/2 - width/2) <= 1, (width, 'content center', content)
            assert content['width'] <= demo['brand']['layout']['container'] + 1, (width, 'readable content', content)
        hero = demo['document']['nodes'][1]['children'][0]
        expect(page.locator('[data-block="' + hero['id'] + '"]')).to_have_css('flex-direction', 'column' if width <= 600 else 'row')
        results.append({'width':width,'device':device,'section_width':bounds['width'],'content_width':content['width']})
        if width in [1920, 390]:
            page.evaluate('scrollTo(0,0)')
            page.screenshot(path=str(out / ('responsive-demo-desktop.png' if width == 1920 else 'responsive-demo-mobile.png')), full_page=True)

    # Brand width is a live setting and must also apply to already-published pages.
    brand = api('/stores/demo/brand')
    brand['brand']['layout']['container'] = 980
    api('/stores/demo/brand', 'PUT', brand)
    page.set_viewport_size({'width':2560,'height':1080})
    page.reload()
    expect(page.get_by_role('heading', name='Aura One. Kendi ritmini bul.')).to_be_visible()
    hero_bounds = page.locator('[data-block="' + hero['id'] + '"]').bounding_box()
    assert abs(hero_bounds['width'] - 980) <= 1 and abs(hero_bounds['x'] + 490 - 1280) <= 1, hero_bounds

    # Custom section flex/grid geometry and explicit outer width still work.
    sections = []
    for layout in ['flex', 'grid']:
        styles = {'display':layout,'flexDirection':'row','gap':'24px','paddingLeft':'24px','paddingRight':'24px','width':'100%','maxWidth':'900px'}
        if layout == 'grid': styles['gridTemplateColumns'] = '1fr 1fr'
        sections.append(block('section', layout, children=[block('box', layout+'-a', styles={'width':'100%','minHeight':'50px'}), block('box', layout+'-b', styles={'width':'100%','minHeight':'50px'})], styles=styles))
    created = api('/stores/demo/pages','POST',{'document':document('Section geometry',sections)})
    api('/pages/' + created['id'] + '/publish','POST',{})
    page.goto(f['base'] + '/?published=' + created['id'])
    expect(page.locator('[data-block=flex-a]')).to_be_visible()
    for layout in ['flex','grid']:
        a = page.locator('[data-block=' + layout + '-a]').bounding_box()
        b = page.locator('[data-block=' + layout + '-b]').bounding_box()
        root = page.locator('[data-block=' + layout + ']').bounding_box()
        assert abs(root['width'] - 900) <= 1 and abs(root['x'] + 450 - 1280) <= 1, root
        assert abs(a['y'] - b['y']) <= 1 and abs(b['x'] - a['x'] - a['width'] - 24) <= 1, (layout,a,b)
        assert abs(a['width'] - b['width']) <= 1 and a['width'] > 400, (layout,a,b)

    # A copied page retains its source container, even with a different target brand.
    target = api('/stores','POST',{'name':'Responsive transfer'})
    catalog = api('/stores/demo/catalog')
    catalog['version'] = 0
    api('/stores/' + target['id'] + '/catalog','PUT',catalog)
    transferred = api('/pages/demo-home/transfer','POST',{'targetStoreId':target['id'],'productMap':{p['id']:p['id'] for p in catalog['products']},'collectionMap':{c['id']:c['id'] for c in catalog['collections']}})
    api('/pages/' + transferred['id'] + '/publish','POST',{})
    target_brand = api('/stores/' + target['id'] + '/brand')
    target_brand['brand']['layout']['container'] = 1400
    api('/stores/' + target['id'] + '/brand','PUT',target_brand)
    page.goto(f['base'] + '/?published=' + transferred['id'])
    transferred_hero = transferred['document']['nodes'][1]['children'][0]
    copied_row = page.locator('[data-block="' + transferred_hero['id'] + '"]')
    expect(copied_row).to_be_visible()
    copied_bounds = copied_row.bounding_box()
    assert abs(copied_bounds['width'] - 980) <= 1 and abs(copied_bounds['x'] + 490 - 1280) <= 1, copied_bounds
    page.set_viewport_size({'width':390,'height':844})
    expect(page.locator('.page-surface')).to_have_attribute('data-device','mobile')
    assert copied_row.bounding_box()['width'] <= 390
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    assert not errors, errors
    (out / 'responsive-demo.json').write_text(json.dumps({'widths':results,'brand_width':980,'custom_layouts':['flex','grid'],'page_errors':errors}, indent=2))
    print('PASS: demo centered with full-width backgrounds at 13 widths (320–4256px), breakpoints, brand width, custom section flex/grid geometry and preserved container after store transfer.')
