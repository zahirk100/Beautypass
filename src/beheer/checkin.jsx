/* ---------- Beheer → Check-in: scan the member pass, see today's treatment, mark arrived, complete ---------- */

// Reads codes from (1) a hand scanner or typing (scanners type the code + Enter) and (2) the camera.
// Camera: the browser's own BarcodeDetector where available (Chrome/Android: QR + Code 128), otherwise jsQR (iPhone: QR).
function Scanner({onCode,busy}){const narrow=useNarrow();const [val,setVal]=React.useState('');const [cam,setCam]=React.useState(false);const [err,setErr]=React.useState('');
const video=React.useRef(null);const input=React.useRef(null);
// Desktop: keep the field focused for a hand scanner (on phones focusing would pop up the keyboard)
React.useEffect(()=>{if(!cam&&!narrow&&input.current)input.current.focus();},[cam,busy]);
React.useEffect(()=>{if(!cam)return;let stream,raf,stop=false,detector=null,jsQR=null;const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d',{willReadFrequently:true});
(async()=>{try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(stop){stream.getTracks().forEach(t=>t.stop());return;}
  video.current.srcObject=stream;await video.current.play();
  if('BarcodeDetector' in window){try{const f=await window.BarcodeDetector.getSupportedFormats();detector=new window.BarcodeDetector({formats:['qr_code','code_128'].filter(x=>f.includes(x))});}catch(e){detector=null;}}
  if(!detector)jsQR=(await import('jsqr')).default;
  const tick=async()=>{if(stop)return;const v=video.current;
    if(v&&v.readyState>=2){let text=null;
      if(detector){const r=await detector.detect(v).catch(()=>[]);if(r.length)text=r[0].rawValue;}
      else{const w=v.videoWidth,h=v.videoHeight,sc=Math.min(1,640/Math.max(w,h));canvas.width=w*sc;canvas.height=h*sc;ctx.drawImage(v,0,0,canvas.width,canvas.height);
        const img=ctx.getImageData(0,0,canvas.width,canvas.height);const r=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});if(r)text=r.data;}
      if(text){if(navigator.vibrate)navigator.vibrate(60);setCam(false);onCode(text);return;}}
    raf=requestAnimationFrame(tick);};
  tick();
}catch(e){setErr(e&&e.name==='NotAllowedError'?'Geef de browser toegang tot de camera (instellingen van de site).':'De camera kon niet worden gestart.');setCam(false);}})();
return()=>{stop=true;cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(t=>t.stop());};},[cam]);
const submit=()=>{const v=val.trim();if(!v)return;setVal('');onCode(v);};
return <APanel>
{cam?<div style={{position:'relative',borderRadius:16,overflow:'hidden',background:'#000',aspectRatio:'4/3',maxHeight:'60vh',marginBottom:12}}>
<video ref={video} playsInline muted style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
<div style={{position:'absolute',inset:'18%',border:'2px solid rgba(255,255,255,.85)',borderRadius:18,boxShadow:'0 0 0 999px rgba(0,0,0,.25)'}}></div>
<div style={{position:'absolute',left:0,right:0,bottom:12,textAlign:'center',color:'#fff',fontSize:13,fontWeight:600}}>Houd de pas in het kader</div></div>:null}
{narrow&&!cam&&<ABtn kind="esp" icon="scan" onClick={()=>{setErr('');setCam(true);}} style={{width:'100%',justifyContent:'center',height:50,marginBottom:10}}>Scan pas met camera</ABtn>}
<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
<div style={{flex:'1 1 220px',position:'relative'}}><input ref={input} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Scan de pas of typ de code" autoComplete="off" autoCapitalize="characters" spellCheck={false}
style={{width:'100%',boxSizing:'border-box',height:46,borderRadius:14,border:`1px solid ${BPC.line2}`,padding:'0 14px',fontFamily:BPC.sans,fontSize:15,background:BPC.card,outline:'none',color:BPC.ink}}/></div>
<ABtn onClick={submit} disabled={busy||!val.trim()} style={{height:46}}>Zoeken</ABtn>
{(!narrow||cam)&&<ABtn kind={cam?'danger':'ghost'} onClick={()=>{setErr('');setCam(!cam);}} style={{height:46}}>{cam?'Camera uit':'Scan met camera'}</ABtn>}</div>
{err&&<div style={{fontSize:12.5,color:BPC.bord,marginTop:10}}>{err}</div>}
<div style={{fontSize:12,color:BPC.ink3,marginTop:10,lineHeight:1.45}}>Een handscanner werkt direct: klik in het veld en scan. Met de camera scan je de QR-code op de pas van de member.</div>
</APanel>;}

const tm=ts=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));

function CheckinResult({res,onAgain,refresh}){const s=useBP();const a=useA();const m=res.member;const p=BP.plan(m.plan);const [busy,setBusy]=React.useState(null);
const act=async(id,fn,ok)=>{setBusy(id);await a.run(fn(),ok);await refresh();setBusy(null);};
const warn={'betaling mislukt':'De laatste betaling is mislukt. Vraag even na voordat de behandeling start.','gepauzeerd':'Dit membership is gepauzeerd.','opgezegd':'Dit membership is opgezegd.','nieuw':'Dit membership is nog niet betaald.'}[m.status];
return <APanel style={{marginTop:14}}>
<div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}><Avatar name={m.name} size={56}/><div style={{flex:1,minWidth:0}}><Serif size={28}>{m.name}</Serif>
<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}><Pill tone={statusTone(m.status)}>{m.status}</Pill><Pill>{p.name}</Pill><Pill>{m.used}/{m.limit} deze maand</Pill></div></div>
<ABtn small kind="ghost" onClick={onAgain}>Volgende scannen</ABtn></div>
{warn&&<div style={{padding:12,borderRadius:12,background:BPC.bordSoft,color:BPC.bord,fontSize:13,marginBottom:12}}>{warn}</div>}
{(m.drink||m.notes||m.team_note)&&<div style={{display:'grid',gap:6,fontSize:13,color:BPC.ink2,padding:'10px 0 14px',borderBottom:`1px solid ${BPC.line}`,marginBottom:14}}>
{m.drink&&<div style={{display:'flex',gap:8}}><Ico n="cup" s={16}/>{m.drink}</div>}{m.notes&&<div style={{display:'flex',gap:8}}><Ico n="doc" s={16}/>{m.notes}</div>}{m.team_note&&<div style={{display:'flex',gap:8,color:BPC.esp}}><Ico n="edit" s={16}/>{m.team_note}</div>}</div>}
<Eyebrow style={{marginBottom:10}}>Vandaag</Eyebrow>
{res.today.length?<div style={{display:'grid',gap:10}}>{res.today.map(x=>{const t=BP.tr(x.treatment),st=BP.staff(x.staff),room=(s.rooms.find(r=>r.id===x.room)||{}).name||'';const done=x.status==='afgerond';
return <div key={x.id} style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',padding:14,borderRadius:16,border:`1px solid ${x.checked_in_at&&!done?BPC.sage:BPC.line}`,background:x.checked_in_at&&!done?BPC.sageSoft:BPC.card}}>
<div style={{fontFamily:BPC.serif,fontSize:22,fontWeight:600,minWidth:56}}>{tm(x.starts_at)}</div>
<div style={{flex:'1 1 160px',minWidth:0}}><div style={{fontWeight:600,fontSize:14}}>{t.name}</div><div style={{fontSize:12.5,color:BPC.ink3}}>{st.name}{room?' · '+room:''}{Number(x.paid)>0?' · los '+BP.eur(x.paid):''}</div>
{x.checked_in_at&&<div style={{fontSize:12,color:BPC.sage,marginTop:3,fontWeight:600}}>Aanwezig sinds {tm(x.checked_in_at)}</div>}</div>
{done?<Pill tone="ok">afgerond</Pill>:!x.confirmed?<Pill tone="warn">wacht op betaling</Pill>:x.status!=='gepland'?<Pill tone={statusTone(x.status)}>{x.status}</Pill>
:!x.checked_in_at?<ABtn disabled={busy===x.id} onClick={()=>act(x.id,()=>BP.act.arrive(x.id),m.name.split(' ')[0]+' is aanwezig')}>{busy===x.id?'Bezig…':'Aanwezig melden'}</ABtn>
:<ABtn kind="esp" disabled={busy===x.id} onClick={()=>act(x.id,()=>BP.act.setApptStatus(x.id,'afgerond'),'Afgerond · telt als gebruikte behandeling')}>{busy===x.id?'Bezig…':'Behandeling afronden'}</ABtn>}</div>;})}</div>
:<div style={{fontSize:14,color:BPC.ink2,lineHeight:1.5}}>Geen afspraak vandaag.{res.next?<> Volgende afspraak: <b>{BP.tr(res.next.treatment).name}</b>, {new Date(res.next.starts_at).toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})} om {tm(res.next.starts_at)}.</>:''}
{BP.get().role!=='specialist'&&m.status==='actief'&&<div style={{marginTop:12}}><ABtn icon="plus" onClick={()=>a.open({k:'new',member:m.id,date:BP.today})}>Afspraak maken</ABtn></div>}</div>}
</APanel>;}

function Checkin(){const s=useBP();const a=useA();const [res,setRes]=React.useState(null);const [code,setCode]=React.useState('');const [busy,setBusy]=React.useState(false);const [err,setErr]=React.useState('');
const look=async c=>{setBusy(true);setErr('');try{const r=await BP.act.checkin(c);setRes(r);setCode(c);}catch(e){setRes(null);setErr(e.message);}setBusy(false);};
// The overview below refreshes live; the opened member is reloaded after each action
const today=s.appointments.filter(x=>x.date===BP.today&&x.status!=='geannuleerd').sort((x,y)=>x.time.localeCompare(y.time));const here=today.filter(x=>x.checkedInAt&&x.status==='gepland').length;
return <><AHead title="Check-in" it="bij de balie" sub={`Vandaag ${today.length} afspraken · ${here} nu aanwezig`}/>
<Scanner onCode={look} busy={busy}/>
{err&&<div style={{marginTop:14,padding:14,borderRadius:14,background:BPC.bordSoft,color:BPC.bord,fontSize:14}}>{err}</div>}
{res&&<CheckinResult res={res} onAgain={()=>{setRes(null);setCode('');}} refresh={()=>look(code)}/>}
<APanel title="Vandaag" style={{marginTop:14}}>{today.length?today.map(x=>{const t=BP.tr(x.treatmentId),m=BP.mem(x.memberId),st=BP.staff(x.staffId);const tone=x.status==='afgerond'?'ok':x.checkedInAt?'esp':null;
return <div key={x.id} className="a-row" onClick={()=>a.open({k:'appt',id:x.id})} style={{display:'grid',gridTemplateColumns:'52px minmax(0,1fr) auto',gap:12,alignItems:'center',padding:'10px 8px',borderRadius:12,cursor:'pointer'}}>
<div style={{fontFamily:BPC.serif,fontSize:19,fontWeight:600}}>{x.time}</div><div style={{minWidth:0}}><div style={{fontSize:13.5,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name} · {t.name}</div><div style={{fontSize:12,color:BPC.ink3}}>{st.name} · {x.room}</div></div>
{tone?<Pill tone={tone}>{x.status==='afgerond'?'afgerond':'aanwezig'}</Pill>:<Pill>{x.status==='gepland'?'verwacht':x.status}</Pill>}</div>;}):<div style={{fontSize:14,color:BPC.ink2}}>Vandaag staan er geen afspraken.</div>}</APanel></>;}

Object.assign(window,{Checkin,Scanner});
