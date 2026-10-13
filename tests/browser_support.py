"""Isolated real-Chromium fixture; never uses owner/store/provider credentials."""
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
import os, secrets, signal, socket, subprocess, time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
@contextmanager
def browser_fixture(lose_upload_response=False, netlify=False):
    with TemporaryDirectory(prefix='fukpages-browser-review-') as temp:
        password = secrets.token_urlsafe(32)
        hashed = subprocess.run(['node','--input-type=module','-e',"import {hashPassword} from './server/auth.mjs';let p='';for await(const c of process.stdin)p+=c;process.stdout.write(hashPassword(p));"],cwd=ROOT,input=password,text=True,capture_output=True,check=True).stdout
        with socket.socket() as sock: sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        env=dict(os.environ,PORT=str(port),DATA_DIR=temp,OWNER_PASSWORD_HASH=hashed,NODE_ENV='test',OWNER_LOGIN='owner',SHOPIFY_SHOP_DOMAIN='',SHOPIFY_ADMIN_ACCESS_TOKEN='',FUKPAGES_AI_API_KEY='',FORM_WEBHOOK_URL='',FORM_WEBHOOK_SECRET='')
        if netlify:
            env.pop('OWNER_PASSWORD_HASH',None)
            env['FUKPAGES_DEMO_PASSWORD']=password
        with open(Path(temp)/'server.log','w') as logs:
            server=subprocess.Popen(['node','tests/serve-netlify-demo.mjs' if netlify else 'tests/serve-browser-review.mjs' if lose_upload_response else 'server/index.mjs'],cwd=ROOT,env=env,stdout=logs,stderr=logs,start_new_session=True)
            try:
                base=f'http://127.0.0.1:{port}'
                for _ in range(100):
                    try:
                        if urlopen(base+'/api/health',timeout=1).status==200:break
                    except Exception: time.sleep(.1)
                else: raise AssertionError('Temporary server failed to start')
                with sync_playwright() as p:
                    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
                    owner=browser.new_context(viewport={'width':1680,'height':1050})
                    login=owner.request.post(base+'/api/auth/login',data={'login':'owner','password':password});assert login.status==200
                    csrf=login.json()['csrf']
                    def api(path,method='GET',body=None):
                        args={'method':method,'headers':{'X-CSRF-Token':csrf}}
                        if body is not None: args['data']=body
                        r=owner.request.fetch(base+'/api'+path,**args)
                        assert r.status<400,(path,r.status,r.text())
                        return r.json() if r.status!=204 else None
                    def upload(bytes,name,kind='image',extra=None):
                        r=owner.request.post(base+'/api/stores/demo/assets',headers={'X-CSRF-Token':csrf},multipart={'type':kind,'files':{'name':name,'mimeType':'application/octet-stream','buffer':bytes},**(extra or {})})
                        assert r.status==201,r.text()
                        return r.json()['results'][0]['asset']
                    yield dict(base=base,browser=browser,owner=owner,api=api,upload=upload,temp=Path(temp))
                    browser.close()
            finally: os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10)

def block(kind,id,props=None,children=None,styles=None):
    return dict(kind=kind,id=id,name=id,props=props or {},children=children or [],styles=dict(desktop=styles or {},tablet={},mobile={}),hidden=dict(desktop=False,tablet=False,mobile=False))
def document(name,nodes): return dict(schemaVersion=1,type='landing',name=name,nodes=nodes)
def open_editor(page,base,name):
    page.goto(base)
    page.get_by_role('button',name='Sayfaları yönet',exact=True).first.click()
    page.locator('.page-table-row').filter(has_text=name).get_by_role('button',name='Düzenle',exact=True).click()
    expect(page.get_by_label('Sayfa adı')).to_be_visible()
