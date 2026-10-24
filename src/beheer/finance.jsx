/* ---------- Beheer → Financiën (right "finance"): payments per month, totals, invoices, export ---------- */
function Finance(){const s=useBP();const a=useA();const months=React.useMemo(()=>{const out=[];const d=new Date(BP.today+'T12:00:00');d.setDate(1);for(let i=0;i<12;i++){out.push(d.toISOString().slice(0,7));d.setMonth(d.getMonth()-1);}return out;},[]);
const [mon,setMon]=React.useState(months[0]);const [st,setSt]=React.useState('all');
const inMonth=s.payments.filter(p=>p.date.slice(0,7)===mon);const list=inMonth.filter(p=>st==='all'||p.status===st).sort((x,y)=>y.date.localeCompare(x.date));
const sum=k=>inMonth.filter(p=>p.status===k).reduce((n,p)=>n+p.amount,0);
const act=s.members.filter(m=>m.status==='actief');const mrr=act.reduce((n,m)=>n+BP.plan(m.plan).price,0);
const failed=s.members.filter(m=>m.status==='betaling mislukt');
const tone={betaald:'ok',mislukt:'bad',open:'warn',terugbetaald:'neutral'};
const kind={eerste:'Eerste maand',maand:'Maandincasso',los:'Losse behandeling',upgrade:'Upgrade',verificatie:'Verificatie'};
const label=m=>new Date(m+'-15T12:00:00').toLocaleDateString('nl-NL',{month:'long',year:'numeric'});
const exportCsv=()=>{const esc=v=>{let x=String(v==null?'':v);if(/^[=+\-@]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
const rows=[['datum','factuur','member','e-mail','omschrijving','soort','bedrag','status','methode'],...list.map(p=>{const m=BP.mem(p.memberId);return [p.date,p.id.startsWith('BP-')?p.id:'',m.name,m.email,p.label,kind[p.kind]||p.kind,p.amount.toFixed(2).replace('.',','),p.status,p.method];})];
const url=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(esc).join(';')).join('\r\n')],{type:'text/csv'}));const l=document.createElement('a');l.href=url;l.download=`beautypass-betalingen-${mon}.csv`;l.click();setTimeout(()=>URL.revokeObjectURL(url),1000);a.toast('Export gedownload (CSV)');};
return <><AHead title="Financiën" sub={'Betalingen via Mollie · '+label(mon)} actions={<><ASelect value={mon} onChange={setMon} opts={months.map(m=>[m,label(m)])}/><ABtn kind="ghost" icon="doc" onClick={exportCsv} disabled={!list.length}>Exporteren</ABtn></>}/>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(150px,calc(50% - 7px)),1fr))',gap:14,marginBottom:14}}>
<Stat label="Ontvangen" value={BP.eur(sum('betaald'))} sub={inMonth.filter(p=>p.status==='betaald').length+' betalingen'} tone="ok"/>
<Stat label="Terugbetaald" value={BP.eur(sum('terugbetaald'))} sub={inMonth.filter(p=>p.status==='terugbetaald').length+' terugbetalingen'}/>
<Stat label="Mislukt" value={inMonth.filter(p=>p.status==='mislukt').length} sub={failed.length+' members met open incasso'} tone={failed.length?'bad':null}/>
<Stat label="MRR" value={BP.eur(mrr)} sub={act.length+' actieve memberships'}/></div>
{failed.length>0&&<APanel title="Mislukte incasso's" style={{marginBottom:14}}>{failed.map(m=><div key={m.id} className="a-row" onClick={()=>a.open({k:'member',id:m.id})} style={{display:'flex',alignItems:'center',gap:12,padding:'8px',borderRadius:12,cursor:'pointer'}}><Avatar name={m.name} size={32} bg={BPC.bordSoft} color={BPC.bord}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:13.5,fontWeight:600}}>{m.name}</div><div style={{fontSize:12,color:BPC.ink3}}>{BP.plan(m.plan).name} · {BP.eur(BP.plan(m.plan).price)}</div></div><Pill tone="bad">betaling mislukt</Pill></div>)}</APanel>}
<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>{[['all','Alles'],['betaald','Betaald'],['open','Open'],['mislukt','Mislukt'],['terugbetaald','Terugbetaald']].map(([k,l])=><ABtn key={k} small kind={st===k?'primary':'ghost'} onClick={()=>setSt(k)}>{l}</ABtn>)}</div>
<APanel pad={8}><Table cols={[['d','Datum'],['m','Member'],['o','Omschrijving'],['b','Bedrag','right'],['s','Status'],['f','Factuur']]} rows={list.map(p=>{const m=BP.mem(p.memberId);return {key:p.paymentId,
d:BP.fmtDate(p.date,{day:'numeric',month:'short'}),m:<div><div style={{fontWeight:600}}>{m.name}</div><div style={{fontSize:12,color:BPC.ink3}}>{m.email}</div></div>,
o:<div><div>{p.label}</div><div style={{fontSize:12,color:BPC.ink3}}>{kind[p.kind]||p.kind}{p.method?' · '+p.method:''}</div></div>,b:<b>{BP.eur(p.amount)}</b>,s:<Pill tone={tone[p.status]||'neutral'}>{p.status}</Pill>,
f:p.status==='betaald'||p.status==='terugbetaald'?<ABtn small kind="ghost" icon="doc" onClick={()=>BP.act.openInvoice(p.paymentId).catch(e=>a.toast(e.message))}>{p.id.startsWith('BP-')?p.id:'Factuur'}</ABtn>:<span style={{color:BPC.ink3}}>—</span>};})}/>
{!list.length&&<div style={{padding:30,textAlign:'center',color:BPC.ink3,fontSize:14}}>Geen betalingen in {label(mon)}.</div>}</APanel></>;}

Object.assign(window,{Finance});
