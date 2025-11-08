// tooltip.js - simple tooltip for .component elements
(function(){
  function createTooltip() {
    const tip = document.createElement('div');
    tip.id = 'component-tooltip';
    tip.style.position = 'fixed';
    tip.style.pointerEvents = 'none';
    tip.style.padding = '6px 10px';
    tip.style.background = 'rgba(0,0,0,0.8)';
    tip.style.color = '#fff';
    tip.style.borderRadius = '6px';
    tip.style.fontSize = '13px';
    tip.style.zIndex = 2000;
    tip.style.transition = 'transform 0.08s ease, opacity 0.15s ease';
    tip.style.opacity = '0';
    tip.style.transform = 'translateY(-6px)';
    document.body.appendChild(tip);
    return tip;
  }

  const tooltip = createTooltip();
  let active = null;

  function showTooltip(text){
    tooltip.textContent = text;
    tooltip.style.opacity = '1';
    tooltip.style.transform = 'translateY(0)';
  }
  function hideTooltip(){
    tooltip.style.opacity = '0';
    tooltip.style.transform = 'translateY(-6px)';
  }

  function onMouseMove(e){
    const x = e.clientX + 12;
    const y = e.clientY + 12;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function attach(el){
    el.addEventListener('mouseenter', (e)=>{
      active = el;
      const text = el.getAttribute('data-tooltip') || el.dataset.component || el.querySelector('.component-name')?.textContent || 'Component';
      showTooltip(text);
      document.addEventListener('mousemove', onMouseMove);
    });
    el.addEventListener('mouseleave', ()=>{
      active = null;
      hideTooltip();
      document.removeEventListener('mousemove', onMouseMove);
    });
  }

  function init(){
    const components = Array.from(document.querySelectorAll('.component'));
    components.forEach(attach);
    // dynamic: observe for new components added later
    const obs = new MutationObserver(()=>{
      const newComps = Array.from(document.querySelectorAll('.component')).filter(c=>!c._tooltipAttached);
      newComps.forEach(c=>{ attach(c); c._tooltipAttached = true; });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
