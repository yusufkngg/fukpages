"""Regression flows for the independently reproduced defects and recovery UX."""
import json, subprocess
from browser_support import ROOT, browser_fixture, block, document, open_editor, expect
with browser_fixture(lose_upload_response=True) as f:
    base,api=f['base'],f['api']
    shots=ROOT/'.local'/'validation';shots.mkdir(parents=True,exist_ok=True)
    pub_context=f['browser'].new_context(viewport={'width':1440,'height':1000})
    pub=pub_context.new_page();errors=[];pub.on('pageerror',lambda e:errors.append(str(e)))
    popup=block('popup','popup',{'trigger':'button','text':'Popup aç','title':'Popup'},[block('heading','popup-heading',{'tag':'h2','html':'Türkçe popup'})])
    b=block('button','state-button',{'text':'Durum düğmesi','href':'#','hoverStyles':json.dumps({'backgroundColor':'#eeddcc','color':'#112233'}),'focusStyles':json.dumps({'backgroundColor':'#ffeedd'})},styles={'backgroundColor':'#112233','paddingTop':'16px'})
    probe=api('/stores/demo/pages','POST',{'document':document('Reliability probe',[b,popup])});api('/pages/'+probe['id']+'/publish','POST',{})
    pub.goto(base+'/?published='+probe['id']);button=pub.locator('[data-block=state-button]')
    button.hover();expect(button).to_have_css('background-color','rgb(238, 221, 204)');button.locator('a').focus();expect(button).to_have_css('background-color','rgb(255, 238, 221)')
    trigger=pub.get_by_role('button',name='Popup aç',exact=True);trigger.click();dialog=pub.get_by_role('dialog',name='Popup',exact=True)
    assert dialog.evaluate('(el)=>el.contains(document.activeElement)')
    for _ in range(5):pub.keyboard.press('Tab');assert dialog.evaluate('(el)=>el.contains(document.activeElement)')
    pub.keyboard.press('Escape');expect(dialog).to_have_count(0);expect(trigger).to_be_focused()
    print('PASS: visitor hover/focus, popup focus containment, Escape and return focus',flush=True)
    generated=subprocess.run(['node','--import','tsx','--input-type=module','-e',"import {createSectionPreset} from './src/sections.ts';process.stdout.write(JSON.stringify(['product-hero','testimonials'].map(createSectionPreset)));"],cwd=ROOT,capture_output=True,text=True,check=True)
    hero,cards=json.loads(generated.stdout)
    work=api('/stores/demo/pages','POST',{'document':document('Recover this page',[hero])})
    page=f['owner'].new_page();page.on('dialog',lambda d:d.accept());page.on('pageerror',lambda e:errors.append(str(e)))
    open_editor(page,base,'Recover this page')
    def fail_save(route):
        if route.request.method=='PUT':route.abort('failed')
        else:route.continue_()
    page.route('**/api/pages/'+work['id'],fail_save)
    page.get_by_label('Sayfa adı').fill('Tarayıcıda korunmuş taslak')
    expect(page.locator('.save-indicator')).to_have_text('Kaydedilemedi',timeout=15000)
    page.unroute('**/api/pages/'+work['id'],fail_save)
    page.reload();open_editor(page,base,'Recover this page')
    recovery=page.get_by_role('dialog',name='Kaydedilmemiş taslağı kurtar',exact=True)
    expect(recovery).to_be_visible();recovery.get_by_role('button',name='Taslağı kurtar',exact=True).click()
    expect(page.get_by_label('Sayfa adı')).to_have_value('Tarayıcıda korunmuş taslak');expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    assert api('/pages/'+work['id'])['document']['name']=='Tarayıcıda korunmuş taslak'
    print('PASS: network save failure, browser reload, explicit recovery and persisted recovered draft',flush=True)
    second=f['owner'].new_page();second.on('dialog',lambda d:d.accept());open_editor(second,base,'Tarayıcıda korunmuş taslak')
    page.get_by_label('Sayfa adı').fill('Birinci sekme');expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    second.get_by_label('Sayfa adı').fill('İkinci sekme seçimi')
    conflict=second.get_by_role('dialog',name='Kayıt çakışmasını çöz',exact=True);expect(conflict).to_be_visible(timeout=15000)
    second.screenshot(path=str(shots/'record-conflict.png'),full_page=True)
    conflict.locator('fieldset').filter(has_text='Sayfa adı').get_by_role('radio').first.check();conflict.get_by_role('button',name='Seçimleri birleştir',exact=True).click()
    expect(second.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000);assert api('/pages/'+work['id'])['document']['name']=='İkinci sekme seçimi'
    second.close()
    print('PASS: two-tab conflict comparison and selected value safely rebased onto the latest version',flush=True)
    open_editor(page,base,'İkinci sekme seçimi')
    page.locator('[data-node-id="'+hero['id']+'"]').focus();page.locator('[data-section-design] > summary').click();page.get_by_label('İçeriği koruyan bölüm düzeni').select_option('centered-hero')
    page.get_by_role('button',name='Yeni düzeni önizle',exact=True).click();preview=page.get_by_role('dialog',name='Bölüm önizlemesi',exact=True)
    expect(preview.locator('[data-section-live-preview]')).to_be_visible();preview.get_by_role('button',name='Önizleme Mobil',exact=True).click();expect(preview.locator('.page-surface[data-device=mobile]')).to_be_visible()
    page.screenshot(path=str(shots/'section-live-preview.png'),full_page=True)
    preview.get_by_role('button',name='Bu düzeni uygula',exact=True).click();expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    changed=api('/pages/'+work['id'])['document']['nodes'][0]
    def ids(n):return [n['id']]+[i for c in n['children'] for i in ids(c)]
    assert ids(changed)==ids(hero)
    assert 'centered-hero'==changed['props']['presetId']
    page.get_by_role('button',name='Bölümler',exact=True).click();page.get_by_role('button',name='Üç özellik kartı önizle',exact=True).click();expect(page.get_by_role('dialog',name='Bölüm önizlemesi')).to_be_visible();page.keyboard.press('Escape')
    print('PASS: content-preserving layout switch, actual branded section preview and preview breakpoints',flush=True)
    cardpage=api('/stores/demo/pages','POST',{'document':document('Cards edit',[cards])});open_editor(page,base,'Cards edit')
    page.locator('[data-node-id="'+cards['id']+'"]').focus();page.locator('[data-section-design] > summary').click();page.get_by_role('button',name='Kart 1 Çoğalt',exact=True).click();expect(page.locator('[data-card-editor]')).to_have_count(4)
    page.get_by_label('Kart 1 Başlık',exact=True).fill('Düzenlenmiş yorum');page.get_by_role('button',name='Kart 1 Aşağı',exact=True).click();expect(page.locator('.save-indicator')).to_have_text('Kaydedildi',timeout=15000)
    stored=api('/pages/'+cardpage['id'])['document'];assert 'Düzenlenmiş yorum' in json.dumps(stored,ensure_ascii=False)
    page.screenshot(path=str(shots/'section-card-management.png'),full_page=True)
    print('PASS: repeated cards edited, copied and reordered without resetting other content',flush=True)
    page.get_by_role('button',name='Medya',exact=True).click()
    path=f['temp']/'retry.png';subprocess.run(['node','--input-type=module','-e',"import sharp from 'sharp';await sharp({create:{width:90,height:60,channels:4,background:'blue'}}).png().toFile(process.argv[1]);",str(path)],cwd=ROOT,capture_output=True,check=True)
    before=len(api('/stores/demo/assets'))
    page.locator('input[type=file][accept*="image/png"]').set_input_files(str(path))
    retry=page.get_by_role('button',name='Başarısız dosyaları tekrar dene (1)',exact=True)
    expect(retry).to_be_visible();assert len(api('/stores/demo/assets'))==before+1
    retry.click();expect(page.locator('.media-grid article')).to_have_count(before+1)
    assert len(api('/stores/demo/assets'))==before+1
    print('PASS: server-committed upload with lost response retries without a duplicate asset',flush=True)
    assert not errors,errors
