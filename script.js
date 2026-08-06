const menuButton=document.querySelector('.menu-toggle');const nav=document.querySelector('.site-nav');let menuReturnFocus=null;const closeMenu=(restore=false)=>{const open=nav?.classList.contains('open');nav?.classList.remove('open');menuButton?.setAttribute('aria-expanded','false');menuButton?.setAttribute('aria-label','Open navigation');document.body.classList.remove('nav-open');if(restore&&open)menuReturnFocus?.focus()};menuButton?.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuReturnFocus=open?menuButton:null;menuButton.setAttribute('aria-expanded',String(open));menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');document.body.classList.toggle('nav-open',open);if(open)nav.querySelector('a')?.focus()});nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>closeMenu(false)));document.addEventListener('click',e=>{if(nav?.classList.contains('open')&&!nav.contains(e.target)&&!menuButton.contains(e.target))closeMenu(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu(true)});const form=document.querySelector('#demo-form');const status=document.querySelector('#form-status');let submitting=false;form?.addEventListener('submit',e=>{e.preventDefault();if(submitting)return;status.textContent='';if(!form.reportValidity())return;const data=new FormData(form);if(data.get('website'))return;submitting=true;const subject=encodeURIComponent(`TAKEFRAME match workflow demo — ${data.get('company')}`);const body=encodeURIComponent([`Name: ${data.get('name')}`,`Company: ${data.get('company')}`,`Work email: ${data.get('email')}`,`Country: ${data.get('country')}`,`Organisation type: ${data.get('organisation')}`,`Matches per year: ${data.get('matches')}`,`Current production software: ${data.get('software')}`,`Ready to share a test match package: ${data.get('testmatch')?'Yes':'No'}`,'','Sources usually received:',data.get('sources'),'','Message:',data.get('message')||''].join('\n'));status.textContent='Opening your email application. No form submission is simulated.';window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`;setTimeout(()=>{submitting=false},1500)});

/* Approved football-first homepage hero enhancement. The mockup remains a
   visual reference; production copy, controls and product artwork stay live. */
(()=>{
  const hero=document.querySelector('.hero#top');
  if(!hero)return;
  document.body.classList.add('football-hero-ready');
  if(!document.querySelector('link[data-football-hero]')){
    const styles=document.createElement('link');
    styles.rel='stylesheet';
    styles.href='/hero-football.css';
    styles.dataset.footballHero='approved';
    document.head.appendChild(styles);
  }
  if(!hero.querySelector('.hero-player')){
    const figure=document.createElement('figure');
    figure.className='hero-player';
    figure.setAttribute('aria-hidden','true');
    const player=document.createElement('img');
    player.className='hero-player-image';
    player.src='/assets/hero-player.png';
    player.alt='';
    player.width=2048;
    player.height=2048;
    player.loading='eager';
    player.fetchPriority='high';
    player.decoding='async';
    figure.appendChild(player);
    const visual=hero.querySelector('.hero-visual');
    hero.insertBefore(figure,visual||null);
  }
})();
