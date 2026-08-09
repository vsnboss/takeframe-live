const menuButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.site-nav');
let menuReturnFocus=null;
const closeMenu=(restore=false)=>{
  const open=nav?.classList.contains('open');
  nav?.classList.remove('open');
  menuButton?.setAttribute('aria-expanded','false');
  menuButton?.setAttribute('aria-label','Open navigation');
  document.body.classList.remove('nav-open');
  if(restore&&open)menuReturnFocus?.focus();
};
menuButton?.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  menuReturnFocus=open?menuButton:null;
  menuButton.setAttribute('aria-expanded',String(open));
  menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  document.body.classList.toggle('nav-open',open);
  if(open)nav.querySelector('a')?.focus();
});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu(false)));
document.addEventListener('click',e=>{
  if(nav?.classList.contains('open')&&!nav.contains(e.target)&&!menuButton.contains(e.target))closeMenu(false);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu(true)});

const form=document.querySelector('#demo-form');
const status=document.querySelector('#form-status');
let submitting=false;
form?.addEventListener('submit',e=>{
  e.preventDefault();
  if(submitting)return;
  status.textContent='';
  if(!form.reportValidity())return;
  const data=new FormData(form);
  if(data.get('website'))return;
  submitting=true;
  const subject=encodeURIComponent(`TAKEFRAME football beta - ${data.get('company')}`);
  const body=encodeURIComponent([
    `Name: ${data.get('name')}`,
    `Company: ${data.get('company')}`,
    `Work email: ${data.get('email')}`,
    `Country: ${data.get('country')}`,
    `Organisation type: ${data.get('organisation')}`,
    `Matches per year: ${data.get('matches')}`,
    `Current production software: ${data.get('software')}`,
    `Ready to share a test match package: ${data.get('testmatch')?'Yes':'No'}`,
    '',
    'Sources usually received:',
    data.get('sources'),
    '',
    'Message:',
    data.get('message')||''
  ].join('\n'));
  status.textContent='Opening your email application. No form submission is simulated.';
  window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`;
  setTimeout(()=>{submitting=false},1500);
});
