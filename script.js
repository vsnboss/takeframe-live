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

(()=>{
  const output=document.querySelector('.section.output');
  const opinionated=output?.querySelector('.opinionated');
  if(!output||!opinionated||output.querySelector('.omt-ecosystem'))return;

  if(!document.querySelector('style[data-omt-ecosystem]')){
    const style=document.createElement('style');
    style.dataset.omtEcosystem='true';
    style.textContent=`
      .omt-ecosystem{margin-top:38px;padding:26px;border:1px solid rgba(112,153,203,.25);border-radius:16px;background:linear-gradient(180deg,rgba(8,21,36,.92),rgba(5,12,22,.94));overflow:hidden}
      .omt-ecosystem-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:20px}
      .omt-ecosystem-head .eyebrow{margin-bottom:7px}
      .omt-ecosystem-head h3{margin:0;font:900 clamp(28px,2.7vw,48px) Squadra,Impact,sans-serif;line-height:.94;text-transform:uppercase;letter-spacing:.02em}
      .omt-ecosystem-head p:last-child{max-width:560px;margin:0;color:#a8bad2;font-size:13px;line-height:1.55;text-align:right}
      .omt-logo-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .omt-brand{min-height:98px;padding:16px;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid rgba(112,153,203,.2);border-radius:11px;background:#04101d;transition:transform .2s,border-color .2s,background .2s}
      .omt-brand:hover{transform:translateY(-2px);border-color:rgba(0,200,255,.48);background:#061624}
      .omt-brand img{display:block;max-width:150px;max-height:46px;width:auto;height:auto;object-fit:contain}
      .omt-brand img.omt-symbol{width:44px;height:44px}
      .omt-brand span{font:900 18px Squadra,Impact,sans-serif;letter-spacing:.045em;text-transform:uppercase;color:#eef5ff}
      .omt-brand--text span{font-size:clamp(16px,1.25vw,22px);text-align:center}
      .omt-ecosystem-foot{display:flex;justify-content:space-between;gap:24px;align-items:center;margin-top:16px;padding-top:15px;border-top:1px solid rgba(112,153,203,.16);color:#7f93ac;font-size:10px;line-height:1.5;text-transform:uppercase;letter-spacing:.05em}
      .omt-ecosystem-foot a{color:#a9c9e8;font-weight:900}
      .switcher-support{margin-top:38px;padding:30px;border:1px solid rgba(0,200,255,.28);border-radius:16px;background:radial-gradient(circle at 15% 0,rgba(0,139,255,.14),transparent 36%),linear-gradient(180deg,#071522,#050c16);box-shadow:inset 0 0 45px rgba(0,126,255,.035)}
      .switcher-support-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:24px}
      .switcher-support-head h3{margin:0;font:900 clamp(34px,3.4vw,58px) Squadra,Impact,sans-serif;line-height:.9;text-transform:uppercase;max-width:900px}.switcher-support-head p:last-child{max-width:560px;margin:0;color:#c0d0e3;font-size:14px;line-height:1.55;text-align:right}.switcher-support-head p:last-child strong{color:#fff}
      .switcher-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.switcher-card{min-height:148px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid rgba(112,153,203,.22);border-radius:11px;background:#04101d;transition:transform .2s,border-color .2s}.switcher-card:hover{transform:translateY(-2px);border-color:rgba(0,200,255,.42)}.switcher-card strong{font:900 20px Squadra,Impact,sans-serif;letter-spacing:.03em}.switcher-card small{display:block;margin-top:6px;color:#91a6bf;line-height:1.4}.switcher-protocols{display:flex;gap:6px;flex-wrap:wrap;margin-top:16px}.switcher-protocols span{padding:6px 8px;border:1px solid rgba(55,224,139,.3);border-radius:6px;color:#63e7a1;background:rgba(55,224,139,.04);font-size:9px;font-weight:900;letter-spacing:.05em}.switcher-protocols span.omt{border-color:rgba(0,200,255,.32);color:#55d8ff;background:rgba(0,200,255,.04)}.switcher-protocols span.workflow{border-color:rgba(255,194,71,.3);color:#ffd16f;background:rgba(255,194,71,.04)}.switcher-support-foot{margin-top:17px;padding-top:15px;border-top:1px solid rgba(112,153,203,.15);color:#7f93ac;font-size:10px;line-height:1.55;text-transform:uppercase;letter-spacing:.045em}
      @media(max-width:1400px){.switcher-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:900px){.omt-ecosystem-head,.switcher-support-head{display:block}.omt-ecosystem-head p:last-child,.switcher-support-head p:last-child{margin-top:12px;text-align:left}.omt-logo-row{grid-template-columns:repeat(2,1fr)}.switcher-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:520px){.omt-ecosystem,.switcher-support{padding:18px}.omt-logo-row{grid-template-columns:1fr 1fr}.omt-brand{min-height:86px;padding:12px}.omt-brand img{max-width:115px;max-height:38px}.omt-brand span{font-size:15px}.omt-ecosystem-foot{display:block}.omt-ecosystem-foot a{display:inline-block;margin-top:8px}.switcher-grid{grid-template-columns:1fr}.switcher-card{min-height:112px}}
    `;
    document.head.appendChild(style);
  }

  const ecosystem=document.createElement('div');
  ecosystem.className='omt-ecosystem';
  ecosystem.setAttribute('aria-labelledby','omt-ecosystem-title');
  ecosystem.innerHTML=`
    <div class="omt-ecosystem-head">
      <div>
        <p class="eyebrow">OMT ecosystem</p>
        <h3 id="omt-ecosystem-title">Open protocol.<br>Growing production ecosystem.</h3>
      </div>
      <p>Selected adopters and tools documented by the Open Media Transport project.</p>
    </div>
    <div class="omt-logo-row" aria-label="Selected Open Media Transport ecosystem brands">
      <a class="omt-brand" href="https://www.vmix.com/" target="_blank" rel="noopener noreferrer" aria-label="vMix website">
        <img src="https://www.vmix.com/images/2017/logos/web/vmix-logo/vMix-Logo-White.png" alt="vMix" loading="lazy">
      </a>
      <a class="omt-brand" href="https://obsproject.com/" target="_blank" rel="noopener noreferrer" aria-label="OBS Studio website">
        <img class="omt-symbol" src="https://raw.githubusercontent.com/obsproject/obs-studio/220a16378fb9079b0ebd008ee994f5cb298de90d/frontend/forms/images/obs.png" alt="OBS Studio" loading="lazy">
        <span>OBS Studio</span>
      </a>
      <a class="omt-brand omt-brand--text" href="https://www.sienna-tv.com/" target="_blank" rel="noopener noreferrer" aria-label="SIENNA website">
        <span>SIENNA</span>
      </a>
      <a class="omt-brand omt-brand--text" href="https://centralcontrol.io/" target="_blank" rel="noopener noreferrer" aria-label="Central Control website">
        <span>Central Control</span>
      </a>
    </div>
    <div class="omt-ecosystem-foot">
      <span>Marks belong to their respective owners. Ecosystem context only; no endorsement of TAKEFRAME is implied.</span>
      <a href="https://www.openmediatransport.org/" target="_blank" rel="noopener noreferrer">Open Media Transport &rarr;</a>
    </div>
  `;
  opinionated.before(ecosystem);

  const switchers=document.createElement('div');
  switchers.className='switcher-support';
  switchers.setAttribute('aria-labelledby','switcher-support-title');
  switchers.innerHTML=`
    <div class="switcher-support-head">
      <div><p class="eyebrow">Production compatibility</p><h3 id="switcher-support-title">Built to drop into<br>the production stack you already run.</h3></div>
      <p><strong>NDI + OMT Program output.</strong> Works with professional production environments including vMix, Panasonic, Ross Video, Vizrt TriCaster, Datavideo and FOR-A.</p>
    </div>
    <div class="switcher-grid" aria-label="Professional production systems compatible with TAKEFRAME output workflows">
      <article class="switcher-card"><div><strong>vMix</strong><small>vMix 29 receives NDI and OMT with alpha-channel support.</small></div><div class="switcher-protocols"><span>NDI</span><span class="omt">OMT</span><span>ALPHA</span></div></article>
      <article class="switcher-card"><div><strong>Panasonic</strong><small>AV-HSW10 accepts NDI High Bandwidth CG sources with alpha.</small></div><div class="switcher-protocols"><span>NDI HB</span><span>ALPHA CG</span></div></article>
      <article class="switcher-card"><div><strong>Ross Video</strong><small>Carbonite Code is purpose-built for NDI and handles key/fill in-stream.</small></div><div class="switcher-protocols"><span>NDI</span><span>KEY + FILL</span></div></article>
      <article class="switcher-card"><div><strong>Vizrt TriCaster</strong><small>Native NDI production workflows support IP graphics and fill/key sources.</small></div><div class="switcher-protocols"><span>NDI</span><span>IP GRAPHICS</span></div></article>
      <article class="switcher-card"><div><strong>Datavideo</strong><small>NDI-enabled iCAST systems plus professional SE-series CG/keying workflows.</small></div><div class="switcher-protocols"><span>NDI</span><span class="workflow">CG / KEYING</span></div></article>
      <article class="switcher-card"><div><strong>FOR-A</strong><small>HVS-series with HVS-NIF receives NDI High Bandwidth with alpha.</small></div><div class="switcher-protocols"><span>NDI HB</span><span>ALPHA RX</span></div></article>
    </div>
    <div class="switcher-support-foot">TAKEFRAME is protocol-compatible with documented production workflows; these marks do not imply vendor certification, partnership or endorsement. Exact compatibility depends on model, firmware, protocol mode and installed options. Datavideo support varies by NDI-enabled model and graphics/keying workflow.</div>
  `;
  opinionated.before(switchers);
})();

(()=>{
  const marketing=document.createElement('script');
  marketing.src='/marketing.js';
  marketing.defer=true;
  document.head.appendChild(marketing);
})();
