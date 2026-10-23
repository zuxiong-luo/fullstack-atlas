const {spawn}=require('node:child_process');const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const path=require('node:path');
const packageRoot=path.dirname(require.resolve('electron/package.json'));
const {readFileSync,existsSync}=require('node:fs');
const pathFile=path.join(packageRoot,'path.txt');
if(!existsSync(pathFile)){console.error('Electron runtime missing. Run npx electron --version to finish the official runtime download, then retry npm run smoke.');process.exit(2);}
const executable=path.join(packageRoot,'dist',readFileSync(pathFile,'utf8'));
if(!existsSync(executable)){console.error('Electron executable is missing; reinstall the official runtime.');process.exit(2);}
const dir=mkdtempSync(path.join(tmpdir(),'electron-real-smoke-'));
const child=spawn(executable,['.','--smoke'],{cwd:path.join(__dirname,'..'),env:{...process.env,ELECTRON_SMOKE_DIR:dir},stdio:'inherit'});
const timer=setTimeout(()=>{console.error('Electron smoke timed out');child.kill('SIGTERM');},45000);
child.on('exit',code=>{clearTimeout(timer);console.log('Smoke screenshot (temporary): '+path.join(dir,'window.png'));if(code!==0)process.exitCode=code||1;});
