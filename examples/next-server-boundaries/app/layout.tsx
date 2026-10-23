import Link from 'next/link';
import type {ReactNode} from 'react';
export default function Layout({children}:{children:ReactNode}){
 return <html lang="zh-CN"><body style={{fontFamily:'system-ui',maxWidth:850,margin:'32px auto',padding:20,lineHeight:1.8}}>
  <nav style={{display:'flex',gap:24}}><Link href="/" prefetch={false}>首页</Link><Link href="/account" prefetch={false}>账户页</Link></nav>
  {children}
 </body></html>;
}
