import {ArrowUpRight, ArrowDown, Moon, Sun} from 'lucide-react';
import FontSizeControl from './FontSizeControl';
import './personal-home.css';

export default function PersonalHome({theme,onToggleTheme}:{theme:string;onToggleTheme:()=>void}) {
  return <div className="personal-home">
    <header className="personal-home-header">
      <a href="#home" className="personal-signature" aria-label="祖雄的首页">祖雄<span>的小地方</span><i aria-hidden="true">.</i></a>
      <nav aria-label="首页导航"><a href="#overview">概览</a><a href="#library">文字</a><a href="#profile">关于</a><a href="#guestbook">留言</a></nav>
      <div className="personal-home-tools"><FontSizeControl/><button onClick={onToggleTheme} aria-label="切换明暗主题">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div>
    </header>
    <main className="personal-home-main">
      <section className="personal-welcome">
        <div className="personal-welcome-copy"><p className="personal-kicker">你好，我是祖雄。</p><h1>认真做事，<br/>也给生活<span>留点空白。</span></h1><p className="personal-intro">做过的事，想过的问题，<br/>还有一些尚未完成的想法。<br/>都慢慢放在这里。</p><a className="personal-browse" href="#library">随便看看 <ArrowUpRight size={18}/></a></div>
        <div className="personal-window" aria-hidden="true"><div className="personal-window-sky"><div className="personal-sun"/><div className="personal-hill personal-hill-far"/><div className="personal-hill personal-hill-near"/></div><div className="personal-window-frame"/><div className="personal-window-sill"/><span className="personal-window-caption">留一扇窗，给日常。</span></div>
        <span className="personal-scroll" aria-hidden="true">往下，还有一点 <ArrowDown size={13}/></span>
      </section>
      <section className="personal-note" aria-labelledby="home-note"><span className="personal-section-label">关于这里 / 01</span><div><h2 id="home-note">有些想法，值得留下来。</h2><p>有些东西，想过之后不想就这样忘记。<br/>所以有了这个小地方，用来记录，也用来分享。</p><p className="personal-note-last">不急着写满，慢慢来。</p></div></section>
      <section className="personal-doors" aria-label="随意走走">
        {[{number:'01',title:'文字',description:'一些思考与记录。',href:'#library',note:'读一读'}, {number:'02',title:'作品',description:'把想法慢慢做出来。',href:'#profile',note:'看一看'}, {number:'03',title:'关于',description:'关于我，也关于这里。',href:'#profile',note:'认识一下'}].map(item=><a href={item.href} key={item.number}><span className="personal-door-number">{item.number}</span><h2>{item.title}</h2><p>{item.description}</p><span className="personal-door-link">{item.note}<ArrowUpRight size={18}/></span></a>)}
      </section>
      <section className="personal-goodbye"><span className="personal-goodbye-mark" aria-hidden="true">＊</span><h2>很高兴，你刚好路过这里。</h2><p>如果愿意，也留下一点你的想法。</p><div><a href="#guestbook">留句话 <ArrowUpRight size={15}/></a><a href="#contact">联系我 <ArrowUpRight size={15}/></a></div></section>
    </main>
    <footer className="personal-home-footer"><span>罗祖雄 · 一些记录，一点日常。</span><span>慢慢来，也很好。</span></footer>
  </div>;
}
