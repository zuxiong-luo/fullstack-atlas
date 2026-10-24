import type {ReactNode} from 'react';
export default function RootLayout({children}:{children:ReactNode}){return <html lang="zh-CN"><body style={{fontFamily:'system-ui',maxWidth:850,margin:'auto',padding:20}}><header>next-production</header>{children}</body></html>;}
