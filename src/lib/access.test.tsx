import {afterEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../App';
function render(hash:string,loggedIn=false){vi.stubGlobal('location',{hash});vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('localStorage',{getItem:()=>null});vi.stubGlobal('sessionStorage',{getItem:(key:string)=>loggedIn&&key==='atlas:session'?'luo':null});return renderToStaticMarkup(<App/>)}
afterEach(()=>vi.unstubAllGlobals());
it('hides member navigation and removes learning paths for visitors',()=>{const html=render('#library');expect(html).toContain('<h1>专栏</h1>');const nav=html.match(/<nav>(.*?)<\/nav>/)?.[1]||'';expect(nav).toContain('概览');expect(nav).toContain('专栏');expect(nav).not.toContain('href="#ai"');expect(html).not.toContain('href="#study"');expect(html).not.toContain('href="#offline"');expect(html).not.toContain('href="#workspace"');expect(html).not.toContain('学习路径');expect(html).not.toContain('面试题库')});
it('blocks direct offline access and reveals member navigation after login',()=>{expect(render('#offline')).toContain('登录账号');const member=render('#library',true);expect(member).toContain('href="#offline"');expect(member).toContain('href="#study"');expect(member).toContain('退出登录')});
it('keeps direct study links gated while public article content is accessible',()=>{expect(render('#q/oauth')).not.toContain('一分钟回答');expect(render('#article/oauth-login')).toContain('OAuth')});

it('separates guestbook discussions from contact details',()=>{const contact=render('#contact');expect(contact).toContain('给我发邮件');expect(contact).not.toContain('comments-panel');const guestbook=render('#guestbook');expect(guestbook).toContain('comments-panel');expect(guestbook).not.toContain('给我发邮件');expect(guestbook).toContain('GitHub Discussions')});
