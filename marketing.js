(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  document.title='TAKEFRAME — The Football Graphics Operating System';
  const meta=$('meta[name="description"]');
  if(meta)meta.content='TAKEFRAME turns match information into broadcast-ready football graphics, operated from one football-native workflow and delivered to professional production systems over