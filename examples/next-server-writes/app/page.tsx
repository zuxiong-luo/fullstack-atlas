import {randomUUID} from 'node:crypto';
import {requireUser} from '../lib/auth';
import {listNotes} from '../lib/store';
import {Failure} from '../lib/errors';
import {saveNote} from './actions';
import Login from './Login';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 let owner:null|'alice'|'bob'=null;
 try{owner=await requireUser();}catch(error){if(!(error instanceof Failure))throw error;}
 const notes=owner?await listNotes(owner):[];const query=await searchParams;
 const errors:Record<string,string>={AUTH_REQUIRED:'请先登录',BAD_NOTE:'输入不符合约定',KEY_REUSED:'提交键已用于不同内容',CROSS_SITE:'拒绝跨站提交',UNAVAILABLE:'服务暂不可用'};
 const message=typeof query.error==='string'?(errors[query.error]??'提交失败'):query.saved?'笔记已保存':'';
 return <><h1>服务端写入实验</h1><p>当前用户：{owner??'未登录'}</p><Login/>
 <p role="status">{message}</p><form action={saveNote}><label>标题<input name="title" required maxLength={80}/></label>
 <input type="hidden" name="key" value={randomUUID()}/><button>保存笔记</button></form>
 <ul>{notes.map(note=><li key={note.id}>{note.title}</li>)}</ul></>;
}
