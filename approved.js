const menuButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.site-nav');
menuButton?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')}});
const form=document.querySelector('#demo-form');
const status=document.querySelector('#form-status');
form?.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const d=new FormData(form);const subject=encodeURIComponent(`TAKEFRAME demo request — ${d.get('company')}`);const body=encodeURIComponent([`Name: ${d.get('name')}`,`Email: ${d.get('email')}`,`Company: ${d.get('company')}`,'','I want to see TAKEFRAME in action.'].join('\n'));status.textContent='Opening your email application…';window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`});
