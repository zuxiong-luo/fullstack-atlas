import {useMemo, type ReactNode} from 'react';
import Prism from 'prismjs';
import './code-theme.css';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-flow';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-glsl';
import 'prismjs/components/prism-docker';
function renderTokens(tokens: (string|Prism.Token)[]):ReactNode[]{
 return tokens.map((t,i)=>typeof t==='string'?t:<span key={i} className={'token '+t.type}>{typeof t.content==='string'?t.content:renderTokens(Array.isArray(t.content)?t.content:[t.content])}</span>);
}
export default function HighlightedCode({code,language}:{code:string;language:string}){
 const lang=({js:'javascript',ts:'typescript',sh:'bash',shell:'bash',py:'python',html:'markup',dockerfile:'docker'} as Record<string,string>)[language]||language;
 const content=useMemo(()=>Prism.languages[lang]?renderTokens(Prism.tokenize(code,Prism.languages[lang])):code,[code,lang]);
 return <code className={'syntax-code language-'+lang}>{content}</code>;
}
