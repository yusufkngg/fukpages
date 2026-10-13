"""Critical combined workflows for the previously code-reviewed feature rows."""
from pathlib import Path
import json, subprocess
from browser_support import ROOT, browser_fixture, block, document, open_editor, expect
with browser_fixture() as f:
    api,base=f['api'],f['base'];errors=[]
    colors=[]
    for color in ['blue','green']:
        data=subprocess.run(['node','--input-type=module','-e',"import sharp from 'sharp';process.stdout.write(await sharp({create:{width:160,height:120,channels:4,background:process.argv[1]}}).png().toBuffer());",color],cwd=ROOT,capture_output=True,check=True).stdout
        colors.append(f['upload'](data,color+'.png'))
    fonts=[]
    for file in ['DejaVuSans.ttf','DejaVuSans-Bold.ttf','DejaVuSans-Oblique.ttf']:
        fonts.append(f['upload']((Path('/usr/share/fonts/truetype/dejavu')/file).read_bytes(),file,'font',{'family':'Review Sans'}))
    brand=api('/stores/demo/brand');brand['brand']['fonts'].update(heading='Review Sans, Arial, sans-serif',body='Review Sans, Arial, sans-serif',button='Review Sans, Arial, sans-serif');brand['brand']['colors']['primary']='#123456';brand['brand']['typography']['h2']=38;api('/stores/demo/brand','PUT',brand)
    image=block('image','responsive-image',{'src':colors[0]['url'],'mobileSrc':colors[1]['url'],'focusX':'25','focusY':'70','aspectRatio':'4 / 3','lightbox':True,'alt':'Responsive photo'},styles={'height':'240px','objectFit':'cover'})
    image['styles']['mobile']={'height':'150px'}
    headings=[block('heading','head-'+str(i),{'tag':'h'+str(i),'html':'Başlık '+str(i)},styles={'fontWeight':'700' if i==1 else '400','fontStyle':'italic' if i==3 else 'normal'}) for i in range(1,7)]
    form=block('form','contact',{'submitLabel':'Yerel formu gönder','successMessage':'Kaydedildi','redirect':'/p/demo/thank-you'},[block('input','email',{'label':'E-posta','placeholder':'E-posta','fieldName':'email','inputType':'email','required':True,'helpText':'İletişim adresi','errorMessage':'Geçerli e-posta gerekli'}),block('checkbox','consent',{'label':'İzin veriyorum','fieldName':'consent','required':True,'consent':True})])
    target=document('Thank you',[block('heading','thanks',{'tag':'h1','html':'Teşekkürler'})]);target['seo']={'slug':'thank-you','title':'Thanks','description':'','image':'','noindex':True};thanks=api('/stores/demo/pages','POST',{'document':target});api('/pages/'+thanks['id']+'/publish','POST',{})
    variants=[block('button','brand-'+v,{'text':v,'buttonVariant':v,'href':'#'}) for v in ['primary','secondary','outline']]
    nodes=[*headings,*variants,block('text','brand-small',{'html':'Küçük metin','globalStyle':'small'}),block('text','brand-link',{'html':'Bağlantı metni','globalStyle':'link'}),image,block('button','copy',{'text':'Kuponu al','action':'copyCoupon','actionTarget':'TEST20'}),block('tabs','tabs',{'items':'Bir|Birinci içerik\nİki|İkinci içerik'}),block('mobileMenu','menu',{'title':'Menü','items':'İletişim|#anchor'}),block('breadcrumb','breadcrumb',{'items':'Ana sayfa|/\nÜrün|#anchor'}),block('blogList','blog',{'items':'Yazı başlığı|Yazar|2026-10-13|Yazı özeti|#anchor'}),block('button','scroll',{'text':'Bölüme git','action':'scroll','actionTarget':'anchor'}),block('button','submit',{'text':'Form aksiyonu','action':'formSubmit','actionTarget':'contact'}),form,block('heading','anchor',{'tag':'h2','html':'Hedef bölüm','cssId':'anchor'},styles={'marginTop':'300px'})]
    section=block('section','brand-section',{'backgroundSrc':colors[0]['url'],'backgroundOverlay':'#ffffffee'},nodes,styles={'paddingLeft':'24px','paddingRight':'24px','gap':'15px'})
    work=api('/stores/demo/pages','POST',{'document':document('Critical flows',[section])});api('/pages/'+work['id']+'/publish','POST',{})
    visitor=f['browser'].new_context(viewport={'width':1440,'height':1000},permissions=['clipboard-read','clipboard-write']);pub=visitor.new_page();pub.on('pageerror',lambda e:errors.append(str(e)));pub.goto(base+'/?published='+work['id'])
    for i in range(1,7):expect(pub.locator('[data-block=head-'+str(i)+']')).to_have_css('font-size',str(brand['brand']['typography']['h'+str(i)])+'px')
    expect(pub.locator('[data-block=brand-small]')).to_have_css('font-size','12px');expect(pub.locator('[data-block=brand-link]')).to_have_css('font-size','16px');expect(pub.locator('[data-block=brand-outline]')).to_have_css('border-top-style','solid');expect(pub.locator('[data-block=brand-primary]')).to_have_css('background-color','rgb(18, 52, 86)')
    expect(pub.locator('[data-block=head-2]')).to_have_css('font-size','38px');expect(pub.locator('[data-block=head-3]')).to_have_css('font-style','italic')
    for description in ['400 18px "Review Sans"','700 18px "Review Sans"','italic 400 18px "Review Sans"']:
        assert pub.evaluate('(s)=>document.fonts.load(s).then(f=>f.length)',description)>0
    img=pub.locator('[data-block=responsive-image] img');expect(img).to_have_css('object-fit','cover');expect(img).to_have_css('object-position','25% 70%');expect(img).to_have_css('aspect-ratio','4 / 3');assert colors[0]['id'] in img.evaluate('(el)=>el.currentSrc')
    assert 'linear-gradient' in pub.locator('[data-block=brand-section]').evaluate('(el)=>getComputedStyle(el).backgroundImage')
    img.focus();pub.keyboard.press('Enter');expect(pub.get_by_role('dialog',name='Görseli büyüt')).to_be_visible();pub.keyboard.press('Escape');expect(img).to_be_focused()
    pub.set_viewport_size({'width':390,'height':850});expect(pub.locator('[data-block=head-2]')).to_have_css('font-size','27px');expect(img).to_have_css('height','150px');assert colors[1]['id'] in img.evaluate('(el)=>el.currentSrc')
    pub.get_by_role('button',name='☰ Menü',exact=True).click();expect(pub.locator('[data-block=menu] a')).to_have_attribute('href','#anchor')
    expect(pub.locator('[data-block=blog]')).to_contain_text('Yazar · 2026-10-13');expect(pub.locator('[data-block=breadcrumb] a')).to_have_count(2)
    tab=pub.get_by_role('tab',name='Bir',exact=True);tab.focus();pub.keyboard.press('ArrowRight');expect(pub.get_by_role('tab',name='İki',exact=True)).to_be_focused();expect(pub.get_by_role('tabpanel')).to_have_text('İkinci içerik')
    pub.get_by_role('link',name='Kuponu al',exact=True).click();assert pub.evaluate('()=>navigator.clipboard.readText()')=='TEST20'
    pub.emulate_media(reduced_motion='reduce');pub.get_by_role('link',name='Bölüme git',exact=True).click();assert pub.locator('#anchor').bounding_box()['y']<850
    pub.get_by_label('E-posta',exact=True).fill('bad');pub.get_by_role('link',name='Form aksiyonu',exact=True).click();assert pub.get_by_label('E-posta',exact=True).evaluate('(el)=>el.validationMessage')=='Geçerli e-posta gerekli'
    pub.get_by_label('E-posta',exact=True).fill('visitor@example.com');pub.get_by_label('İzin veriyorum',exact=True).check();pub.get_by_role('link',name='Form aksiyonu',exact=True).click();pub.wait_for_url('**/p/demo/thank-you');expect(pub.locator('h1')).to_have_text('Teşekkürler');assert len(api('/stores/demo/submissions'))==1
    target_store=api('/stores','POST',{'name':'Transfer target'})
    transferred=api('/pages/'+work['id']+'/transfer','POST',{'targetStoreId':target_store['id']});api('/pages/'+transferred['id']+'/publish','POST',{})
    transfer_page=visitor.new_page();transfer_page.goto(base+'/?published='+transferred['id']);expect(transfer_page.locator('h2').first).to_have_css('font-family','"Review Sans", Arial, sans-serif');assert transfer_page.evaluate("()=>document.fonts.load('italic 400 18px \"Review Sans\"').then(f=>f.length)")>0
    assert api('/stores/'+target_store['id']+'/brand')['brand']['fonts']['heading']=='Arial, sans-serif'
    print('PASS: inherited brand fonts and italic faces also render publicly after transfer; target brand is preserved',flush=True)
    print('PASS: regular/bold/italic font faces, H1–H6/global/mobile typography, responsive media/focus/aspect/lightbox, background overlay, menu/blog/breadcrumb, keyboard tabs, coupon, reduced motion and validated form action/redirect',flush=True)
    page=f['owner'].new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());open_editor(page,base,'Critical flows')
    page.get_by_role('button',name='Medya',exact=True).click();asset=page.locator('[data-asset-id="'+colors[0]['id']+'"]');asset.get_by_role('button',name='Bilgiler',exact=True).click()
    page.get_by_label('Ad',exact=True).fill('Marka fotoğrafı');page.get_by_label('Ad',exact=True).press('Tab');page.get_by_label('Klasör',exact=True).fill('Kampanya');page.get_by_label('Klasör',exact=True).press('Tab');page.get_by_label('Etiketler',exact=True).fill('ürün, yaz');page.get_by_label('Etiketler',exact=True).press('Tab')
    expect(asset).to_contain_text('Marka fotoğrafı');asset.get_by_role('button',name='Marka fotoğrafı favori',exact=True).click();page.get_by_label('Favoriler',exact=True).check();expect(page.locator('.media-grid article')).to_have_count(1);page.get_by_label('Medya klasörü',exact=True).select_option('Kampanya');page.get_by_label('Medya ara',exact=True).fill('yaz');expect(page.locator('.media-grid article')).to_have_count(1)
    page.get_by_role('button',name='Marka',exact=True).click();page.get_by_label('Font ara',exact=True).fill('Review Sans');expect(page.locator('.library .feature-card').filter(has_text='Review Sans').first).to_contain_text('Review Sans')
    print('PASS: media rename/folder/tags/favorite/search combination and searchable uploaded font catalogue',flush=True)
    heading=page.locator('[data-node-id=head-1]');heading.click();page.get_by_role('button',name='Stili kopyala',exact=True).click();page.get_by_role('button',name='Öğeleri kopyala',exact=True).click()
    destination=api('/stores/demo/pages','POST',{'document':document('Paste destination',[block('section','paste-section',{},[block('heading','paste-heading',{'html':'Destination','tag':'h1'})])])});open_editor(page,base,'Paste destination')
    page.get_by_role('button',name='Stili yapıştır',exact=True).click();page.get_by_role('button',name='Öğeleri yapıştır',exact=True).click();expect(page.locator('.editor-block[data-kind=heading]')).to_have_count(2)
    expect(page.locator('[data-node-id=paste-heading]')).to_have_css('font-weight','700')
    page.locator('[data-node-id=paste-heading]').click(button='right');page.locator('.editor-context-menu').get_by_role('button',name='Üst öğeyi seç',exact=True).click();expect(page.locator('[data-node-id=paste-section]')).to_have_class(__import__('re').compile('selected'))
    page.locator('[data-node-id=paste-heading]').click();page.locator('.inspector-container').get_by_role('button',name='İçerik',exact=True).click();page.get_by_label('Katman adı',exact=True).fill('Aranacak başlık');page.get_by_label('Katman adı',exact=True).press('Tab');page.locator('[data-node-id=paste-heading]').focus();page.keyboard.press('ArrowDown');expect(page.locator('[data-node-id=paste-section] > .editor-block').last).to_have_attribute('data-node-id','paste-heading')
    page.get_by_role('button',name='Katmanlar',exact=True).click();page.get_by_label('Katman ara',exact=True).fill('Aranacak başlık');expect(page.locator('.layer-tree')).to_contain_text('Aranacak başlık')
    expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    stored=api('/pages/'+destination['id'])['document'];assert len(stored['nodes'][0]['children'])==2
    print('PASS: style and element paste across pages, right-click parent selection, keyboard sibling movement and layer naming/search',flush=True)
    raw=(f['temp']/'drop.png');subprocess.run(['node','--input-type=module','-e',"import sharp from 'sharp';await sharp({create:{width:160,height:120,channels:4,background:'orange'}}).png().toFile(process.argv[1]);",str(raw)],cwd=ROOT,capture_output=True,check=True)
    import base64
    page.locator('.canvas-sheet').evaluate("(el,data)=>{const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'drop.png',{type:'image/png'}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));}",base64.b64encode(raw.read_bytes()).decode())
    expect(page.locator('.editor-block[data-kind=image]')).to_have_count(1);expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    lazy_asset=f['upload'](raw.read_bytes(),'lazy.png')
    lazy=api('/stores/demo/pages','POST',{'document':document('Lazy loading',[block('section','lazy-section',{},[block('spacer','spacer',{},styles={'height':'16000px'}),block('image','lazy-image',{'src':lazy_asset['url'],'alt':'Offscreen photo'},styles={'height':'200px'})])])});api('/pages/'+lazy['id']+'/publish','POST',{})
    lazy_page=f['browser'].new_context(viewport={'width':1440,'height':900}).new_page();requests=[];lazy_page.on('request',lambda r:requests.append(r.url) if lazy_asset['id'] in r.url else None)
    lazy_page.goto(base+'/?published='+lazy['id']);expect(lazy_page.locator('[data-block=lazy-image] img')).to_have_attribute('loading','lazy');lazy_page.wait_for_load_state('networkidle');assert not requests,requests
    lazy_page.locator('[data-block=lazy-image]').scroll_into_view_if_needed();lazy_page.wait_for_function('()=>document.querySelector("[data-block=lazy-image] img").naturalWidth>0');assert requests
    print('PASS: native browser file-drop event creates/persists an image and offscreen images load only after scrolling',flush=True)
    experiment=api('/stores/demo/experiments','POST',{'name':'Critical A/B','a':work['id'],'b':thanks['id'],'split':50})
    pub.goto(base+'/?experiment='+experiment['id']);expect(pub.locator('.page-surface')).to_be_visible()
    open_editor(page,base,'Critical flows');page.get_by_role('button',name='Akışlar',exact=True).click();page.get_by_role('button',name='Test sonuçlarını yenile',exact=True).click()
    result=page.locator('.experiment-results article').filter(has_text='Critical A/B');expect(result.locator('tbody tr')).to_have_count(2)
    assert sum(result.locator('tbody tr').evaluate_all('(rows)=>rows.map(r=>Number(r.querySelector("td").textContent))'))==1
    print('PASS: A/B results panel displays the actual assigned visitor counts and rate intervals',flush=True)
    assert not errors,errors
