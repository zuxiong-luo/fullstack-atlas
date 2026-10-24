'use client';
import {useState} from 'react';
export default function Title(){const [clicks,setClicks]=useState(0);return <section><h2>公开构建标题：{process.env.NEXT_PUBLIC_SITE_TITLE??'unset'}</h2><button onClick={()=>setClicks(n=>n+1)}>客户端计数 {clicks}</button></section>;}
