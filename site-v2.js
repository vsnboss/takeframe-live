(()=>{
  const style=document.createElement('style');
  style.dataset.headerBrandScale='true';
  style.textContent=`
    .topbar{height:92px;grid-template-columns:360px 1fr auto;background:rgba(2,7,18,.88);backdrop-filter:blur(18px);box-shadow:0 12px 40px rgba(0,0,0,.28)}
    .brand{height:100%;display:flex;align-items:center}
    .brand img{width:320px;max-height:72px;object-fit:contain;object-position:left center;filter:drop-shadow(0 0 18px rgba(0,200,255,.12))}

    .hero{background:
      radial-gradient(circle at 82% 38%,rgba(0,200,255,.18),transparent 24%),
      radial-gradient(circle at 67% 16%,rgba(21,140,255,.20),transparent 28%),
      linear-gradient(135deg,#020712 0%,#03101f 52%,#020712 100%)}
    .hero:before{content:"";position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(90deg,transparent 0 49.8%,rgba(0,200,255,.08) 50%,transparent 50.2%),
      linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:100% 100%,54px 54px,54px 54px;mask-image:linear-gradient(to bottom,#000,transparent 92%)}
    .hero:after{content:"";position:absolute;right:2%;top:18%;width:46%;height:58%;border:1px solid rgba(0,200,255,.18);border-radius:50%;filter:blur(.2px);box-shadow:0 0 80px rgba(0,145,255,.08);pointer-events:none}
    .hero .container{grid-template-columns:.82fr 1.18fr;gap:34px;padding-top:62px;padding-bottom:44px}
    .hero-copy{max-width:760px}
    .hero h1{font-size:clamp(76px,6.3vw,126px);text-shadow:0 16px 46px rgba(0,0,0,.35)}
    .hero h1 em{color:#1d95ff;text-shadow:0 0 30px rgba(21,140,255,.16)}
    .hero-lead{max-width:680px;font-size:21px;color:#dce8f5}
    .hero-actions .button-primary{box-shadow:0 0 0 1px rgba(0,200,255,.18),0 16px 38px rgba(0,91,199,.28)}
    .hero-actions .button-secondary{background:rgba(6,19,33,.72);backdrop-filter:blur(10px)}
    .spec-strip{border-top-color:rgba(86,139,194,.36);color:#e9f3ff}
    .spec-strip span:before{box-shadow:0 0 14px rgba(99,231,161,.75)}

    .hero-media{min-height:700px;overflow:visible;perspective:1400px}
    .hero-media:before{content:"";position:absolute;inset:7% 1% 4% 4%;z-index:0;border:1px solid rgba(0,200,255,.14);background:linear-gradient(145deg,rgba(0,200,255,.035),rgba(21,140,255,.015) 48%,transparent 70%);clip-path:polygon(10% 0,100% 0,100% 88%,90% 100%,0 100%,0 12%);box-shadow:inset 0 0 70px rgba(0,126,255,.04)}
    .hero-media:after{content:"LIVE FOOTBALL / PROGRAM / CONTROL";position:absolute;right:3%;bottom:2%;z-index:8;color:rgba(117,184,238,.48);font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em}

    .hero-player-image{right:-8%;bottom:-30px;z-index:5;width:min(72%,760px);max-width:none;filter:drop-shadow(-18px 28px 48px rgba(0,0,0,.72)) drop-shadow(0 0 26px rgba(0,169,255,.08));transform:translateZ(80px)}
    .hero-controller{left:-2%;top:50px;width:70%;z-index:3;transform:rotateY(3deg) rotateX(.5deg);border-color:rgba(0,200,255,.42);box-shadow:0 38px 85px rgba(0,0,0,.64),0 0 0 1px rgba(0,200,255,.06),0 0 54px rgba(0,131,255,.11)}
    .hero-controller:before,.hero-graphic:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.06),transparent 20% 70%,rgba(0,200,255,.035))}
    .hero-graphic{right:-1%;bottom:32px;width:54%;z-index:7;transform:rotateY(-5deg) rotateZ(.6deg);border-color:rgba(0,200,255,.52);box-shadow:0 30px 70px rgba(0,0,0,.68),0 0 46px rgba(0,162,255,.13)}
    .hero-product{border-radius:14px;backdrop-filter:blur(12px)}
    .hero-product figcaption{background:linear-gradient(90deg,rgba(4,15,29,.98),rgba(8,28,47,.96));border-top-color:rgba(0,200,255,.22)}
    .hero-product figcaption b{color:#fff;letter-spacing:.035em}
    .hero-live{top:7px;right:3%;border-color:rgba(99,231,161,.36);background:rgba(3,14,24,.9);box-shadow:0 0 26px rgba(55,224,139,.08)}
    .hero-live i{box-shadow:0 0 16px rgba(99,231,161,.9)}

    .section{position:relative}
    .section:nth-of-type(even){background:linear-gradient(180deg,rgba(7,19,33,.28),rgba(2,7,18,0))}
    .workflow-card,.model-panel,.audience-card,.lead-form,.enrichment-form,.console-frame{background:linear-gradient(180deg,rgba(8,24,41,.93),rgba(4,12,22,.97));border-color:rgba(76,128,183,.32);box-shadow:inset 0 1px 0 rgba(255,255,255,.02),0 18px 44px rgba(0,0,0,.14)}
    .workflow-card{position:relative;overflow:hidden}
    .workflow-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,#158cff,#00c8ff);opacity:.8}
    .model-panel{box-shadow:inset 0 0 55px rgba(0,133,255,.035),0 22px 55px rgba(0,0,0,.18)}
    .table-wrap{background:rgba(3,10,19,.58);border-color:rgba(72,123,177,.32);box-shadow:0 26px 65px rgba(0,0,0,.16)}
    th{background:#06111f;color:#edf6ff}
    .comparison-table td:nth-child(3){background:rgba(5,38,31,.16)}
    .architecture-line{color:#e9f5ff;border-color:rgba(0,200,255,.24);background:rgba(0,200,255,.025);padding-left:18px;padding-right:18px}
    .protocol-proof span,.proof-bar span{box-shadow:inset 0 0 20px rgba(55,224,139,.03)}
    .console-frame{border-color:rgba(0,200,255,.28);box-shadow:0 34px 80px rgba(0,0,0,.32),0 0 55px rgba(0,132,255,.05)}
    .nordic-grid figure{border-color:rgba(67,116,166,.34);box-shadow:0 20px 48px rgba(0,0,0,.2);transition:transform .2s ease,border-color .2s ease}
    .nordic-grid figure:hover{transform:translateY(-4px);border-color:rgba(0,200,255,.5)}
    .vsn-proof{background:linear-gradient(90deg,rgba(0,200,255,.055),rgba(6,16,29,.92));border-left-color:#00c8ff}

    @media(max-width:1180px){
      .topbar{height:84px;grid-template-columns:300px 1fr auto}
      .brand img{width:270px;max-height:64px}
      .hero .container{grid-template-columns:1fr}
      .hero-media{min-height:680px}
      .hero-controller{width:72%;left:2%}
      .hero-player-image{right:3%;width:58%;bottom:-22px}
      .hero-graphic{width:49%;right:2%}
    }
    @media(max-width:820px){
      .topbar{height:76px;grid-template-columns:1fr auto auto}
      .brand img{width:230px;max-height:58px}
      .site-nav{top:84px}
      .hero .container{padding-top:42px}
      .hero h1{font-size:clamp(58px,16.5vw,86px)}
      .hero-media{min-height:590px}
      .hero-controller{width:94%;left:0;top:38px;transform:none}
      .hero-player-image{width:76%;right:-18%;bottom:-8px}
      .hero-graphic{width:60%;right:0;bottom:14px;transform:none}
      .hero-media:after{display:none}
    }
    @media(max-width:520px){
      .brand img{width:205px;max-height:54px}
      .hero-media{min-height:500px}
      .hero-player-image{width:84%;right:-28%;bottom:0}
      .hero-controller{width:100%;top:28px}
      .hero-graphic{width:67%;bottom:4px}
    }
    @media(prefers-reduced-motion:no-preference){
      .hero-live i{animation:tfPulse 1.8s ease-in-out infinite}
      @keyframes tfPulse{0%,100%{opacity:.55;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
    }
  `;
  document.head.appendChild(style);
})();

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
