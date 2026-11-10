const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(file,stubs={}){file=path.resolve(__dirname,'..',file);const mod=new Module(file,module);mod.require=id=>Object.hasOwn(stubs,id)?stubs[id]:id.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),id.endsWith('.js')?id.replace(/\.js$/,'.ts'):id+'.ts')),stubs):require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return mod.exports;}
function response(){return {code:null,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;},setHeader(){}};}
function fixture(user={id:'verified-user',email_confirmed_at:'2026-11-08'}){let clients=[];const client={auth:{getUser:async()=>({data:{user},error:user?null:new Error('invalid')})}};const module=load('api/_supabase.ts',{'@supabase/supabase-js':{createClient:(...args)=>{clients.push(args);return client;}}});return {client,clients,...module};}
test('legacy endpoints never construct a service client without a bearer identity',async()=>{const f=fixture(),res=response();assert.equal(await f.getSupabase({headers:{}},res),null);assert.equal(res.code,401);assert.equal(f.clients.length,0);});
test('verified requests use the public key plus caller JWT so database RLS remains active',async()=>{process.env.SUPABASE_URL='https://project.test';process.env.SUPABASE_ANON_KEY='public-key';process.env.SUPABASE_SERVICE_ROLE_KEY='must-never-be-used';const f=fixture(),res=response();assert.equal(await f.getSupabase({headers:{authorization:'Bearer caller-session'}},res),f.client);assert.equal(f.clients[0][1],'public-key');assert.equal(f.clients[0][2].global.headers.Authorization,'Bearer caller-session');assert.equal(f.clients[0][2].auth.persistSession,false);});
test('invalid and unverified sessions cannot reach protected legacy records',async()=>{for(const [user,status] of [[null,401],[{id:'unverified'},403]]){const f=fixture(user),res=response();assert.equal(await f.getSupabase({headers:{authorization:'Bearer rejected'}},res),null);assert.equal(res.code,status);}});
test('every protected legacy route stops before database or password mutation when session validation fails',async()=>{for(const route of ['users/index.ts','users/[id]/index.ts','users/[id]/password.ts','cards/index.ts','tasks/index.ts','tasks/[id]/index.ts','tasks/[id]/complete.ts','locations/index.ts','layouts/index.ts']){const f=fixture();let reads=0;const handler=load('api/'+route,{'../_supabase.js':{...f,getSupabase:async(req,res)=>{res.status(401).json({error:'Unauthorized'});return null;}},'../../_supabase.js':{...f,getSupabase:async(req,res)=>{res.status(401).json({error:'Unauthorized'});return null;}}}).default;const res=response();await handler({method:['cards/index.ts','locations/index.ts','layouts/index.ts'].includes(route)?'GET':'POST',headers:{},query:{id:'unrelated-user'},text:async()=>{reads++;return '{}';}},res);assert.equal(res.code,401,route);assert.equal(reads,0,route);assert.equal(f.clients.length,0,route);}});

// Exercise the real Node ESM loader used by deployed functions.
test('compiled legacy task handlers load in Node ESM and deny requests before querying data',async()=>{
 const os=require('node:os'),{pathToFileURL}=require('node:url');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nfcfit-esm-'));
 try{
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({type:'module'}));
  fs.symlinkSync(path.resolve(__dirname,'../node_modules'),path.join(temp,'node_modules'),'dir');
  for(const relative of ['api/_supabase.ts','api/tasks/index.ts','api/tasks/[id]/complete.ts','lib/status.ts','types.ts']){
   const target=path.join(temp,relative.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  for(const entry of ['api/tasks/index.js','api/tasks/[id]/complete.js']){
   const handler=(await import(pathToFileURL(path.join(temp,entry)).href)).default;const res=response();
   await handler({method:entry.includes('/complete.')?'POST':'GET',headers:{},query:{id:'unrelated'}},res);assert.equal(res.code,401,entry);
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
