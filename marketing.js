(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  document.title='TAKEFRAME — The Football Graphics Operating System';
  const meta=$('meta[name="description"]');
  if(meta)meta.content='TAKEFRAME is the football graphics operating system: from messy match information to live broadcast graphics, professional Program output and a football-native control workflow.';
  const og=$('meta[property="og:description"]');
  if(og)og.content='Stop building graphics workflows. Start running football. From team sheet to live Program with TAKEFRAME.';

  const heroLead=$('.hero-lead');
  if(heroLead)heroLead.innerHTML='Stop building graphics workflows around generic tools. <strong>TAKEFRAME starts with the match</strong> — then turns football information, operator actions and professional output into one production system.';

  const heroPrimary=$('.hero-actions .button-primary');
  if(heroPrimary)heroPrimary.textContent='See TAKEFRAME in action';
  const heroSecondary=$('.hero-actions .button-secondary');
  if(heroSecondary)heroSecondary.textContent='Bring us your next match';

  const statement=$('.statement-copy');
  if(statement){
    const p=$('p:last-child',statement);
    if(p)p.innerHTML='Generic graphics platforms sell you a blank canvas. Then your team has to build the football logic, data flow and control workflow around it. <strong>TAKEFRAME starts where they stop: with the match itself.</strong>';
  }

  const journeyHeading=$('.journey .section-heading h2');
  if(journeyHeading)journeyHeading.innerHTML='From raw match information.<br><em>To live Program.</em>';

  const onboardHeading=$('.onboard h2');
  if(onboardHeading)onboardHeading.innerHTML='Your data will never be perfect.<br><em>Your broadcast still has to be.</em>';
  const onboardText=$('.onboard .left-heading > p:not(.eyebrow)');
  if(onboardText)onboardText.innerHTML='Team sheet. PDF. Spreadsheet. Match URL. Screenshot. Manual correction. TAKEFRAME is designed for the way football information actually arrives — then turns it into one match workflow ready for production.';

  const intelligenceTitle=$('.intelligence-title h2');
  if(intelligenceTitle)intelligenceTitle.innerHTML='One match.<br>Many sources.<br><em>One truth.</em>';
  const intelligenceText=$('.intelligence-title p:last-child');
  if(intelligenceText)intelligenceText.innerHTML='<strong>TAKEFRAME turns information into production context.</strong> The operator sees the match, not a pile of disconnected data fields.';

  const operationHeading=$('.operation-copy h2');
  if(operationHeading)operationHeading.innerHTML='Stop operating graphics.<br><em>Run the match.</em>';
  const operationText=$('.operation-copy > p:not(.eyebrow)');
  if(operationText)operationText.innerHTML='Goal. Card. Substitution. VAR. Added time. Half-time. Full-time. The operator tells TAKEFRAME what happened in football language. TAKEFRAME handles the graphics workflow.';

  const outputHeading=$('.output .left-heading h2');
  if(outputHeading)outputHeading.innerHTML='Built for the control room.<br><em>Not for another browser tab.</em>';
  const outputText=$('.output .left-heading > p:not(.eyebrow)');
  if(outputText)outputText.innerHTML='TAKEFRAME renders a dedicated Program frame and sends it over professional IP output into the production stack you already use.';

  const graphicsHeading=$('.graphics-copy h2');
  if(graphicsHeading)graphicsHeading.innerHTML='Broadcast football.<br><em>Without rebuilding the system every week.</em>';
  const graphicsText=$('.graphics-copy > p:not(.eyebrow)');
  if(graphicsText)graphicsText.innerHTML='Your package defines the look. TAKEFRAME carries the match logic, operation and output. The graphics become the visual layer of a complete football production system.';

  const dataHeading=$('.data-section h2');
  if(dataHeading)dataHeading.innerHTML='Everything about the match.<br><em>In one production model.</em>';

  const comparisonHeading=$('.comparison .section-heading h2');
  if(comparisonHeading)comparisonHeading.innerHTML='A graphics tool gives you parts.<br><em>TAKEFRAME gives you football.</em>';

  const finalHeading=$('.final-copy h2');
  if(finalHeading)finalHeading.innerHTML='Bring the match.<br><em>Go to air.</em>';
  const finalText=$('.final-copy > p:not(.eyebrow)');
  if(finalText)finalText.innerHTML='Stop spending matchday building around generic graphics software. Put the football workflow, the operator and professional Program output in one system.';
  const finalButton=$('.final-copy .button');
  if(finalButton)finalButton.textContent='See why TAKEFRAME is different';

  if(!$('#marketing-category')){
    const intelligence=$('.section.intelligence');
    if(intelligence){
      const section=document.createElement('section');
      section.id='marketing-category';
      section.className='section marketing-category';
      section.innerHTML=`
        <div class="marketing-kicker">THE CATEGORY SHIFT</div>
        <h2>THE OLD WAY STARTS WITH GRAPHICS.<br><em>TAKEFRAME STARTS WITH FOOTBALL.</em></h2>
        <p class="marketing-lead">The scorebug is not the product. The match is. TAKEFRAME connects what happens before kickoff, what happens during the game and what reaches Program into one football-native operating system.</p>
        <div class="marketing-contrast">
          <article class="marketing-old"><small>GENERIC GRAPHICS PLATFORM</small><strong>DESIGN → CONNECT → SCRIPT → OPERATE → TROUBLESHOOT</strong><p>Your team assembles the workflow.</p></article>
          <div class="marketing-vs">VS</div>
          <article class="marketing-new"><small>TAKEFRAME</small><strong>ONBOARD → PREMATCH → MATCH → PROGRAM</strong><p>The football workflow is the product.</p></article>
        </div>
        <div class="marketing-signature"><span>ONE MATCH.</span><span>ONE TRUTH.</span><strong>EVERY GRAPHIC.</strong></div>
      `;
      intelligence.after(section);
    }
  }

  if(!$('style[data-marketing-layer]')){
    const style=document.createElement('style');
    style.dataset.marketingLayer='true';
    style.textContent=`
      .hero-lead strong,.statement-copy p strong,.intelligence-title p strong{color:#fff}
      .marketing-category{position:relative;text-align:center;overflow:hidden;background:radial-gradient(circle at 50% 40%,rgba(0,133,255,.11),transparent 48%)}
      .marketing-category:before{content:"";position:absolute;left:50%;top:0;width:1px;height:100%;background:linear-gradient(transparent,rgba(0,200,255,.22),transparent)}
      .marketing-kicker{color:#00c8ff;font-size:12px;font-weight:900;letter-spacing:.14em;margin-bottom:20px}
      .marketing-category h2{font-size:clamp(54px,5vw,96px);line-height:.88;position:relative}.marketing-category h2 em{color:#158cff;font-style:normal}
      .marketing-lead{max-width:1000px;margin:30px auto 0!important;font-size:20px!important;color:#d7e3f1!important}
      .marketing-contrast{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:stretch;margin-top:48px;text-align:left}.marketing-contrast article{padding:30px;border-radius:16px;border:1px solid rgba(112,153,203,.24);background:linear-gradient(180deg,#081524,#050c16)}.marketing-contrast small{display:block;margin-bottom:22px;color:#8197b1;font-size:10px;font-weight:900;letter-spacing:.1em}.marketing-contrast strong{display:block;font:900 clamp(25px,2.2vw,42px) Squadra,Impact,sans-serif;line-height:1.05}.marketing-contrast p{margin:16px 0 0!important;font-size:14px!important;color:#9db1c9!important}.marketing-old{opacity:.58}.marketing-new{border-color:rgba(0,200,255,.52)!important;box-shadow:inset 0 0 50px rgba(0,136,255,.07)}.marketing-new strong{color:#55d8ff}.marketing-vs{align-self:center;font:900 25px Squadra,Impact,sans-serif;color:#5e7895}
      .marketing-signature{display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:38px;padding-top:28px;border-top:1px solid rgba(112,153,203,.2);font:900 clamp(22px,2.4vw,42px) Squadra,Impact,sans-serif;letter-spacing:.03em}.marketing-signature strong{color:#00c8ff}
      @media(max-width:800px){.marketing-contrast{grid-template-columns:1fr}.marketing-vs{text-align:center}.marketing-lead{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }
})();
