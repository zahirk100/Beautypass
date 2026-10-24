/* ---------- Member pass: QR code + barcode (Code 128) with the personal check-in code ---------- */
import qrcode from 'qrcode-generator';

// QR as one SVG path (error correction M: still readable from a cracked or dim phone screen)
function QrSvg({text,size=220}){const d=React.useMemo(()=>{const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount();let p='';
for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))p+=`M${c+4} ${r+4}h1v1h-1z`;return {p,n:n+8};},[text]);
return <svg width={size} height={size} viewBox={`0 0 ${d.n} ${d.n}`} shapeRendering="crispEdges" role="img" aria-label={'QR-code '+text} style={{display:'block',background:'#fff'}}><path d={d.p} fill="#1d1a17"/></svg>;}

// Code 128 (set B) for 1D hand scanners: bar/space widths per value, start B = 104, stop = 106
const C128=('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 '+
'221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 '+
'231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 '+
'314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 '+
'111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 '+
'114131 311141 411131 211412 211214 211232 2331112').split(' ');
function code128(text){const vals=[104,...[...text].map(ch=>ch.charCodeAt(0)-32)];const check=vals.reduce((s,v,i)=>s+v*(i||1),0)%103;
return [...vals,check,106].map(v=>C128[v]).join('');}
// Every bar module gets a whole number of screen pixels; scaled bars blur and become unreadable for scanners
function BarcodeSvg({text,height=56,max=300}){const bars=React.useMemo(()=>{const w=code128(text);const out=[];let x=10;
[...w].forEach((n,i)=>{n=+n;if(i%2===0)out.push([x,n]);x+=n;});return {out,total:x+10};},[text]);
const dpr=window.devicePixelRatio||1;const per=Math.max(1,Math.floor(max*dpr/bars.total));const width=bars.total*per/dpr;
return <svg width={width} height={height} viewBox={`0 0 ${bars.total} 40`} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label={'Streepjescode '+text} style={{display:'block',background:'#fff',margin:'0 auto'}}>
{bars.out.map(([x,w],i)=><rect key={i} x={x} y={0} width={w} height={40} fill="#1d1a17"/>)}</svg>;}

const fmtCode=c=>String(c||'').replace(/^(BP)(.{5})(.{5})$/,'$1 $2 $3');

// Full-screen pass (portal, so it works from every screen and on phone and desktop alike)
function MemberPass({open,onClose}){const s=useBP();const me=BP.mem(s.me);const [busy,setBusy]=React.useState(false);const [ask,setAsk]=React.useState(false);
React.useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[open]);
if(!open||!me||!me.checkinCode)return null;const plan=BP.plan(me.plan);
return ReactDOM.createPortal(<div onClick={onClose} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(29,26,23,.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'bpFade .2s',fontFamily:BPC.sans}}>
<div onClick={e=>e.stopPropagation()} style={{width:'min(100%,380px)',background:BPC.paper,borderRadius:28,padding:'26px 22px 20px',textAlign:'center',boxShadow:'0 30px 80px rgba(0,0,0,.25)',maxHeight:'calc(100dvh - 32px)',overflowY:'auto',boxSizing:'border-box'}}>
<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}><img src={WORDMARK} alt="BeautyPass" style={{height:12}}/><div onClick={onClose} role="button" aria-label="Sluiten" style={{width:34,height:34,borderRadius:17,border:`1px solid ${BPC.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:BPC.card}}><Ico n="x" s={16}/></div></div>
<Serif size={30}>{me.name}</Serif><div style={{fontSize:13,color:BPC.ink2,margin:'4px 0 18px'}}>{plan.name}-member{me.status!=='actief'?' · '+me.status:''}</div>
<div style={{background:'#fff',borderRadius:20,padding:18,border:`1px solid ${BPC.line}`,display:'grid',justifyItems:'center',gap:14}}>
<QrSvg text={me.checkinCode} size={210}/><div style={{width:'100%'}}><BarcodeSvg text={me.checkinCode} max={290}/></div>
<div style={{fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace',fontSize:17,letterSpacing:2,fontWeight:600}}>{fmtCode(me.checkinCode)}</div></div>
<div style={{fontSize:13,color:BPC.ink2,lineHeight:1.5,margin:'16px 4px 6px'}}>Laat je pas scannen bij binnenkomst. Zet je scherm op de hoogste helderheid.</div>
{!ask?<div onClick={()=>setAsk(true)} style={{fontSize:12.5,color:BPC.ink3,cursor:'pointer',marginTop:8}}>Pas kwijt of gedeeld? Vraag een nieuwe aan</div>
:<div style={{display:'grid',gap:8,marginTop:10}}><div style={{fontSize:12.5,color:BPC.ink2}}>Je oude pas werkt daarna niet meer.</div>
<Btn kind="ghost" disabled={busy} onClick={async()=>{setBusy(true);try{await BP.act.newCheckinCode();setAsk(false);}catch(e){BP.showError(e);}setBusy(false);}}>{busy?'Bezig…':'Nieuwe pas maken'}</Btn></div>}
</div></div>,document.body);}

// Small button for on the member card
function PassButton({style}){const [open,setOpen]=React.useState(false);
return <><div role="button" onClick={e=>{e.stopPropagation();setOpen(true);}} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:99,background:'rgba(255,255,255,.16)',border:'1px solid rgba(255,255,255,.28)',fontSize:12.5,fontWeight:600,color:'#fff',cursor:'pointer',...style}}>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>Mijn pas</div>
<MemberPass open={open} onClose={()=>setOpen(false)}/></>;}

Object.assign(window,{QrSvg,BarcodeSvg,MemberPass,PassButton,code128});
