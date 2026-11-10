const {api}=require('./trainer-browser-fixture.cjs');
const {createHash,randomUUID}=require('crypto');const fs=require('fs');
const actor='trainer@planning.test';const stable=s=>{const h=createHash('sha256').update('nfcfit-density:'+s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
(async()=>{
 const before=await api(actor,'/coaching/overview'), catalog=await api(actor,'/coaching/library');
 const original=before.plans.find(p=>!p.athlete_id&&p.content.name==='Kuvvet ve Denge · Ada');if(!original)throw Error('Original isolated source missing');
 const names=['Temel Kuvvet · Başlangıç','Tüm Vücut · Adaptasyon','Üst Alt · Dengeli Gelişim','Hareket Kalitesi · Mobilite','Hipertrofi · Üst Gövde','Koşuya Destek · Kuvvet','Fonksiyonel Güç · Denge','Alt Gövde · Temel','Gövde Stabilitesi · Kontrol','Sporcu Hazırlık · Kuvvet','İleri Kuvvet · Dört Hafta','Dambıl · Tüm Vücut','Direnç Bandı · Başlangıç','Dayanıklılık · İstasyon','Sırt ve Postür · Destek','Kontrollü Dönüş · Adaptasyon','Kuvvet Sürekliliği · Orta','Teknik Gelişim · Temel','Güç ve Kondisyon · Kombine','Kişisel Hedef · Performans'];
 const programs=[];
 for(let i=0;i<names.length;i++){
  const id=stable('program:'+i);let p=before.plans.find(p=>p.id===id);
  if(!p){const c=structuredClone(original.content);c.name=names[i];c.goal=['Kuvvet gelişimi','Kas dayanıklılığı','Hareket kalitesi','Genel kondisyon'][i%4];c.difficulty=['beginner','intermediate','advanced'][i%3];c.planning_status=i%4===0?'draft':'published';c.days.forEach(d=>{d.id=randomUUID();d.exercises.forEach(e=>{e.id=randomUUID();e.sets=3+i%3;e.reps=8+(i%3)*2;});});p=await api(actor,'/coaching/plans',{id,tenant_id:'planning-club',content:c});} programs.push(p);
 }
 const templates=await api(actor,'/coaching/workout-templates?tenant_id=planning-club');
 for(let i=0;i<24;i++){
  const id=stable('workout:'+i);if(templates.some(t=>t.id===id))continue;
  const exercises=catalog.slice(i*3,i*3+3+(i%3)).map(e=>({id:randomUUID(),exercise_id:e.id,sets:3+(i%2),reps:e.measurements.includes('reps')?10+i%3:null,kg:null,seconds:e.measurements.includes('seconds')?30:null,meters:e.measurements.includes('meters')?100:null,rest_seconds:60,notes:''}));
  await api(actor,'/coaching/workout-templates',{id,tenant_id:'planning-club',content:{id:randomUUID(),name:['Üst Gövde','Alt Gövde','Tüm Vücut','Mobilite','Merkez Bölge','Kondisyon'][i%6]+' · '+['A','B','C','D'][Math.floor(i/6)],dates:[original.content.start_date],exercises}});
 }
 const members=(await api(actor,'/coaching/dashboard')).filter(m=>!['Ada Yılmaz','Emre Demir'].includes(m.name));
 for(let i=0;i<12;i++){
  const p=programs.filter(p=>p.content.planning_status==='published')[i];const m=members[i];const overview=await api(actor,'/coaching/overview?athlete_id='+m.athlete_id);
  if(!overview.plans.some(a=>a.template_id===p.id))await api(actor,'/coaching/plans/'+p.id+'/assign',{request_id:stable('assignment:'+i),athlete_ids:[m.athlete_id],start_date:p.content.start_date,allow_overlap:false});
 }
 const overview=await api(actor,'/coaching/overview');const result={members:(await api(actor,'/coaching/dashboard')).length,sourcePrograms:overview.plans.filter(p=>!p.athlete_id&&p.content.planning_status!=='archived').length,workoutTemplates:(await api(actor,'/coaching/workout-templates?tenant_id=planning-club')).length,exerciseCatalog:catalog.length,assignedDemoMembers:12,productionDataUsed:false};fs.writeFileSync('test-results/trainer-density/dataset.json',JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exitCode=1;});
