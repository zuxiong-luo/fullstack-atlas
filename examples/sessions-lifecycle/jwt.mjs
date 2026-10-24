import { randomBytes,createHmac,timingSafeEqual } from 'node:crypto';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const decode=segment=>{
  if(!/^[A-Za-z0-9_-]+$/.test(segment))throw new Error('JWT_INVALID');
  const bytes=Buffer.from(segment,'base64url');
  if(bytes.toString('base64url')!==segment)throw new Error('JWT_INVALID');
  return JSON.parse(bytes.toString('utf8'));
};
export function createTokens({key=randomBytes(32),now=Date.now}={}) {
  if(!Buffer.isBuffer(key)||key.length<32)throw new Error('strong server key required');
  const secret=Buffer.from(key),revoked=new Map();
  const mac=input=>createHmac('sha256',secret).update(input).digest();
  const seconds=()=>Math.floor(now()/1000);
  function prune() { for(const [id,expiry] of revoked)if(expiry<=seconds())revoked.delete(id); }
  function issue(sub) {
    prune();
    if(!['alice','bob'].includes(sub))throw new Error('JWT_INVALID');
    const iat=seconds();
    const claims={iss:'atlas-session-lab',aud:'atlas-notes',sub,iat,exp:iat+30,jti:randomBytes(16).toString('base64url')};
    const input=encode({alg:'HS256',typ:'JWT'})+'.'+encode(claims);
    return input+'.'+mac(input).toString('base64url');
  }
  function verify(token) {
    prune();
    if(typeof token!=='string'||token.length>4096)throw new Error('JWT_INVALID');
    const parts=token.split('.');
    if(parts.length!==3)throw new Error('JWT_INVALID');
    const [h,p,s]=parts,header=decode(h);
    if(Object.keys(header??{}).sort().join(',')!=='alg,typ'||header?.alg!=='HS256'||header?.typ!=='JWT')throw new Error('JWT_INVALID');
    if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('JWT_INVALID');
    const signature=Buffer.from(s,'base64url'),expected=mac(h+'.'+p);
    if(signature.toString('base64url')!==s||signature.length!==expected.length||!timingSafeEqual(signature,expected))throw new Error('JWT_INVALID');
    const claims=decode(p),current=seconds();
    if(claims?.iss!=='atlas-session-lab'||claims?.aud!=='atlas-notes'||
       !['alice','bob'].includes(claims?.sub)||
       !Number.isSafeInteger(claims?.iat)||!Number.isSafeInteger(claims?.exp)||
       claims.iat>current||claims.exp<=current||claims.exp<=claims.iat||claims.exp-claims.iat>30||
       typeof claims.jti!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(claims.jti)||revoked.has(claims.jti))throw new Error('JWT_INVALID');
    return claims;
  }
  function revoke(token) { const claims=verify(token);revoked.set(claims.jti,claims.exp); }
  return {issue,verify,revoke};
}
