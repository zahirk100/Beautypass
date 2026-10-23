/* ---------- Login, password and access screens (not in the prototype; built from its parts) ---------- */
const lfield={width:'100%',boxSizing:'border-box',height:50,borderRadius:14,border:`1px solid ${BPC.line2}`,background:BPC.card,padding:'0 16px',fontSize:16,fontFamily:BPC.sans,color:BPC.ink,outline:'none'};
const lbtn=(kind)=>({height:52,borderRadius:26,border:kind==='ghost'?`1px solid ${BPC.line2}`:'none',background:kind==='ghost'?BPC.card:BPC.ink,color:kind==='ghost'?BPC.ink:'#fff',fontFamily:BPC.sans,fontSize:15,fontWeight:600,width:'100%',cursor:'pointer'});
function LField({label,type='text',value,onChange,placeholder,auto}){return <label style={{display:'block'}}><div style={{fontSize:11.5,fontWeight:600,color:BPC.ink2,marginBottom:6}}>{label}</div><input type={type} value={value} placeholder={placeholder} autoComplete={auto} onChange={e=>onChange(e.target.value)} style={lfield}/></label>;}
function LBtn({children,onClick,kind,disabled}){return <button disabled={disabled} onClick={onClick} style={{...lbtn(kind),opacity:disabled?.4:1}}>{children}</button>;}
function LMsg({kind,children}){if(!children)return null;return <div style={{fontSize:13,lineHeight:1.45,padding:'12px 14px',borderRadius:14,background:kind==='ok'?BPC.sageSoft:BPC.bordSoft,color:kind==='ok'?BPC.sage:BPC.bord}}>{children}</div>;}

// Split layout on desktop (campaign image left), full screen on phones
function AuthShell({children,eyebrow,title,it,image=true}){const [wide,setWide]=React.useState(()=>window.innerWidth>=980);
React.useEffect(()=>{const f=()=>setWide(window.innerWidth>=980);window.addEventListener('resize',f);return()=>window.removeEventListener('resize',f);},[]);
const form=<div style={{width:'min(100%,420px)',display:'grid',gap:14}}><Eyebrow>{eyebrow}</Eyebrow><Serif size={wide?48:40} it={it}>{title}</Serif><div style={{height:4}}></div>{children}</div>;
if(!wide||!image)return <div style={{minHeight:'100dvh',background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink,display:'flex',flexDirection:'column',padding:'60px 24px 40px',boxSizing:'border-box'}}><img src={WORDMARK} alt="BeautyPass" style={{height:15,alignSelf:wide?'center':'flex-start',marginBottom:48}}/><div style={{display:'flex',justifyContent:'center'}}>{form}</div></div>;
return <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',background:BPC.paper,fontFamily:BPC.sans,color:BPC.ink}}>
<div style={{position:'relative',overflow:'hidden'}}><img src="/assets/cover-v3.webp" alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/><div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(20,16,12,.1),rgba(20,16,12,.55))'}}></div><div style={{position:'absolute',left:48,bottom:48,right:48,color:'#fff'}}><img src={WORDMARK} alt="BeautyPass" style={{height:20,filter:'invert(1)',marginBottom:24}}/><Serif size={64} it="Your way." style={{color:'#fff'}}>Your beauty.</Serif></div></div>
<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>{form}</div></div>;}

// Members: password, or a 6-digit code by e-mail (also the way back in when the password is forgotten)
function MemberLogin({onDone}){const [mode,setMode]=React.useState('pw');const [email,setEmail]=React.useState('');const [pw,setPw]=React.useState('');const [code,setCode]=React.useState('');const [sent,setSent]=React.useState(false);const [busy,setBusy]=React.useState(false);const [err,setErr]=React.useState('');
const run=async fn=>{setBusy(true);setErr('');try{await fn();}catch(e){setErr(e.message);}setBusy(false);};
const okEmail=/^\S+@\S+\.\S+$/.test(email);
return <AuthShell eyebrow="Amsterdam · Members" title="Welkom" it="terug.">
{mode==='pw'?<>
<LField label="E-mailadres" type="email" auto="email" value={email} onChange={setEmail}/><LField label="Wachtwoord" type="password" auto="current-password" value={pw} onChange={setPw}/>
<LMsg>{err}</LMsg><LBtn disabled={busy||!okEmail||!pw} onClick={()=>run(async()=>{await BP.auth.signInPassword(email,pw);onDone();})}>{busy?'Bezig…':'Inloggen'}</LBtn>
<LBtn kind="ghost" onClick={()=>{setMode('code');setErr('');}}>Inloggen met een code per e-mail</LBtn></>
:<>
<LField label="E-mailadres" type="email" auto="email" value={email} onChange={v=>{setEmail(v);setSent(false);}}/>
{sent&&<LField label="Code uit je mail" value={code} placeholder="123456" auto="one-time-code" onChange={v=>setCode(v.replace(/\D/g,'').slice(0,6))}/>}
<LMsg kind="ok">{sent&&!err?'We hebben je een code van 6 cijfers gestuurd.':''}</LMsg><LMsg>{err}</LMsg>
{sent?<LBtn disabled={busy||code.length!==6} onClick={()=>run(async()=>{await BP.auth.verifyCode(email,code,'email');onDone();})}>{busy?'Bezig…':'Inloggen'}</LBtn>
:<LBtn disabled={busy||!okEmail} onClick={()=>run(async()=>{await BP.auth.sendCode(email);setSent(true);})}>{busy?'Bezig…':'Stuur code'}</LBtn>}
<LBtn kind="ghost" onClick={()=>{setMode('pw');setErr('');}}>Inloggen met wachtwoord</LBtn></>}
<div style={{textAlign:'center',fontSize:14,color:BPC.ink2,marginTop:6}}>Nog geen member? <a href="/onboarding" style={{fontWeight:700,color:BPC.ink,textDecoration:'none'}}>Word member</a></div>
</AuthShell>;}

// Team: e-mail + password; reset by e-mail link
function TeamLogin({onDone}){const [email,setEmail]=React.useState('');const [pw,setPw]=React.useState('');const [busy,setBusy]=React.useState(false);const [err,setErr]=React.useState('');const [ok,setOk]=React.useState('');
const run=async fn=>{setBusy(true);setErr('');setOk('');try{await fn();}catch(e){setErr(e.message);}setBusy(false);};
return <AuthShell eyebrow="Beheer · Amsterdam" title="Inloggen" it="team." image={false}>
<LField label="E-mailadres" type="email" auto="email" value={email} onChange={setEmail}/><LField label="Wachtwoord" type="password" auto="current-password" value={pw} onChange={setPw}/>
<LMsg>{err}</LMsg><LMsg kind="ok">{ok}</LMsg>
<LBtn disabled={busy||!email||!pw} onClick={()=>run(async()=>{await BP.auth.signInPassword(email,pw);onDone();})}>{busy?'Bezig…':'Inloggen'}</LBtn>
<div onClick={()=>/^\S+@\S+\.\S+$/.test(email)?run(async()=>{await BP.auth.resetPassword(email,location.origin+'/beheer/');setOk('Als dit adres bij ons bekend is, staat er een link in je mail om een nieuw wachtwoord te kiezen.');}):setErr('Vul eerst je e-mailadres in')} style={{textAlign:'center',fontSize:13.5,color:BPC.ink2,cursor:'pointer'}}>Wachtwoord vergeten?</div>
</AuthShell>;}

// After an invitation or a reset link: choose a password
function SetPassword({onDone,invite}){const [pw,setPw]=React.useState('');const [pw2,setPw2]=React.useState('');const [busy,setBusy]=React.useState(false);const [err,setErr]=React.useState('');
return <AuthShell eyebrow={invite?'Welkom bij het team':'Nieuw wachtwoord'} title="Kies je" it="wachtwoord." image={false}>
<LField label="Wachtwoord" type="password" auto="new-password" value={pw} onChange={setPw} placeholder="Minimaal 8 tekens"/><LField label="Herhaal wachtwoord" type="password" auto="new-password" value={pw2} onChange={setPw2}/>
<LMsg>{err}</LMsg><LBtn disabled={busy||pw.length<8||pw!==pw2} onClick={async()=>{setBusy(true);setErr('');try{await BP.auth.setPassword(pw);onDone();}catch(e){setErr(e.message);}setBusy(false);}}>{busy?'Bezig…':'Opslaan'}</LBtn>
{pw2&&pw!==pw2&&<div style={{fontSize:12.5,color:BPC.bord,textAlign:'center'}}>De wachtwoorden zijn niet gelijk</div>}
</AuthShell>;}

function NoAccess({what}){return <AuthShell eyebrow="Beheer · Amsterdam" title="Geen" it="toegang." image={false}>
<div style={{fontSize:14.5,color:BPC.ink2,lineHeight:1.55}}>Dit account heeft geen toegang tot {what||'de beheeromgeving'}. Vraag de eigenaar om je een rol te geven.</div>
<LBtn kind="ghost" onClick={async()=>{await BP.auth.signOut();location.reload();}}>Uitloggen</LBtn><a href="/member/" style={{textAlign:'center',fontSize:14,color:BPC.ink2}}>Naar de member app</a></AuthShell>;}

function BootError({message}){return <AuthShell eyebrow="BeautyPass" title="Even" it="geduld." image={false}><LMsg>{message}</LMsg><LBtn onClick={()=>location.reload()}>Opnieuw proberen</LBtn></AuthShell>;}

Object.assign(window,{MemberLogin,TeamLogin,SetPassword,NoAccess,BootError,AuthShell});
