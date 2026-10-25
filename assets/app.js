'use strict';
// Analítica invisible: se carga solo al configurar un token público válido.
// El token de sitio de Cloudflare es un identificador público, no una clave API.
function initAudienceAnalytics(){
 const tag=document.querySelector('meta[name="pequeplan-analytics-token"]');
 const token=String(tag?.content||'').trim();
 if(!token)return;
 if(!/^[a-f0-9]{32}$/i.test(token)){
  console.warn('Hoy Toca Plan: identificador de Cloudflare Web Analytics inválido');
  return;
 }
 const beacon=document.createElement('script');
 beacon.type='module';
 beacon.async=true;
 beacon.src='https://static.cloudflareinsights.com/beacon.min.js';
 beacon.dataset.cfBeacon=JSON.stringify({token});
 document.head.appendChild(beacon);
}
initAudienceAnalytics();

const $ = id => document.getElementById(id);
const safe = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function link(url){try{const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
const state={events:[],sources:[],discoveries:[],suggestions:[],status:{},radar:{},verification:{},health:{},cinema:{updated_at:null,movies:[]},tab:'agenda'};
let cardsShown=36;
const localDate = () => {const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
function plusDays(iso,n){const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function fmtDate(date){if(!date)return 'Por confirmar';const d=new Date(date+'T12:00:00Z');return Number.isNaN(d.getTime())?safe(date):new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d);}
function weekendWindow(today){const d=new Date(today+'T12:00:00Z');const day=d.getUTCDay();const sat=plusDays(today,day===0?-1:(6-day+7)%7);return [sat,plusDays(sat,1)];}
function todayWeekend(){return weekendWindow(localDate());}
// Fin de semana familiar: viernes desde las 16:00, sábado y domingo.
// Nunca muestra días ya pasados, aunque haya futuras repeticiones de la actividad.
function weekendActiveWindow(today=localDate()){
 const [sat,sun]=weekendWindow(today),friday=plusDays(sat,-1);
 return [today>friday?today:friday,sun];
}
function weekendFridayTimeConfirmed(e){
 const time=String(e.time||'');
 const times=[...time.matchAll(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?=[^0-9]|$)/g)];
 return times.some(m=>Number(m[1])<24&&Number(m[2])<60&&Number(m[1])*60+Number(m[2])>=16*60);
}
// Una fecha consultada y el indicador del calendario usan la misma interpretación conservadora.
function weekdayIndex(iso){return new Date(iso+'T12:00:00Z').getUTCDay();}
function weeklyOpeningDays(e){
 const txt=String(e.time||'')+'; '+String(e.schedule_note||'');
 const s=txt.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
 const aliases='(?:lunes|martes|miercoles|jueves|viernes|sabados?|domingos?|lun|mar|mie|jue|vie|sab|dom)';
 const weekday=v=>v.startsWith('lun')?1:v.startsWith('mar')?2:v.startsWith('mie')?3:v.startsWith('jue')?4:v.startsWith('vie')?5:v.startsWith('sab')?6:0;
 const open=new Set([...s.matchAll(new RegExp('\\b('+aliases+')\\b','g'))].map(m=>weekday(m[1])));
 for(const m of s.matchAll(new RegExp('\\b('+aliases+')\\s*(?:a|hasta|[-–])\\s*('+aliases+')\\b','g'))){
  let d=weekday(m[1]),last=weekday(m[2]);
  for(let n=0;n<7;n++){open.add(d);if(d===last)break;d=d===6?0:d+1;}
 }
 const closed=new Set();
 for(const m of s.matchAll(new RegExp('\\b('+aliases+')\\s+(?:permanecera?\\s+)?cerrad[oa]s?\\b','g')))closed.add(weekday(m[1]));
 for(const m of s.matchAll(new RegExp('\\bcerrad[oa]s?\\s+(?:los\\s+)?('+aliases+')\\b','g')))closed.add(weekday(m[1]));
 for(const d of closed)open.delete(d);
 return {open,closed};
}
function explicitlyEveryDay(e){
 const note=String(e.schedule_note||'')+' '+String(e.time||'');
 return /\b(?:abre|abierto|disponible|funciones|visitas)\s+todos los d[ií]as\b/i.test(note);
}
// Sólo admitir un intervalo como sesiones diarias cuando la evidencia de ESA
// actividad enumera exhaustivamente sus fechas, mes y año. Una cartelera genérica
// con fecha inicial/final no es prueba suficiente.
function evidenceEnumeratesEveryDay(e){
 const start=String(e.start||''),end=String(e.end||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>=end)return false;
 if(start.slice(0,7)!==end.slice(0,7))return false;
 const evidence=String(e.evidence||'');
 const match=evidence.match(/\blos d[ií]as?\s+((?:\d{1,2}\s*(?:,\s*|y\s*)?){2,7})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})\b/i);
 if(!match)return false;
 const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 if(Number(match[3])!==Number(start.slice(0,4))||months.indexOf(match[2].toLowerCase())+1!==Number(start.slice(5,7)))return false;
 const days=(match[1].match(/\d{1,2}/g)||[]).map(Number);
 const expected=[];
 for(let day=start;day<=end&&expected.length<=7;day=plusDays(day,1))expected.push(Number(day.slice(8)));
 return expected.length>=2&&expected.length<=7&&days.length===expected.length&&days.every((n,i)=>n===expected[i]);
}
function explicitlyEnumeratedPeriod(e){
 if(evidenceEnumeratesEveryDay(e))return true;
 const note=String(e.schedule_note||'');
 if(/(?:actividades|programaci[oó]n|funciones|sesiones)\s+(?:oficiales?\s+)?(?:el|los)\s+\d{1,2}\s*,\s*\d{1,2}\s+y\s+\d{1,2}/i.test(note)
 || /\b(?:abre|se celebra|se celebran)\s+(?:los\s+)?(?:dos|tres)\s+d[ií]as\s+indicados\b/i.test(note))return true;
 // Si la fuente acredita dos sesiones mediante sus días y horarios explícitos,
 // mostrarlas sin deducir sesiones de un intervalo genérico de cartelera.
 const start=String(e.start||''),end=String(e.end||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start===end)return false;
 const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 const dateLabel=d=>Number(d.slice(8))+' '+months[Number(d.slice(5,7))-1];
 const time=String(e.time||'').toLocaleLowerCase('es');
 return time.includes(dateLabel(start))&&time.includes(dateLabel(end));
}
function eventOnDate(e,date){
 if(['cancelada','aplazada'].includes(e.status)||!e.start||!date)return false;
 if(date<e.start||date>(e.end||e.start))return false;
 if(Array.isArray(e.occurrences)&&e.occurrences.length)return activeSessions(e).includes(date);
 if(e.start===(e.end||e.start))return true;
 if(e.schedule_unconfirmed)return false;
 const day=weekdayIndex(date),weekly=weeklyOpeningDays(e);
 if(weekly.closed.has(day))return false;
 if(weekly.open.size)return weekly.open.has(day);
 if(e.interval_kind==='continuous_days'&&e.status==='publicada_en_fuente')return true;
 if(explicitlyEveryDay(e)||explicitlyEnumeratedPeriod(e))return true;
 return false; // Un período amplio no crea sesiones diarias por sí solo.
}
function confirmedOnWeekendDay(e,date){return eventOnDate(e,date);}
function weekendEventDates(e,today=localDate()){
 if(['cancelada','aplazada'].includes(e.status))return [];
 const [from,to]=weekendActiveWindow(today);
 if(from>to)return [];
 if(Array.isArray(e.occurrences)&&e.occurrences.length)
  return activeSessions(e).filter(d=>d>=from&&d<=to&&((new Date(d+'T12:00:00Z').getUTCDay()!==5)||weekendFridayTimeConfirmed(e))).sort();
 const days=[];
 for(let d=from;d<=to;d=plusDays(d,1)){
  if(eventOnDate(e,d)&&((new Date(d+'T12:00:00Z').getUTCDay()!==5)||weekendFridayTimeConfirmed(e)))days.push(d);
 }
 return days;
}

function activeSessions(e){const cancelled=new Set([...(e.cancelled_occurrences||[]),...(e.postponed_occurrences||[])]);return (e.occurrences||[]).filter(d=>!cancelled.has(d));}
function relevant(e){if(['cancelada','aplazada'].includes(e.status))return false;const today=localDate(),end=e.end||e.start;if(Array.isArray(e.occurrences)&&e.occurrences.length)return activeSessions(e).some(d=>d>=today);return Boolean(e.start && end>=today);}
function matchesWhen(e){if(!relevant(e))return false;
 const v=$('when').value,today=localDate(),start=e.start||'',end=e.end||start;
 if(v==='all')return true;
 const day=v==='today'?today:v==='tomorrow'?plusDays(today,1):v==='date'?selectedDate:null;
 if(v==='date'&&!selectedDate)return false;
 if(day)return eventOnDate(e,day);
 if(v==='weekend')return weekendEventDates(e,today).length>0;
 if(Array.isArray(e.occurrences)&&e.occurrences.length)
  return activeSessions(e).some(d=>d>=today&&d<=plusDays(today,Math.max(0,Number(v)-1)));
 if(!start)return false;
 return start<=plusDays(today,Math.max(0,Number(v)-1))&&end>=today;
}
function syncDateChips(){
 const chosen=$('when').value;
 const [sat,sun]=weekendWindow(localDate());
 const weekendButton=document.querySelector('[data-when="weekend"]');
 if(weekendButton)weekendButton.setAttribute('aria-label','Este finde: viernes '+fmtDate(plusDays(sat,-1))+' desde las 16:00, sábado '+fmtDate(sat)+' y domingo '+fmtDate(sun));
 document.querySelectorAll('[data-when]').forEach(b=>{
  const active=b.dataset.when===chosen;
  b.classList.toggle('active',active);
  b.setAttribute('aria-pressed',String(active));
 });
}
// Calendario opcional: una fecha elegida nunca se interpreta como un intervalo.
let selectedDate=null;
let calendarMonth=localDate().slice(0,7);
function monthShift(month,increment){
 const year=Number(month.slice(0,4)),monthIndex=Number(month.slice(5,7))-1;
 return new Date(Date.UTC(year,monthIndex+increment,1,12)).toISOString().slice(0,7);
}
function calendarDateLabel(date){
 return new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
// Cuenta solo fechas individuales publicadas y sesiones enumeradas.
// Los intervalos sin sesiones concretas no generan indicadores de días.
function documentedDays(e,from=localDate(),to=plusDays(from,31)){
 if(!relevant(e))return [];
 const dates=[];
 for(let d=from;d<=to;d=plusDays(d,1))if(eventOnDate(e,d))dates.push(d);
 return dates;
}
function matchesOtherFilters(e){
 return relevant(e)
  &&(!$('newOnly').checked||(e.first_seen||'')>=plusDays(localDate(),-7))
  &&(!$('town').value||e.town===$('town').value)
  &&(!$('category').value||e.category===$('category').value)
  &&ageMatches(e)&&priceMatches(e)
  &&(!$('verifiedOnly').checked||e.status==='publicada_en_fuente');
}
function calendarCounts(onlyPending=false){
 const today=localDate(),counts={},first=calendarMonth+'-01',last=plusDays(monthShift(calendarMonth,1)+'-01',-1);
 if(activeView==='cine'){
  if(onlyPending)return counts;
  for(const movie of (state.cinema.movies||[])){
   const dates=new Set((movie.showtimes||[]).map(s=>s.date).filter(date=>date>=today&&date>=first&&date<=last));
   for(const date of dates)counts[date]=(counts[date]||0)+1;
  }
  return counts;
 }
 const eligible=activeView==='reservas'?
  state.events.filter(e=>bookingBaseMatches(e,today)&&bookingKind(e)&&Boolean(link(e.reservation_url)||link(e.source_url))):
  state.events.filter(matchesOtherFilters);
 for(const event of eligible){
  if(onlyPending&&(activeView==='reservas'||event.status==='publicada_en_fuente'))continue;
  for(const date of documentedDays(event,first,last)){
   if(date>=today)counts[date]=(counts[date]||0)+1;
  }
 }
 return counts;
}
function renderCalendar(){
 const today=localDate();
 if(calendarMonth<today.slice(0,7))calendarMonth=today.slice(0,7);
 const first=calendarMonth+'-01';
 const [year,month]=calendarMonth.split('-').map(Number);
 const firstWeekday=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const daysInMonth=new Date(Date.UTC(year,month,0,12)).getUTCDate();
 const counts=calendarCounts(),pendingCounts=calendarCounts(true);
 const fragment=[];
 for(let i=0;i<firstWeekday;i++)fragment.push('<span class="calendar-spacer" aria-hidden="true"></span>');
 for(let day=1;day<=daysInMonth;day++){
  const date=calendarMonth+'-'+String(day).padStart(2,'0');
  const count=counts[date]||0,pending=pendingCounts[date]||0,published=count-pending,past=date<today,chosen=date===selectedDate;
  const noun=activeView==='cine'?(count===1?' película':' películas'):(count===1?' plan':' planes');
  const emptyLabel=activeView==='cine'?', sin películas infantiles verificadas':', sin planes documentados en el catálogo';
  const label=calendarDateLabel(date)+(count?', '+count+noun+(activeView==='cine'?'':': '+published+' con fecha publicada'+(pending?', '+pending+' pendiente'+(pending===1?'':'s')+' de contrastar':'')):emptyLabel);
  fragment.push('<button type="button" class="calendar-day'+(count?' has-events':'')+(pending?' includes-pending':'')+(chosen?' selected':'')+(date===today?' today':'')+'" data-date="'+date+'" aria-label="'+safe(label)+'" aria-pressed="'+chosen+'"'+(date===today?' aria-current="date"':'')+(past?' disabled':'')+'><span class="calendar-number">'+day+'</span>'+(count?'<span class="calendar-count" aria-hidden="true">'+count+'</span>':'')+(pending?'<span class="calendar-pending-mark" aria-hidden="true">*</span>':'')+'</button>');
 }
 $('calendarDays').innerHTML=fragment.join('');
 $('calendarMonthTitle').textContent=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(first+'T12:00:00Z'));
 $('calendarPrev').disabled=calendarMonth<=today.slice(0,7);
}
function syncCalendarSelection(){
 const chosen=$('when').value==='date'&&selectedDate;
 $('calendarSummaryText').textContent=chosen?'Fecha: '+fmtDate(selectedDate):'Elegir día en el calendario';
 $('calendarPicker').classList.toggle('has-selection',Boolean(chosen));
 $('clearDate').hidden=!chosen;
 const option=$('when').querySelector('option[value="date"]');
 if(option){option.hidden=!chosen;option.textContent=chosen?'Día '+fmtDate(selectedDate):'Fecha elegida';}
}
function chooseCalendarDate(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<localDate())return;
 selectedDate=date;calendarMonth=date.slice(0,7);
 $('when').value='date';cardsShown=36;
 syncCalendarSelection();renderEvents();renderAdvanceBookings();renderCinema();syncExplorerView();renderCalendar();
 $('calendarPicker').open=false;
 $('calendarPicker').querySelector('summary').focus();
}
function clearCalendarDate(){
 selectedDate=null;calendarMonth=localDate().slice(0,7);$('when').value='15';
 syncCalendarSelection();
 $('calendarPicker').open=false;
}
function resetSharedDate(){
 clearCalendarDate();cardsShown=36;renderEvents();renderAdvanceBookings();renderCinema();syncExplorerView();renderCalendar();
}
function syncAgeControl(){$('ageUnknownToggle').hidden=!$('age').value;}
function ageMatches(e){const a=$('age').value;if(!a)return true; if(e.age_min==null&&e.age_max==null)return $('includeUnknownAge').checked;const n=Number(a);return (e.age_min==null||n>=Number(e.age_min))&&(e.age_max==null||n<=Number(e.age_max));}
function priceMatches(e){const p=(e.price_label||'').toLowerCase();const v=$('price').value;if(!v)return true;if(v==='free')return /gratis|gratuit|^0\s*€|^0$/.test(p);return /\d+(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b)/i.test(p)&&!/gratis|gratuit|por confirmar|consultar|no indicada/.test(p);}
function choices(id,values){const s=$(id);const selected=s.value;s.querySelectorAll('option:not(:first-child)').forEach(x=>x.remove());values.filter(Boolean).sort((a,b)=>a.localeCompare(b,'es')).forEach(value=>{const el=document.createElement('option');el.value=value;el.textContent=value;s.appendChild(el);});s.value=[...s.options].some(x=>x.value===selected)?selected:'';}
function statusMessage(){
const s=state.status||{}, radar=state.radar||{};
const display=iso=>{const d=new Date(iso);return !iso||Number.isNaN(d.getTime())?'sin ejecución':d.toLocaleString('es-ES',{timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'});};
let msg=s.last_run?'🔄 Fuentes: '+display(s.last_run)+' · '+(s.checked||0)+' consultadas · '+(s.failed||0)+' incidencias':'⚠️ Fuentes todavía sin ejecución automática';
msg+=' · 🔎 Radar: '+display(radar.last_run);
if(radar.last_run)msg+=' · '+(radar.new_candidates||0)+' noticias candidatas nuevas (no verificadas)';
if(state.verification.last_run)msg+=' · '+(state.verification.new_published_events||0)+' publicaciones automáticas verificadas';
msg+=' · Los candidatos necesitan verificar fecha, municipio y organizador.';
$('statusLine').textContent=msg;
$('statusLine').classList.toggle('warn',!s.last_run||!radar.last_run);
}
function stats(){
 const upcoming=state.events.filter(relevant).length,checked=state.events.filter(e=>e.status==='publicada_en_fuente'&&relevant(e)).length;
 $('kpis').innerHTML='<div class="kpi"><strong>'+upcoming+'</strong><span>Actividades en agenda</span></div><div class="kpi"><strong>'+state.sources.length+'</strong><span>Fuentes del catálogo</span></div><div class="kpi"><strong>'+checked+'</strong><span>Con ficha fechada detectada</span></div>';
 $('sourceCount').textContent='('+state.sources.length+')';
 $('discoveryCount').textContent='('+state.discoveries.filter(d=>d.status==='por_revisar').length+')';
}
// Orden cronológico fijo, independiente de búsqueda, filtros o estado de revisión.
// Dentro del mismo día, los horarios conocidos preceden a los no indicados.
function chronologicalTime(value){
  const m=String(value||'').match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?:[^0-9]|$)/);
  if(!m)return 24*60+1;
  const hours=Number(m[1]),minutes=Number(m[2]);
  return hours<24&&minutes<60?hours*60+minutes:24*60+1;
}
function eventChronological(a,b){
  const today=localDate();
  const displayDate=e=>cardNextDate(e,today);
  const aStart=displayDate(a), bStart=displayDate(b);
  const aDate=/^\d{4}-\d{2}-\d{2}$/.test(aStart||'')?aStart:'9999-12-31';
  const bDate=/^\d{4}-\d{2}-\d{2}$/.test(bStart||'')?bStart:'9999-12-31';
  return aDate.localeCompare(bDate)
    ||chronologicalTime(a.time)-chronologicalTime(b.time)
    ||String(a.title||'').localeCompare(String(b.title||''),'es');
}
// Reservas anticipadas: independiente del rango de la agenda, pero respeta
// municipio, edad, categoría y precio. Nunca supone entradas disponibles.
const BOOKING_LEAD_DAYS=1;
const BOOKING_HORIZON_DAYS=60;

function bookingNextDate(e,today=localDate()){
 const from=plusDays(today,BOOKING_LEAD_DAYS),until=plusDays(today,BOOKING_HORIZON_DAYS);
 if(e.status!=='publicada_en_fuente'||!relevant(e)||!e.start)return null;
 // Día explícito: reservas y agenda usan la misma sesión; el calendario permite seleccionar hoy.
 if(selectedDate)return selectedDate>=today&&eventOnDate(e,selectedDate)?selectedDate:null;
 const sessions=Array.isArray(e.occurrences)&&e.occurrences.length?
  activeSessions(e).filter(d=>d>=from&&d<=until).sort():null;
 if(sessions)return sessions[0]||null;
 if(e.start=== (e.end||e.start))return e.start>=from&&e.start<=until?e.start:null;
 const first=e.start>from?e.start:from,last=(e.end||e.start)<until?(e.end||e.start):until;
 for(let date=first;date<=last;date=plusDays(date,1)){
  if(eventOnDate(e,date))return date;
 }
 return null;
}
function bookingKind(e){
 const ticketUrl=link(e.reservation_url);
 const stage=/teatro|espect[aá]culo|musical|danza|ballet|concierto/i.test(String(e.category||'')+' '+String(e.title||''));
 const price=String(e.price_label||'');
 const paid=/\d+(?:[.,]\d{1,2})?\s*(?:€|eur\b|euros?\b)/i.test(price)&&!/gratis|gratuit|consultar|confirmar/i.test(price);
 if(e.reservation_required===true)return 'required';
 if(ticketUrl&&(stage||paid))return 'tickets';
 return null;
}
function bookingBaseMatches(e,today=localDate()){
 return e.status==='publicada_en_fuente'&&relevant(e)
  &&(!$('town').value||e.town===$('town').value)
  &&(!$('category').value||e.category===$('category').value)
  &&ageMatches(e)&&priceMatches(e)
  &&(!$('newOnly').checked||(e.first_seen||'')>=plusDays(today,-7));
}
function bookingCandidates(today=localDate()){
 return state.events.filter(e=>bookingBaseMatches(e,today))
  .map(e=>({event:e,date:bookingNextDate(e,today),kind:bookingKind(e)}))
  .filter(x=>x.date&&x.kind&&(link(x.event.reservation_url)||link(x.event.source_url)))
  .sort((a,b)=>a.date.localeCompare(b.date)
    ||(a.kind==='required'?0:1)-(b.kind==='required'?0:1)
    ||String(a.event.title).localeCompare(String(b.event.title),'es'));
}
function ageLabel(e){return e.age_min!=null&&e.age_max!=null?e.age_min+'–'+e.age_max+' años':e.age_min!=null?'Desde '+e.age_min+' años':e.age_max!=null?'Hasta '+e.age_max+' años':'Sin confirmar';}
function isAgeUnknown(e){return e.age_min==null&&e.age_max==null;}
function advanceCardHtml({event:e,date,kind}){
 const url=link(e.reservation_url)||link(e.source_url);
 const details=dateParts(date);
 const price=e.price_label||'Por confirmar';
 const age=ageLabel(e),unknown=isAgeUnknown(e);
 const label=kind==='required'?'Reserva previa necesaria':'Consultar entradas';
 const cta=e.reservation_url?'Consultar entradas':'Ver información para reservar';
 const extra=kind==='required'&&e.reservation_url?'Reserva previa indicada por el organizador':'';
 return '<article class="advance-card">'+
  '<div class="advance-card-top"><time datetime="'+safe(date)+'" class="advance-date"><span>'+safe(details.weekday)+'</span><strong>'+safe(details.day)+'</strong><span>'+safe(details.month)+'</span></time>'+
  '<div class="advance-card-details"><span class="advance-kind">'+safe(label)+'</span><h3>'+safe(e.title)+'</h3>'+
  '<p class="advance-place"><span class="advance-venue">📍 '+safe(String(e.venue||e.address||'Lugar por confirmar').trim())+'</span>'+
  (e.town?'<span class="advance-town">'+safe(e.town)+'</span>':'')+'</p>'+
  '<p class="advance-price">Precio: '+safe(price)+'</p>'+
  '<p class="advance-age'+(unknown?' advance-age-unknown':'')+'">Edad: '+safe(age)+'</p></div></div>'+
  (extra?'<p class="advance-confirmation">'+safe(extra)+'</p>':'')+
  '<a class="advance-cta" href="'+safe(url)+'" target="_blank" rel="noopener noreferrer">'+cta+' <span aria-hidden="true">↗</span><span class="sr-only">: '+safe(e.title)+'</span></a></article>';
}
function renderAdvanceBookings(){
 const candidates=bookingCandidates(),age=$('age').value;
 const section=$('advanceBookings'),note=$('advanceAgeNote');
 const unknown=candidates.filter(x=>isAgeUnknown(x.event)).length;
 note.hidden=!age;
 if(age){
  const known=candidates.length-unknown;
  note.textContent='Para '+age+' años · '+known+' con edad indicada'+
   ($('includeUnknownAge').checked?', '+unknown+' sin edad confirmada':' · Excluidos los planes sin edad confirmada');
 }
 // Las reservas son una vista independiente, nunca un acordeón sobre la agenda.
 section.hidden=activeView!=='reservas';
 if(!candidates.length){
  $('advanceCards').innerHTML=age?'<div class="advance-empty">No hay actividades para reservar que coincidan con estos filtros'+
    ($('includeUnknownAge').checked?'. Comprueba otra edad o municipio.':'. Puedes activar «Incluir planes sin edad confirmada» para ampliar las opciones.')+
    '</div>':'<div class="advance-empty">'+(selectedDate?'No hay reservas para el '+fmtDate(selectedDate)+' con estos filtros. Prueba otra fecha o municipio.':'No hay planes para reservar en los próximos 1–60 días con estos filtros. Prueba otro municipio, categoría o precio.')+'</div>';
  return;
 }
 $('advanceCards').innerHTML=candidates.map(advanceCardHtml).join('');
}
function cardNextDate(e,today=localDate()){
 const when=$('when').value;
 const chosen=when==='today'?today:when==='tomorrow'?plusDays(today,1):when==='date'?selectedDate:null;
 const scheduled=Array.isArray(e.occurrences)&&e.occurrences.length;
 if(chosen&&eventOnDate(e,chosen))return chosen;
 if(when==='weekend'){
  const weekendDates=weekendEventDates(e,today);
  if(weekendDates.length)return weekendDates[0];
 }
 if(scheduled)return activeSessions(e).filter(d=>d>=today).sort()[0]||e.start;
 return e.start<today&&e.end>=today?today:e.start;
}
function dateParts(iso){
 const d=new Date((iso||'1970-01-01')+'T12:00:00Z');
 return {
  day:new Intl.DateTimeFormat('es-ES',{day:'numeric',timeZone:'UTC'}).format(d),
  month:new Intl.DateTimeFormat('es-ES',{month:'short',timeZone:'UTC'}).format(d).replace('.','').toUpperCase(),
  weekday:new Intl.DateTimeFormat('es-ES',{weekday:'short',timeZone:'UTC'}).format(d).replace('.','').toUpperCase()
 };
}
function cardHtml(e){
 const source=link(e.source_url),booking=link(e.reservation_url),published=e.status==='publicada_en_fuente';
 const age=e.age_min!=null&&e.age_max!=null?e.age_min+'–'+e.age_max+' años':
   e.age_min!=null?'Desde '+e.age_min+' años':e.age_max!=null?'Hasta '+e.age_max+' años':'Edad sin confirmar';
 const price=e.price_label||'Por confirmar';
 const date=cardNextDate(e),dateLabel=fmtDate(date),d=dateParts(date);
 const isRange=Boolean((e.end&&e.end!==e.start)||(e.occurrences&&e.occurrences.length>1));
 const occurrences=Array.isArray(e.occurrences)&&e.occurrences.length?activeSessions(e).filter(x=>x>=localDate()).sort():[];
 const dateType=occurrences.length?'Sesiones confirmadas':isRange?'Período activo':'Fecha';
 const moreDates=occurrences.length?occurrences.map(fmtDate).join(' · '):e.end&&e.end!==e.start?fmtDate(e.start)+' – '+fmtDate(e.end):dateLabel;
 const dateNote=e.schedule_note||'';
 const evidenceLink=k=>{
  const info=(e.field_sources||{})[k],href=link(info&&info.source_url);
  return href?' <a class="evidence-link" href="'+safe(href)+'" title="'+safe(info.quote||'Comprobar este dato')+'" target="_blank" rel="noopener noreferrer">Fuente ↗</a>':'';
 };
 const detail=(label,value,key)=>value==null||value===''?'':'<div class="detail"><label>'+label+'</label><span>'+safe(value)+(key?evidenceLink(key):'')+'</span></div>';
 const desc=String(e.details||'Consulta la ficha del organizador para más información.').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 const teaser=desc.length>118?desc.slice(0,115).replace(/\s+\S*$/,'')+'…':desc;
 const ageEvidence=link(e.age_source_url);
 const evidenceAge=ageEvidence?' <a class="evidence-link" href="'+safe(ageEvidence)+'" title="'+safe(e.age_quote||'Comprobar edad')+'" target="_blank" rel="noopener noreferrer">Fuente ↗</a>':'';
 const daysDetail=isRange?detail(dateType,moreDates+(dateNote?' · '+dateNote:'')):'';
 const headingId='activity-'+safe(e.id||'sin-id');
 const mainUrl=booking||source;
 const callToAction=mainUrl?'<a class="more" href="'+safe(mainUrl)+'" target="_blank" rel="noopener noreferrer">'+(booking?'Inscripción / entradas':'Ver actividad')+' <span aria-hidden="true">↗</span><span class="sr-only">: '+safe(e.title)+'</span></a>':'';
 const extraSource=booking&&source&&booking!==source?'<a class="source-link" href="'+safe(source)+'" target="_blank" rel="noopener noreferrer">Consultar ficha original ↗</a>':'';
 return '<article class="card" aria-labelledby="'+headingId+'">'+
  '<div class="card-main"><div class="date-badge" aria-label="'+safe(dateLabel)+'"><span class="date-weekday">'+safe(d.weekday)+'</span><strong>'+safe(d.day)+'</strong><span class="date-month">'+safe(d.month)+'</span></div>'+
  '<div class="card-body"><span class="card-category">'+safe(e.category||'Actividad familiar')+'</span>'+
  (!published?'<span class="pending-label">Por contrastar</span>':'')+
  '<h3 id="'+headingId+'">'+safe(e.title)+'</h3>'+
  '<p class="card-location"><span aria-hidden="true">⌖</span> '+safe(e.town||'Municipio pendiente')+(e.venue?' · '+safe(e.venue):'')+'</p>'+
  '<p class="card-time"><span aria-hidden="true">◷</span> '+safe(e.time||'Horario por confirmar')+'</p></div></div>'+
  '<div class="card-tags"><span class="'+(e.age_min==null&&e.age_max==null?'uncertain':'')+'">'+safe(age)+'</span><span class="price-tag '+(/confirmar|consultar|no indicad|pendiente/i.test(price)?'uncertain':'')+'"><span class="price-tag-label">Precio:</span> '+safe(price)+'</span></div>'+
  '<p class="card-teaser">'+safe(teaser)+'</p>'+
  '<div class="card-actions">'+callToAction+
  '<details class="card-expand"><summary>Más información <span aria-hidden="true">⌄</span></summary>'+
  '<div class="expanded-body"><p>'+safe(desc)+'</p><div class="details">'+
  detail('Fecha',dateLabel)+daysDetail+
  detail('Hora',e.time||'Por confirmar','time')+
  detail('Municipio',e.town||'Por confirmar')+
  detail('Lugar',e.venue||'Por confirmar','venue')+
  detail('Edad',age)+
  (e.age_min!=null||e.age_max!=null?'<div class="detail"><label>Justificación de edad</label><span>'+safe(e.age_label||age)+evidenceAge+'</span></div>':'')+
  detail('Precio',price,'price_label')+
  detail('Duración',e.duration_minutes!=null?e.duration_minutes+' minutos':null,'duration_minutes')+
  detail('Inscripción',e.reservation_required==null?null:e.reservation_required?'Reserva previa necesaria':'No requiere reserva','reservation_required')+
  detail('Dirección',e.address||null,'address')+
  '</div><p class="card-provenance">Fuente: '+safe(e.source_name||'Sin identificar')+
  ' · '+safe(e.last_checked?'Comprobado el '+e.last_checked.slice(0,10):'Sin comprobación reciente')+'</p>'+
  (source?'<a class="source-link" href="'+safe(source)+'" target="_blank" rel="noopener noreferrer">Ver fuente y confirmar ↗</a>':'')+
  extraSource+'</div></details></div></article>';
}
function renderEvents(){
 const filtered=state.events.filter(e=>matchesWhen(e)&&matchesOtherFilters(e)).sort(eventChronological);
 const count=filtered.length,withAge=filtered.filter(e=>e.age_min!=null||e.age_max!=null).length;
 const weekendLabel=$('when').value==='weekend'?' · '+fmtDate(weekendActiveWindow()[0])+' – '+fmtDate(weekendActiveWindow()[1])+' (viernes desde las 16:00)':'';
 $('resultsCount').textContent=count+' '+(count===1?'plan encontrado':'planes encontrados')+weekendLabel+($('when').value==='date'&&selectedDate?' · '+fmtDate(selectedDate):'')+($('age').value?' · '+$('age').value+' años: '+withAge+' con edad indicada'+(count-withAge?', '+(count-withAge)+' sin confirmar':''):'');
 $('showMore').hidden=count<=cardsShown;
 $('showMore').textContent='Mostrar más planes ('+(count-cardsShown)+' restantes) ↓';
 $('cards').innerHTML=filtered.slice(0,cardsShown).map(cardHtml).join('')||
 '<div class="empty"><strong>No hay planes con esos filtros.</strong><p>Prueba otra fecha o municipio. La ausencia de resultados no significa que no existan actividades.</p><button class="empty-reset" type="button" id="emptyReset">Restablecer filtros</button></div>';
 const reset=$('emptyReset');if(reset)reset.addEventListener('click',resetFilters);
}
function cinemaShowtimesFor(movie,date){
 return (movie.showtimes||[]).filter(s=>s.date===date&&Array.isArray(s.times)&&s.times.length);
}
function cinemaCardHtml(movie,date){
 const sessions=cinemaShowtimesFor(movie,date);
 const meta=[movie.classification,movie.duration_minutes!=null?movie.duration_minutes+' min':null,(movie.genres||[]).join(' · ')].filter(Boolean);
 const rows=sessions.map(s=>{
  const url=link(s.booking_url)||link(movie.source_url);
  const times=s.times.map(t=>'<span class="cinema-time">'+safe(t)+'</span>').join('');
  return '<div class="cinema-venue"><div><strong>'+safe(s.cinema)+'</strong><span>'+safe(s.town||'Málaga')+'</span></div><div class="cinema-session-actions"><div class="cinema-times">'+times+'</div>'+(url?'<a href="'+safe(url)+'" target="_blank" rel="noopener noreferrer">Horarios / entradas ↗</a>':'')+'</div></div>';
 }).join('');
 return '<article class="cinema-card"><div class="cinema-card-head"><div><span class="card-category">Cine infantil</span><h3>'+safe(movie.title)+'</h3></div><span class="cinema-age">'+safe(movie.classification||'Edad por confirmar')+'</span></div>'+
  (meta.length?'<p class="cinema-meta">'+meta.map(safe).join(' · ')+'</p>':'')+
  (movie.family_reason?'<p class="cinema-reason">'+safe(movie.family_reason)+'</p>':'')+
  '<div class="cinema-venues">'+rows+'</div></article>';
}
function renderCinema(){
 const section=$('cinemaResults');
 if(!section)return;
 section.hidden=activeView!=='cine';
 if(activeView!=='cine')return;
 if(!selectedDate){
  $('cinemaCount').textContent='Elige un día en el calendario.';
  $('cinemaCards').innerHTML='<div class="cinema-empty"><strong>Selecciona una fecha</strong><p>La cartelera de Cine solo utiliza el día elegido. No se aplican los filtros de Agenda o Reservas.</p></div>';
  return;
 }
 const movies=(state.cinema.movies||[]).filter(m=>cinemaShowtimesFor(m,selectedDate).length).sort((x,y)=>String(x.title||'').localeCompare(String(y.title||''),'es'));
 const cinemas=new Set(movies.flatMap(m=>cinemaShowtimesFor(m,selectedDate).map(s=>s.cinema))).size;
 $('cinemaCount').textContent=movies.length+' '+(movies.length===1?'película infantil':'películas infantiles')+' · '+cinemas+' '+(cinemas===1?'cine':'cines')+' · '+fmtDate(selectedDate);
 $('cinemaCards').innerHTML=movies.map(m=>cinemaCardHtml(m,selectedDate)).join('')||
  '<div class="cinema-empty"><strong>No tenemos sesiones infantiles verificadas para este día.</strong><p>La cartelera cambia con frecuencia; comprueba otro día del calendario.</p></div>';
}
function renderDiscoveries(){const ds=(state.discoveries||[]).filter(d=>d.status==='por_revisar');$('discoveries').innerHTML=ds.length?ds.slice().reverse().slice(0,150).map(d=>`<article class="source-card"><span class="pill pending">Pista sin verificar</span><h3>${safe(d.title)}</h3><p>${safe(d.source_name||d.domain||'Fuente externa')} · Detectado: ${safe((d.first_seen||'').slice(0,10))}</p>${d.review_reason?`<p>${safe(d.review_reason)}</p>`:''}${link(d.url)?`<a href="${safe(link(d.url))}" target="_blank" rel="noopener noreferrer">Abrir publicación ↗</a>`:''}</article>`).join(''):'<div class="empty">Todavía no hay descubrimientos sin revisar. El radar se alimentará en las próximas ejecuciones.</div>';}
function renderHealth(){
  const h=state.health||{},s=state.status||{};
  if(!h.generated_at || h.level==='pending'){
    $('healthCard').innerHTML='<p><strong>Estado desconocido:</strong> todavía no se ha publicado una ejecución integral del diagnóstico. No implica ausencia de errores.</p><p>Último rastreo registrado: '+safe(s.last_run||'no disponible')+'</p>';
    return;
  }
  const pending=state.sources.filter(x=>!x.last_checked).length;
  const failuresNow=state.sources.filter(x=>x.status==='error');
  const towns=new Set(state.events.filter(relevant).map(x=>x.town).filter(Boolean)).size;
  const stale=h.sources!==state.sources.length || h.events!==state.events.length;
  const failures=(failuresNow.length?failuresNow:(h.source_errors||[])).map(e=>'<li>'+safe(e.name)+' — '+safe(e.last_error||e.detail||'No disponible')+'</li>').join('');
  const alertItems=stale?['El diagnóstico no corresponde al número actual de actividades o fuentes.']:h.alerts||[];
  const alerts=alertItems.map(a=>'<li>'+safe(a)+'</li>').join('');
  const date=h.last_full_scan||s.last_run||null;
  const when=date?new Date(date).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):'Sin ejecutar';
  $('healthCard').innerHTML='<p><strong>Último rastreo completo:</strong> '+safe(when)+
  ' · <strong>Fuentes:</strong> '+safe(state.sources.length)+
  ' · <strong>Fuentes pendientes:</strong> '+safe(pending)+
  ' · <strong>Fuentes con error:</strong> '+safe(failuresNow.length)+
  ' · <strong>Municipios con planes:</strong> '+safe(towns)+
  '</p>'+(alerts?'<p><strong>Incidencias:</strong></p><ul>'+alerts+'</ul>':'<p>Sin nuevas incidencias detectadas.</p>')+
  (failures?'<p><strong>Detalle de fuentes fallidas:</strong></p><ul>'+failures+'</ul>':'');
}
function renderSources(){const q=$('searchSource').value.trim().toLocaleLowerCase('es');const rows=state.sources.filter(s=>[s.name,s.type,s.area,s.notes].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));$('sources').innerHTML=rows.map(s=>`<article class="source-card"><div><span class="pill soft">${safe(s.priority||'Normal')}</span><span class="pill ${s.status==='pendiente'?'pending':''}">${safe(s.status||'Pendiente')}</span></div><h3>${safe(s.name)}</h3><p>${safe(s.type)} · ${safe(s.area)}</p><p>${safe(s.notes||'')}</p>${link(s.url)?`<a href="${safe(link(s.url))}" target="_blank" rel="noopener noreferrer">Visitar fuente ↗</a>`:''}</article>`).join('')||'<div class="empty">No hay fuentes con este filtro.</div>';const suggestions=state.suggestions||[];$('sourceSuggestions').innerHTML=suggestions.length?suggestions.map(s=>`<article class="source-card"><span class="pill pending">Candidata</span><h3>${safe(s.name||s.domain)}</h3><p>${safe(s.reason||'Pendiente de valorar')}</p>${link(s.url)?`<a href="${safe(link(s.url))}" target="_blank" rel="noopener noreferrer">Revisar fuente ↗</a>`:''}</article>`).join(''):'<div class="empty">Sin propuestas nuevas. El catálogo no incorpora dominios sin revisión.</div>';}
async function getJson(name){const res=await fetch('data/'+name+'.json',{cache:'no-store'});if(!res.ok)throw new Error(name+': HTTP '+res.status);return res.json();}
async function init(){try{$('reloadData').hidden=true;const events=await getJson('events');if(!Array.isArray(events))throw new Error('events.json inválido');const optional=await Promise.all(['sources','discoveries','source_suggestions','status','radar_status','verification_status','health','cinema'].map(n=>getJson(n).catch(()=>n==='cinema'?{movies:[]}:['status','radar_status','verification_status','health'].includes(n)?{}:[])));const [sources,discoveries,suggestions,status,radar,verification,health,cinema]=optional;Object.assign(state,{events,sources:Array.isArray(sources)?sources:[],discoveries:Array.isArray(discoveries)?discoveries:[],suggestions:Array.isArray(suggestions)?suggestions:[],status:status||{},radar:radar||{},verification:verification||{},health:health||{},cinema:cinema&&Array.isArray(cinema.movies)?cinema:{movies:[]}});choices('town',[...new Set(events.filter(relevant).map(e=>e.town))]);choices('category',[...new Set(events.filter(relevant).map(e=>e.category))]);statusMessage();stats();syncAgeControl();renderEvents();renderCalendar();syncExplorerView();renderAdvanceBookings();renderCinema();}catch(e){$('statusLine').classList.add('warn');$('statusLine').textContent='No se pudo cargar la agenda. Comprueba la conexión y vuelve a intentarlo.';$('reloadData').hidden=false;document.querySelector('.diagnostics').open=true;$('projectInfo').open=true;$('cards').innerHTML='<div class="empty">No se pudo cargar la agenda. Usa el botón de reintentar de la sección de actualización.</div>';console.error(e);}}
// Dos modos de explorar sin acumular dos listados verticales.
let activeView='reservas';
function viewFromUrl(){return window.location.hash==='#cine'?'cine':window.location.hash==='#agenda'?'agenda':'reservas';}
function agendaPeriodLabel(){
 const v=$('when').value;
 if(v==='today')return 'hoy';
 if(v==='tomorrow')return 'mañana';
 if(v==='weekend'){
  const [from,to]=weekendActiveWindow();
  return 'este finde · '+fmtDate(from)+' – '+fmtDate(to);
 }
 if(v==='date')return selectedDate?'el '+fmtDate(selectedDate):'elige una fecha';
 if(v==='all')return 'todas las actividades vigentes';
 return 'próximos '+v+' días';
}
function syncExplorerView(){
 const agenda=activeView==='agenda',cine=activeView==='cine',reservas=activeView==='reservas';
 $('agendaResults').hidden=!agenda;
 $('advanceBookings').hidden=!reservas;
 $('cinemaResults').hidden=!cine;
 $('planFilters').hidden=cine;
 $('advancedFilters').hidden=cine;
 $('verifiedFilter').hidden=!agenda;
 $('advancedHint').textContent='Precio y novedades';
 $('viewPeriod').textContent=cine?(selectedDate?'Cine infantil · '+fmtDate(selectedDate):'Cine infantil · elige un día'):
  agenda?'Agenda próxima · '+agendaPeriodLabel():
  selectedDate?'Reservas para el '+fmtDate(selectedDate):
  'Reservas anticipadas · '+fmtDate(plusDays(localDate(),BOOKING_LEAD_DAYS))+
  ' – '+fmtDate(plusDays(localDate(),BOOKING_HORIZON_DAYS))+' (1–60 días desde hoy)';
 $('calendarHelp').innerHTML=cine?'<span class="calendar-help-dot" aria-hidden="true"></span> Cada número indica cuántas películas infantiles tienen sesiones verificadas ese día.':
  '<span class="calendar-help-dot" aria-hidden="true"></span> Cada número indica resultados de la pestaña actual con fecha documentada. En Agenda, <span class="calendar-help-pending">*</span> señala planes pendientes de contrastar.';
 const horizon=$('advanceBookings').querySelector('.advance-horizon');
 if(horizon)horizon.textContent=selectedDate?'Fecha elegida':'Próximos 1–60 días';
 for(const [view,id] of [['reservas','tabReservas'],['agenda','tabAgenda'],['cine','tabCine']]){
  const tab=$(id),selected=view===activeView;
  tab.setAttribute('aria-selected',String(selected));
  tab.tabIndex=selected?0:-1;
 }
}
function chooseExplorerView(next,{push=false}={}){
 if(!['agenda','reservas','cine'].includes(next))return;
 if(next===activeView){syncExplorerView();renderCinema();renderCalendar();return;}
 activeView=next;
 syncExplorerView();
 renderAdvanceBookings();renderCinema();renderCalendar();
 // Mantener el viewport donde estaba. La pestaña sticky ya permanece a la vista.
 if(push)window.history.pushState({pequeplanView:next},'',next==='cine'?'#cine':next==='agenda'?'#agenda':'#reservas');
}
function resetFilters(){
 for(const id of ['town','age','category','price'])$(id).value='';
 $('when').value='15';$('verifiedOnly').checked=true;$('newOnly').checked=false;
 $('includeUnknownAge').checked=true;
 cardsShown=36;
 clearCalendarDate();
 syncAgeControl();renderEvents();renderCalendar();renderAdvanceBookings();renderCinema();syncExplorerView();
}
for(const id of ['town','age','category','price','verifiedOnly','newOnly','includeUnknownAge'])
 $(id).addEventListener('input',()=>{
  if(id==='age')syncAgeControl();
  cardsShown=36;renderEvents();renderAdvanceBookings();syncExplorerView();renderCalendar();
 });
$('clearDate').addEventListener('click',resetSharedDate);
// El enlace del pie no puede limitarse a #projectInfo: <details> no se abre
// al navegar por una ancla, y las fuentes están en un segundo <details> cerrado.
function showSourcesAndTransparency(){
 const project=$('projectInfo'),sources=$('sourcesDetails');
 project.open=true;
 sources.open=true;
 renderSources();renderHealth();
 const summary=sources.querySelector('summary');
 summary.scrollIntoView({block:'start',behavior:'auto'});
 summary.focus({preventScroll:true});
}
$('footerSourcesLink').addEventListener('click',event=>{
 event.preventDefault();
 showSourcesAndTransparency();
});
$('projectInfo').addEventListener('toggle',()=>{if($('projectInfo').open){renderSources();renderHealth();renderDiscoveries();}});
$('sourcesDetails').addEventListener('toggle',()=>{if($('sourcesDetails').open){renderSources();renderHealth();}});
$('discoveryDetails').addEventListener('toggle',()=>{if($('discoveryDetails').open)renderDiscoveries();});
$('calendarPicker').addEventListener('toggle',()=>{
 if($('calendarPicker').open)renderCalendar();
});
$('calendarPrev').addEventListener('click',()=>{
 const previous=monthShift(calendarMonth,-1);
 if(previous<localDate().slice(0,7))return;
 calendarMonth=previous;renderCalendar();
});
$('calendarNext').addEventListener('click',()=>{
 calendarMonth=monthShift(calendarMonth,1);renderCalendar();
});
$('calendarDays').addEventListener('keydown',event=>{
 const button=event.target.closest('button[data-date]');
 if(!button)return;
 const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
 if(step==null)return;
 event.preventDefault();
 const next=plusDays(button.dataset.date,step);
 if(next<localDate())return;
 if(next.slice(0,7)!==calendarMonth){calendarMonth=next.slice(0,7);renderCalendar();}
 const target=$('calendarDays').querySelector('button[data-date="'+next+'"]');
 if(target&&!target.disabled)target.focus();
});
$('calendarDays').addEventListener('click',event=>{
 const day=event.target.closest('button[data-date]');
 if(day&&!day.disabled)chooseCalendarDate(day.dataset.date);
});
for(const tab of document.querySelectorAll('[data-explore]')){
 tab.addEventListener('click',()=>chooseExplorerView(tab.dataset.explore,{push:true}));
 tab.addEventListener('keydown',event=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();
  const order=['reservas','agenda','cine'],current=order.indexOf(tab.dataset.explore);
  const next=order[(current+(event.key==='ArrowRight'?1:-1)+order.length)%order.length];
  chooseExplorerView(next,{push:true});
  $({reservas:'tabReservas',agenda:'tabAgenda',cine:'tabCine'}[next]).focus({preventScroll:true});
 });
}
$('advanceBack').addEventListener('click',()=>chooseExplorerView('agenda',{push:true}));
window.addEventListener('popstate',()=>chooseExplorerView(viewFromUrl()));

$('showMore').addEventListener('click',()=>{cardsShown+=24;renderEvents();});
$('reloadData').addEventListener('click',init);
$('searchSource').addEventListener('input',renderSources);
$('clear').addEventListener('click',resetFilters);
syncAgeControl();
syncCalendarSelection();
// Cada apertura nueva comienza en Reservas, incluso si se recarga una URL antigua #agenda.
// El historial sigue permitiendo cambiar de vista en esta sesión.
activeView='reservas';
if(window.location.hash==='#agenda'||window.location.hash==='#cine')window.history.replaceState({pequeplanView:'reservas'},'','#reservas');
syncExplorerView();
init();
