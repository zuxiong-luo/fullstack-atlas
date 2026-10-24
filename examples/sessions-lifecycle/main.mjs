import { startApp } from './server.mjs';
import { send,cookiePair } from './client.mjs';
const app=await startApp();
try {
  const login=await send(app,'/login',{method:'POST',body:{user:'alice',password:'classroom-only-42'}});
  // Only print business behavior, not reusable cookies, JWTs, CSRF values or private keys.
  console.log('login',login.status);
  console.log('own note',(await send(app,'/notes/1',{cookie:cookiePair(login)})).status);
  console.log('other user note',(await send(app,'/notes/2',{cookie:cookiePair(login)})).status);
  console.log('logout',(await send(app,'/logout',{method:'POST',cookie:cookiePair(login),csrf:login.body.csrfToken})).status);
  console.log('old cookie',(await send(app,'/me',{cookie:cookiePair(login)})).status);
} finally {await app.close();}
