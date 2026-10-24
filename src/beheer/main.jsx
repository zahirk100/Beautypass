// Entry: same code as the former inline <script type="text/babel"> of beheer/index.html
import '../shared/globals.js';
import '../shared/bp-api.js';
import '../shared/bp-ui.jsx';
import './admin-a.jsx';
import './admin-b.jsx';
import '../shared/login.jsx';

const NAV=[['dash','Dashboard','grid'],['agenda','Agenda','cal'],['members','Members','users'],['plans','Memberships','layers'],['team','Team & roosters','team'],['waitlist','First access','mail'],['settings','Instellingen','cog']];
// Menu items need the matching right (Beheer → Instellingen → Rollen & rechten); the database enforces the same
function Admin(){const s=useBP();const nav=NAV.filter(([k])=>BP.can(k)||(k==='team'&&BP.can('team')));
const [page,setPageS]=React.useState(()=>{const p=localStorage.getItem('bp-admin-page');return nav.some(([k])=>k===p)?p:(nav[0]||['agenda'])[0];});const setPage=p=>setPageS(nav.some(([k])=>k===p)?p:(nav[0]||['agenda'])[0]);const [param,setParam]=React.useState(null);const [drawer,setDrawer]=React.useState(null);const [toast,setToast]=React.useState(null);
React.useEffect(()=>{localStorage.setItem('bp-admin-page',page);},[page]);
React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2800);return()=>clearTimeout(t);},[toast]);
const api={go:(p,x)=>{setPage(p);setParam(x||null);setDrawer(null);window.scrollTo(0,0);},param,clearParam:()=>setParam(null),open:d=>setDrawer(d),close:()=>setDrawer(null),toast:m=>setToast({m,k:Date.now()}),
run:(promise,ok)=>Promise.resolve(promise).then(r=>{if(ok)setToast({m:typeof ok==='function'?ok(r):ok,k:Date.now()});return r;}).catch(e=>{setToast({m:e.message,k:Date.now()});})};
React.useEffect(()=>{BP.onError(m=>setToast({m,k:Date.now()}));},[]);
const roleName=(s.settings.roles.find(r=>r.id===s.role)||{}).name||s.role;const who=(s.profile&&s.profile.email)||'';
const P={dash:<Dashboard/>,agenda:<Agenda/>,members:<Members/>,plans:<PlansAdmin/>,team:<Team/>,waitlist:<Waitlist/>,settings:<Settings/>}[page];
const failed=s.members.filter(m=>m.status==='betaling mislukt').length;const wait=s.waitlist.filter(w=>w.status==='wachtend').length;
const badge=k=>k==='members'&&failed>0?failed:k==='waitlist'&&wait>0?wait:0;
const logout=async()=>{await BP.auth.signOut();location.replace('/beheer/');};
const [menu,setMenu]=React.useState(false);const [sheet,setSheet]=React.useState(false);
// Phone tabs: at most five; the rest sits under "Meer"
const SHORT={dash:'Overzicht',agenda:'Agenda',members:'Members',plans:'Plans',team:'Team',waitlist:'Access',settings:'Instellingen'};
const short=nav.map(([k,l,i])=>[k,SHORT[k]||l,i]);const more=short.length>5?short.slice(4):[];const tabs=short.length>5?[...short.slice(0,4),['more','Meer','dots']]:short;
return <ACtx.Provider value={api}><div className="shell">
{/* Phone: top bar with account menu, tabs at the bottom */}
<header className="m-top"><img src={WORDMARK} alt="BeautyPass" style={{height:13}}/><span style={{fontSize:10.5,letterSpacing:1.4,textTransform:'uppercase',color:BPC.ink3,fontWeight:600,marginLeft:10,flex:1}}>Beheer</span>
<div onClick={()=>setMenu(!menu)} style={{cursor:'pointer'}}><Avatar name={(s.profile&&s.profile.name)||who||'B'} size={32}/></div>
{menu&&<div style={{position:'absolute',top:56,right:12,zIndex:60,background:BPC.card,border:`1px solid ${BPC.line}`,borderRadius:16,padding:14,minWidth:220,boxShadow:'0 16px 40px rgba(0,0,0,.12)'}}><div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis'}}>{who}</div><div style={{fontSize:12,color:BPC.ink3,marginBottom:12}}>{roleName}</div><ABtn small kind="ghost" onClick={logout}>Uitloggen</ABtn></div>}</header>
<nav className="m-tabs">{tabs.map(([k,l,i])=>{const on=k==='more'?more.some(([x])=>x===page):page===k;const n=k==='more'?more.reduce((t,[x])=>t+badge(x),0):badge(k);
return <div key={k} className={'m-tab'+(on?' on':'')} onClick={()=>{setMenu(false);if(k==='more')setSheet(!sheet);else{setSheet(false);api.go(k);}}}><div style={{position:'relative'}}><Ico n={i} s={20}/>{n>0&&<span className="m-badge">{n}</span>}</div><span>{l}</span></div>;})}</nav>
{sheet&&<div onClick={()=>setSheet(false)} style={{position:'fixed',inset:0,zIndex:45,background:'rgba(29,26,23,.25)',animation:'bpFade .2s'}}><div onClick={e=>e.stopPropagation()} style={{position:'absolute',left:12,right:12,bottom:'calc(84px + env(safe-area-inset-bottom))',background:BPC.card,borderRadius:20,padding:8,boxShadow:'0 20px 50px rgba(0,0,0,.18)'}}>
{more.map(([k,l,i])=><div key={k} className={'a-nav'+(page===k?' on':'')} onClick={()=>{setSheet(false);api.go(k);}}><Ico n={i} s={18}/><span style={{flex:1}}>{l}</span>{badge(k)>0&&<span style={{fontSize:11,opacity:.7}}>{badge(k)}</span>}</div>)}</div></div>}
{/* Desktop: sidebar */}
<nav className="side"><div className="brand" style={{padding:'4px 14px 22px'}}><img src={WORDMARK} alt="BeautyPass" style={{height:15}}/><div style={{fontSize:11,letterSpacing:1.6,textTransform:'uppercase',color:BPC.ink3,fontWeight:600,marginTop:8}}>Beheer · Amsterdam</div></div>
{nav.map(([k,l,i])=><div key={k} className={'a-nav'+(page===k?' on':'')} onClick={()=>api.go(k)} title={l}><Ico n={i} s={18}/><span style={{flex:1}}>{l}</span>{k==='members'&&failed>0&&<span style={{fontSize:11,background:page===k?'#fff':BPC.bord,color:page===k?BPC.bord:'#fff',borderRadius:99,padding:'1px 7px'}}>{failed}</span>}{k==='waitlist'&&<span style={{fontSize:11,opacity:.6}}>{wait}</span>}</div>)}
<div className="foot"><div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 8px',borderTop:`1px solid ${BPC.line}`}}><Avatar name={(s.profile&&s.profile.name)||who||'B'} size={32}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis'}}>{who}</div><div style={{fontSize:11.5,color:BPC.ink3}}>{roleName}</div></div></div>
<div onClick={logout} style={{fontSize:11.5,color:BPC.ink3,cursor:'pointer',padding:'0 8px'}}>Uitloggen</div></div></nav>
<main className="main" key={page} onClick={()=>menu&&setMenu(false)} style={{animation:'aIn .25s'}}>{P}</main></div>
<Drawer open={!!drawer} onClose={api.close}>{drawer&&(drawer.k==='appt'?<ApptDrawer id={drawer.id}/>:drawer.k==='member'?<MemberDrawer id={drawer.id}/>:drawer.k==='tr'?<TrDrawer id={drawer.id}/>:drawer.k==='staff'?<StaffDrawer id={drawer.id}/>:drawer.k==='new'?<NewAppt {...drawer}/>:null)}</Drawer>
{toast&&<div key={toast.k} style={{position:'fixed',bottom:28,left:'50%',zIndex:200,background:BPC.ink,color:'#fff',fontSize:13.5,fontWeight:600,padding:'12px 20px',borderRadius:99,animation:'bpToast 2.8s forwards',boxShadow:'0 10px 30px rgba(0,0,0,.2)'}}>{toast.m}</div>}
</ACtx.Provider>;}
function Gate(){const [st,setSt]=React.useState({k:'loading'});
const go=()=>{setSt({k:'loading'});BP.boot('team').then(k=>setSt({k})).catch(e=>setSt({k:'error',msg:e.message}));};
React.useEffect(()=>{if(BP.authLink==='recovery'||BP.authLink==='invite'){BP.supabase.auth.getSession().then(()=>setSt({k:'password',invite:BP.authLink==='invite'}));return;}go();},[]);
if(st.k==='loading')return <Loading/>;
if(st.k==='error')return <BootError message={st.msg}/>;
if(st.k==='password')return <SetPassword invite={st.invite} onDone={()=>{history.replaceState(null,'','/beheer/');go();}}/>;
if(st.k==='login')return <TeamLogin onDone={go}/>;
if(st.k==='no-access')return <NoAccess/>;
return <Admin/>;}
ReactDOM.createRoot(document.getElementById('root')).render(<Gate/>);
