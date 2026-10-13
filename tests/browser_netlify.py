"""Netlify function + official local Blobs server in a real browser."""
from browser_support import ROOT, browser_fixture, open_editor, expect
with browser_fixture(netlify=True) as f:
    base,owner,api=f['base'],f['owner'],f['api']
    anonymous=f['browser'].new_context(viewport={'width':1440,'height':1000})
    visitor=anonymous.new_page();errors=[]
    visitor.on('pageerror',lambda e:errors.append(str(e)))
    visitor.goto(base)
    expect(visitor.get_by_role('heading',name='Stüdyona hoş geldin.')).to_be_visible()
    expect(visitor.get_by_role('link',name='Demo mağazayı aç ↗')).to_be_visible()
    visitor.goto(base+'/p/demo/demo-store')
    expect(visitor.get_by_role('heading',name='Aura One. Kendi ritmini bul.')).to_be_visible()
    visitor.get_by_role('button',name='Yerel sepete ekle',exact=True).click()
    expect(visitor.locator('.cart-status')).to_contain_text('sepete')
    visitor.get_by_role('button',name='Sepeti aç').click()
    expect(visitor.locator('dialog[open]')).to_contain_text('Aura One')
    visitor.keyboard.press('Escape')
    visitor.locator('.cart-status button').click()
    visitor.evaluate('window.scrollTo(0,0)')
    out=ROOT/'.local/validation';out.mkdir(parents=True,exist_ok=True)
    visitor.screenshot(path=str(out/'netlify-demo-store-desktop.png'),full_page=True)
    visitor.set_viewport_size({'width':390,'height':844})
    expect(visitor.locator('.page-surface')).to_have_attribute('data-device','mobile')
    visitor.evaluate('window.scrollTo(0,0)')
    visitor.screenshot(path=str(out/'netlify-demo-store-mobile.png'),full_page=True)
    assert visitor.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
    page=owner.new_page();open_editor(page,base,'Aura · Demo mağaza')
    page.get_by_label('Sayfa adı').fill('Aura · Panelde düzenlendi')
    page.get_by_role('button',name='Kaydet',exact=True).click()
    expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=15000)
    page.screenshot(path=str(out/'netlify-demo-panel.png'))
    open_editor(page,base,'Aura · Panelde düzenlendi');expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Panelde düzenlendi')
    assert page.evaluate("async()=>{const r=await fetch('/api/pages/demo-home');if(!r.ok)throw new Error('HTTP '+r.status);return (await r.json()).document.name;}")=='Aura · Panelde düzenlendi'
    assert not errors,errors
    print('Netlify demo browser: private panel, public store, variant/cart, persistent edit, desktop/mobile passed (local Blobs server).')
