import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const dir of ['desktop','windows-desktop']){
 const handlers={},opened=[];let popup,loaded;
 const shell={openExternal:async url=>opened.push(url)};
 const win={loadURL:url=>loaded=url,webContents:{setWindowOpenHandler:fn=>popup=fn,on:(event,fn)=>handlers[event]=fn}};
 function BrowserWindow(){return win;}BrowserWindow.getAllWindows=()=>[win];
 const app={whenReady:()=>({then:fn=>fn()}),on:()=>{},quit:()=>{}};
 vm.runInNewContext(fs.readFileSync(new URL(`../${dir}/main.js`,import.meta.url),'utf8'),{require:()=>({app,BrowserWindow,shell}),URL,process:{platform:'win32'}});
 assert.equal(loaded,'https://jornada.wcaio.workers.dev');
 for(const url of ['file:///etc/passwd','javascript:alert(1)','custom:launch','not a url'])assert.equal(popup({url}).action,'deny');
 assert.equal(opened.length,0);
 popup({url:'https://example.org/'});assert.equal(opened.length,1);
 let blocked=false;handlers['will-navigate']({preventDefault:()=>blocked=true},'https://example.org/');assert(blocked);
 blocked=false;handlers['will-navigate']({preventDefault:()=>blocked=true},loaded+'/');assert(!blocked);
}
console.log('OK: ambos os instaladores usam domínio atual, bloqueiam protocolos arbitrários e navegação externa.');
