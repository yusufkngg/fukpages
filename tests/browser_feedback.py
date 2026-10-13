"""User-reported editor workflows, exercised against the real Netlify function/Blobs fixture."""
import base64,json,subprocess
from browser_support import ROOT,browser_fixture,expect,open_editor,open_actions
out=ROOT/'.local/validation';out.mkdir(parents=True,exist_ok=True)
with browser_fixture(netlify=True) as f:
    base=f['base'];owner=f['owner'];owner.grant_permissions(['clipboard-read','clipboard-write'])
    controls=owner.new_page();controls.goto(base)
    expect(controls.get_by_role('button',name='Sayfaları yönet',exact=True).first).to_be_visible()
    csrf=controls.evaluate("async()=>(await (await fetch('/api/auth/status')).json()).csrf")
    def api(path,method='GET',body=None):
        return controls.evaluate("""async({path,method,body,csrf})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===null?{}:{body:JSON.stringify(body)})});if(!r.ok)throw new Error(path+' HTTP '+r.status+' '+await r.text());return r.status===204?null:r.json();}""",dict(path=path,method=method,body=body,csrf=csrf))
    page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    open_editor(page,base,'Aura · Demo mağaza')
    source=api('/pages/demo-home')['document']
    def walk(nodes):
        for n in nodes:
            yield n
            yield from walk(n['children'])
    nodes=list(walk(source['nodes']));heading=next(n for n in nodes if n['kind']=='heading' and n['props'].get('tag')=='h1');image=next(n for n in nodes if n['kind']=='image');button=next(n for n in walk(source['nodes'][1]['children']) if n['kind']=='button')
    root=lambda id:page.locator('[data-node-id="'+id+'"]')
    root(heading['id']).click(button='right');expect(page.locator('.editor-context-menu')).to_be_visible()
    root(image['id']).click();expect(page.locator('.editor-context-menu')).to_have_count(0);expect(root(image['id'])).to_have_class(__import__('re').compile('selected'))
    root(image['id']).click(button='right');page.keyboard.press('Escape');expect(page.locator('.editor-context-menu')).to_have_count(0)
    root(image['id']).click(button='right');page.locator('.canvas-scroll').evaluate('(el)=>el.scrollTop+=100');expect(page.locator('.editor-context-menu')).to_have_count(0)
    print('PASS: right-click menu dismisses on outside left click, Escape and scroll; left click still selects its target',flush=True)
    root(button['id']).focus();page.locator('.inspector-tabs').get_by_role('button',name='Ayarlar',exact=True).click()
    page.get_by_label('Bağlantı',exact=True).fill('www.example.com/buy');page.get_by_label('Bağlantı',exact=True).press('Tab')
    page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=20000)
    stored=next(n for n in walk(api('/pages/demo-home')['document']['nodes']) if n['id']==button['id'])
    assert stored['props']['href']=='https://www.example.com/buy' and stored['props']['action']=='navigate' and not stored['props']['actionTarget'],stored['props']
    page.get_by_label('Sayfalar arasında geçiş').select_option('demo-product');expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Ürün sayfası')
    page.get_by_label('Sayfalar arasında geçiş').select_option('demo-home');expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Demo mağaza')
    root(button['id']).focus();page.locator('.inspector-tabs').get_by_role('button',name='Ayarlar',exact=True).click();expect(page.get_by_label('Bağlantı',exact=True)).to_have_value('https://www.example.com/buy')
    print('PASS: protocol-less URL overrides the old scroll action, persists and reopens; page bar switches both ways',flush=True)

    row_id=next(n for n in nodes if n['kind']=='row')['id']
    root(row_id).focus();expect(root(row_id)).to_have_class(__import__('re').compile('selected'));page.locator('.inspector-tabs').get_by_role('button',name='Ayarlar',exact=True).click()
    padding=page.get_by_label('padding Top',exact=True);padding.fill('');padding.press_sequentially('10');padding.press('Tab')
    for side in ['Top','Right','Bottom','Left']:expect(root(row_id)).to_have_css('padding-'+side.lower(),'10px')
    padding.fill('1.5rem');padding.press('Tab');expect(root(row_id)).to_have_css('padding-top','19.5px')
    padding.fill('10');padding.press('Tab')
    page.get_by_title('Dört kenarı birlikte değiştir',exact=True).first.click()
    page.get_by_label('margin Top',exact=True).fill('12');page.get_by_label('margin Top',exact=True).press('Tab');expect(root(row_id)).to_have_css('margin-top','12px')
    page.get_by_role('button',name='Mobil',exact=True).click();page.get_by_label('padding Top',exact=True).fill('8');page.get_by_label('padding Top',exact=True).press('Tab');expect(root(row_id)).to_have_css('padding-top','8px')
    page.get_by_role('button',name='Masaüstü',exact=True).click();expect(root(row_id)).to_have_css('padding-top','10px')
    page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=20000)
    page.get_by_label('Sayfalar arasında geçiş').select_option('demo-product');expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Ürün sayfası')
    page.get_by_label('Sayfalar arasında geçiş').select_option('demo-home');expect(page.get_by_label('Sayfa adı')).to_have_value('Aura · Demo mağaza');expect(root(row_id)).to_have_css('padding-top','10px');expect(root(row_id)).to_have_css('margin-top','12px')
    print('PASS: typing bare 10 applies linked padding as px immediately; rem and independent mobile overrides survive save/reopen',flush=True)

    root(button['id']).focus();before=root(button['id']).bounding_box();handle=root(button['id']).get_by_label('Genişliği boyutlandır');r=handle.bounding_box()
    page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+60,r['y']+r['height']/2,steps=10);page.mouse.up()
    assert root(button['id']).bounding_box()['width']>before['width']+20
    before=root(button['id']).bounding_box();r=root(button['id']).get_by_label('Yüksekliği boyutlandır').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2+25,steps=8);page.mouse.up();assert root(button['id']).bounding_box()['height']>before['height']+10
    open_actions(page);page.get_by_role('button',name='Serbest yerleştir',exact=True).click();expect(root(button['id'])).to_have_css('position','absolute')
    before=root(button['id']).bounding_box();r=root(button['id']).get_by_title('Öğeyi sürükle').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+50,r['y']+r['height']/2+30,steps=10);page.mouse.up();after=root(button['id']).bounding_box();assert after['x']>before['x']+15 and after['y']>before['y']+10,(before,after)
    before=root(button['id']).bounding_box();page.keyboard.press('Shift+ArrowRight');assert root(button['id']).bounding_box()['x']>before['x']+3
    desktop_position=root(button['id']).evaluate('(el)=>({left:el.style.left,top:el.style.top,width:el.style.width})')
    page.get_by_role('button',name='Mobil',exact=True).click();expect(root(button['id'])).not_to_have_css('position','absolute')
    open_actions(page);page.get_by_role('button',name='Serbest yerleştir',exact=True).click();expect(root(button['id'])).to_have_css('position','absolute')
    r=root(button['id']).get_by_title('Öğeyi sürükle').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+16,r['y']+r['height']/2+16,steps=6);page.mouse.up()
    mobile_position=root(button['id']).evaluate('(el)=>({left:el.style.left,top:el.style.top,width:el.style.width})');assert mobile_position!=desktop_position
    open_actions(page);page.get_by_role('button',name='Üst öğeyi seç',exact=True).click();page.locator('.inspector-tabs').get_by_role('button',name='Ayarlar',exact=True).click();page.get_by_label('Yerleşim modu',exact=True).select_option('flow')
    root(button['id']).focus();expect(root(button['id'])).not_to_have_css('position','absolute');before=root(button['id']).bounding_box();r=root(button['id']).get_by_label('Genişliği boyutlandır').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+r['width']/2+16,r['y']+r['height']/2,steps=6);page.mouse.up();assert root(button['id']).bounding_box()['width']>before['width']+8
    page.get_by_role('button',name='Masaüstü',exact=True).click();expect(root(button['id'])).to_have_css('position','absolute');assert root(button['id']).evaluate('(el)=>({left:el.style.left,top:el.style.top,width:el.style.width})')==desktop_position
    page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=20000)
    page.screenshot(path=str(out/'editor-free-placement.png'))
    print('PASS: button edge resizing and real free movement respect canvas scale; mobile flow and desktop coordinates remain independent',flush=True)

    root(image['id']).click();page.evaluate('getSelection().removeAllRanges()');page.keyboard.press('Control+c');page.keyboard.press('Control+v');expect(page.locator('.editor-block[data-kind=image]')).to_have_count(2,timeout=20000)
    assert page.locator('.editor-block[data-kind=image]').last.locator('img').get_attribute('src')==image['props']['src']
    png=subprocess.run(['node','--input-type=module','-e',"import sharp from 'sharp';process.stdout.write(await sharp({create:{width:80,height:60,channels:4,background:'orange'}}).png().toBuffer())"],cwd=ROOT,capture_output=True,check=True).stdout
    page.evaluate("async(data)=>{const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));await navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([bytes],{type:'image/png'})})]);}",base64.b64encode(png).decode())
    page.keyboard.press('Control+v');expect(page.locator('.editor-block[data-kind=image]')).to_have_count(3,timeout=20000)
    expect(page.locator('.editor-block[data-kind=image]').last.locator('img')).to_have_attribute('src',__import__('re').compile('/api/assets/'))
    page.evaluate("async()=>navigator.clipboard.write([new ClipboardItem({'text/html':new Blob(['<img src=\"/assets/headphones.svg\">'],{type:'text/html'}),'text/plain':new Blob(['/assets/headphones.svg'],{type:'text/plain'})})])")
    page.keyboard.press('Control+v');expect(page.locator('.editor-block[data-kind=image]')).to_have_count(4,timeout=20000)
    print('PASS: native Ctrl+C/Ctrl+V copies an image node with its source; native PNG and browser HTML image clipboard both insert images',flush=True)

    page.get_by_role('button',name='Öğeler',exact=True).click();page.locator('[data-palette=row]').click();row=page.locator('.editor-block[data-kind=row].selected');expect(row.locator(':scope > .editor-block[data-kind=column]')).to_have_count(2)
    columns=row.locator(':scope > .editor-block[data-kind=column]');assert columns.first.evaluate('(el)=>getComputedStyle(el).outlineStyle')=='dashed';assert columns.first.bounding_box()['width']>0
    open_actions(page);page.get_by_role('button',name='Kolon ekle',exact=True).click();expect(row.locator(':scope > .editor-block[data-kind=column]')).to_have_count(3)
    print('PASS: new rows immediately contain visible columns and another column can be added',flush=True)
    for label,panel,delta in [('Kütüphane panelini boyutlandır','.library',50),('Ayar panelini boyutlandır','.inspector-container',-50)]:
        before=page.locator(panel).bounding_box()['width'];r=page.get_by_role('separator',name=label).bounding_box();page.mouse.move(r['x']+3,r['y']+r['height']/2);page.mouse.down();page.mouse.move(r['x']+3+delta,r['y']+r['height']/2,steps=10);page.mouse.up();assert page.locator(panel).bounding_box()['width']>before+20
    widths=page.evaluate("JSON.parse(localStorage.getItem('fp-panel-widths'))")
    page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=20000)
    print('PASS: both separate side panels resize with real pointer gestures and remember their widths',flush=True)

    page.reload();open_editor(page,base,'Aura · Demo mağaza');assert page.locator('.library').bounding_box()['width']==widths['library'];assert page.locator('.inspector-container').bounding_box()['width']==widths['inspector']
    page.get_by_role('button',name='Bölümler',exact=True).click();thumb=page.locator('[data-preset-thumbnail=purchase]');expect(thumb.locator('.page-surface')).to_be_visible();assert 'MAKE IT' not in thumb.inner_text()
    card=page.locator('.preset-entry').filter(has=page.locator('[data-section-preset=purchase]'));card.locator('.preset-preview-button').click();expect(page.get_by_role('dialog',name='Bölüm önizlemesi')).to_be_visible()
    page.get_by_label('Bölüm önizleme ürünü').select_option('aura-one')
    preview=page.locator('[data-section-live-preview]');snapshot=preview.locator('.content-block').evaluate_all('els=>els.map(el=>({text:el.innerText.trim(),style:el.getAttribute("style")}))')
    page.get_by_role('button',name='Bölümü ekle',exact=True).click();expect(page.get_by_role('dialog',name='Bölüm önizlemesi')).to_have_count(0)
    added=page.locator('.editor-block[data-kind=section].selected');assert added.locator('[data-kind=productGallery]').count()>0
    expect(added).to_contain_text('Aura One kablosuz kulaklık')
    added_id=added.get_attribute('data-node-id');page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi',timeout=20000)
    section=next(n for n in api('/pages/demo-home')['document']['nodes'] if n['id']==added_id);assert all(n['props'].get('productId')=='aura-one' for n in walk([section]))
    print('PASS: section thumbnails use the renderer and the exact preview product binding is preserved when added and saved',flush=True)

    page.get_by_role('button',name='Sayfa',exact=True).click();page.get_by_label('SEO slug').fill('feedback-seo');page.get_by_label('SEO title').fill('Yeni SEO — Türkçe başlık');page.get_by_label('SEO description').fill('Güncel meta açıklaması')
    expect(page).to_have_title('Yeni SEO — Türkçe başlık')
    page.get_by_role('button',name='SEO’yu kaydet ve yayını güncelle',exact=True).click();expect(page.locator('[data-seo-publication]')).to_contain_text('Yeni SEO — Türkçe başlık',timeout=20000)
    visitor=f['browser'].new_context(viewport={'width':1440,'height':1000});public=visitor.new_page();public.goto(base+'/p/demo/feedback-seo');expect(public).to_have_title('Yeni SEO — Türkçe başlık');expect(public.locator('meta[name=description]')).to_have_attribute('content','Güncel meta açıklaması')
    response=visitor.request.get(base+'/p/demo/feedback-seo');assert '<title>Yeni SEO — Türkçe başlık</title>' in response.text()
    public_row=public.locator('[data-block="'+row_id+'"]');expect(public_row).to_have_css('padding-top','10px');expect(public_row).to_have_css('margin-top','12px')
    public.goto(base+'/p/demo/home');expect(public).to_have_title('Yeni SEO — Türkçe başlık')
    public.set_viewport_size({'width':390,'height':1000});expect(public_row).to_have_css('padding-top','8px')
    print('PASS: SEO draft changes the editor tab; one save/publish updates the new live URL, initial HTML title and visitor metadata',flush=True)

    page.get_by_role('button',name='Sayfa yönetimi',exact=True).click();expect(page.get_by_role('tab',name=__import__('re').compile('Ürün sayfaları'))).to_be_visible()
    page.get_by_role('tab',name=__import__('re').compile('Ürün sayfaları')).click();product_row=page.locator('.page-table-row').filter(has_text='Aura · Ürün sayfası');product_row.get_by_role('button',name='Aura · Ürün sayfası çoğalt',exact=True).click();expect(page.locator('.page-table-row')).to_have_count(2,timeout=20000)
    copied=page.locator('.page-table-row').filter(has_text='Kopya');expect(copied).to_contain_text('Atama yok');expect(copied).to_contain_text('Taslak')
    product_row=page.locator('.page-table-row').filter(has_text='Aura · Ürün sayfası').filter(has_not_text='Kopya');product_row.get_by_role('button',name='Atamalar',exact=True).click();expect(page.get_by_label('Ata: Aura One kablosuz kulaklık')).to_be_checked();page.get_by_role('button',name='Vazgeç',exact=True).click()
    page.screenshot(path=str(out/'page-manager.png'))
    page.get_by_role('tab',name=__import__('re').compile('Koleksiyon sayfaları')).click();collection_row=page.locator('.page-table-row').filter(has_text='Aura · Koleksiyon sayfası');expect(collection_row).to_contain_text('Aura koleksiyonu')
    public.goto(base+'/p/demo/products/aura-one');expect(public.get_by_role('heading',name='Aura One kablosuz kulaklık',exact=True)).to_be_visible()
    public.get_by_role('button',name='Yerel sepete ekle',exact=True).click();expect(public.locator('.cart-status')).to_contain_text('sepete')
    public.goto(base+'/p/demo/collections/demo-collection');expect(public.get_by_role('heading',name='Aura koleksiyonu',exact=True)).to_be_visible();expect(public.locator('.builder-product-grid')).to_contain_text('Aura One kablosuz kulaklık')
    print('PASS: homepage/product/collection overview, unassigned independent clone, assignment selection and real public product/collection routes',flush=True)
    assert not errors,errors
    (out/'feedback-validation.json').write_text(json.dumps({'editor_errors':errors,'panels':widths,'checks':['padding-input','padding-persistence','padding-publication','stable-home','context-menu','persistent-link','page-switch','edge-resize','free-drag','independent-mobile','clipboard-node','clipboard-png','clipboard-html','columns','panel-resize','section-preview-binding','editor-seo-title','published-seo-title','page-overview','page-duplicate','assignments','product-route-cart','collection-route']},indent=2))
