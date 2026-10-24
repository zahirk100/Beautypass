// Entry: same code as the former inline <script type="text/babel"> of member/index.html
import '../shared/globals.js';
import '../shared/bp-api.js';
import '../shared/ios-frame.jsx';
import '../shared/bp-ui.jsx';
import '../shared/pass.jsx';
import './member-a.jsx';
import './member-b.jsx';
import './member-web.jsx';
import '../shared/login.jsx';

const TABS=[['home','Home','home'],['book','Plannen','plus'],['appts','Afspraken','cal'],['membership','Membership','card'],['profile','Profiel','user']];
function TabBar({tab,setTab}){return <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:30,paddingBottom:26,paddingTop:8,background:'rgba(250,249,246,.92)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderTop:`1px solid ${BPC.line}`,display:'flex'}}>
{TABS.map(([k,l,i])=>{const on=tab===k;return <div key={k} onClick={()=>setTab(k)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer',color:on?BPC.ink:BPC.ink3,padding:'4px 0'}}>{k==='book'?<div style={{width:34,height:34,borderRadius:17,background:on?BPC.esp:BPC.ink,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-4}}><Ico n="plus" s={18} c="#fff" w={2}/></div>:<Ico n={i} s={22} w={on?1.9:1.5}/>}<span style={{fontSize:10,fontWeight:on?700:500}}>{l}</span></div>;})}</div>;}
function MemberApp({flash}){
const view='app';const setView=()=>{};
const [tab,setTabS]=React.useState(()=>localStorage.getItem('bp-member-tab')||'home');
const [stack,setStack]=React.useState([]);const [toast,setToast]=React.useState(null);const [ok,setOk]=React.useState(0);
React.useEffect(()=>{localStorage.setItem('bp-member-tab',tab);},[tab]);
const scrollRef=React.useRef(null);
const api={push:x=>setStack(s=>[...s,x]),pop:()=>setStack(s=>s.slice(0,-1)),reset:()=>setStack([]),setTab:t=>{setStack([]);setTabS(t);if(scrollRef.current)scrollRef.current.scrollTop=0;},
toast:msg=>setToast({msg,k:Date.now()}),logout:async()=>{await BP.auth.signOut();location.replace('/member/');}};
React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(t);},[toast]);
const top=stack[stack.length-1];
const renderTop=x=>x.k==='appt'?<ApptDetail id={x.id}/>:x.k==='book'?<Book tid={x.tid} reschedule={x.reschedule}/>:x.k==='routine'?<RoutineEdit/>:x.k==='plans'?<Plans/>:x.k==='payments'?<Payments/>:null;
const root={home:<Home/>,appts:<Appointments/>,membership:<Membership/>,profile:<Profile/>}[tab];
// Phone: the app layout full screen; tablet and computer: the website layout
const MOBILE=760;const [mobile,setMobile]=React.useState(()=>window.innerWidth<MOBILE);
React.useEffect(()=>{document.body.classList.toggle('web',!mobile);},[mobile]);
// Errors from background saves go to whichever toast is on screen (the website view has its own)
const webView=!mobile;
React.useEffect(()=>{if(!webView)BP.onError(msg=>api.toast(msg));},[webView]);React.useEffect(()=>{if(flash&&!webView)api.toast(flash);},[]);
React.useEffect(()=>{const f=()=>setMobile(window.innerWidth<MOBILE);f();window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);},[]);
const inner=<div style={{position:'relative',height:'100dvh',overflow:'hidden',background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink}}>
{<>
<div ref={scrollRef} className="bp-scroll" style={{position:'absolute',inset:0,overflowY:'auto'}}>{tab==='book'?null:root}</div>
{tab==='book'&&!top&&<Book root key="rootbook"/>}
{top&&<div key={stack.length} style={{position:'absolute',inset:0,zIndex:20}}>{renderTop(top)}</div>}
{!top&&tab!=='book'&&<TabBar tab={tab} setTab={api.setTab}/>}
</>}
{toast&&<div key={toast.k} style={{position:'absolute',top:60,left:'50%',zIndex:90,background:BPC.ink,color:'#fff',fontSize:13,fontWeight:600,padding:'11px 18px',borderRadius:99,whiteSpace:'nowrap',animation:'bpToast 2.6s forwards',boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>{toast.msg}</div>}
</div>;
if(mobile)return <MCtx.Provider value={api}><SheetFixed.Provider value={true}>{inner}</SheetFixed.Provider></MCtx.Provider>;
return <MCtx.Provider value={api}><MemberWeb view={view} setView={setView} okKey={ok} onboard={null} flash={flash} logout={api.logout}/></MCtx.Provider>;}
// Who is this? Not logged in → login; no active membership yet → onboarding; otherwise the app
function Gate(){const [st,setSt]=React.useState({k:'loading'});
const [flash]=React.useState(()=>{if(!new URLSearchParams(location.search).get('betaald'))return null;
// Back from Mollie: show the appointments and clear the flag, so a refresh does not repeat the message
try{localStorage.setItem('bp-member-tab','appts');localStorage.setItem('bp-web-page','appts');}catch(e){}history.replaceState(null,'',location.pathname);return 'Betaling ontvangen · bedankt';});
const go=()=>{setSt({k:'loading'});BP.boot('member').then(k=>{if(k==='onboarding'){location.replace('/onboarding');return;}setSt({k});}).catch(e=>setSt({k:'error',msg:e.message}));};
React.useEffect(()=>{if(BP.authLink==='recovery'){BP.supabase.auth.getSession().then(()=>setSt({k:'password'}));return;}go();},[]);
if(st.k==='loading')return <Loading/>;
if(st.k==='error')return <BootError message={st.msg}/>;
if(st.k==='password')return <SetPassword onDone={()=>{history.replaceState(null,'','/member/');go();}}/>;
if(st.k==='login')return <MemberLogin onDone={go}/>;
return <MemberApp flash={flash}/>;}
ReactDOM.createRoot(document.getElementById('root')).render(<Gate/>);
