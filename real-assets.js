(()=>{
  const v='real-20260814-3';
  const setImage=(selector,src,alt)=>{
    const img=document.querySelector(selector);
    if(!img)return;
    img.src=`${src}?v=${v}`;
    img.alt=alt;
    img.decoding='async';
  };
  const setCaption=(selector,title,text)=>{
    const caption=document.querySelector(selector);
    if(caption)caption.innerHTML=`<b>${title}</b><span>${text}</span>`;
  };
  const apply=()=>{
    setImage('.hero .product-shot-primary img','/assets/console.webp','Real TAKEFRAME Control LIVE operator interface');
    setCaption('.hero .product-shot-primary figcaption','TAKEFRAME CONTROL','Real LIVE operator surface.');

    setImage('.hero .product-shot-secondary img','/assets/lineup.webp','Real NORDIC1 Starting XI graphic');
    setCaption('.hero .product-shot-secondary figcaption','NORDIC1','Real football graphics package.');

    setImage('.section.operation .console-panel img','/assets/console.webp','Real TAKEFRAME Control LIVE match operator console');

    const cards=[
      ['/assets/scorebug.webp','Real NORDIC1 scorebug graphic','Scorebug'],
      ['/assets/lineup.webp','Real NORDIC1 Starting XI graphic','Starting XI'],
      ['/assets/lowerthird.webp','Real NORDIC1 player graphic','Player graphic'],
      ['/assets/stats.webp','Real NORDIC1 goal event graphic','Goal event']
    ];
    document.querySelectorAll('.section.graphics .graphics-grid figure').forEach((figure,index)=>{
      const item=cards[index];
      if(!item)return;
      const img=figure.querySelector('img');
      if(img){
        img.src=`${item[0]}?v=${v}`;
        img.alt=item[1];
      }
      const caption=figure.querySelector('figcaption');
      if(caption)caption.textContent=item[2];
    });
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  setTimeout(apply,250);
  setTimeout(apply,1000);
})();
