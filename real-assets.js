(()=>{
  const files={
    hero:['/assets/real-data/hero-live.txt'],
    scorebug:['/assets/real-data/scorebug-final.txt'],
    startingXI:['/assets/real-data/starting-xi-1.txt','/assets/real-data/starting-xi-2.txt'],
    playerGraphic:['/assets/real-data/player-graphic-live.txt'],
    goalEvent:['/assets/real-data/goal-event.txt']
  };

  const read=async parts=>{
    const chunks=await Promise.all(parts.map(async url=>{
      const response=await fetch(url,{cache:'force-cache'});
      if(!response.ok)throw new Error(`Failed to load ${url}`);
      return response.text();
    }));
    return chunks.join('');
  };

  const setImage=(img,src,alt)=>{
    if(!img||!src)return;
    img.src=src;
    img.alt=alt||'';
    img.decoding='async';
  };

  const setCaption=(figure,title)=>{
    const caption=figure?.querySelector('figcaption');
    if(caption)caption.innerHTML=`${title} <span>REAL NORDIC1</span>`;
  };

  const apply=assets=>{
    const heroStack=document.querySelector('.hero .screen-stack');
    if(heroStack){
      const screens=heroStack.querySelectorAll('img');
      setImage(screens[0],assets.hero,'Real TAKEFRAME Control LIVE operator interface');
      if(screens[1])screens[1].style.display='none';
      heroStack.classList.add('real-controller');
    }

    setImage(
      document.querySelector('.section.stages article:last-child img'),
      assets.hero,
      'Real TAKEFRAME Control LIVE match control interface'
    );

    const grid=document.querySelector('.section.nordic .graphics-grid');
    if(grid){
      const cards=[
        ['scorebug','Real NORDIC1 scorebug graphic','Scorebug'],
        ['startingXI','Real NORDIC1 starting XI graphic','Starting XI'],
        ['playerGraphic','Real NORDIC1 player graphic','Player graphic'],
        ['goalEvent','Real NORDIC1 goal event graphic','Goal event']
      ];
      const figures=[...grid.querySelectorAll('figure')];
      cards.forEach(([key,alt,title],index)=>{
        const figure=figures[index];
        if(!figure)return;
        let img=figure.querySelector('img');
        if(!img){
          img=document.createElement('img');
          figure.prepend(img);
        }
        img.loading='lazy';
        setImage(img,assets[key],alt);
        setCaption(figure,title);
      });
      grid.classList.add('real-nordic1');
    }
  };

  const boot=async()=>{
    try{
      const entries=await Promise.all(
        Object.entries(files).map(async([key,parts])=>[key,await read(parts)])
      );
      const assets=Object.fromEntries(entries);
      apply(assets);
      setTimeout(()=>apply(assets),600);
    }catch(error){
      console.error('TAKEFRAME real assets failed to load',error);
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
