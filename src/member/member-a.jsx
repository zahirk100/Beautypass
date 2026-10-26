const MCtx=React.createContext(null);
const useM=()=>React.useContext(MCtx);
function Btn({children,onClick,kind='primary',disabled,style,icon}){const k={primary:{background:BPC.ink,color:'#fff'},esp:{background:BPC.esp,color:'#fff'},ghost:{background:'transparent',color:BPC.ink,border:`1px solid ${BPC.line2}`},soft:{background:BPC.paper2,color:BPC.ink},danger:{background:'transparent',color:BPC.bord,border:`1px solid ${BPC.bordSoft}`}}[kind];
return <button disabled={disabled} onClick={onClick} style={{...k,height:52,borderRadius:26,border:k.border||'none',fontFamily:BPC.sans,fontSize:15,fontWeight:600,letterSpacing:0.1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,width:'100%',cursor:disabled?'default':'pointer',opacity:disabled?0.35:1,transition:'transform .12s, opacity .2s',...style}} onMouseDown={e=>!disabled&&(e.currentTarget.style.transform='scale(.98)')} onMouseUp={e=>e.currentTarget.style.transform=''} onMouseLeave={e=>e.currentTarget.style.transform=''}>{children}{icon&&<Ico n={icon} s={17}/>}</button>;}
// Desktop pages (onboarding on a computer) show the same screens wider, without the phone status bar
const ScreenWide=React.createContext(false);
function Screen({title,onBack,right,children,footer,bg=BPC.paper,pad=true}){const wide=React.useContext(ScreenWide);const col=wide?{width:'100%',maxWidth:560,margin:'0 auto',boxSizing:'border-box'}:{};
return <div style={{position:'absolute',inset:0,background:bg,display:'flex',flexDirection:'column',animation:'bpIn .28s cubic-bezier(.2,.7,.3,1)'}}>
<div style={{paddingTop:wide?32:58,flexShrink:0}}><div style={{height:44,display:'flex',alignItems:'center',justifyContent:'space-between',padding:wide?'0 32px':'0 16px',...col}}>
{onBack?<div onClick={onBack} style={{width:38,height:38,borderRadius:19,background:BPC.card,border:`1px solid ${BPC.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Ico n="back" s={18}/></div>:<div style={{width:38}}></div>}
<div style={{fontSize:15,fontWeight:600}}>{title}</div><div style={{minWidth:38,display:'flex',justifyContent:'flex-end'}}>{right}</div></div></div>
<div className="bp-scroll" style={{flex:1,overflowY:'auto',padding:pad?(wide?'16px 32px 40px':'8px 20px 32px'):0}}><div style={col}>{children}</div></div>
{footer&&<div style={{padding:wide?'16px 32px 28px':'12px 20px 34px',borderTop:`1px solid ${BPC.line}`,background:bg,flexShrink:0}}><div style={col}>{footer}</div></div>}</div>;}
// In the full-screen phone app a sheet covers the screen, also when the page underneath is scrolled
const SheetFixed=React.createContext(false);
function Sheet({open,onClose,children,title}){const fixed=React.useContext(SheetFixed);if(!open)return null;return <div style={{position:fixed?'fixed':'absolute',inset:0,zIndex:80}}><div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(29,26,23,.35)',animation:'bpFade .2s'}}></div>
<div style={{position:'absolute',left:0,right:0,bottom:0,background:BPC.paper,borderRadius:'28px 28px 0 0',padding:'10px 22px 38px',animation:'bpUp .3s cubic-bezier(.2,.8,.3,1)',maxHeight:'82%',overflowY:'auto'}}>
<div style={{width:36,height:4,borderRadius:2,background:BPC.line2,margin:'0 auto 18px'}}></div>{title&&<Serif size={28} style={{marginBottom:10}}>{title}</Serif>}{children}</div></div>;}
function Card({children,style,onClick}){return <div onClick={onClick} style={{background:BPC.card,border:`1px solid ${BPC.line}`,borderRadius:20,padding:16,cursor:onClick?'pointer':'default',...style}}>{children}</div>;}
function Row({icon,label,value,onClick,last,danger}){return <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0',borderBottom:last?'none':`1px solid ${BPC.line}`,cursor:onClick?'pointer':'default',color:danger?BPC.bord:BPC.ink}}>{icon&&<Ico n={icon} s={19} c={danger?BPC.bord:BPC.ink2}/>}<div style={{flex:1,fontSize:14.5,fontWeight:500}}>{label}</div>{value&&<div style={{fontSize:13.5,color:BPC.ink3}}>{value}</div>}{onClick&&<Ico n="chev" s={16} c={BPC.ink3}/>}</div>;}
function Field({label,value,onChange,type='text',error,placeholder}){return <label style={{display:'block'}}><div style={{fontSize:11.5,fontWeight:600,color:error?BPC.bord:BPC.ink2,marginBottom:6}}>{label}</div>
<input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} style={{width:'100%',boxSizing:'border-box',height:50,borderRadius:14,border:`1px solid ${error?BPC.bord:BPC.line2}`,background:BPC.card,padding:'0 16px',fontSize:15,fontFamily:BPC.sans,color:BPC.ink,outline:'none'}}/>{error&&<div style={{fontSize:11.5,color:BPC.bord,marginTop:5}}>{error}</div>}</label>;}
const lowestPlanFor=(s,tid)=>[...s.plans].filter(p=>p.active).sort((a,b)=>a.price-b.price).find(p=>p.included.includes(tid));
function IncludedTag({s,plan,tid}){if(plan.included.includes(tid))return <Pill tone="ok"><Ico n="check" s={11} w={2.4}/>Inbegrepen</Pill>;const lp=lowestPlanFor(s,tid);return <Pill tone="warn">{lp?'Vanaf '+lp.name:'Los te boeken'}</Pill>;}
function Thumb({src,size=52,r=14}){return <img src={src} alt="" style={{width:size,height:size,borderRadius:r,objectFit:'cover',flexShrink:0,background:BPC.paper2}}/>;}

/* ---------- Onboarding ---------- */
// Routine → package → checkout. Choosing comes first; the login is made at checkout (e-mail only) and the
// member signs in with a code from their mail after paying. Signed-in visitors (unpaid, or rejoining) pay
// through their own account.
const MAIL_DOMAINS=['gmail.com','hotmail.com','hotmail.nl','outlook.com','outlook.nl','live.nl','live.com','icloud.com','me.com','yahoo.com','ziggo.nl','kpnmail.nl','planet.nl','xs4all.nl','home.nl','upcmail.nl','telfort.nl','protonmail.com'];
function editDist(a,b){const d=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
// "jan@gmial.com" → "jan@gmail.com"
function mailSuggestion(email){const m=/^([^@\s]+)@([^@\s]+)$/.exec(String(email).trim().toLowerCase());if(!m||MAIL_DOMAINS.includes(m[2]))return null;const best=MAIL_DOMAINS.map(d=>[d,editDist(m[2],d)]).sort((x,y)=>x[1]-y[1])[0];return best&&best[1]>0&&best[1]<=2?m[1]+'@'+best[0]:null;}

// Reassurance under the plan choice (the things that keep people from signing up)
function TrustRow(){return <div style={{display:'flex',justifyContent:'center',gap:14,flexWrap:'wrap',fontSize:12,color:BPC.ink2,marginBottom:12}}>{['Maandelijks opzegbaar','Pauzeren kan','Geen inschrijfkosten'].map(x=><span key={x} style={{display:'flex',alignItems:'center',gap:5}}><Ico n="check" s={13} c={BPC.sage} w={2.4}/>{x}</span>)}</div>;}
// How long a routine takes in one visit (same rule as the planner: different zones at the same time, max 3)
function visitEstimate(s,tids){const items=tids.map(BP.tr).filter(t=>t.cat).sort((a,b)=>b.dur-a.dur);const ok=(a,b)=>a&&b&&a!==b&&a!=='body'&&b!=='body'&&!([a,b].includes('face')&&[a,b].includes('head'));const waves=[];
for(const t of items){const w=s.settings.parallelOn!==false&&waves.find(w=>w.length<3&&w.every(x=>ok(x.zone,t.zone)));if(w)w.push(t);else waves.push([t]);}
return {minutes:waves.reduce((n,w)=>n+Math.max(...w.map(t=>t.dur)),0),together:waves.filter(w=>w.length>1).map(w=>w.map(t=>t.name))};}
function Onboarding({onDone,onLogin,initStep}){const s=useBP();const signedIn=!!s.session;const wide=React.useContext(ScreenWide);const draft=React.useMemo(()=>{try{return JSON.parse(sessionStorage.getItem('bp-onb')||'{}');}catch(e){return {};}},[]);
const me0=s.members.find(x=>x.id===s.me);
const [step,setStep]=React.useState(()=>{const st=initStep!=null?initStep:Math.min(draft.step||0,3);return wide?Math.max(1,st):st;});
const [counts,setCounts]=React.useState(()=>draft.counts&&Object.keys(draft.counts).length?Object.fromEntries(Object.keys(draft.counts).map(t=>[t,1])):Object.fromEntries(((me0&&me0.routine)||[]).map(t=>[t,1])));
const [planId,setPlanId]=React.useState(()=>draft.plan||(me0&&me0.plan)||null);
const [f,setF]=React.useState({name:draft.name||(me0&&me0.name)||(s.profile&&s.profile.name)||'',email:(s.session&&s.session.user.email)||draft.email||new URLSearchParams(location.search).get('email')||'',phone:draft.phone||(me0&&me0.phone)||'',hp:''});
const [payM,setPayM]=React.useState(draft.method||'iDEAL');const [tried,setTried]=React.useState(false);const [busy,setBusy]=React.useState(false);const [err,setErr]=React.useState('');const [bump,setBump]=React.useState(0);
React.useEffect(()=>{try{sessionStorage.setItem('bp-onb',JSON.stringify({step:Math.min(step,3),counts,plan:planId,name:f.name,email:f.email,phone:f.phone,method:payM}));}catch(e){}},[step,counts,planId,f.name,f.email,f.phone,payM]);
// Plans by number per month; the middle one is the one most people pick
const plansA=s.plans.filter(p=>p.active).sort((a,b)=>a.perMonth-b.perMonth||a.price-b.price);const popular=plansA[Math.floor((plansA.length-1)/2)];
const chosen=plansA.find(p=>p.id===planId)||popular;const [openCat,setOpenCat]=React.useState(null);
// Ready-made routines (Beheer → Routine-ideeën): only treatments that exist and can be booked on their own
const presets=(s.settings.routinePresets||[]).map(pr=>({...pr,treatments:(pr.treatments||[]).filter(id=>s.treatments.some(t=>t.id===id&&t.active!==false&&t.room==='solo'))})).filter(pr=>pr.name&&pr.treatments.length);
// What a plan holds: its categories, what only this plan (and bigger) has, price per treatment and what you save
const planInfo=p=>{const inc=s.treatments.filter(t=>t.active!==false&&p.included.includes(t.id));const cats=s.categories.filter(c=>inc.some(t=>t.cat===c.id));
const smaller=plansA.filter(q=>q.perMonth<p.perMonth);const extra=smaller.length?inc.filter(t=>t.room==='solo'&&!smaller.some(q=>q.included.includes(t.id))):[];
const solo=inc.filter(t=>t.room==='solo');const avg=solo.length?Math.round(solo.reduce((n,t)=>n+t.price,0)/solo.length):0;return {cats,extra,avg,save:Math.round(avg*p.perMonth-p.price)};};
const pick=Object.keys(counts).filter(t=>counts[t]>0&&BP.tr(t).cat&&(!chosen||chosen.included.includes(t))).slice(0,chosen?chosen.perMonth:99);const total=pick.reduce((n,t)=>n+counts[t],0);const los=pick.reduce((n,t)=>n+BP.tr(t).price*counts[t],0);
const setN=(t,n)=>{setCounts(c=>{const x={...c};if(n<=0)delete x[t];else x[t]=Math.min(4,n);return x;});setBump(k=>k+1);};

const needTerms=!!(s.settings.termsUrl&&s.settings.privacyUrl);const [terms,setTerms]=React.useState(false);
const errs={name:f.name.trim().length<2&&'Vul je naam in',email:!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())&&'Vul een geldig e-mailadres in'};const sug=!signedIn&&mailSuggestion(f.email);
const finish=()=>{try{sessionStorage.removeItem('bp-onb');}catch(e){}onDone();};
const prog=<div style={{display:'flex',gap:4,marginBottom:22}}>{[1,2,3].map(i=><div key={i} style={{flex:1,height:2,borderRadius:1,background:i<=step?BPC.ink:BPC.line2,transition:'background .3s'}}></div>)}</div>;
// Checkout: signed in → own account; otherwise the account is made with the payment
const pay=async()=>{setTried(true);setErr('');if(errs.name||errs.email)return;if(needTerms&&!terms){setErr('Ga eerst akkoord met de voorwaarden en het privacybeleid');return;}setBusy(true);
try{let r;if(signedIn){await BP.act.onboard({name:f.name.trim(),phone:f.phone,routine:pick,plan:chosen.id});if(needTerms)await BP.act.acceptTerms();r=await BP.act.startMembership(chosen.id,payM);}
else r=await BP.act.checkout({name:f.name.trim(),email:f.email.trim(),phone:f.phone.trim(),plan:chosen.id,routine:pick,method:payM,terms:needTerms?terms:undefined,website:f.hp});
window.location.href=r.checkoutUrl;}catch(e){setBusy(false);setErr(e.message);}};
const me=s.members.find(x=>x.id===s.me);

if(step===0)return <div style={{position:'absolute',inset:0,background:BPC.ink,animation:'bpFade .4s'}}>
<img src="/assets/cover-v3.webp" alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
<div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(20,16,12,.15) 0%,rgba(20,16,12,0) 35%,rgba(20,16,12,.78) 78%)'}}></div>
<img src={WORDMARK} alt="BeautyPass" style={{position:'absolute',top:72,left:'50%',transform:'translateX(-50%)',height:20,filter:'invert(1)'}}/>
<div style={{position:'absolute',left:24,right:24,bottom:44,color:'#fff'}}><Eyebrow style={{color:'rgba(255,255,255,.75)',marginBottom:12}}>Amsterdam · Members</Eyebrow>
<Serif size={52} it="Your way." style={{color:'#fff'}}>Your beauty.</Serif><div style={{fontSize:15,lineHeight:1.5,opacity:.88,margin:'14px 0 26px'}}>Elke maand je vaste beauty-momenten, alles op één dag als je wilt. Kies hoe vaak, wij regelen de rest.</div>
<Btn kind="ghost" style={{background:'#fff',border:'none'}} onClick={()=>setStep(1)}>Bekijk de memberships</Btn><div onClick={onLogin} style={{textAlign:'center',fontSize:14,marginTop:16,opacity:.85,cursor:'pointer'}}>Al member? <b>Inloggen</b></div></div></div>;

if(step===1&&chosen)return <Screen onBack={wide?null:()=>setStep(0)} title="Membership" footer={<><TrustRow/><Btn onClick={()=>{setPlanId(chosen.id);setCounts(Object.fromEntries(pick.map(t=>[t,1])));setStep(2);}}>Kies {chosen.name} · {BP.eur(chosen.price)}/mnd</Btn></>}>{prog}
<Serif size={36} it="trakteren?">Hoe vaak wil je jezelf</Serif><div style={{fontSize:14,color:BPC.ink2,margin:'10px 0 20px',lineHeight:1.5}}>Een vast aantal behandelingen per maand. Welke, kies je elke maand zelf.</div>
{(()=>{const info=planInfo(chosen);return <>
<div style={{display:'grid',gridTemplateColumns:`repeat(${plansA.length},minmax(0,1fr))`,gap:8,marginTop:6}}>{plansA.map(p=>{const sel=chosen.id===p.id,pop=popular&&p.id===popular.id;return <div key={p.id} onClick={()=>setPlanId(p.id)} role="button" aria-pressed={sel} style={{position:'relative',borderRadius:20,padding:'18px 6px 14px',textAlign:'center',cursor:'pointer',background:sel?BPC.esp:BPC.card,color:sel?'#fff':BPC.ink,border:`1.5px solid ${sel?BPC.esp:BPC.line}`,transition:'background .2s, color .2s',boxShadow:sel?'0 12px 28px rgba(60,40,25,.22)':'none'}}>
{pop&&<div style={{position:'absolute',top:-10,left:0,right:0,display:'flex',justifyContent:'center'}}><Pill style={{background:BPC.gold,color:'#fff',fontSize:10}}>Meest gekozen</Pill></div>}
<div style={{fontFamily:BPC.serif,fontSize:44,fontWeight:600,lineHeight:1}}>{p.perMonth}</div><div style={{fontSize:11.5,opacity:.75,marginTop:2}}>per maand</div>
<div style={{fontSize:13,fontWeight:700,marginTop:10}}>{p.name}</div><div style={{fontSize:14,marginTop:2}}>{BP.eur(p.price)}</div></div>;})}</div>
<Card key={chosen.id} style={{marginTop:14,animation:'bpFade .25s'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}><Serif size={26}>{chosen.name}</Serif><div style={{fontFamily:BPC.serif,fontSize:24,fontWeight:600}}>{BP.eur(chosen.price)}<span style={{fontFamily:BPC.sans,fontSize:12,fontWeight:500,color:BPC.ink3}}> /mnd</span></div></div>
<div style={{fontSize:13.5,fontWeight:600,marginTop:6}}>{chosen.perMonth} behandelingen per maand, naar keuze</div>
<div style={{fontSize:12.5,color:BPC.ink2,marginTop:4}}>{BP.eur(Math.round(chosen.price/chosen.perMonth))} per behandeling{info.avg?` · los gemiddeld ${BP.eur(info.avg)}`:''}</div>
<div style={{display:'flex',gap:6,marginTop:14,flexWrap:'wrap'}}>{info.cats.map(c=><div key={c.id} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px 4px 4px',borderRadius:99,background:BPC.paper2,fontSize:12}}><img src={c.img} alt="" style={{width:22,height:22,borderRadius:11,objectFit:'cover'}}/>{c.name}</div>)}</div>
{info.extra.length>0&&<div style={{fontSize:12.5,marginTop:10,fontWeight:600}}>+ ook {info.extra.map(t=>t.name).join(', ')}</div>}
{info.save>0&&<div style={{display:'inline-block',marginTop:12,padding:'6px 10px',borderRadius:10,fontSize:12.5,fontWeight:700,background:BPC.sageSoft,color:BPC.sage}}>Je bespaart ± {BP.eur(info.save)} per maand</div>}</Card></>;})()}</Screen>;

if(step===2&&chosen){const est=visitEstimate(s,pick);const inPlan=id=>chosen.included.includes(id);
return <Screen onBack={()=>setStep(1)} title="Jouw routine" footer={<><div key={bump} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10,fontSize:13,color:BPC.ink2,animation:bump?'bpPop .35s':'none'}}><span><b style={{color:BPC.ink,fontSize:15}}>{pick.length}</b> van {chosen.perMonth} gekozen</span><span>{chosen.name}</span></div>
<Btn onClick={()=>setStep(3)}>{pick.length?'Verder':'Sla over, ik kies later'}</Btn></>}>{prog}
<Serif size={36} it="zin in?">Waar heb je</Serif><div style={{fontSize:14,color:BPC.ink2,margin:'10px 0 18px',lineHeight:1.5}}>Tik aan wat je graag laat doen. Dit wordt je routine: daarmee plan je straks alles in één bezoek. Je kunt het altijd aanpassen.</div>
{presets.length>0&&<><Eyebrow style={{marginBottom:10}}>Snel kiezen</Eyebrow><div className="bp-scroll" style={{display:'flex',gap:10,overflowX:'auto',margin:wide?'0 0 22px':'0 -20px 22px',padding:wide?'0 0 4px':'0 20px 4px'}}>{presets.map(pr=>{const fits=pr.treatments.every(id=>chosen.included.includes(id))&&pr.treatments.length<=chosen.perMonth;const on=pr.treatments.length===pick.length&&pr.treatments.every(id=>pick.includes(id));const e=visitEstimate(s,pr.treatments);const big=!fits&&plansA.find(q=>pr.treatments.every(id=>q.included.includes(id))&&pr.treatments.length<=q.perMonth);
return <div key={pr.id} onClick={()=>{if(!fits){setErr(big?`${pr.name} past in ${big.name}`:`${pr.name} past niet in ${chosen.name}`);return;}setErr('');setCounts(Object.fromEntries(pr.treatments.map(t=>[t,1])));setBump(k=>k+1);}} style={{flexShrink:0,width:200,borderRadius:20,overflow:'hidden',cursor:'pointer',background:on?BPC.esp:BPC.card,color:on?'#fff':BPC.ink,border:`1.5px solid ${on?BPC.esp:BPC.line}`,opacity:fits?1:.55,transition:'background .2s, color .2s'}}>
<div style={{display:'flex',height:64}}>{pr.treatments.slice(0,3).map(id=><img key={id} src={BP.cat(BP.tr(id).cat).img} alt="" style={{flex:1,minWidth:0,objectFit:'cover'}}/>)}</div>
<div style={{padding:'12px 14px'}}><div style={{display:'flex',alignItems:'center',gap:6,fontSize:14.5,fontWeight:700}}>{!fits&&<Ico n="lock" s={13}/>}{pr.name}</div><div style={{fontSize:12,opacity:.75,marginTop:3,lineHeight:1.35}}>{pr.tagline}</div>
<div style={{fontSize:11.5,marginTop:8,fontWeight:600,opacity:.85}}>{pr.treatments.length} behandelingen · ± {durText(e.minutes)}{!fits&&big?' · in '+big.name:''}</div></div></div>;})}</div>
{err&&!openCat&&<div style={{fontSize:12.5,color:BPC.gold,margin:'-12px 0 16px',lineHeight:1.45}}>{err} · <span onClick={()=>{setErr('');setStep(1);}} style={{textDecoration:'underline',cursor:'pointer'}}>bekijk memberships</span></div>}
<Eyebrow style={{marginBottom:10}}>Of stel zelf samen</Eyebrow></>}
<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>{(()=>{const cats=s.categories.filter(c=>s.treatments.some(t=>t.cat===c.id&&t.active!==false&&t.room==='solo'));const oi=cats.findIndex(c=>c.id===openCat);const after=oi<0?-1:Math.min(cats.length-1,oi%2===0?oi+1:oi);
return cats.map((c,ci)=>{const list=s.treatments.filter(t=>t.cat===c.id&&t.active!==false&&t.room==='solo');const n=list.filter(t=>counts[t.id]).length;const open=openCat===c.id;
return <React.Fragment key={c.id}><div onClick={()=>setOpenCat(open?null:c.id)} style={{position:'relative',borderRadius:18,overflow:'hidden',cursor:'pointer',aspectRatio:'4/3',outline:open?`2px solid ${BPC.ink}`:'none',outlineOffset:2}}><img src={c.img} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/><div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(20,16,12,0) 40%,rgba(20,16,12,.7))'}}></div>
<div style={{position:'absolute',left:12,right:12,bottom:10,color:'#fff',fontSize:13.5,fontWeight:700}}>{c.name}</div>{n>0&&<div style={{position:'absolute',top:8,right:8,minWidth:24,height:24,borderRadius:12,background:'#fff',color:BPC.ink,fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{n}</div>}</div>
{ci===after&&<Card style={{gridColumn:'1 / -1',animation:'bpIn .25s'}}><div style={{fontSize:13,fontWeight:700,marginBottom:10}}>{BP.cat(openCat).name}</div><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{s.treatments.filter(t=>t.cat===openCat&&t.active!==false&&t.room==='solo').map(t=>{const on=!!counts[t.id],ok=inPlan(t.id),lp=!ok&&lowestPlanFor(s,t.id);
return <div key={t.id} onClick={()=>!ok?setErr(`${t.name} zit in ${lp?lp.name:'een ander membership'}`):!on&&pick.length>=chosen.perMonth?setErr(`In ${chosen.name} kies je ${chosen.perMonth} behandelingen per maand. Haal er eerst een weg${plansA.some(q=>q.perMonth>chosen.perMonth)?'':'.'}`):(setErr(''),setN(t.id,on?0:1))} style={{padding:'9px 14px',borderRadius:99,fontSize:13,fontWeight:500,cursor:'pointer',border:`1px solid ${on?BPC.ink:BPC.line2}`,background:on?BPC.ink:BPC.card,color:on?'#fff':ok?BPC.ink:BPC.ink3,display:'flex',alignItems:'center',gap:6,transition:'all .15s'}}>{on&&<Ico n="check" s={13} w={2.2}/>}{!ok&&<Ico n="lock" s={12}/>}{t.name}{!ok&&lp&&<span style={{fontSize:11}}>· in {lp.name}</span>}</div>;})}</div>
{err&&<div style={{fontSize:12.5,color:BPC.gold,marginTop:10,lineHeight:1.45}}>{err}{(/zit in/.test(err)||plansA.some(q=>q.perMonth>chosen.perMonth))&&<> · <span onClick={()=>{setErr('');setStep(1);}} style={{textDecoration:'underline',cursor:'pointer'}}>{/zit in/.test(err)?'bekijk memberships':'of kies een groter membership'}</span></>}</div>}</Card>}</React.Fragment>;});})()}</div>
{pick.length>0&&<Card style={{marginTop:14,background:BPC.paper2,border:'none'}}><Eyebrow style={{marginBottom:8}}>Jouw routine</Eyebrow><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{pick.map(id=><Pill key={id} tone="ink">{BP.tr(id).name}</Pill>)}</div>
{pick.length>1&&<div style={{fontSize:13,color:BPC.ink2,marginTop:12,lineHeight:1.45}}>In één bezoek ± <b style={{color:BPC.ink}}>{durText(est.minutes)}</b>{est.together.length>0&&<> in plaats van {durText(pick.reduce((n,id)=>n+BP.tr(id).dur,0))}</>}{est.together.length>0?', omdat meerdere specialisten tegelijk aan je werken.':'.'} Verspreid over de maand plannen kan ook.</div>}</Card>}</Screen>;}

if(step===3&&chosen)return <Screen onBack={()=>setStep(2)} title="Afrekenen" footer={<>{err&&<div style={{fontSize:12.5,color:BPC.bord,marginBottom:10,textAlign:'center',lineHeight:1.4}}>{err}{/al member|Log in/.test(err)&&onLogin&&<> · <span onClick={onLogin} style={{textDecoration:'underline',cursor:'pointer',fontWeight:600}}>Inloggen</span></>}</div>}
<Btn kind="esp" disabled={busy} onClick={pay} icon="lock">{busy?'Doorsturen naar Mollie…':`Betaal ${BP.eur(chosen.price)} met ${payM}`}</Btn><div style={{fontSize:11.5,color:BPC.ink3,textAlign:'center',marginTop:10,lineHeight:1.4}}>Daarna incasseren we maandelijks automatisch. Maandelijks opzegbaar.</div></>}>{prog}
<Serif size={36} it="afrekenen.">Bijna klaar,</Serif>
<Card style={{marginTop:18,display:'flex',alignItems:'center',gap:12}}><div style={{flex:1}}><div style={{fontSize:15,fontWeight:600}}>{chosen.name}</div><div style={{fontSize:12.5,color:BPC.ink2}}>{chosen.perMonth} behandelingen per maand{pick.length?' · '+pick.length+' in je routine':''}</div></div><div style={{textAlign:'right'}}><div style={{fontFamily:BPC.serif,fontSize:24,fontWeight:600}}>{BP.eur(chosen.price)}</div><div onClick={()=>setStep(2)} style={{fontSize:12,color:BPC.ink2,textDecoration:'underline',cursor:'pointer'}}>Wijzig</div></div></Card>
<Eyebrow style={{margin:'24px 0 10px'}}>Je gegevens</Eyebrow>
<div style={{display:'grid',gap:14}}><Field label="Volledige naam" value={f.name} onChange={v=>setF({...f,name:v})} error={tried&&errs.name}/>
{signedIn?<div><div style={{fontSize:11.5,fontWeight:600,color:BPC.ink2,marginBottom:6}}>E-mailadres</div><div style={{fontSize:15,padding:'2px 0'}}>{f.email}</div></div>
:<div><Field label="E-mailadres" type="email" value={f.email} onChange={v=>setF({...f,email:v})} error={tried&&errs.email}/>{sug&&<div style={{fontSize:12.5,color:BPC.gold,marginTop:6}}>Bedoel je <span onClick={()=>setF({...f,email:sug})} style={{textDecoration:'underline',cursor:'pointer',fontWeight:600}}>{sug}</span>?</div>}</div>}
<Field label="Telefoon (optioneel)" type="tel" value={f.phone} onChange={v=>setF({...f,phone:v})}/>
<input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.hp} onChange={e=>setF({...f,hp:e.target.value})} name="website" style={{position:'absolute',left:-9999,width:1,height:1,opacity:0}}/></div>
{!signedIn&&<div style={{display:'flex',gap:10,marginTop:14,padding:12,borderRadius:14,background:BPC.paper2,fontSize:12.5,color:BPC.ink2,lineHeight:1.45}}><Ico n="mail" s={17}/><span>We maken je account automatisch aan met dit e-mailadres. Na het betalen log je in met een code uit je mail, zonder wachtwoord.</span></div>}
<Eyebrow style={{margin:'24px 0 10px'}}>Betaalmethode</Eyebrow>
<div style={{display:'grid',gap:8}}>{[['iDEAL','Eerste maand nu, daarna automatische incasso'],['Creditcard','Visa, Mastercard, Amex']].map(([m,d])=>{const on=payM===m;return <Card key={m} onClick={()=>setPayM(m)} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer',borderColor:on?BPC.ink:BPC.line}}><div style={{width:20,height:20,borderRadius:10,border:on?`6px solid ${BPC.ink}`:`1.5px solid ${BPC.line2}`,boxSizing:'border-box'}}></div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{m}</div><div style={{fontSize:12,color:BPC.ink3}}>{d}</div></div></Card>;})}</div>
{needTerms&&<label style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:20,fontSize:13,lineHeight:1.45,color:BPC.ink2,cursor:'pointer'}}><input type="checkbox" checked={terms} onChange={e=>{setTerms(e.target.checked);setErr('');}} style={{width:20,height:20,marginTop:1,accentColor:BPC.ink,flexShrink:0}}/><span>Ik ga akkoord met de <a href={s.settings.termsUrl} target="_blank" rel="noopener" style={{color:BPC.ink,fontWeight:600}}>algemene voorwaarden</a> en het <a href={s.settings.privacyUrl} target="_blank" rel="noopener" style={{color:BPC.ink,fontWeight:600}}>privacybeleid</a>, en met de maandelijkse automatische incasso.</span></label>}
<div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',marginTop:20,fontSize:12,color:BPC.ink3}}><Ico n="lock" s={14}/>{s.paymentsMode==='demo'?'Testmodus · er wordt niet echt betaald':'Veilig betalen via Mollie'}</div></Screen>;

if(step<5)return <Screen onBack={()=>setStep(1)} title="Jouw pakket"><div style={{fontSize:14,color:BPC.ink2,marginTop:20}}>Kies eerst je behandelingen.</div><div style={{height:16}}></div><Btn onClick={()=>setStep(1)}>Naar je routine</Btn></Screen>;
const pl=BP.plan(me?me.plan:(chosen||{}).id);
return <div style={{position:'absolute',inset:0,background:BPC.paper,display:'flex',flexDirection:'column',justifyContent:'center',padding:wide?'0 max(28px, calc(50% - 220px))':'0 28px',animation:'bpFade .4s',textAlign:'center'}}>
<div style={{width:76,height:76,borderRadius:38,background:BPC.sageSoft,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 26px'}}><Ico n="check" s={34} c={BPC.sage} w={2}/></div>
<Eyebrow style={{marginBottom:12}}>Welkom bij BeautyPass</Eyebrow><Serif size={42} it="you're in.">{((me&&me.name)||f.name).split(' ')[0]},</Serif>
<div style={{fontSize:14.5,color:BPC.ink2,lineHeight:1.55,margin:'16px 0 32px'}}>Je {pl.name}-membership is actief. Je hebt deze maand {pl.perMonth} behandelingen tegoed.</div>
<Btn onClick={finish} icon="arrow">Plan je eerste behandeling</Btn></div>;}

/* ---------- Home ---------- */
// Nothing free on a day: ask for an e-mail as soon as a time comes free for this treatment
function WatchDay({tid,date,web}){const s=useBP();const on=(s.watches||[]).some(w=>w.tid===tid&&w.date===date);const [busy,setBusy]=React.useState(false);
const run=async fn=>{setBusy(true);try{await fn();}catch(e){BP.showError(e);}setBusy(false);};
return <div style={{marginTop:web?12:0,marginBottom:web?0:22,padding:14,borderRadius:16,background:BPC.goldSoft,color:BPC.ink,fontSize:13.5,lineHeight:1.45}}>
<b>Alles vol op {BP.fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}.</b> {on?'Je krijgt een mail zodra er een tijd vrijkomt.':'Wil je een seintje als er een tijd vrijkomt?'}
<div style={{marginTop:10}}>{on?<span onClick={()=>!busy&&run(()=>BP.act.unwatchSlot(tid,date))} style={{fontSize:13,fontWeight:600,textDecoration:'underline',cursor:'pointer'}}>Afmelden</span>
:<span onClick={()=>!busy&&run(()=>BP.act.watchSlot(tid,date))} style={{display:'inline-block',padding:'8px 14px',borderRadius:99,background:BPC.ink,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>{busy?'Bezig…':'Laat het me weten'}</span>}</div></div>;}

// Feedback after a completed treatment: 1–5 stars and an optional comment
function ReviewForm({a,onDone}){const s=useBP();const prev=(s.reviews||[]).find(r=>r.appointmentId===a.id);const [stars,setStars]=React.useState(prev?prev.rating:0);const [txt,setTxt]=React.useState(prev?prev.comment:'');const [busy,setBusy]=React.useState(false);
return <div><div style={{display:'flex',gap:6,justifyContent:'center',margin:'4px 0 14px'}}>{[1,2,3,4,5].map(n=><span key={n} role="button" aria-label={n+' sterren'} onClick={()=>setStars(n)} style={{fontSize:34,cursor:'pointer',color:n<=stars?BPC.gold:BPC.line2,lineHeight:1}}>★</span>)}</div>
<textarea value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Wil je nog iets kwijt? (optioneel)" style={{width:'100%',boxSizing:'border-box',height:80,borderRadius:14,border:`1px solid ${BPC.line2}`,padding:12,fontFamily:BPC.sans,fontSize:14,resize:'none',background:BPC.card,outline:'none'}}></textarea>
<div style={{height:12}}></div><Btn disabled={!stars||busy} onClick={async()=>{setBusy(true);try{await BP.act.review(a.id,stars,txt);onDone&&onDone();}catch(e){BP.showError(e);}setBusy(false);}}>{busy?'Bezig…':prev?'Beoordeling bijwerken':'Versturen'}</Btn></div>;}

// Kids corner with a booking: how many places are left at the chosen time (capacity set in Beheer)
const amsMin=ts=>{const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(ts)).split(':').map(Number);return h*60+m;};
function useKidsFree(date,time,tid,own=0){const s=useBP();const [busy,setBusy]=React.useState(null);
React.useEffect(()=>{if(!s.settings.kidsEnabled||!date)return;let live=true;setBusy(null);BP.act.kidsBusy(date).then(r=>live&&setBusy(r||[])).catch(()=>live&&setBusy([]));return()=>{live=false;};},[date,s.appointments,s.settings.kidsEnabled]);
if(!s.settings.kidsEnabled||!time||!tid||!busy)return null;const [h,m]=time.split(':').map(Number);const a=h*60+m,b=a+BP.tr(tid).dur;
return Math.max(0,own+s.settings.kidsCapacity-busy.filter(x=>amsMin(x.starts_at)<b&&amsMin(x.ends_at)>a).reduce((n,x)=>n+x.kids,0));}
function KidsPicker({date,time,tid,value,onChange,dark,own=0}){const s=useBP();const free=useKidsFree(date,time,tid,own);
React.useEffect(()=>{if(!own&&free!=null&&value>free)onChange(free);},[free]);
if(!s.settings.kidsEnabled)return null;
return <div style={{marginTop:16,padding:14,borderRadius:16,background:dark?BPC.paper:BPC.card,border:`1px solid ${BPC.line}`}}>
<div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}><Ico n="kid" s={20} c={BPC.esp}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>Kinderhoek</div><div style={{fontSize:12,color:BPC.ink3}}>Speelhoek voor de kleintjes tijdens je behandeling</div></div></div>
<div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[0,1,2,3].map(n=>{const off=n>0&&(free==null?!time:n>free);const on=value===n;return <div key={n} onClick={()=>!off&&onChange(n)} style={{padding:'8px 13px',borderRadius:99,fontSize:13,fontWeight:600,cursor:off?'default':'pointer',background:on?BPC.ink:BPC.paper2,color:on?'#fff':off?BPC.line2:BPC.ink,textDecoration:off&&n>0&&time?'line-through':'none'}}>{n===0?'Niet nodig':n===1?'1 kind':n+' kinderen'}</div>;})}</div>
<div style={{fontSize:12,color:BPC.ink3,marginTop:8}}>{!time?'Kies eerst een tijd.':free===0?`De kinderhoek is om ${time} vol.`:free!=null?`Om ${time} nog ${free} ${free===1?'plek':'plekken'} vrij.`:''}</div></div>;}

function MemberCard({s,me,plan,onClick}){const used=BP.usedThisMonth(me.id);const lim=BP.limitThisMonth(me.id);const left=Math.max(0,lim-used);const end=new Date();end.setMonth(end.getMonth()+1,1);
return <div onClick={onClick} style={{background:BPC.esp,color:'#fff',borderRadius:24,padding:20,position:'relative',overflow:'hidden',cursor:onClick?'pointer':'default'}}>
<div style={{position:'absolute',right:-40,top:-40,width:170,height:170,borderRadius:'50%',border:'1px solid rgba(255,255,255,.14)'}}></div><div style={{position:'absolute',right:-10,top:-10,width:110,height:110,borderRadius:'50%',border:'1px solid rgba(255,255,255,.1)'}}></div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><img src={WORDMARK} alt="" style={{height:12,filter:'invert(1)',opacity:.9}}/><span style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',opacity:.7}}>{me.status==='gepauzeerd'?'Gepauzeerd':'Member'}</span></div>
<div style={{fontFamily:BPC.serif,fontSize:34,fontWeight:500,margin:'26px 0 4px'}}>{plan.name}</div>
<div style={{fontSize:13,opacity:.75,marginBottom:16}}>Nog {left} van {lim} behandelingen deze maand</div>
<div style={{display:'flex',gap:5}}>{Array.from({length:lim}).map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<used?'rgba(255,255,255,.3)':'#fff'}}></div>)}</div>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:12}}><div style={{fontSize:11.5,opacity:.6}}>Vernieuwt op {end.toLocaleDateString('nl-NL',{day:'numeric',month:'long'})}</div>{me.checkinCode&&<PassButton/>}</div></div>;}
// What needs attention in the membership: an open payment, a running cancellation, a pause
function MembershipNotice({Button,toast,wide}){const s=useBP();const me=BP.mem(s.me),plan=BP.plan(me.plan);const [busy,setBusy]=React.useState(false);
const d=x=>x?new Date(x+'T12:00:00').toLocaleDateString('nl-NL',{day:'numeric',month:'long'}):'';
const run=(action,msg)=>{setBusy(true);BP.act.membership(action,{}).then(r=>{if(r&&r.checkoutUrl){window.location.href=r.checkoutUrl;return;}setBusy(false);toast(msg);}).catch(e=>{setBusy(false);toast(e.message);});};
let bad=false,text=null,btn=null;
if(me.status==='betaling mislukt'){bad=true;text=`Je laatste betaling van ${BP.eur(plan.price)} is niet gelukt. Zodra die betaald is, kun je weer boeken binnen je membership.`;btn=['Nu betalen',()=>run('settle')];}
else if(me.cancelAt&&me.status!=='opgezegd'){text=`Je hebt opgezegd. Je membership loopt tot ${d(me.cancelAt)}; daarna stopt de incasso.`;btn=['Opzegging intrekken',()=>run('uncancel','Fijn dat je blijft. Je membership loopt door.')];}
else if(me.status==='gepauzeerd'){text=`Je membership is gepauzeerd tot ${d(me.pausedUntil)}. Daarna gaat de incasso weer door.`;}
if(!text)return null;
return <div style={{display:'flex',flexDirection:wide?'row':'column',alignItems:wide?'center':'stretch',gap:12,padding:16,borderRadius:18,background:bad?BPC.bordSoft:BPC.goldSoft,color:bad?BPC.bord:BPC.ink,fontSize:13.5,lineHeight:1.5}}><div style={{flex:1}}>{text}</div>{btn&&<Button small kind={bad?'primary':'ghost'} disabled={busy} onClick={btn[1]}>{btn[0]}</Button>}</div>;}
const UnpaidPill=()=><Pill tone="warn">nog betalen</Pill>;
// Pay a reserved single treatment (again, e.g. after cancelling at Mollie) while the time is still held
const payNow=(a,toast)=>BP.act.payAppointment(a.groupId).then(r=>{window.location.href=r.checkoutUrl;}).catch(e=>toast(e.message));

function ApptCard({a,onClick,compact}){const t=BP.tr(a.treatmentId),c=BP.cat(t.cat),st=BP.staff(a.staffId);return <div onClick={onClick} style={{display:'flex',gap:14,alignItems:'center',background:BPC.card,border:`1px solid ${BPC.line}`,borderRadius:20,padding:12,cursor:'pointer'}}>
<Thumb src={c.img} size={compact?56:72} r={14}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,color:BPC.ink3,textTransform:'capitalize'}}>{BP.fmtDate(a.date,{weekday:'short',day:'numeric',month:'short'})} · {a.time}</div>
<div style={{fontFamily:BPC.serif,fontSize:21,fontWeight:600,margin:'2px 0',lineHeight:1.1}}>{t.name}</div><div style={{fontSize:12,color:BPC.ink2}}>met {st.name.split(' ')[0]} · {a.room}</div></div>
{a.unpaid?<UnpaidPill/>:a.status!=='gepland'?<Pill tone={statusTone(a.status)}>{a.status}</Pill>:<Ico n="chev" s={16} c={BPC.ink3}/>}</div>;}
function Home(){const s=useBP();const m=useM();const me=BP.mem(s.me),plan=BP.plan(me.plan);const h=new Date().getHours();
const next=s.appointments.filter(a=>a.memberId===me.id&&a.status==='gepland'&&a.date>=BP.today).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
const routine=(me.routine||[]).map(BP.tr).filter(t=>t.cat);const day=(new Date().getDay()+6)%7;const hrs=s.settings.hours[day]||['',''];
return <div style={{padding:'66px 20px 110px'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}><img src={WORDMARK} alt="BeautyPass" style={{height:15}}/><div onClick={()=>m.setTab('profile')} style={{cursor:'pointer'}}><Avatar name={me.name} size={36}/></div></div>
<Eyebrow>{h<12?'Goedemorgen':h<18?'Goedemiddag':'Goedenavond'}</Eyebrow><Serif size={40} style={{margin:'6px 0 22px'}} it="time for you.">{me.name.split(' ')[0]},</Serif>
<MemberCard s={s} me={me} plan={plan} onClick={()=>m.setTab('membership')}/><div style={{marginTop:16}}><MembershipNotice Button={Btn} toast={m.toast}/></div><div style={{marginTop:14}}><RoutineCta onClick={()=>m.push({k:'visitplan'})}/></div>
{(()=>{const r=BP.toReview();return r?<div onClick={()=>m.push({k:'appt',id:r.id})} style={{display:'flex',alignItems:'center',gap:12,marginTop:18,padding:14,borderRadius:18,background:BPC.goldSoft,cursor:'pointer'}}><span style={{fontSize:22,color:BPC.gold}}>★</span><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>Hoe was je {BP.tr(r.treatmentId).name}?</div><div style={{fontSize:12.5,color:BPC.ink2}}>Geef je beoordeling in een paar seconden</div></div><Ico n="chev" s={16} c={BPC.ink3}/></div>:null;})()}
<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'28px 0 12px'}}><Serif size={24}>Je volgende moment</Serif>{next&&<span onClick={()=>m.setTab('appts')} style={{fontSize:13,color:BPC.ink2,cursor:'pointer'}}>Alles</span>}</div>
{next&&next.visitId&&myVisits(s).find(v=>v.id===next.visitId)?<VisitCard v={myVisits(s).find(v=>v.id===next.visitId)} onClick={()=>m.push({k:'visit',id:next.visitId})}/>:next?<ApptCard a={next} onClick={()=>m.push({k:'appt',id:next.id})}/>:<Card style={{textAlign:'center',padding:24}}><div style={{fontSize:14,color:BPC.ink2,marginBottom:14}}>Je hebt nog niets gepland.</div><Btn onClick={()=>m.setTab('book')}>Plan een behandeling</Btn></Card>}
{routine.length>0&&<><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',margin:'28px 0 12px'}}><Serif size={24}>Snel boeken</Serif><span onClick={()=>m.push({k:'routine'})} style={{fontSize:13,color:BPC.ink2,cursor:'pointer'}}>Routine aanpassen</span></div>
<div className="bp-scroll" style={{display:'flex',gap:10,overflowX:'auto',margin:'0 -20px',padding:'0 20px'}}>{routine.map(t=>{const c=BP.cat(t.cat);return <div key={t.id} onClick={()=>m.push({k:'book',tid:t.id})} style={{width:136,flexShrink:0,cursor:'pointer'}}><div style={{position:'relative'}}><img src={c.img} alt="" style={{width:136,height:160,objectFit:'cover',borderRadius:18,display:'block'}}/>{!plan.included.includes(t.id)&&<div style={{position:'absolute',top:8,left:8}}><Pill tone="warn">Niet inbegrepen</Pill></div>}</div><div style={{fontSize:13,fontWeight:600,marginTop:8}}>{t.name}</div><div style={{fontSize:12,color:BPC.ink3}}>{t.dur} min</div></div>;})}</div></>}
<Card style={{marginTop:28,display:'flex',gap:14,alignItems:'center'}}><Thumb src="/assets/tour-arrival-v26.webp" size={56}/><div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>The BeautyPass house</div><div style={{fontSize:12.5,color:BPC.ink2,marginTop:2}}>{hrs[1]?`Vandaag open ${hrs[1]} – ${hrs[2]}`:'Vandaag gesloten'} · Amsterdam</div></div></Card></div>;}
// For now members book only what is in their membership and within this month's number
function bookBlock(s,me,plan,tid,resched){if(s.settings.allowExtras||resched||!tid)return null;
if(!plan.included.includes(tid)){const lp=lowestPlanFor(s,tid);return {kind:'plan',text:lp?`Zit in ${lp.name}`:'Niet in je membership',long:`${BP.tr(tid).name} zit niet in je ${plan.name}-membership${lp?`, wel in ${lp.name}`:''}.`};}
if(BP.limitThisMonth(me.id)-BP.usedThisMonth(me.id)<=0){const n=new Date();n.setMonth(n.getMonth()+1,1);return {kind:'credit',text:'Tegoed op',long:`Je tegoed voor deze maand is op. Vanaf ${n.toLocaleDateString('nl-NL',{day:'numeric',month:'long'})} plan je weer, of kies een groter membership.`};}
return null;}
function LockTag({b}){return <Pill tone="neutral"><Ico n="lock" s={11}/>{b.text}</Pill>;}

/* ---------- Your routine in one visit ---------- */
// Treatments that can be part of a visit (the six hands and duo packages are booked on their own)
const visitable=s=>s.treatments.filter(t=>t.active!==false&&t.room==='solo');
// Which chosen treatments fall within the monthly number (most expensive first) and what is settled in the salon
function visitCredits(me,plan,tids,date,back=0){const sameMonth=!date||date.slice(0,7)===BP.today.slice(0,7);let left=(sameMonth?BP.limitThisMonth(me.id)-BP.usedThisMonth(me.id):plan.perMonth)+back;
const out={inc:[],extra:[],amount:0};for(const t of tids.map(BP.tr).sort((a,b)=>b.price-a.price)){if(plan.included.includes(t.id)&&left>0){out.inc.push(t.id);left--;}else{out.extra.push(t.id);out.amount+=t.price;}}return out;}
function useVisitSlots(tids,date,skip){const [st,setSt]=React.useState({loading:true,list:[]});const key=tids.slice().sort().join(',')+'|'+date+'|'+(skip||'');
React.useEffect(()=>{if(!tids.length){setSt({loading:false,list:[]});return;}let live=true;setSt(x=>({...x,loading:true}));
BP.act.visitSlots(tids,date,skip).then(r=>live&&setSt({loading:false,list:r||[]})).catch(e=>live&&setSt({loading:false,list:[],error:e.message}));return()=>{live=false;};},[key]);return st;}
const durText=min=>min>=60?Math.floor(min/60)+' uur'+(min%60?' '+(min%60)+' min':''):min+' min';
const hm=(t,add)=>{const [h,m]=t.split(':').map(Number);const x=h*60+m+add;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
// The appointments of a booked visit in the same shape as a plan (treatments starting together form one wave)
function visitPlan(list){const segs=list.slice().sort((a,b)=>a.time.localeCompare(b.time));const starts=[...new Set(segs.map(a=>a.time))];
const out=segs.map(a=>({treatment:a.treatmentId,staff:a.staffId,time:a.time,until:hm(a.time,BP.tr(a.treatmentId).dur),wave:starts.indexOf(a.time),id:a.id}));
const end=out.reduce((e,x)=>x.until>e?x.until:e,out[0]?out[0].until:'');return {segments:out,start:starts[0],end,minutes:out.length?(mins(end)-mins(starts[0])):0};}
const mins=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
// The visits of this member (upcoming, still planned), each with its appointments
function myVisits(s){const by={};s.appointments.filter(a=>a.memberId===s.me&&a.visitId&&a.status==='gepland').forEach(a=>{(by[a.visitId]=by[a.visitId]||[]).push(a);});
return Object.entries(by).map(([id,list])=>({id,date:list[0].date,list,plan:visitPlan(list)})).sort((a,b)=>(a.date+a.plan.start).localeCompare(b.date+b.plan.start));}
// Plan: treatments that start together are shown side by side
function VisitTimeline({plan,dark,onPart}){if(!plan||!plan.segments.length)return null;const waves={};plan.segments.forEach(x=>{(waves[x.wave]=waves[x.wave]||[]).push(x);});
return <div style={{display:'grid',gap:12}}>{Object.keys(waves).sort((a,b)=>a-b).map(k=>{const w=waves[k];return <div key={k} style={{display:'flex',gap:12}}><div style={{width:48,flexShrink:0,fontFamily:BPC.serif,fontSize:19,fontWeight:600,paddingTop:8}}>{w[0].time}</div>
<div style={{flex:1,minWidth:0,display:'grid',gap:6}}>{w.length>1&&<div style={{fontSize:10.5,fontWeight:700,letterSpacing:1.2,textTransform:'uppercase',color:dark?'rgba(255,255,255,.75)':BPC.esp,marginTop:2}}>Tegelijk · {w.length} specialisten</div>}
<div style={{display:'grid',gridTemplateColumns:w.length>1?'repeat(auto-fit,minmax(130px,1fr))':'1fr',gap:6}}>{w.map(x=><div key={x.treatment} style={{padding:'10px 12px',borderRadius:14,background:dark?'rgba(255,255,255,.1)':BPC.card,border:dark?'none':`1px solid ${BPC.line}`,minWidth:0}}>
<div style={{fontSize:14,fontWeight:600}}>{BP.tr(x.treatment).name}</div><div style={{fontSize:12,opacity:.7}}>{x.time} – {x.until} · {BP.staff(x.staff).name.split(' ')[0]}</div>
{onPart&&x.id&&<div onClick={()=>onPart(x)} style={{fontSize:12,marginTop:6,textDecoration:'underline',cursor:'pointer',opacity:.75}}>Alleen deze annuleren</div>}</div>)}</div></div></div>;})}</div>;}
// Choose the treatments: the routine from the profile is ticked, others can be added
function VisitPicker({tids,setTids,routine}){const s=useBP();const [more,setMore]=React.useState(false);const me=BP.mem(s.me),plan=BP.plan(me.plan);const all=visitable(s).filter(t=>s.settings.allowExtras||plan.included.includes(t.id));const base=[...new Set([...routine,...tids])].filter(id=>all.some(t=>t.id===id));const others=all.filter(t=>!base.includes(t.id));
const tog=id=>setTids(tids.includes(id)?tids.filter(x=>x!==id):[...tids,id].slice(0,6));
return <div><div style={{display:'grid',gap:8}}>{base.map(id=>{const t=BP.tr(id),on=tids.includes(id);return <div key={id} onClick={()=>tog(id)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:16,background:BPC.card,border:`1.5px solid ${on?BPC.ink:BPC.line}`,cursor:'pointer',opacity:on?1:.6}}>
<div style={{width:22,height:22,borderRadius:7,border:`1.5px solid ${on?BPC.ink:BPC.line2}`,background:on?BPC.ink:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<Ico n="check" s={13} c="#fff" w={2.5}/>}</div>
<div style={{flex:1,minWidth:0}}><div style={{fontSize:14.5,fontWeight:600}}>{t.name}</div><div style={{fontSize:12,color:BPC.ink3}}>{t.dur} min</div></div>{!on&&<span style={{fontSize:12,color:BPC.ink3}}>deze keer niet</span>}</div>;})}</div>
{others.length>0&&(more?<div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>{others.map(t=><div key={t.id} onClick={()=>tog(t.id)} style={{padding:'8px 13px',borderRadius:99,fontSize:13,cursor:'pointer',background:BPC.paper2,display:'flex',alignItems:'center',gap:6}}><Ico n="plus" s={12}/>{t.name}</div>)}</div>
:<div onClick={()=>setMore(true)} style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:12,fontSize:13,fontWeight:600,cursor:'pointer'}}><Ico n="plus" s={14}/>Behandeling toevoegen</div>)}</div>;}
function VisitCreditNote({cr,plan}){const s=useBP();if(!cr.inc.length&&!cr.extra.length)return null;
if(!s.settings.allowExtras&&cr.extra.length)return <div style={{padding:12,borderRadius:14,background:BPC.goldSoft,fontSize:13,lineHeight:1.45,color:BPC.ink2}}><b style={{color:BPC.gold}}>Je hebt deze maand nog {cr.inc.length} {cr.inc.length===1?'behandeling':'behandelingen'} in je {plan.name}-membership.</b> Vink er {cr.extra.length} uit, of plan {cr.extra.length===1?'die':'die'} volgende maand.</div>;
return <div style={{padding:12,borderRadius:14,background:cr.extra.length?BPC.goldSoft:BPC.sageSoft,fontSize:13,lineHeight:1.45,color:BPC.ink2}}>
<b style={{color:cr.extra.length?BPC.gold:BPC.sage}}>{cr.inc.length} binnen je {plan.name}-membership</b>{cr.extra.length>0&&<> · {cr.extra.map(id=>BP.tr(id).name).join(', ')} reken je los af in de salon ({BP.eur(cr.amount)})</>}</div>;}
function VisitTimes({slots,time,setTime}){if(slots.loading)return <div style={{fontSize:13,color:BPC.ink3}}>Tijden zoeken…</div>;
if(!slots.list.length)return <div style={{fontSize:13,color:BPC.ink2,lineHeight:1.45}}>{slots.error||'Op deze dag past je routine niet meer. Kies een andere dag of laat een behandeling weg.'}</div>;
return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(96px,1fr))',gap:8}}>{slots.list.map(x=>{const on=time===x.slot;return <div key={x.slot} onClick={()=>setTime(x.slot)} style={{padding:'9px 0',textAlign:'center',borderRadius:12,cursor:'pointer',background:on?BPC.esp:BPC.card,color:on?'#fff':BPC.ink,border:`1px solid ${on?BPC.esp:BPC.line}`}}>
<div style={{fontSize:14,fontWeight:700}}>{x.slot}</div><div style={{fontSize:11,opacity:.7}}>tot {x.plan.end}</div></div>;})}</div>;}
function VisitDays({days,date,setDate}){return <div className="bp-scroll" style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>{days.map(d=>{const on=d===date,dt=new Date(d+'T12:00:00');return <div key={d} onClick={()=>setDate(d)} style={{flexShrink:0,width:54,padding:'10px 0',borderRadius:16,textAlign:'center',cursor:'pointer',background:on?BPC.ink:BPC.card,color:on?'#fff':BPC.ink,border:`1px solid ${on?BPC.ink:BPC.line}`}}><div style={{fontSize:11,opacity:.7,textTransform:'capitalize'}}>{d===BP.today?'vandaag':d===BP.addDays(BP.today,1)?'morgen':dt.toLocaleDateString('nl-NL',{weekday:'short'})}</div><div style={{fontFamily:BPC.serif,fontSize:22,fontWeight:600}}>{dt.getDate()}</div></div>;})}</div>;}
// Everything the planner needs (phone and website share it)
function useRoutinePlanner(replace){const s=useBP();const me=BP.mem(s.me),plan=BP.plan(me.plan);
const old=replace?s.appointments.filter(a=>a.visitId===replace&&a.status==='gepland'):[];
const routine=(old.length?old.map(a=>a.treatmentId):(me.routine||[])).filter(id=>visitable(s).some(t=>t.id===id)&&(s.settings.allowExtras||plan.included.includes(id)));
const [tids,setTids]=React.useState(routine);const days=BP.bookDays();
const [date,setDate]=React.useState(()=>(old[0]&&days.includes(old[0].date)?old[0].date:days[0])||BP.addDays(BP.today,1));
const [time,setTime]=React.useState(null);const pr=me.prefs||{};const [kids,setKids]=React.useState(pr.kids?(pr.kidsCount||1):0);const [busy,setBusy]=React.useState(false);const [done,setDone]=React.useState(null);
const slots=useVisitSlots(tids,date,replace);const sel=slots.list.find(x=>x.slot===time);const cr=visitCredits(me,plan,tids,date,old.length);const over=!s.settings.allowExtras&&cr.extra.length>0;
React.useEffect(()=>{setTime(null);},[tids.join(','),date]);
const book=async(toast)=>{setBusy(true);try{const r=await BP.act.bookVisit({tids,date,time,kids,replace});setDone({...r,date,plan:sel.plan});}catch(e){toast(e.message);}setBusy(false);};
return {over,s,me,plan,old,routine,tids,setTids,days,date,setDate,time,setTime,kids,setKids,busy,done,slots,sel,cr,book};}
function VisitKids({p}){const s=p.s;if(!s.settings.kidsEnabled)return null;return <div><div style={{fontSize:13.5,fontWeight:600,marginBottom:8}}>Kinderhoek</div><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[0,1,2,3].map(n=><div key={n} onClick={()=>p.setKids(n)} style={{padding:'7px 12px',borderRadius:99,fontSize:12.5,fontWeight:600,cursor:'pointer',background:p.kids===n?BPC.ink:BPC.paper2,color:p.kids===n?'#fff':BPC.ink}}>{n===0?'Niet nodig':n===1?'1 kind':n+' kinderen'}</div>)}</div></div>;}
// Home: one button to plan the whole routine
function RoutineCta({onClick,wide}){const s=useBP();const me=BP.mem(s.me);if(!s.settings.visitsReady)return null;const r=(me.routine||[]).filter(id=>visitable(s).some(t=>t.id===id));if(!r.length)return null;
const total=r.reduce((n,id)=>n+BP.tr(id).dur,0);
return <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:14,padding:wide?'18px 20px':16,borderRadius:22,background:BPC.esp,color:'#fff',cursor:'pointer'}}><div style={{width:44,height:44,borderRadius:22,background:'rgba(255,255,255,.14)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Ico n="spark" s={20} c="#fff"/></div>
<div style={{flex:1,minWidth:0}}><div style={{fontSize:15.5,fontWeight:700}}>Plan je routine</div><div style={{fontSize:12.5,opacity:.8,marginTop:2}}>{r.length} {r.length===1?'behandeling':'behandelingen'} in één bezoek{r.length>1?' · vaak sneller dan '+durText(total):''}</div></div><Ico n="chev" s={18} c="#fff"/></div>;}

Object.assign(window,{bookBlock,LockTag,TrustRow,visitEstimate,visitable,visitCredits,useVisitSlots,durText,visitPlan,myVisits,VisitTimeline,VisitPicker,VisitCreditNote,VisitTimes,VisitDays,useRoutinePlanner,VisitKids,RoutineCta,mailSuggestion,MembershipNotice,UnpaidPill,payNow,WatchDay,ReviewForm,KidsPicker,useKidsFree,SheetFixed,ScreenWide,MCtx,useM,Btn,Screen,Sheet,Card,Row,Field,IncludedTag,Thumb,lowestPlanFor,Onboarding,Home,MemberCard,ApptCard});
