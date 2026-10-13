"""Independent icon/text boxes, legacy migration and actual custom SVG publishing."""
import json,re
from browser_support import ROOT,browser_fixture,block,document,expect
out=ROOT/'.local/validation';out.mkdir(parents=True,exist_ok=True)
with browser_fixture(netlify=True,ui_language=None) as f:
    owner=f['owner'];owner.grant_permissions(['clipboard-read','clipboard-write'])
    page=owner.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f['base'])
    csrf=page.evaluate("async()=>(await (await fetch('/api/auth/status')).json()).csrf")
    def api(path,method='GET',body=None):
        return page.evaluate("""async({path,method,body,csrf})=>{const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===null?{}:{body:JSON.stringify(body)})});if(!r.ok)throw new Error(path+' '+r.status+' '+await r.text());return r.status===204?null:r.json();}""",dict(path=path,method=method,body=body,csrf=csrf))
    legacy=document('Atomic legacy',[block('section','atomic-section',children=[
        block('heading','main-heading',{'html':'Every part is yours.','tag':'h1'},styles={'fontSize':'36px'}),
        block('text','legacy-menu',{'html':'Shop &nbsp;&nbsp;&nbsp; Our story &nbsp;&nbsp;&nbsp; Support'},styles={'fontSize':'14px','color':'#17241c'}),
        block('text','legacy-proof',{'html':'<span style="color:#e5a324">★★★★★</span> <b>4.9 / 5</b> · Loved by our customers'},styles={'fontSize':'14px','color':'#66715f'}),
        block('row','benefit-row',children=[block('itemList','benefit-'+str(i),{'atomicContent':True},[block('icon','benefit-icon-'+str(i),{'text':glyph},styles={'fontSize':'20px','width':'fit-content'}),block('text','benefit-text-'+str(i),{'html':label},styles={'fontSize':'14px','color':'#17241c'})],styles={'display':'flex','flexDirection':'row','alignItems':'center','gap':'8px','width':'fit-content'}) for i,(glyph,label) in enumerate([('✂','Laser cut'),('✓','No marks'),('✦','Comfort all day')])],styles={'display':'flex','flexDirection':'row','gap':'24px','flexWrap':'wrap'}),
        block('button','legacy-button',{'text':'Explore ↗','href':'https://example.com'},styles={'paddingTop':'12px','paddingBottom':'12px','paddingLeft':'20px','paddingRight':'20px','backgroundColor':'#17241c','color':'#ffffff','width':'fit-content'}),
        block('list','legacy-list',{'items':'Free shipping\nEasy returns'},styles={'fontSize':'14px'}),
    ],styles={'display':'flex','flexDirection':'column','gap':'24px','paddingTop':'32px','paddingBottom':'32px','paddingLeft':'32px','paddingRight':'32px','backgroundColor':'#ffffff','width':'100%'})])
    created=api('/stores/demo/pages','POST',{'document':legacy})
    assert api('/pages/'+created['id'])['document']['nodes'][0]['children'][1]['kind']=='text'
    def open_page():
        page.goto(f['base']);page.get_by_role('button',name='Manage pages',exact=True).first.click();page.locator('.page-table-row[data-page-id="'+created['id']+'"]').get_by_role('button',name='Edit',exact=True).click();expect(page.get_by_label('Page name',exact=True)).to_be_visible()
    open_page();node=lambda id:page.locator('[data-node-id="'+id+'"]')
    menu=node('legacy-menu');expect(menu).to_have_attribute('data-kind','row');expect(menu.locator(':scope > .editor-block[data-kind=text]')).to_have_count(3)
    proof=node('legacy-proof');expect(proof).to_have_attribute('data-kind','row');expect(proof.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(5);expect(proof.locator(':scope > .editor-block[data-kind=text]')).to_have_count(1)
    icons=proof.locator(':scope > .editor-block[data-kind=icon]');star_ids=icons.evaluate_all('els=>els.map(el=>el.dataset.nodeId)');icons.nth(2).click();expect(page.locator('.inspector-heading')).to_contain_text('Icon')
    page.get_by_label('Text colour',exact=True).fill('#ff0000');page.get_by_label('Text colour',exact=True).press('Tab');expect(node(star_ids[2])).to_have_css('color','rgb(255, 0, 0)');expect(node(star_ids[1])).to_have_css('color','rgb(229, 163, 36)')
    page.get_by_role('button',name='Icon ♡',exact=True).click();expect(node(star_ids[2])).to_contain_text('♡');expect(node(star_ids[1])).to_contain_text('★')
    node(star_ids[2]).focus();page.keyboard.press('Control+x');expect(proof.locator(':scope > .editor-block[data-kind=icon]')).to_have_count(4);page.keyboard.press('Control+v');expect(node(star_ids[2])).to_be_visible(timeout=20000)
    menu.locator(':scope > .editor-block[data-kind=text]').nth(1).click();page.get_by_label('Text content',exact=True).fill('Our company');expect(menu.locator(':scope > .editor-block[data-kind=text]').first).to_contain_text('Shop')
    menu.focus();page.get_by_label('Gap',exact=True).fill('30');page.get_by_label('Gap',exact=True).press('Tab');expect(menu).to_have_css('gap','30px')
    print('PASS: old proof/menu migrate to independent boxes; a single star changes colour/glyph, cuts/pastes and menu labels/gap edit independently',flush=True)
    node('benefit-icon-0').click();page.get_by_role('button',name='Upload / choose custom icon',exact=True).click()
    svg=b'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#7a42e8" d="M16 2 30 30H2z"/></svg>'
    page.locator('.library input[type=file][accept*="image/png"]').set_input_files({'name':'custom-icon.svg','mimeType':'image/svg+xml','buffer':svg})
    asset=page.locator('.media-grid article').filter(has_text='custom-icon.svg');expect(asset).to_be_visible(timeout=20000);asset.locator('button').first.click();expect(node('benefit-icon-0').locator('img.custom-icon')).to_be_visible()
    page.wait_for_function("()=>document.querySelector('[data-node-id=benefit-icon-0] img')?.naturalWidth>0")
    page.get_by_label('Use icon colour',exact=True).check();page.get_by_label('Text colour',exact=True).fill('#00aa66');page.get_by_label('Text colour',exact=True).press('Tab');expect(node('benefit-icon-0').locator('.icon-mask')).to_have_css('background-color','rgb(0, 170, 102)');page.get_by_label('Use icon colour',exact=True).uncheck()
    expect(node('benefit-text-0')).to_contain_text('Laser cut');node('benefit-text-0').click();page.get_by_label('Text content',exact=True).fill('Precision cut');expect(node('benefit-icon-0').locator('img')).to_be_visible()
    node('legacy-button').focus();expect(node('legacy-button').locator('.editor-block[data-kind=icon]')).to_have_count(1);expect(node('legacy-button').locator('.editor-block[data-kind=text]')).to_have_count(1);expect(page.get_by_label('Link',exact=True)).to_have_value('https://example.com')
    node('benefit-row').focus();page.screenshot(path=str(out/'atomic-item-list.png'))
    page.get_by_role('button',name='Save',exact=True).click();expect(page.locator('.save-indicator')).to_contain_text('Saved',timeout=20000)
    saved=api('/pages/'+created['id'])['document'];open_page();expect(node('legacy-menu')).to_contain_text('Our company');expect(node(star_ids[2])).to_have_css('color','rgb(255, 0, 0)');expect(node('benefit-icon-0').locator('img')).to_be_visible()
    node('legacy-proof').focus();page.screenshot(path=str(out/'atomic-review-row.png'))
    page.get_by_role('button',name='Page',exact=True).click();page.get_by_label('SEO slug',exact=True).fill('atomic-preview');page.get_by_role('button',name='Save SEO and update publication',exact=True).click();expect(page.locator('[data-seo-publication]')).to_be_visible(timeout=20000)
    visitor=f['browser'].new_context(viewport={'width':1440,'height':900});public=visitor.new_page();public.on('pageerror',lambda e:errors.append(str(e)));public.goto(f['base']+'/p/demo/atomic-preview')
    expect(public.locator('[data-block=benefit-icon-0] img.custom-icon')).to_be_visible();public.wait_for_function("()=>document.querySelector('[data-block=benefit-icon-0] img')?.naturalWidth>0")
    expect(public.locator('[data-block=legacy-menu]')).to_contain_text('Our company');expect(public.locator('[data-block="'+star_ids[2]+'"]').first).to_have_css('color','rgb(255, 0, 0)')
    expect(public.locator('[data-block=legacy-button] a')).to_have_attribute('href','https://example.com')
    for width in [1440,820,390,320]:
        public.set_viewport_size({'width':width,'height':900});assert public.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
    assert not errors,errors
    (out/'atomic-validation.json').write_text(json.dumps({'version':'0.6.0','checks':['legacy-migration','individual-stars','icon-colour','icon-glyph','icon-cut-paste','menu-labels','menu-gap','item-list-boxes','custom-SVG','button-parts','save-reopen','public-SVG','public-structure','responsive'],'pageErrors':errors},indent=2))
    print('PASS: separate item-list icon/text, real custom SVG replacement, button parts, saved/reopened graph and published responsive page',flush=True)
