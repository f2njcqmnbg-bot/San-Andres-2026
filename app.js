// Carga del plan y renderizado
let PLAN = [];
const DAYS_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','OFF','OPTIONAL','RACE','RUN','GYM'];

async function loadPlan(){
  const res = await fetch('data/plan.json');
  PLAN = await res.json();
  renderWeeksGrid();
  renderWeeklyKmChart();
}

function getWeeks(){
  const set = new Set(PLAN.map(r=>r.Week).filter(Boolean));
  return Array.from(set).sort();
}

function renderWeeksGrid(){
  const weeks = getWeeks();
  const grid = document.getElementById('weeksGrid');
  grid.innerHTML = '';
  weeks.forEach(week=>{
    const km = getWeeklyKmFromStorage(week);
    const card = document.createElement('div');
    card.className = 'col-6 col-md-4 col-lg-2';
    card.innerHTML = `
      <div class="card card-week h-100" onclick="openWeek('${week}')">
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex align-items-center justify-content-between">
              <h3 class="h5 mb-0">${week}</h3>
              <span class="badge rounded-pill badge-tag">${km.toFixed(1)} km</span>
            </div>
            <div class="small-muted mt-1">click para ver</div>
          </div>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function openWeek(week){
  const modal = new bootstrap.Modal(document.getElementById('weekModal'));
  document.getElementById('weekTitle').innerText = `Semana ${week}`;

  const rows = PLAN.filter(r=>r.Week===week);
  // agrupar por Day
  const byDay = {};
  rows.forEach(r=>{
    const day = r.Day || 'NA';
    byDay[day] = byDay[day] || [];
    byDay[day].push(r);
  });
  const days = Object.keys(byDay).sort((a,b)=>{
    return DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b);
  });

  // Tabs
  const tabs = document.getElementById('daysTabs');
  tabs.innerHTML = '';
  days.forEach((d,i)=>{
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<button class="nav-link ${i===0?'active':''}" data-bs-toggle="tab" data-bs-target="#tab-${i}" type="button">${d}</button>`;
    tabs.appendChild(li);
  });

  // Contenido
  const content = document.getElementById('dayContent');
  content.innerHTML = '';
  const tabContent = document.createElement('div');
  tabContent.className = 'tab-content';

  days.forEach((d,i)=>{
    const items = byDay[d];
    const pane = document.createElement('div');
    pane.className = `tab-pane fade ${i===0?'show active':''}`;
    pane.id = `tab-${i}`;

    // Tabla de la sesión (desde Excel)
    const table = document.createElement('table');
    table.className = 'table table-sm table-striped';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Fecha</th><th>Tipo</th><th>Componente</th><th>Item</th>
      <th>Series</th><th>Reps/Tiempo</th><th>RPE Obj</th><th>Zona/Intensidad</th><th>Descanso (s)</th><th>Notas</th>
    </tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    items.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.Date||''}</td>
        <td>${r.SessionType||''}</td>
        <td>${r.Component||''}</td>
        <td>${r.Item||''}</td>
        <td>${r.Sets||''}</td>
        <td>${r.Reps_or_Time||''}</td>
        <td>${r.Target_RPE||''}</td>
        <td>${r.Zone_or_Intensity||''}</td>
        <td>${r.Rest_s||''}</td>
        <td>${r.Notes||''}</td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Formulario de registro
    const type = (items.find(x=>x.SessionType)||{}).SessionType || '';
    const form = buildLogForm(type, {week, day:d});

    pane.appendChild(table);
    pane.appendChild(document.createElement('hr'));
    pane.appendChild(form);

    tabContent.appendChild(pane);
  });

  content.appendChild(tabContent);
  modal.show();
}

function buildLogForm(sessionType, ctx){
  const wrap = document.createElement('div');
  wrap.className = 'p-3 border border-secondary rounded-3';

  const title = document.createElement('h3');
  title.className = 'h6';
  title.textContent = `Registro – ${sessionType || 'Sesión'}`;

  const row = document.createElement('div');
  row.className = 'row g-3';

  if(sessionType==='RUN'){
    row.innerHTML = `
      <div class="col-6 col-md-3">
        <label class="form-label">Distancia (km)</label>
        <input type="number" step="0.01" class="form-control" id="km" />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">Tiempo (min)</label>
        <input type="number" step="1" class="form-control" id="minutes" />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">Pace (min/km)</label>
        <input type="text" class="form-control" id="pace" placeholder="ej: 5:10" />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">FC prom.</label>
        <input type="number" class="form-control" id="hr" />
      </div>
      <div class="col-12">
        <label class="form-label">Notas</label>
        <textarea class="form-control" id="notes" rows="2" placeholder="Sensación, dolor, etc."></textarea>
      </div>`;
  } else if(sessionType==='GYM'){
    row.innerHTML = `
      <div class="col-6 col-md-2">
        <label class="form-label">Series</label>
        <input type="number" class="form-control" id="sets" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">Reps</label>
        <input type="number" class="form-control" id="reps" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">Peso (kg)</label>
        <input type="number" step="0.5" class="form-control" id="weight" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label">RPE real</label>
        <input type="number" step="0.5" class="form-control" id="rpe" />
      </div>
      <div class="col-12 col-md-4">
        <label class="form-label">Notas</label>
        <input class="form-control" id="notes" />
      </div>`;
  } else {
    row.innerHTML = `<div class="col-12 text-secondary">No se requiere registro específico para este tipo de sesión.</div>`;
  }

  const btnWrap = document.createElement('div');
  btnWrap.className = 'mt-3';
  const btn = document.createElement('button');
  btn.className = 'btn btn-save';
  btn.textContent = 'Guardar registro';
  btn.onclick = ()=>{
    const payload = collectFormValues(row);
    saveLog(ctx.week, ctx.day, payload);
    renderWeeksGrid();
    renderWeeklyKmChart();
  };

  wrap.appendChild(title);
  wrap.appendChild(row);
  btnWrap.appendChild(btn);
  wrap.appendChild(btnWrap);
  // precargar si existe
  preloadForm(row, getLog(ctx.week, ctx.day));
  return wrap;
}

function collectFormValues(container){
  const get = id=>{
    const el = container.querySelector('#'+id);
    return el? el.value : undefined;
  }
  return {
    km: parseFloat(get('km'))||0,
    minutes: parseFloat(get('minutes'))||0,
    pace: get('pace')||'',
    hr: parseFloat(get('hr'))||0,
    sets: parseFloat(get('sets'))||0,
    reps: parseFloat(get('reps'))||0,
    weight: parseFloat(get('weight'))||0,
    rpe: parseFloat(get('rpe'))||0,
    notes: get('notes')||''
  };
}

function preloadForm(container, data){
  if(!data) return;
  const ids = ['km','minutes','pace','hr','sets','reps','weight','rpe','notes'];
  ids.forEach(id=>{
    const el = container.querySelector('#'+id);
    if(el && data[id]!==undefined){ el.value = data[id]; }
  });
}

const LS_KEY = 'trainingLogs_v1';
function getAllLogs(){
  try{ return JSON.parse(localStorage.getItem(LS_KEY))||{} }catch(e){ return {} }
}
function saveAllLogs(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
function key(week, day){ return `${week}__${day}`; }
function saveLog(week, day, data){
  const all = getAllLogs();
  all[key(week,day)] = data;
  saveAllLogs(all);
}
function getLog(week, day){
  const all = getAllLogs();
  return all[key(week,day)];
}

function getWeeklyKmFromStorage(week){
  const all = getAllLogs();
  let sum = 0;
  Object.keys(all).forEach(k=>{
    if(k.startsWith(week+'__')){
      sum += (all[k].km||0);
    }
  });
  return sum;
}

let kmChart;
function renderWeeklyKmChart(){
  const ctx = document.getElementById('weeklyKmChart');
  const weeks = getWeeks();
  const kms = weeks.map(w=>getWeeklyKmFromStorage(w));
  if(kmChart){ kmChart.destroy(); }
  kmChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: weeks,
      datasets:[{
        label:'Km totales por semana',
        data: kms,
        backgroundColor: '#00d1b266',
        borderColor: '#00d1b2',
        borderWidth: 1.5
      }]
    },
    options:{
      scales:{
        y:{ beginAtZero:true, grid:{ color:'#2a2a2a' }, ticks:{ color:'#bdbdbd' } },
        x:{ grid:{ color:'#1a1a1a' }, ticks:{ color:'#bdbdbd' } },
      },
      plugins:{ legend:{ labels:{ color:'#eaeaea' } } }
    }
  });
}

window.addEventListener('DOMContentLoaded', loadPlan);
