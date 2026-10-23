// Entry: same code as the former inline <script type="text/babel"> of member/index.html
import '../shared/globals.js';
import '../shared/bp-store.js';
import '../shared/ios-frame.jsx';
import '../shared/bp-ui.jsx';
import './member-a.jsx';
import './member-b.jsx';
import './member-web.jsx';

const TABS=[['home','Home','home'],['book','Plannen','plus'],['appts','Afspraken','cal'],['membership','Membership','card'],['profile','Profiel','user']];
function TabBar({tab,setTab}){return <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:30,paddingBottom:26,paddingTop:8,background:'rgba(250,249,246,.92)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderTop:`1px solid ${BPC.line}`,display:'flex'}}>
{TABS.map(([k,l,i])=>{const on=tab===k;return <div key={k} onClick={()=>setTab(k)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer',color:on?BPC.ink:BPC.ink3,padding:'4px 0'}}>{k==='book'?<div style={{width:34,height:34,borderRadius:17,background:on?BPC.esp:BPC.ink,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-4}}><Ico n="plus" s={18} c="#fff" w={2}/></div>:<Ico n={i} s={22} w={on?1.9:1.5}/>}<span style={{fontSize:10,fontWeight:on?700:500}}>{l}</span></div>;})}</div>;}
function MemberApp(){
const [view,setView]=React.useState(()=>localStorage.getItem('bp-member-view')||'onboarding');
const [tab,setTabS]=React.useState(()=>localStorage.getItem('bp-member-tab')||'home');
const [stack,setStack]=React.useState([]);const [toast,setToast]=React.useState(null);const [ok,setOk]=React.useState(0);
React.useEffect(()=>{localStorage.setItem('bp-member-view',view);},[view]);
React.useEffect(()=>{localStorage.setItem('bp-member-tab',tab);},[tab]);
const scrollRef=React.useRef(null);
const api={push:x=>setStack(s=>[...s,x]),pop:()=>setStack(s=>s.slice(0,-1)),reset:()=>setStack([]),setTab:t=>{setStack([]);setTabS(t);if(scrollRef.current)scrollRef.current.scrollTop=0;},
toast:msg=>setToast({msg,k:Date.now()}),onboard:()=>{setStack([]);setView('onboarding');setOk(k=>k+1);}};
React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2600);return()=>clearTimeout(t);},[toast]);
const top=stack[stack.length-1];
const renderTop=x=>x.k==='appt'?<ApptDetail id={x.id}/>:x.k==='book'?<Book tid={x.tid} reschedule={x.reschedule}/>:x.k==='routine'?<RoutineEdit/>:x.k==='plans'?<Plans/>:x.k==='payments'?<Payments/>:null;
const root={home:<Home/>,appts:<Appointments/>,membership:<Membership/>,profile:<Profile/>}[tab];
const [scale,setScale]=React.useState(1);const [mobile,setMobile]=React.useState(false);
const [mode,setMode]=React.useState(()=>localStorage.getItem('bp-member-mode')||'web');
React.useEffect(()=>{localStorage.setItem('bp-member-mode',mode);document.body.classList.toggle('web',mode==='web'&&!mobile);},[mode,mobile]);
React.useEffect(()=>{const f=()=>{setMobile(window.innerWidth<520);setScale(Math.min(1,(window.innerHeight-40)/874,(window.innerWidth-40)/402));};f();window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);},[]);
const inner=<div style={{position:'relative',height:mobile?'100dvh':874,overflow:'hidden',background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink}}>
{view==='onboarding'?<Onboarding key={ok} onDone={()=>{setView('app');setTabS('home');}}/>:<>
<div ref={scrollRef} className="bp-scroll" style={{position:'absolute',inset:0,overflowY:'auto'}}>{tab==='book'?null:root}</div>
{tab==='book'&&!top&&<Book root key="rootbook"/>}
{top&&<div key={stack.length} style={{position:'absolute',inset:0,zIndex:20}}>{renderTop(top)}</div>}
{!top&&tab!=='book'&&<TabBar tab={tab} setTab={api.setTab}/>}
</>}
{toast&&<div key={toast.k} style={{position:'absolute',top:60,left:'50%',zIndex:70,background:BPC.ink,color:'#fff',fontSize:13,fontWeight:600,padding:'11px 18px',borderRadius:99,whiteSpace:'nowrap',animation:'bpToast 2.6s forwards',boxShadow:'0 8px 24px rgba(0,0,0,.2)'}}>{toast.msg}</div>}
</div>;
if(mobile)return <MCtx.Provider value={api}>{inner}</MCtx.Provider>;
if(mode==='web')return <MCtx.Provider value={api}><MemberWeb view={view} setView={setView} okKey={ok} onboard={api.onboard} onApp={()=>setMode('app')}/></MCtx.Provider>;
return <MCtx.Provider value={api}><div className="stage">
<div className="side"><img src={WORDMARK} alt="BeautyPass" style={{height:16,alignSelf:'flex-start'}}/><h1>Member <em>app</em></h1><p>Klikbaar prototype. Wijzigingen worden gedeeld met de beheeromgeving in dezelfde browser.</p>
<div className="sw"><button className={view==='onboarding'?'on':''} onClick={()=>api.onboard()}>Onboarding</button><button className={view==='app'?'on':''} onClick={()=>{setStack([]);setView('app');}}>App</button><button onClick={()=>setMode('web')}>Website-weergave →</button></div>
<p><a href="/beheer/">Open de beheeromgeving →</a></p></div>
<div style={{width:402*scale,height:874*scale,flexShrink:0}}><div style={{transform:`scale(${scale})`,transformOrigin:'top left'}}>
<IOSDevice width={402} height={874}>{inner}</IOSDevice></div></div></div></MCtx.Provider>;}
ReactDOM.createRoot(document.getElementById('root')).render(<MemberApp/>);
