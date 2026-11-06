export function mountNavigationLabels(root=document){
  for(const button of root.querySelectorAll('.rail-btn')){
    const name=button.getAttribute('aria-label')||button.getAttribute('title');if(!name)continue;
    button.removeAttribute('title');button.querySelector('.rail-label')?.remove();
    const label=document.createElement('span');label.className='rail-label';label.setAttribute('aria-hidden','true');label.textContent=name;button.append(label);
    const reset=()=>{delete button.dataset.labelDismissed;};button.addEventListener('pointerenter',reset);button.addEventListener('pointerleave',reset);button.addEventListener('focus',reset);button.addEventListener('blur',reset);button.addEventListener('keydown',event=>{if(event.key==='Escape')button.dataset.labelDismissed='true';});
  }
}
