(function(){
const KEY='bp-store-v1';
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d);};
const today=iso(new Date());
const IMG='/assets/';
const categories=[
{id:'nails',name:'Manicure & pedicure',title:'Perfectly',it:'polished.',img:IMG+'nails-mobile-v21.webp'},
{id:'brows',name:'Brows & lashes',title:'Eyes',it:'on you.',img:IMG+'brows-v23.webp'},
{id:'hair',name:'Blowouts',title:'Good hair',it:'energy.',img:IMG+'blowouts-v18.webp'},
{id:'skin',name:'Skincare & facials',title:'Face',it:'the day.',img:IMG+'skincare-v21.webp'},
{id:'smooth',name:'Laser & wax',title:'Smooth',it:'your way.',img:IMG+'smooth-v23.webp'},
{id:'six',name:'Six hands',title:'Better',it:'together.',img:IMG+'tour-duo-v26.webp'}];
const treatments=[
{id:'mani',cat:'nails',name:'Manicure classic',dur:45,price:45,room:'solo'},
{id:'gel',cat:'nails',name:'Gellak manicure',dur:60,price:55,room:'solo'},
{id:'pedi',cat:'nails',name:'Pedicure',dur:60,price:55,room:'solo'},
{id:'art',cat:'nails',name:'Nail art',dur:30,price:25,room:'solo'},
{id:'browlam',cat:'brows',name:'Brow lamination',dur:45,price:59,room:'solo'},
{id:'lash',cat:'brows',name:'Lash lift',dur:60,price:65,room:'solo'},
{id:'browtint',cat:'brows',name:'Brow shape & tint',dur:30,price:35,room:'solo'},
{id:'blow',cat:'hair',name:'Blowout',dur:45,price:45,room:'solo'},
{id:'curls',cat:'hair',name:'Blowout met krullen',dur:60,price:55,room:'solo'},
{id:'fexp',cat:'skin',name:'Express facial',dur:30,price:49,room:'solo'},
{id:'fsig',cat:'skin',name:'Signature facial',dur:75,price:110,room:'solo'},
{id:'waxl',cat:'smooth',name:'Wax benen',dur:45,price:49,room:'solo'},
{id:'lasers',cat:'smooth',name:'Laser klein gebied',dur:30,price:69,room:'solo'},
{id:'laserl',cat:'smooth',name:'Laser groot gebied',dur:60,price:139,room:'solo'},
{id:'six1',cat:'six',name:'Six hands: mani, pedi & blowout',dur:75,price:149,room:'six'},
{id:'duo',cat:'six',name:'Duo-moment voor twee',dur:60,price:120,room:'duo'}];
const plans=[
{id:'essential',name:'Essential',price:79,perMonth:2,interval:'1 month',active:true,desc:'De basis van je routine.',included:['mani','gel','browtint','blow','fexp']},
{id:'signature',name:'Signature',price:149,perMonth:4,interval:'1 month',active:true,desc:'Je vaste rituelen, elke maand.',included:['mani','gel','pedi','browtint','browlam','lash','blow','curls','fexp','waxl']},
{id:'edit',name:'The Edit',price:229,perMonth:6,interval:'1 month',active:true,desc:'Alles, inclusief six hands.',included:['mani','gel','pedi','art','browtint','browlam','lash','blow','curls','fexp','fsig','waxl','lasers','six1','duo']}];
const team=[
{id:'t1',name:'Noor Bakker',role:'Nail artist',skills:['nails','six'],days:[1,1,1,0,1,1,0],color:'#c9a88c'},
{id:'t2',name:'Lina Haddad',role:'Brow & lash specialist',skills:['brows'],days:[0,1,1,1,1,1,0],color:'#a7a08a'},
{id:'t3',name:'Mila Jansen',role:'Hairstylist',skills:['hair','six'],days:[1,1,0,1,1,1,1],color:'#b98f7e'},
{id:'t4',name:'Eva Mertens',role:'Huidtherapeut',skills:['skin','smooth'],days:[1,0,1,1,1,0,0],color:'#8f9a86'},
{id:'t5',name:'Sara Öztürk',role:'Nail artist',skills:['nails','six'],days:[0,1,1,1,0,1,1],color:'#c4b2a0'}];
const names=['Sophie de Vries','Emma Visser','Julia Smit','Fleur van Dijk','Zoë Meijer','Anouk de Boer','Yara El Amrani','Lotte Mulder','Sanne Bos','Isa de Groot','Femke Vos','Nina Peters','Roos Hendriks','Maud Dekker'];
const statuses=['actief','actief','actief','betaling mislukt','actief','actief','gepauzeerd','actief','actief','actief','opgezegd','actief','actief','actief'];
const planCycle=['signature','essential','edit','signature','essential','signature','essential','edit','signature','essential','signature','edit','signature','essential'];
const members=names.map((n,i)=>({id:'m'+(i+1),name:n,email:n.toLowerCase().replace(/ë/g,'e').replace(/[^a-z ]/g,'').split(' ').filter(Boolean).join('.')+'@mail.nl',phone:'06 '+(12345678+i*1371).toString().slice(0,8).replace(/(\d{2})(\d{3})(\d{3})/,'$1 $2 $3'),plan:planCycle[i],status:statuses[i],since:addDays(today,-(20+i*9)),mollie:'sub_'+(8241+i*37).toString(36)+'Kd'+i,mandate:i%3===0?'SEPA-incasso':'iDEAL',notes:i===0?'Lichte allergie voor latex. Drinkt graag matcha.':''}));
members[0].routine=['gel','browlam','blow','fsig'];members[0].prefs={drink:'Matcha latte',specialist:'t1',kids:false,reminders:true,newsletter:true};
const T=['09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
const appointments=[];let aid=1;
const mk=(date,time,mem,tr,staff,room,status)=>appointments.push({id:'a'+(aid++),date,time,memberId:mem,treatmentId:tr,staffId:staff,room,status:status||'gepland'});
mk(today,'09:30','m2','gel','t1','Solo 1');mk(today,'10:00','m5','browlam','t2','Solo 2');mk(today,'10:30','m8','blow','t3','Solo 3');
mk(today,'11:00','m12','fsig','t4','Solo 4');mk(today,'11:30','m3','pedi','t5','Solo 1');mk(today,'13:00','m4','six1','t1','Six hands suite');
mk(today,'13:00','m4','six1','t3','Six hands suite');mk(today,'14:00','m9','lash','t2','Solo 2');mk(today,'14:30','m6','mani','t5','Solo 1');
mk(today,'15:00','m10','fexp','t4','Solo 4');mk(today,'16:00','m13','curls','t3','Solo 3');mk(today,'16:30','m7','gel','t1','Solo 1','no-show');
mk(addDays(today,1),'10:00','m11','blow','t3','Solo 3');mk(addDays(today,1),'11:00','m14','browtint','t2','Solo 2');mk(addDays(today,1),'14:00','m2','pedi','t1','Solo 1');
mk(addDays(today,-1),'10:00','m3','mani','t1','Solo 1','afgerond');mk(addDays(today,-1),'12:00','m8','fexp','t4','Solo 4','afgerond');
mk(addDays(today,-9),'10:30','m1','gel','t1','Solo 1','afgerond');mk(addDays(today,-30),'14:00','m1','browlam','t2','Solo 2','afgerond');mk(addDays(today,-38),'11:00','m1','blow','t3','Solo 3','afgerond');
mk(addDays(today,3),'11:30','m1','lash','t2','Solo 2');
const wl=['hanna.k','lisa.vdberg','mariam.b','eline.s','chloe.dm','noa.w','evi.r','sophia.l','ilse.t','amber.v','dewi.p','kim.h','laura.n','jasmijn.o','tess.g','iris.f'];
const waitlist=wl.map((e,i)=>({id:'w'+(i+1),email:e+'@mail.nl',date:addDays(today,-(2+i*3)),source:['Instagram','Website','Vriendin','Instagram','Website'][i%5],interest:[['nails','hair'],['skin'],['brows','nails'],['six'],['smooth','skin']][i%5],status:i<4?'uitgenodigd':i<6?'member':'wachtend',round:i<6?1:null}));
const settings={hours:[['Maandag','10:00','20:00'],['Dinsdag','09:00','20:00'],['Woensdag','09:00','20:00'],['Donderdag','09:00','21:00'],['Vrijdag','09:00','21:00'],['Zaterdag','09:00','18:00'],['Zondag','11:00','17:00']],cancelHours:24,noShowCounts:true,rollover:false,mollieMode:'live',mollieProfile:'pfl_BeautyPassAms',rooms:['Solo 1','Solo 2','Solo 3','Solo 4','Duo-suite','Six hands suite'],roles:[{id:'owner',name:'Eigenaar',perms:['dash','agenda','members','plans','team','waitlist','settings','finance']},{id:'manager',name:'Manager',perms:['dash','agenda','members','plans','team','waitlist']},{id:'desk',name:'Receptie',perms:['dash','agenda','members','waitlist']},{id:'spec',name:'Specialist',perms:['agenda']}],users:[{name:'Jij',email:'hallo@beautypass.nl',role:'owner'},{name:'Rachel Kok',email:'rachel@beautypass.nl',role:'manager'},{name:'Demi Roos',email:'demi@beautypass.nl',role:'desk'}]};
const invoices=[0,1,2].map(i=>{const d=new Date();d.setMonth(d.getMonth()-i);d.setDate(1);return{id:'BP-'+d.getFullYear()+pad(d.getMonth()+1)+'-0418',date:iso(d),amount:149,status:'betaald',method:'iDEAL · ING'};});
const seed=()=>({v:1,categories,treatments,plans,team,members,appointments,waitlist,settings,invoices,me:'m1',onboarded:true});
const NP=!!window.BP_NOPERSIST;let state;try{state=NP?seed():(JSON.parse(localStorage.getItem(KEY))||seed());}catch(e){state=seed();}
const subs=new Set();
const save=()=>{if(!NP)try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}subs.forEach(f=>f(state));};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){state=JSON.parse(e.newValue);subs.forEach(f=>f(state));}});
const BP={get:()=>state,set:fn=>{state={...state,...fn(state)};save();},subscribe:f=>{subs.add(f);return()=>subs.delete(f);},reset:()=>{state=seed();save();},today,addDays,iso,T,
fmtDate:(s,o)=>new Date(s+'T12:00:00').toLocaleDateString('nl-NL',o||{weekday:'long',day:'numeric',month:'long'}),
eur:n=>'€ '+Number(n).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:2}),
tr:id=>state.treatments.find(t=>t.id===id),plan:id=>state.plans.find(p=>p.id===id),mem:id=>state.members.find(m=>m.id===id),staff:id=>state.team.find(t=>t.id===id),cat:id=>state.categories.find(c=>c.id===id),
usedThisMonth:mid=>{const m=today.slice(0,7);return state.appointments.filter(a=>a.memberId===mid&&a.date.slice(0,7)===m&&a.status!=='geannuleerd').length;}};
window.BP=BP;
})();
