// Onboarding: welcome → membership → checkout (Mollie); the account is made at checkout, then the first visit. Phone: the app flow full screen;
// desktop: the split layout from the prototype's website view.
import '../shared/globals.js';
import '../shared/bp-api.js';
import '../shared/ios-frame.jsx';
import '../shared/bp-ui.jsx';
import '../shared/pass.jsx';
import '../member/member-a.jsx';
import '../member/member-b.jsx';
import '../member/member-web.jsx';
import '../shared/login.jsx';

const toMember = () => location.replace('/member/');

// Back from Mollie: wait until the webhook has activated the membership
function PaymentReturn({onActive,onRetry}){const [st,setSt]=React.useState('wait');
React.useEffect(()=>{let n=0,live=true;const tick=async()=>{n++;try{const me=await BP.reload.member();if(!live)return;
if(me&&me.status==='actief')return onActive();if(n>=30)return setSt('slow');}catch(e){}if(live)setTimeout(tick,2000);};tick();return()=>{live=false;};},[]);
return <AuthShell eyebrow="Bijna klaar" title={st==='wait'?'Betaling':'Nog even'} it={st==='wait'?'verwerken…':'geduld.'} image={false}>
{st==='wait'?<div style={{display:'flex',alignItems:'center',gap:12,color:BPC.ink2,fontSize:14}}><div style={{width:22,height:22,borderRadius:11,border:`2.5px solid ${BPC.line}`,borderTopColor:BPC.esp,animation:'bpSpin .8s linear infinite'}}></div>We wachten op de bevestiging van Mollie.</div>
:<><div style={{fontSize:14,color:BPC.ink2,lineHeight:1.55}}>We hebben nog geen bevestiging van je betaling. Is de betaling gelukt? Dan staat je membership binnen een paar minuten klaar en krijg je een mail. Lukte het niet, probeer het dan opnieuw.</div>
<button onClick={onRetry} style={{height:52,borderRadius:26,border:'none',background:BPC.ink,color:'#fff',fontFamily:BPC.sans,fontSize:15,fontWeight:600,cursor:'pointer'}}>Opnieuw betalen</button></>}
</AuthShell>;}

function OnboardingPage(){const [st,setSt]=React.useState({k:'loading'});const [mobile,setMobile]=React.useState(()=>window.innerWidth<760);
React.useEffect(()=>{const f=()=>setMobile(window.innerWidth<760);window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);},[]);
const paid=new URLSearchParams(location.search).get('betaald');
// Signed in but not paid yet (back button, failed payment, or coming from /member): continue where it stopped
const resume=()=>{const b=BP.get();if(!b.session)return undefined;const me=b.members.find(x=>x.id===b.me);return me&&me.plan?2:1;};
const ref=new URLSearchParams(location.search).get('ref');
React.useEffect(()=>{BP.boot('onboarding').then(k=>{if(k==='member'){if(paid){setSt({k:'flow',step:5});return;}toMember();return;}setSt(paid?{k:BP.get().session?'return':'checkout'}:{k:'flow',step:resume()});}).catch(e=>setSt({k:'error',msg:e.message}));},[]);
if(st.k==='loading')return <Loading/>;
if(st.k==='error')return <BootError message={st.msg}/>;
if(st.k==='return')return <PaymentReturn onActive={()=>setSt({k:'flow',step:5})} onRetry={()=>{history.replaceState(null,'','/onboarding');setSt({k:'flow',step:2});}}/>;
if(st.k==='checkout'){let d={};try{d=JSON.parse(sessionStorage.getItem('bp-onb')||'{}');}catch(e){}
return <CheckoutReturn refId={ref} email={d.email} onRetry={()=>{history.replaceState(null,'','/onboarding');setSt({k:'flow',step:2});}} onSignedIn={()=>{history.replaceState(null,'','/onboarding?betaald=1');setSt({k:'loading'});BP.boot('onboarding').then(k=>setSt(k==='member'?{k:'flow',step:5}:{k:'return'})).catch(e=>setSt({k:'error',msg:e.message}));}}/>;}
const login=()=>location.assign('/member/');const logout=async()=>{await BP.auth.signOut();try{sessionStorage.removeItem('bp-onb');}catch(e){}location.replace('/onboarding');};
if(mobile)return <div style={{position:'relative',height:'100dvh',overflow:'hidden',background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink}}><Onboarding initStep={st.step} onLogin={login} onDone={toMember}/></div>;
// Desktop: the campaign image on the left, the steps on the right
let draft={};try{draft=JSON.parse(sessionStorage.getItem('bp-onb')||'{}');}catch(e){}
return <MemberWeb view="onboarding" setView={()=>{}} onApp={()=>{}} okKey={0} onboard={{step:st.step!=null?st.step:Math.min(draft.step||0,2),login,logout,done:toMember}}/>;}
ReactDOM.createRoot(document.getElementById('root')).render(<OnboardingPage/>);
