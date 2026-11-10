const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_PATH?{executablePath:process.env.PLAYWRIGHT_CHROME_PATH}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://nfc-fit.vercel.app/console',{waitUntil:'domcontentloaded'});
 await page.getByLabel('E-posta',{exact:true}).waitFor();
 const out=path.resolve(__dirname,'../../test-results/exercise-media');
 await page.screenshot({path:path.join(out,'screenshots/09-production-login-desktop.png')});
 await page.setViewportSize({width:375,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(out,'screenshots/10-production-login-mobile.png')});assert.equal(errors.length,0);
 fs.writeFileSync(path.join(out,'production-browser-results.json'),JSON.stringify({url:page.url(),login_form_visible:true,mobile_overflow:false,page_errors:errors,authenticated_production_workflow_tested:false},null,2));
 await browser.close();console.log('PASS production login renders at desktop and 375px; no page errors');
})().catch(e=>{console.error(e);process.exitCode=1});
