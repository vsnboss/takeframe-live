const menuButton=document.querySelector('.menu-toggle');
const nav=document.querySelector('.site-nav');
const closeMenu=()=>{nav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false')};
menuButton?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(open))});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

const form=document.querySelector('#lead-form');
const status=document.querySelector('#lead-status');
const enrichment=document.querySelector('#enrichment');
const enrichmentForm=document.querySelector('#enrichment-form');

function firstInvalid(formEl){
  const el=[...formEl.elements].find(item=>item.willValidate&&!item.checkValidity());
  if(el){el.focus();el.setAttribute('aria-invalid','true')}
  return el;
}

form?.addEventListener('submit',e=>{
  e.preventDefault();
  [...form.elements].forEach(el=>el.removeAttribute?.('aria-invalid'));
  if(!form.checkValidity()){
    status.textContent='Please complete the required fields.';
    firstInvalid(form);
    return;
  }
  const data=new FormData(form);
  const subject=encodeURIComponent(`TAKEFRAME match review - ${data.get('company')}`);
  const body=encodeURIComponent([
    `Name: ${data.get('name')}`,
    `Work email: ${data.get('email')}`,
    `Company: ${data.get('company')}`,
    `Organisation type: ${data.get('organisation')}`,
    '',
    'Request: Review our next football match workflow with TAKEFRAME.'
  ].join('\n'));
  status.textContent='Opening your email application. Your first-step details are ready to send.';
  enrichment?.classList.add('is-visible');
  enrichment?.setAttribute('tabindex','-1');
  enrichment?.focus();
  window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`;
});

enrichmentForm?.addEventListener('submit',e=>{
  e.preventDefault();
  const lead=new FormData(form);
  const extra=new FormData(enrichmentForm);
  const subject=encodeURIComponent(`TAKEFRAME match package details - ${lead.get('company')||'Football production'}`);
  const body=encodeURIComponent([
    `Name: ${lead.get('name')||''}`,
    `Work email: ${lead.get('email')||''}`,
    `Company: ${lead.get('company')||''}`,
    `Organisation type: ${lead.get('organisation')||''}`,
    `Matches per year: ${extra.get('matches')||''}`,
    `Current production software: ${extra.get('software')||''}`,
    `Sources usually received: ${extra.get('sources')||''}`,
    `Ready to share a test match package: ${extra.get('testmatch')?'Yes':'No'}`
  ].join('\n'));
  window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`;
});
