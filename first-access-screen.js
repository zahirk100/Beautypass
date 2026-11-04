(() => {
const form=document.querySelector('#access-form'),input=form.querySelector('input'),button=form.querySelector('button'),label=button.querySelector('span'),status=document.querySelector('#access-status');
let busy=false;
const show=(text)=>{status.hidden=false;status.textContent=text;};
if(new URLSearchParams(location.search).get('first-access')==='confirmed'){form.querySelector('.access-fields').hidden=true;show("You're on the list. We'll be in touch when First access opens.");}
form.addEventListener('submit',async event=>{
event.preventDefault();if(busy)return;
input.value=input.value.trim();
if(!input.checkValidity()){input.setAttribute('aria-invalid','true');show('Please enter a valid email address.');input.focus();return;}
input.removeAttribute('aria-invalid');busy=true;button.disabled=true;input.readOnly=true;form.setAttribute('aria-busy','true');label.textContent='Joining…';status.hidden=true;
try{
const response=await fetch('/api/first-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:input.value,website:''}),signal:AbortSignal.timeout(15000)});
const result=await response.json();if(!response.ok||result.ok!==true)throw new Error('Signup failed');
form.querySelector('.access-fields').hidden=true;show('One more step. Check your inbox and confirm your email address to join the list.');
}catch{show('We couldn’t complete your signup. Please try again.');button.disabled=false;input.readOnly=false;label.textContent='Join the list';}
finally{busy=false;form.removeAttribute('aria-busy');}
});
})();