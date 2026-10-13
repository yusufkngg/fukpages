"""All 60 presets: four widths, long Turkish content/extra cards, and missing media/fonts."""
from pathlib import Path
import base64, copy, json, subprocess
from browser_support import ROOT, browser_fixture, expect
artifacts=ROOT/'.local'/'validation';artifacts.mkdir(parents=True,exist_ok=True)
long_title='İstanbul’dan dünyaya: kişiselleştirilebilir ürünlerle yaşamına özgürlük, güven ve şıklık kat. '
long_text='Türkçe içerik testi: İ ı Ş ş Ğ ğ Ç ç Ö ö Ü ü. Ürünün özellikleri, teslimat koşulları ve kullanım ayrıntıları açıkça anlatılır. '
with browser_fixture() as f:
    api,base=f['api'],f['base']
    font=f['upload']((ROOT/'tests/fixtures/Roboto-variable.ttf').read_bytes(),'Roboto.ttf','font')
    alternate=f['upload']((ROOT/'tests/fixtures/ABeeZee-Regular.ttf').read_bytes(),'ABeeZee.ttf','font')
    generated=subprocess.run(['node','--import','tsx','--input-type=module','-e',"import {sectionPresets,createSectionPreset} from './src/sections.ts';import {cloneBlock} from './src/model.ts';process.stdout.write(JSON.stringify(sectionPresets.map(p=>{const n=createSectionPreset(p.id);const walk=x=>{if(x.kind==='row'&&x.children.length===3&&x.children.every(c=>c.kind===x.children[0].kind))x.children.push(...x.children.map(cloneBlock));x.children.forEach(walk)};return {id:p.id,name:p.name,normal:n,extra:(()=>{let x=structuredClone(n);walk(x);return x})()}})));"],cwd=ROOT,capture_output=True,text=True,check=True)
    presets=json.loads(generated.stdout);assert len(presets)==60
    api('/stores/demo/catalog','PUT',{'version':0,'products':[{'id':'quality-product','title':long_title,'description':long_text,'currency':'TRY','images':['/assets/headphones.svg'],'metafields':{'details.material':'Pamuk'},'variants':[{'id':'quality-variant','title':'Standart ürün','price':19900,'stock':50}]}],'collections':[{'id':'quality-collection','title':long_title,'description':long_text,'productIds':['quality-product']}]})
    browser=f['browser'];context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    failures=[];checks=0;shots={'desktop':[],'mobile':[]}
    for case in ['normal','long-turkish-extra-cards','missing-media-alternate-font']:
        brand=api('/stores/demo/brand');family=alternate['family'] if case.startswith('missing') else font['family'];brand['brand']['fonts'].update(heading=family+', Arial, sans-serif',body=family+', Arial, sans-serif',button=family+', Arial, sans-serif');api('/stores/demo/brand','PUT',brand)
        docs=[]
        for entry in presets:
            section=copy.deepcopy(entry['extra' if case.startswith('long') else 'normal'])
            def prepare(n):
                if n['kind'] in ['productField','productGallery','variantPicker','quantity','addToCart','stickyCart']:n['props']['productId']='quality-product'
                if n['kind']=='bundle':n['props']['productIds']='quality-product'
                if n['kind']=='collectionGrid':n['props']['collectionId']='quality-collection'
                if case.startswith('long'):
                    if n['kind']=='heading':n['props']['html']=long_title*2
                    if n['kind']=='text':n['props']['html']=long_text*4
                    if n['kind']=='button':n['props']['text']='Ürün detaylarını ve bütün seçenekleri incele →'
                    if n['kind']=='comparison':n['props']['rows']='|'.join([long_text]*3)+'\n'+'|'.join([long_text]*3)
                if case.startswith('missing'):
                    if n['kind']=='image':n['props']['src']='';n['props']['alt']='Görsel açıklaması'
                    if n['kind'] in ['gallery','beforeAfter','logos']:n['props']['images']=''
                for c in n['children']:prepare(c)
            prepare(section);docs.append((entry,section))
        for start in range(0,60,10):
            chunk=docs[start:start+10];doc={'schemaVersion':1,'type':'landing','name':f'Quality {case} {start}','nodes':[s for _,s in chunk]}
            created=api('/stores/demo/pages','POST',{'document':doc});api('/pages/'+created['id']+'/publish','POST',{})
            page.goto(base+'/?published='+created['id']);expect(page.locator('.page-surface')).to_be_visible();page.evaluate('()=>document.fonts.ready')
            for width,label in [(1440,'desktop'),(820,'tablet'),(390,'mobile'),(320,'narrow-mobile')]:
                page.set_viewport_size({'width':width,'height':1000});expect(page.locator('.page-surface')).to_have_attribute('data-device','mobile' if width<=600 else 'tablet' if width<=900 else 'desktop')
                for entry,section in chunk:
                    root=page.locator('[data-block="'+section['id']+'"]');expect(root).to_be_visible();root.evaluate('(el)=>el.scrollIntoView({block:"start"})')
                    metrics=root.evaluate('(el)=>{const r=el.getBoundingClientRect();return {width:r.width,left:r.left,right:r.right,scroll:el.scrollWidth,client:el.clientWidth,body:document.documentElement.scrollWidth,viewport:innerWidth}}')
                    checks+=1
                    if metrics['body']>width+2 or metrics['right']>width+2 or metrics['left']<-2:failures.append({'preset':entry['id'],'case':case,'viewport':width,'metrics':metrics})
                    if case=='normal' and label in shots:
                        image=root.screenshot();shots[label].append((entry['name'],base64.b64encode(image).decode()))
                print(f'CHECK: {case} presets {start+1}–{start+len(chunk)} at {width}px',flush=True)
    (artifacts/'section-quality.json').write_text(json.dumps({'checks':checks,'presets':60,'cases':3,'widths':[1440,820,390,320],'failures':failures,'page_errors':errors},ensure_ascii=False,indent=2))
    for label,images in shots.items():
        gallery=browser.new_page(viewport={'width':1500,'height':1000});gallery.add_init_script("localStorage.setItem('fp-ui-language','tr')")
        html='<html lang="tr"><style>*{box-sizing:border-box}body{font:12px Arial;margin:0;padding:18px;background:#e9eee2}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.card{background:white;border-radius:8px;padding:8px;min-height:210px}.card img{width:100%;height:175px;object-fit:contain;object-position:top}.card b{display:block;margin:8px 0}</style><h1>FukPages · 60 bölüm · '+label+'</h1><div class="grid">'+''.join('<div class="card"><b>'+name+'</b><img src="data:image/png;base64,'+data+'"></div>' for name,data in images)+'</div></html>'
        gallery.set_content(html);gallery.evaluate('()=>Promise.all([...document.images].map(i=>i.decode()))');gallery.screenshot(path=str(artifacts/f'section-quality-{label}.png'),full_page=True);gallery.close()
    assert not errors,errors
    assert not failures,json.dumps(failures[:20],ensure_ascii=False)
    print(f'PASS: {checks} preset/viewport/scenario checks; all 60 presets, three content/font scenarios and four widths',flush=True)
