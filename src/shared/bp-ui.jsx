const BPC={paper:'#faf9f6',paper2:'#f3efe8',card:'#ffffff',line:'#e6e0d6',line2:'#d8d0c3',ink:'#1d1a17',ink2:'#5f5850',ink3:'#958c80',esp:'#4b2e22',espSoft:'#efe6dd',bord:'#7a2633',bordSoft:'#f5e4e4',sage:'#5f6e4f',sageSoft:'#e8ece0',gold:'#a07c4f',goldSoft:'#f3ebdd',
serif:'"Cormorant Garamond", "Times New Roman", serif',sans:'"Manrope", -apple-system, system-ui, sans-serif'};
const WORDMARK='/assets/beautypass-wordmark-v6-small-ink.svg';
function useBP(){const [s,setS]=React.useState(BP.get());React.useEffect(()=>BP.subscribe(x=>setS({...x})),[]);return s;}
const ICONS={scan:'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7 12h10',
home:'M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z',
cal:'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
plus:'M12 5v14M5 12h14',
card:'M3 6h18v12H3zM3 10h18',
user:'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
spark:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
chev:'M9 6l6 6-6 6',back:'M15 6l-6 6 6 6',down:'M6 9l6 6 6-6',
check:'M5 12.5l4.5 4.5L19 7',x:'M6 6l12 12M18 6L6 18',
clock:'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
pin:'M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
lock:'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
users:'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 010 6.5M18 14.8c1.8.7 3 2.5 3.5 5.2',
layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
team:'M8 8a3 3 0 100-6 3 3 0 000 6zM16 8a3 3 0 100-6 3 3 0 000 6zM2 15c.8-2.5 3-4 6-4s5.2 1.5 6 4M12 15c.8-2.5 2.6-4 4-4 3 0 5.2 1.5 6 4M3 21h18',
mail:'M3 6h18v12H3zM3 7l9 6 9-6',
cog:'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
search:'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
bell:'M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20.5a2 2 0 004 0',
euro:'M17 6.5A6.5 6.5 0 007 12a6.5 6.5 0 0010 5.5M4 10h9M4 14h9',
pause:'M8 5v14M16 5v14',
doc:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
cup:'M5 8h11v6a5 5 0 01-5 5h-1a5 5 0 01-5-5zM16 10h2a2 2 0 010 4h-2M8 3v2M11 3v2',
logout:'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
dots:'M5 12h.01M12 12h.01M19 12h.01',
edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
arrow:'M5 12h14M13 6l6 6-6 6',
filter:'M4 5h16l-6 8v6l-4-2v-4z',
refresh:'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6'};
function Ico({n,s=20,c='currentColor',w=1.6,style}){return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,...style}}><path d={ICONS[n]}/></svg>;}
function Serif({children,it,size=34,style}){return <div style={{fontFamily:BPC.serif,fontSize:size,lineHeight:1.02,fontWeight:500,letterSpacing:-0.3,color:BPC.ink,textWrap:'pretty',...style}}>{children}{it&&<>{' '}<em style={{fontStyle:'italic',fontWeight:400}}>{it}</em></>}</div>;}
function Eyebrow({children,style}){return <div style={{fontSize:10.5,letterSpacing:1.8,textTransform:'uppercase',fontWeight:600,color:BPC.ink3,...style}}>{children}</div>;}
function Pill({children,tone='neutral',style}){const t={neutral:[BPC.paper2,BPC.ink2],ok:[BPC.sageSoft,BPC.sage],warn:[BPC.goldSoft,BPC.gold],bad:[BPC.bordSoft,BPC.bord],esp:[BPC.esp,'#fff'],ink:[BPC.ink,'#fff']}[tone];return <span style={{display:'inline-flex',alignItems:'center',gap:5,background:t[0],color:t[1],fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:99,whiteSpace:'nowrap',...style}}>{children}</span>;}
const statusTone=s=>({actief:'ok',gepland:'neutral',afgerond:'ok','betaling mislukt':'bad','no-show':'bad',gepauzeerd:'warn',opgezegd:'neutral',geannuleerd:'neutral',wachtend:'neutral',uitgenodigd:'warn',member:'ok',betaald:'ok'}[s]||'neutral');
function Toggle({on,onChange}){return <div onClick={()=>onChange(!on)} style={{width:44,height:26,borderRadius:13,background:on?BPC.esp:BPC.line2,position:'relative',cursor:'pointer',transition:'background .2s',flexShrink:0}}><div style={{position:'absolute',top:3,left:on?21:3,width:20,height:20,borderRadius:10,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.2)',transition:'left .2s'}}></div></div>;}
// Initials without Dutch particles ("Anna de Vries" → AV), also for names typed in lower case
const PARTICLES=['van','de','der','den','het','ten','ter','te','op','in',"'t",'la','le','du','von'];
function initials(name){const w=String(name||'').trim().split(/\s+/).filter(Boolean);const main=w.filter(x=>!PARTICLES.includes(x.toLowerCase()));const use=(main.length?main:w);
return (use.length>1?use[0][0]+use[use.length-1][0]:(use[0]||'').slice(0,1)).toUpperCase();}
function Avatar({name,size=36,bg=BPC.espSoft,color=BPC.esp}){const i=initials(name);return <div style={{width:size,height:size,borderRadius:size/2,background:bg,color,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:BPC.serif,fontSize:size*0.42,fontWeight:600,flexShrink:0}}>{i}</div>;}
Object.assign(window,{BPC,WORDMARK,useBP,Ico,Serif,Eyebrow,Pill,statusTone,Toggle,Avatar});

/* ---------- Real-data helpers ---------- */
// Free start times for a treatment on a day, straight from the database (same check as booking)
function useSlots(tid,date,skip){const [st,setSt]=React.useState({loading:false,map:{}});const s=useBP();const stamp=s.appointments.length+'|'+(s.appointments[0]&&s.appointments[0].id);
React.useEffect(()=>{if(!tid||!date){setSt({loading:false,map:{}});return;}let live=true;setSt(x=>({...x,loading:true}));
BP.act.slotsFor(tid,date,skip).then(rows=>{if(live)setSt({loading:false,map:Object.fromEntries((rows||[]).map(r=>[r.slot,r.staff_ids||[]]))});}).catch(()=>{if(live)setSt({loading:false,map:{}});});return()=>{live=false;};},[tid,date,skip,stamp]);return st;}
// "Zet in agenda": a calendar file for the appointment
function downloadIcs(a){const t=BP.tr(a.treatmentId);const s=new Date(a.startsAt);const e=new Date(s.getTime()+t.dur*60000);const f=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BeautyPass//NL','BEGIN:VEVENT','UID:'+a.id+'@beautypass.nl','DTSTAMP:'+f(new Date()),'DTSTART:'+f(s),'DTEND:'+f(e),'SUMMARY:'+t.name+' · BeautyPass','LOCATION:BeautyPass house\\, Amsterdam','END:VEVENT','END:VCALENDAR'].join('\r\n');
const url=URL.createObjectURL(new Blob([body],{type:'text/calendar'}));const l=document.createElement('a');l.href=url;l.download='beautypass-afspraak.ics';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function Loading({label}){return <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:18,background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink2}}><img src={WORDMARK} alt="BeautyPass" style={{height:15}}/><div style={{width:28,height:28,borderRadius:14,border:`2.5px solid ${BPC.line}`,borderTopColor:BPC.esp,animation:'bpSpin .8s linear infinite'}}></div>{label&&<div style={{fontSize:13}}>{label}</div>}</div>;}
Object.assign(window,{useSlots,downloadIcs,Loading});
