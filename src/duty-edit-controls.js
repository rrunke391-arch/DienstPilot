(() => {
  'use strict';

  if (window.__dienstpilotDutyEditControlsV1) return;
  window.__dienstpilotDutyEditControlsV1 = true;

  const STATE_KEY = 'lenkRuhezeitenRunke20260413';
  const ALLOWED = new Set(['administrator','geschaftsleitung','geschaeftsleitung','disposition']);
  let busy = false;

  function norm(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');}
  function mayEdit(){
    try { const u=JSON.parse(sessionStorage.getItem('dienstpilot_user')||'null'); return ALLOWED.has(norm(u?.role||sessionStorage.getItem('dienstpilot_role'))); }
    catch { return ALLOWED.has(norm(sessionStorage.getItem('dienstpilot_role'))); }
  }
  function profile(){
    try { const s=JSON.parse(localStorage.getItem(STATE_KEY)||'null'); if(s?.appSettings?.activeProfile) return String(s.appSettings.activeProfile).trim().toLowerCase(); } catch {}
    const m=(document.getElementById('syncStatus')?.textContent||'').match(/Aktiv:\s*([^·]+)/i);
    return m ? m[1].trim().toLowerCase() : '';
  }
  function status(text, cls){
    const el=document.getElementById('syncStatus'); if(!el) return;
    const p=profile(); const n=p? p.charAt(0).toUpperCase()+p.slice(1):'';
    el.textContent=n?`Aktiv: ${n} · ${text}`:text; el.className=`sync-status ${cls||''}`.trim();
  }
  function fields(card){
    const get=(name)=>card.querySelector(`[data-field="${name}"]`);
    return {date:get('date'),number:get('number'),start:get('start'),end:get('end')};
  }
  function setEditable(card,on){
    Object.values(fields(card)).forEach(el=>{if(!el)return; el.disabled=!on; el.readOnly=!on; el.toggleAttribute('disabled',!on); el.toggleAttribute('readonly',!on);});
    card.dataset.dpEditing=on?'1':'0';
    const save=card.querySelector('.dp-duty-save'); if(save) save.disabled=!on;
    const edit=card.querySelector('.dp-duty-edit'); if(edit) edit.disabled=on;
  }
  async function updatePlan(card, mode){
    if(busy||!mayEdit()) return;
    const p=profile(), id=card.dataset.duty; if(!p||!id) return;
    if(mode==='delete' && !window.confirm('Diesen Dienst wirklich löschen?')) return;
    busy=true; status(mode==='delete'?'lösche…':'speichere…','saving');
    try {
      const url=`/api/plan/${encodeURIComponent(p)}`;
      const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`Plan konnte nicht geladen werden (${r.status})`);
      const plan=await r.json(); const list=Array.isArray(plan?.duties)?plan.duties:[];
      let found=false, next;
      if(mode==='delete') {
        next=list.filter(d=>{const hit=String(d?.id)===String(id); if(hit) found=true; return !hit;});
      } else {
        const f=fields(card);
        const values={date:String(f.date?.value||''),number:String(f.number?.value||'').replace(/\D/g,'').slice(0,4),start:String(f.start?.value||''),end:String(f.end?.value||'')};
        if(!values.date||!values.number||!values.start||!values.end) throw new Error('Bitte Datum, Dienstnummer, Beginn und Ende vollständig ausfüllen.');
        next=list.map(d=>{if(String(d?.id)!==String(id)) return d; found=true; return {...d,...values};});
      }
      if(!found) throw new Error('Der Dienst wurde im Fahrerplan nicht gefunden.');
      const put=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...plan,duties:next,savedAt:new Date().toISOString()})});
      if(!put.ok) throw new Error(`Änderung konnte nicht gespeichert werden (${put.status})`);
      status('synchronisiert','synced'); setTimeout(()=>location.reload(),250);
    } catch(e){console.error(e); status('Speichern fehlgeschlagen','offline'); alert(e.message||'Aktion fehlgeschlagen.');}
    finally{busy=false;}
  }
  function installCard(card){
    if(card.dataset.dpControls==='1'||!mayEdit()) return;
    card.dataset.dpControls='1';
    const oldDelete=[...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='Löschen'); if(oldDelete) oldDelete.style.display='none';
    const host=card.querySelector('h3')?.parentElement || card.firstElementChild || card;
    const bar=document.createElement('div');
    bar.className='dp-duty-controls';
    bar.style.cssText='display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin:10px 0;';
    bar.innerHTML='<button type="button" class="dp-duty-edit">Bearbeiten</button><button type="button" class="dp-duty-save" disabled>Speichern</button><button type="button" class="dp-duty-delete">Löschen</button>';
    host.appendChild(bar);
    bar.querySelector('.dp-duty-edit').addEventListener('click',()=>setEditable(card,true));
    bar.querySelector('.dp-duty-save').addEventListener('click',()=>updatePlan(card,'save'));
    bar.querySelector('.dp-duty-delete').addEventListener('click',()=>updatePlan(card,'delete'));
    setEditable(card,false);
  }
  function scan(){document.querySelectorAll('[data-duty]').forEach(installCard);}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true}); else scan();
})();