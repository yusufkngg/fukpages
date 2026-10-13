"""Exercise uploaded media/fonts and the extended editor in real Chromium."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json, os, secrets, signal, socket, subprocess, time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / '.local' / 'validation'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
def block(kind, id, props=None, children=None, styles=None):
    return dict(kind=kind,id=id,name=id,props=props or {},children=children or [],styles=dict(desktop=styles or {},tablet={},mobile={}),hidden=dict(desktop=False,tablet=False,mobile=False))

with TemporaryDirectory(prefix='fukpages-studio-browser-') as temporary:
    password = secrets.token_urlsafe(32)
    hashed = subprocess.run(['node','--input-type=module','-e',"import {hashPassword} from './server/auth.mjs';let p='';for await(const c of process.stdin)p+=c;process.stdout.write(hashPassword(p));"],cwd=ROOT,input=password,text=True,capture_output=True,check=True).stdout
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    environment = dict(os.environ, PORT=str(port),DATA_DIR=temporary,OWNER_PASSWORD_HASH=hashed,NODE_ENV='test')
    environment.update(OWNER_LOGIN='owner', SHOPIFY_SHOP_DOMAIN='', SHOPIFY_ADMIN_ACCESS_TOKEN='', FUKPAGES_AI_API_KEY='', OPENAI_API_KEY='', FORM_WEBHOOK_URL='', FORM_WEBHOOK_SECRET='')
    logs=open(Path(temporary)/'server.log','w')
    server=subprocess.Popen(['node','server/index.mjs'],cwd=ROOT,env=environment,stdout=logs,stderr=logs,start_new_session=True)
    try:
        base=f'http://127.0.0.1:{port}'
        for _ in range(100):
            try:
                if urlopen(base+'/api/health',timeout=1).status==200:break
            except Exception:time.sleep(.1)
        else:raise AssertionError('Server did not start')
        images=[]
        for color in ['blue','green']:
            path=Path(temporary)/(color+'.png')
            subprocess.run(['node','--input-type=module','-e',"import sharp from 'sharp';await sharp({create:{width:200,height:160,channels:4,background:process.argv[2]}}).png().toFile(process.argv[1]);",str(path),color],cwd=ROOT,capture_output=True,check=True)
            images.append(str(path))
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':1680,'height':1100})
            page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base);page.get_by_label('Şifre',exact=True).fill(password);page.get_by_role('button',name='Stüdyoya gir',exact=True).click();page.get_by_role('button',name='Editörü aç').click()
            expect(page.get_by_label('Sayfa adı')).to_be_visible()
            page.get_by_role('button',name='Medya',exact=True).click()
            page.locator('input[type=file][accept*="image/png"]').set_input_files(images)
            expect(page.locator('.media-grid article')).to_have_count(2)
            page.screenshot(path=str(ARTIFACTS/'media-library.png'),full_page=True)
            image_node=page.locator('.editor-block[data-kind=image]').first
            image_node.click();original_radius=image_node.evaluate('(el)=>getComputedStyle(el).borderRadius')
            page.locator('.media-grid article').first.locator('button').first.click()
            expect(image_node.locator('img')).to_have_attribute('src',__import__('re').compile('/api/assets/'))
            assert image_node.evaluate('(el)=>getComputedStyle(el).borderRadius')==original_radius
            page.get_by_role('button',name='Kaydet',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Kaydedildi')
            page.get_by_role('button',name='Marka',exact=True).click()
            page.locator('input[type=file][accept*=".woff2"]').set_input_files([str(ROOT/'tests/fixtures/ABeeZee-Regular.ttf'),str(ROOT/'tests/fixtures/Roboto-variable.ttf')])
            expect(page.locator('.feature-card b').filter(has_text='ABeeZee')).to_be_visible()
            page.get_by_label('Global font heading').select_option('ABeeZee, Arial, sans-serif')
            page.get_by_role('button',name='Marka kitini kaydet').click()
            expect(page.locator('[data-kind=heading]:has(h1)')).to_have_css('font-family','ABeeZee, Arial, sans-serif')
            page.evaluate('()=>document.fonts.load(\'400 32px "ABeeZee"\')')
            assert page.evaluate('()=>document.fonts.check(\'400 32px "ABeeZee"\')')
            page.screenshot(path=str(ARTIFACTS/'brand-kit.png'),full_page=True)
            page.locator('[data-kind=heading]:has(h1)').click();page.get_by_role('button',name='İçerik',exact=True).click();page.get_by_label('Özel font seç').select_option('Roboto, Arial, sans-serif')
            expect(page.get_by_label('Font ekseni wght')).to_be_visible();initial_weight=int(page.get_by_label('Font ekseni wght').input_value());page.get_by_label('Font ekseni wght').press('ArrowLeft');expect(page.locator('[data-kind=heading]:has(h1)')).to_have_css('font-variation-settings',f'"wght" {initial_weight-1}')
            page.get_by_role('button',name='Geri al',exact=True).click();page.get_by_role('button',name='Geri al',exact=True).click()
            context.grant_permissions(['clipboard-read','clipboard-write'],origin=base)
            page.evaluate("(hex)=>{const bytes=Uint8Array.from(hex.match(/.{2}/g).map(v=>parseInt(v,16)));return navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([bytes],{type:'image/png'})})]);}",Path(images[0]).read_bytes().hex())
            page.locator('.canvas-topline').click();page.keyboard.press('Control+V')
            expect(page.locator('.editor-block.selected[data-kind=image]')).to_be_visible()
            page.locator('.editor-block.selected[data-kind=image]').get_by_title('Öğeyi sil').click()
            row=page.locator('.editor-block[data-kind=row]:has(> .editor-block[data-kind=column])').first
            row.dispatch_event('click');handle=row.get_by_label('Kolonları boyutlandır');expect(handle).to_be_visible();handle.scroll_into_view_if_needed();start_width=row.locator(':scope > .editor-block[data-kind=column]').first.evaluate('(el)=>el.getBoundingClientRect().width');bounds=handle.bounding_box();page.mouse.move(bounds['x']+4,bounds['y']+20);page.mouse.down();page.mouse.move(bounds['x']+64,bounds['y']+20,steps=10);page.mouse.up()
            changed_width=row.locator(':scope > .editor-block[data-kind=column]').first.evaluate('(el)=>el.getBoundingClientRect().width');assert abs(changed_width-start_width)>10
            page.get_by_role('button',name='Geri al',exact=True).click()
            page.get_by_role('button',name='Sayfa',exact=True).click();page.get_by_role('button',name='Görsel yükleme sürelerini ölç',exact=True).click();expect(page.locator('[data-image-timings] p').first).to_be_visible()
            print('PASS: direct column resize handle and actual image resource timings')
            print('PASS: variable font axis editor and native clipboard image upload')
            page.get_by_role('button',name='Yerel yayın',exact=True).click()
            expect(page.get_by_role('button',name='Yerel yayın güncelle')).to_be_visible()
            csrf=context.request.get(base+'/api/auth/status').json()['csrf']
            def api(path,method='GET',body=None):
                response=context.request.fetch(base+'/api'+path,method=method,data=body,headers={'X-CSRF-Token':csrf,'Content-Type':'application/json'})
                assert response.ok, (path,response.status,response.text())
                return response.json()
            source_id=api('/stores/demo/pages')[0]['id']
            assets=api('/stores/demo/assets');photo=next(a for a in assets if a['type']=='image')
            visitor=browser.new_context(viewport={'width':1280,'height':900});public=visitor.new_page();public.on('pageerror',lambda e:errors.append(str(e)))
            public.goto(base+'/?published='+source_id)
            expect(public.locator('.page-surface img').first).to_be_visible()
            public.evaluate('()=>document.fonts.load(\'400 32px "ABeeZee"\')')
            assert public.evaluate('()=>document.fonts.check(\'400 32px "ABeeZee"\')')
            assert public.locator('.page-surface img').first.evaluate('(el)=>el.naturalWidth')>0
            public.reload();expect(public.locator('h1')).to_have_css('font-family','ABeeZee, Arial, sans-serif')
            print('PASS: multi-file upload, style-preserving replacement, font conversion, brand assignment and visitor/reload media/font rendering')
            catalog={'version':0,'products':[{'id':'p1','title':'Yerel ürün','currency':'TRY','images':[photo['url']],'metafields':{'details.material':'Pamuk'},'variants':[{'id':'v1','title':'Siyah','price':19900,'stock':2,'image':photo['url']},{'id':'v2','title':'Tükenmiş','price':29900,'stock':0},{'id':'v3','title':'Beyaz','price':39900,'stock':5}]}],'collections':[{'id':'c1','title':'Koleksiyon','productIds':['p1']}]}
            api('/stores/demo/catalog','PUT',catalog)
            form=block('form','contact-form',{'successMessage':'Kaydın alındı'},[block('input','email',{'label':'E-posta','placeholder':'E-posta','inputType':'email','fieldName':'email','required':True}),block('checkbox','consent',{'label':'İzin','fieldName':'consent','required':True,'consent':True})])
            nodes=[block('heading','main-title',{'html':'Türkçe başlık','tag':'h1','translations':json.dumps({'en':{'html':'English heading'}})}),block('productGallery','gallery',{'productId':'p1'}),block('productField','dynamic-price',{'productId':'p1','field':'price'}),block('variantPicker','variants',{'productId':'p1'}),block('quantity','quantity',{'productId':'p1'}),block('addToCart','cart-button',{'productId':'p1'}),block('tabs','tabs',{'items':'Bir|Birinci içerik\nİki|İkinci içerik'}),block('beforeAfter','before-after',{'images':photo['url']+'\n'+photo['url']}),form,block('popup','popup',{'trigger':'button','text':'Popup aç','title':'Popup'},[block('text','popup-body',{'html':'Popup içeriği'})])]
            composite=api('/stores/demo/pages','POST',{'document':{'schemaVersion':1,'type':'landing','name':'Extended validation','nodes':nodes,'locales':['tr','en'],'defaultLocale':'tr','seo':{'slug':'extended-validation','title':'SEO validation','description':'Meta validation','image':photo['url'],'noindex':True}}})
            api('/pages/'+composite['id']+'/publish','POST',{})
            public.goto(base+'/p/demo/extended-validation')
            expect(public.locator('h1')).to_have_text('Türkçe başlık');public.get_by_label('Sayfa dili').select_option('en');expect(public.locator('h1')).to_have_text('English heading')
            public.get_by_label('Ürün varyantı').select_option('v3');expect(public.locator('[data-block=dynamic-price]')).to_contain_text('399')
            assert public.get_by_label('Ürün varyantı').locator('option[value=v2]').evaluate('(el)=>el.disabled'), public.get_by_label('Ürün varyantı').inner_html()
            public.get_by_label('Ürün adedi').fill('2');public.get_by_role('button',name='Yerel sepete ekle',exact=True).click();expect(public.get_by_role('status').first).to_contain_text('Yerel sepete eklendi')
            public.locator('.builder-product-gallery > img').click();expect(public.get_by_role('dialog',name='Ürün yakınlaştırma')).to_be_visible();public.get_by_role('button',name='Ürün yakınlaştırma kapat',exact=True).click();expect(public.get_by_role('dialog')).to_have_count(0)
            slider=public.locator('.before-after input');slider.press('ArrowLeft');assert '51%' in public.locator('.before-after > div > img').last.evaluate('(el)=>getComputedStyle(el).clipPath')
            public.get_by_role('tab',name='İki',exact=True).click();expect(public.get_by_role('tabpanel')).to_have_text('İkinci içerik')
            public.get_by_role('button',name='Popup aç',exact=True).click();expect(public.get_by_role('dialog',name='Popup')).to_be_visible();public.get_by_label('Popup kapat').click();expect(public.get_by_role('dialog')).to_have_count(0)
            public.get_by_label('E-posta',exact=True).fill('visitor@example.com');public.get_by_label('İzin',exact=True).check();public.get_by_role('button',name='Gönder',exact=True).click();expect(public.get_by_role('status').last).to_have_text('Kaydın alındı')
            assert len(api('/stores/demo/submissions'))==1
            preview=api('/pages/'+composite['id']+'/preview','POST',{})
            public.goto(base+preview['path']);public.get_by_label('Değerlendiren adı').fill('Müşteri');public.get_by_label('Değerlendirme notu').fill('Tasarım onaylandı');public.get_by_role('button',name='Onayla',exact=True).click();expect(public.get_by_role('status').last).to_have_text('Değerlendirme kaydedildi.')
            assert api('/pages/'+composite['id']+'/reviews')[0]['decision']=='approve'
            print('PASS: local product/variant/price/stock, cart, tabs, popup, translation, validated form and customer preview approval')
            page.get_by_role('button',name='Akışlar',exact=True).click()
            page.get_by_label('İkinci test sayfası').select_option(composite['id'])
            page.get_by_role('button',name='%50 / %50 A/B testi oluştur',exact=True).click()
            expect(page.locator('a[href*="experiment="]')).to_have_count(2);expect(page.locator('a[href*="experiment="]').first).to_be_visible()
            page.get_by_role('button',name='İki adımlı huni oluştur',exact=True).click()
            expect(page.locator('a[href*="funnel="]')).to_be_visible()
            generated=subprocess.run(['node','--import','tsx','--input-type=module','-e',"import {sectionPresets,createSectionPreset} from './src/sections.ts';process.stdout.write(JSON.stringify(sectionPresets.map(p=>({schemaVersion:1,type:'landing',name:p.name,nodes:[createSectionPreset(p.id)]}))));"],cwd=ROOT,text=True,capture_output=True,check=True)
            for preset_document in json.loads(generated.stdout):
                created=api('/stores/demo/pages','POST',{'document':preset_document})
                api('/pages/'+created['id']+'/publish','POST',{})
                public.goto(base+'/?published='+created['id'])
                expect(public.locator('.page-surface')).to_be_visible()
                expect(public.locator('[data-block="'+created['document']['nodes'][0]['id']+'"]')).to_be_visible()
            print('PASS: A/B and funnel editor controls, all 60 presets publish and render in a visitor session')
            page.get_by_role('button',name='Bölümler',exact=True).click();expect(page.locator('[data-section-preset]')).to_have_count(60)
            page.screenshot(path=str(ARTIFACTS/'editor-extended.png'),full_page=True)
            assert not errors,errors
            print('PASS: 60 presets and no uncaught browser errors')
            guest_password=secrets.token_urlsafe(32)
            api('/team','POST',{'login':'browser-viewer','password':guest_password,'role':'viewer','stores':['demo']})
            guest=browser.new_context(viewport={'width':1280,'height':900});reader=guest.new_page();reader.on('pageerror',lambda e:errors.append(str(e)))
            reader.goto(base);reader.get_by_label('Kullanıcı adı',exact=True).fill('browser-viewer');reader.get_by_label('Şifre',exact=True).fill(guest_password);reader.get_by_role('button',name='Stüdyoya gir').click()
            reader.get_by_role('button',name='Tasarımı görüntüle',exact=True).click();expect(reader.get_by_text('İzleyici · Salt okunur tasarım',exact=True)).to_be_visible();expect(reader.get_by_role('button',name='Kaydet',exact=True)).to_have_count(0)
            print('PASS: optional viewer account logs in and renders a read-only store-scoped design')
            assert not errors,errors
            guest.close();visitor.close();context.close();browser.close()
    finally:
        os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10);logs.close()
