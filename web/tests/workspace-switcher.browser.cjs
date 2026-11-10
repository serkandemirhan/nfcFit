const {launch,login}=require('./trainer-browser-fixture.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../test-results/workspace-switcher');
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
(async()=>{
 const env=await launch(); const p=env.page; const checks=[];
 try {
  await login(p,'owner@planning.test');
  const nav=p.getByRole('navigation',{name:'Çalışma alanı',exact:true});
  const check=async(name,active)=>{
   await nav.waitFor(); assert.equal(await nav.count(),1);
   assert.equal(await nav.getByRole('button',{name:active,exact:true}).getAttribute('aria-pressed'),'true');
   const box=await nav.locator('.workspace-switcher-control').boundingBox();
   assert(Math.abs(box.x+box.width/2-p.viewportSize().width/2)<2,'Switcher must be centered');
   assert(box.y<35,'Switcher must be at the top');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
   for(const button of await nav.getByRole('button').all()) assert((await button.boundingBox()).height>=40);
   await p.screenshot({path:path.join(out,'screenshots',name+'.png')}); checks.push({name,status:'PASS'});
  };
  await p.locator('.nfc-facility').waitFor();
  await check('01-desktop-facility','Tesis yönetimi');
  await p.getByRole('button',{name:'Menüyü daralt',exact:true}).click();
  await check('02-desktop-facility-collapsed','Tesis yönetimi');
  await nav.getByRole('button',{name:'Antrenör alanı',exact:true}).click();
  await p.locator('.trainer-area').waitFor(); await check('03-desktop-trainer','Antrenör alanı');
  await p.setViewportSize({width:375,height:812}); await check('04-mobile-trainer','Antrenör alanı');
  await nav.getByRole('button',{name:'Tesis yönetimi',exact:true}).click();
  await p.locator('.nfc-facility').waitFor(); await check('05-mobile-facility','Tesis yönetimi');
  await p.getByRole('button',{name:'Menüyü aç',exact:true}).click();
  const drawer=p.getByRole('dialog',{name:'Tesis menüsü'}); await drawer.waitFor();
  assert.equal(await drawer.getByRole('navigation',{name:'Çalışma alanı',exact:true}).count(),0);
  await drawer.getByRole('button',{name:'Üyeler',exact:true}).click();
  await drawer.waitFor({state:'hidden'});await p.getByRole('heading',{name:'Üyeler',exact:true,level:1}).waitFor();
  await check('06-mobile-members','Tesis yönetimi');
  await p.setViewportSize({width:1440,height:900});await login(p,'manager@planning.test');
  await p.locator('.nfc-facility').waitFor();assert.equal(await nav.count(),0);
  assert.equal(await p.getByRole('button',{name:'Abonelik ve ayarlar',exact:true}).count(),0);
  checks.push({name:'Manager permissions preserved; no unavailable workspace switch',status:'PASS'});
  assert.deepEqual(env.errors,[]);checks.push({name:'No uncaught browser errors',status:'PASS'});
  fs.writeFileSync(path.join(out,'functional-results.json'),JSON.stringify({checks,errors:env.errors},null,2));console.log(checks);
 } finally {await env.browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
