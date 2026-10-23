// Entry: same code as the former inline <script type="text/babel"> of beheer/index.html
import '../shared/globals.js';
import '../shared/bp-store.js';
import '../shared/bp-ui.jsx';
import './admin-a.jsx';
import './admin-b.jsx';

const NAV=[['dash','Dashboard','grid'],['agenda','Agenda','cal'],['members','Members','users'],['plans','Memberships','layers'],['team','Team & roosters','team'],['waitlist','First access','mail'],['settings','Instellingen','cog']];
function Admin(){const s=useBP();const [page,setPage]=React.useState(()=>localStorage.getItem('bp-admin-page')||'dash');const [param,setParam]=React.useState(null);const [drawer,setDrawer]=React.useState(null);const [toast,setToast]=React.useState(null);
React.useEffect(()=>{localStorage.setItem('bp-admin-page',page);},[page]);
React.useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),2800);return()=>clearTimeout(t);},[toast]);
const api={go:(p,x)=>{setPage(p);setParam(x||null);setDrawer(null);window.scrollTo(0,0);},param,clearParam:()=>setParam(null),open:d=>setDrawer(d),close:()=>setDrawer(null),toast:m=>setToast({m,k:Date.now()})};
const P={dash:<Dashboard/>,agenda:<Agenda/>,members:<Members/>,plans:<PlansAdmin/>,team:<Team/>,waitlist:<Waitlist/>,settings:<Settings/>}[page];
const failed=s.members.filter(m=>m.status==='betaling mislukt').length;const wait=s.waitlist.filter(w=>w.status==='wachtend').length;
return <ACtx.Provider value={api}><div className="shell"><nav className="side"><div className="brand" style={{padding:'4px 14px 22px'}}><img src={WORDMARK} alt="BeautyPass" style={{height:15}}/><div style={{fontSize:11,letterSpacing:1.6,textTransform:'uppercase',color:BPC.ink3,fontWeight:600,marginTop:8}}>Beheer · Amsterdam</div></div>
{NAV.map(([k,l,i])=><div key={k} className={'a-nav'+(page===k?' on':'')} onClick={()=>api.go(k)} title={l}><Ico n={i} s={18}/><span style={{flex:1}}>{l}</span>{k==='members'&&failed>0&&<span style={{fontSize:11,background:page===k?'#fff':BPC.bord,color:page===k?BPC.bord:'#fff',borderRadius:99,padding:'1px 7px'}}>{failed}</span>}{k==='waitlist'&&<span style={{fontSize:11,opacity:.6}}>{wait}</span>}</div>)}
<div className="foot" style={{marginTop:'auto',display:'grid',gap:10,padding:'0 6px'}}><a href="/member/" style={{fontSize:12.5,fontWeight:600,textDecoration:'none',padding:'10px 8px'}}>Open member app →</a><div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 8px',borderTop:`1px solid ${BPC.line}`}}><Avatar name="Beheer Team" size={32}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>hallo@beautypass.nl</div><div style={{fontSize:11.5,color:BPC.ink3}}>Eigenaar</div></div></div>
<div onClick={()=>{BP.reset();api.toast('Demo-data gereset');}} style={{fontSize:11.5,color:BPC.ink3,cursor:'pointer',padding:'0 8px'}}>Demo-data resetten</div></div></nav>
<main className="main" key={page} style={{animation:'aIn .25s'}}>{P}</main></div>
<Drawer open={!!drawer} onClose={api.close}>{drawer&&(drawer.k==='appt'?<ApptDrawer id={drawer.id}/>:drawer.k==='member'?<MemberDrawer id={drawer.id}/>:drawer.k==='tr'?<TrDrawer id={drawer.id}/>:drawer.k==='new'?<NewAppt {...drawer}/>:null)}</Drawer>
{toast&&<div key={toast.k} style={{position:'fixed',bottom:28,left:'50%',zIndex:200,background:BPC.ink,color:'#fff',fontSize:13.5,fontWeight:600,padding:'12px 20px',borderRadius:99,animation:'bpToast 2.8s forwards',boxShadow:'0 10px 30px rgba(0,0,0,.2)'}}>{toast.m}</div>}
</ACtx.Provider>;}
ReactDOM.createRoot(document.getElementById('root')).render(<Admin/>);
