(()=>{
  const root=document.documentElement;
  const applyScale=()=>{
    const w=window.innerWidth;
    const s=w<941?w/941:Math.min(w/941,1.5);
    root.style.setProperty('--s',String(s));
  };
  applyScale();
  window.addEventListener('resize',applyScale,{passive:true});

  const modal=document.querySelector('#demo');
  document.querySelectorAll('.js-demo').forEach(button=>button.addEventListener('click',()=>{
    if(typeof modal?.showModal==='function') modal.showModal();
  }));
  modal?.querySelector('.close')?.addEventListener('click',()=>modal.close());
  modal?.addEventListener('click',event=>{
    const r=modal.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) modal.close();
  });

  const form=document.querySelector('#demo-form');
  form?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;
    const data=new FormData(form);
    const subject=encodeURIComponent(`TAKEFRAME demo — ${data.get('company')}`);
    const body=encodeURIComponent([
      `Name: ${data.get('name')}`,
      `Email: ${data.get('email')}`,
      `Company: ${data.get('company')}`,
      '',
      'Request: TAKEFRAME LIVE demo / next match review.'
    ].join('\n'));
    form.querySelector('output').textContent='Opening your email application…';
    window.location.href=`mailto:office@vsn.hr?subject=${subject}&body=${body}`;
  });
})();
