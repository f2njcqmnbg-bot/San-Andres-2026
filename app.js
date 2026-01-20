
// ==========================
// Plan Web – App Mejorada v2
// ==========================
// Cambios clave:
// - Vista por día con 2 plantillas para GYM: "Programado" y "Tu registro" (por ejercicio).
// - Vista RUN con Programado (Warm-up / Main / Notes) + formulario de registro de la sesión.
// - Guardado específico por ejercicio: week__day__exerciseId en LocalStorage.
// - Cálculo de km semanales basado en los registros RUN guardados.
// - Mantiene Bootstrap + Chart.js ya usados en index.html.
// -----------------------------------------------

let PLAN = [];
const DAYS_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','OFF','OPTIONAL','RACE'];
const LS_KEY = 'trainingLogs_v2';

// Utilidades de almacenamiento
function getAllLogs() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch (_) { return {}; }
}
function saveAllLogs(obj) { localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
function sanitizeId(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-zA-Z0-9]+/g, '_')                   // no alfanum → _
    .replace(/^_+|_+$/g, '')                          // bordes
    .toLowerCase();
}
function keyRun(week, day) { return `${week}__${day}__run`; }
function keyGym(week, day, exerciseId) { return `${week}__${day}__${exerciseId}`; }

// Guardar/leer RUN (por día)
function getRunLog(week, day) {
  const all = getAllLogs();
  return all[keyRun(week, day)];
}
function saveRunLog(week, day, data) {
  const all = getAllLogs();
  all[keyRun(week, day)] = data;
  saveAllLogs(all);
}

// Guardar/leer GYM (por ejercicio)
function getGymLog(week, day, exerciseId) {
  const all = getAllLogs();
  return all[keyGym(week, day, exerciseId)];
}
function saveGymLog(week, day, exerciseId, data) {
  const all = getAllLogs();
  all[keyGym(week, day, exerciseId)] = data;
  saveAllLogs(all);
}

// Kilómetros semanales (suma de todos los RUN del week)
function getWeeklyKmFromStorage(week) {
  const all = getAllLogs();
  let sum = 0;
  Object.entries(all).forEach(([k, v]) => {
    if (k.startsWith(`${week}__`) && k.endsWith(`__run`)) {
      sum += parseFloat(v.km || 0) || 0;
    }
  });
  return sum;
}

// Carga del plan (JSON generado desde tu Excel)
async function loadPlan() {
  const res = await fetch('data/plan.json');
  PLAN = await res.json();
  renderWeeksGrid();
  renderWeeklyKmChart();
}

// Semanas únicas
function getWeeks() {
  const set = new Set(PLAN.map(r => r.Week).filter(Boolean));
  return Array.from(set).sort();
}

// ---------------------------
// UI: parrilla de semanas
// ---------------------------
function renderWeeksGrid() {
  const weeks = getWeeks();
  const grid = document.getElementById('weeksGrid');
  grid.innerHTML = '';
  weeks.forEach(week => {
    const km = getWeeklyKmFromStorage(week);
    const col = document.createElement('div');
    col.className = 'col-6 col-md-4 col-lg-2';

    col.innerHTML = `
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
      </div>
    `;
    grid.appendChild(col);
  });
}

// ---------------------------------
// UI: modal por semana / tabs por día
// ---------------------------------
window.openWeek = function(week) {
  const modal = new bootstrap.Modal(document.getElementById('weekModal'));
  document.getElementById('weekTitle').innerText = `Semana ${week}`;

  const rows = PLAN.filter(r => r.Week === week);
  const byDay = {};
  rows.forEach(r => {
    const d = r.Day || 'NA';
    (byDay[d] = byDay[d] || []).push(r);
  });
  const days = Object.keys(byDay).sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));

  // Tabs
  const tabs = document.getElementById('daysTabs');
  tabs.innerHTML = '';
  days.forEach((d, i) => {
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

  days.forEach((d, i) => {
    const items = byDay[d];
    const pane = document.createElement('div');
    pane.className = `tab-pane fade ${i===0?'show active':''}`;
    pane.id = `tab-${i}`;

    // Determinar tipo dominante del día (RUN/GYM/OPTIONAL/OFF/RACE…)
    const dominantType = getDominantSessionType(items);

    // Encabezado del día
    const h = document.createElement('div');
    h.className = 'd-flex align-items-center justify-content-between mb-2';
    h.innerHTML = `
      <h5 class="mb-0">${d} – <span class="text-info">${dominantType || 'Sesión'}</span></h5>
    `;
    pane.appendChild(h);

    // Render según tipo
    if (dominantType === 'GYM') {
      renderGymDay(pane, week, d, items);
    } else if (dominantType === 'RUN') {
      renderRunDay(pane, week, d, items);
    } else {
      // Otros: OPTIONAL / OFF / RACE / Notes
      renderGenericDay(pane, items);
    }

    tabContent.appendChild(pane);
  });

  content.appendChild(tabContent);
  modal.show();
};

// Encontrar tipo de sesión "dominante" del día
function getDominantSessionType(items) {
  // Prioridad: RUN y GYM; de lo contrario toma el primero existente
  const types = Array.from(new Set(items.map(r => r.SessionType).filter(Boolean)));
  if (types.includes('RUN')) return 'RUN';
  if (types.includes('GYM')) return 'GYM';
  return types[0] || '';
}

// -----------------------
// Render de día: GYM
// -----------------------
function renderGymDay(container, week, day, items) {
  // Filtrar ejercicios programados
  const exRows = items.filter(r => (r.Component||'').toLowerCase() === 'exercise');

  if (exRows.length === 0) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning';
    alert.textContent = 'No hay ejercicios programados para este día.';
    container.appendChild(alert);
    return;
  }

  // Tabla: Programado
  const programmedTitle = document.createElement('h6');
  programmedTitle.textContent = 'Programado';
  container.appendChild(programmedTitle);
  container.appendChild(buildProgrammedGymTable(exRows));

  // Tabla: Tu registro (editable por ejercicio)
  const yourTitle = document.createElement('h6');
  yourTitle.className = 'mt-3';
  yourTitle.textContent = 'Tu registro';
  container.appendChild(yourTitle);

  const userTable = document.createElement('table');
  userTable.className = 'table table-sm table-striped align-middle';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Ejercicio</th>
      <th style="width:110px">Series</th>
      <th style="width:110px">Reps</th>
      <th style="width:120px">Peso (kg)</th>
      <th style="width:110px">RPE</th>
      <th>Notas</th>
    </tr>
  `;
  userTable.appendChild(thead);

  const tbody = document.createElement('tbody');

  exRows.forEach(row => {
    const exName = row.Item || 'Ejercicio';
    const exId = sanitizeId(exName);
    const prev = getGymLog(week, day, exId) || {};

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-semibold">${exName}</td>
      <td><input type="number" class="form-control form-control-sm" value="${prev.sets ?? ''}" data-k="sets"></td>
      <td><input type="number" class="form-control form-control-sm" value="${prev.reps ?? ''}" data-k="reps"></td>
      <td><input type="number" step="0.5" class="form-control form-control-sm" value="${prev.weight ?? ''}" data-k="weight"></td>
      <td><input type="number" step="0.5" class="form-control form-control-sm" value="${prev.rpe ?? ''}" data-k="rpe"></td>
      <td><input type="text" class="form-control form-control-sm" value="${prev.notes ?? ''}" data-k="notes"></td>
    `;
    tr.dataset.exerciseId = exId;
    tr.dataset.exerciseName = exName;
    tbody.appendChild(tr);
  });

  userTable.appendChild(tbody);
  container.appendChild(userTable);

  // Botón Guardar
  const btnWrap = document.createElement('div');
  btnWrap.className = 'mt-2';
  const btn = document.createElement('button');
  btn.className = 'btn btn-save';
  btn.textContent = 'Guardar registro de GYM';
  btn.onclick = () => {
    const rows = [...tbody.querySelectorAll('tr')];
    rows.forEach(tr => {
      const exId = tr.dataset.exerciseId;
      const data = {};
      tr.querySelectorAll('input').forEach(input => {
        const k = input.getAttribute('data-k');
        let val = input.value;
        if (['sets','reps','weight','rpe'].includes(k)) {
          val = parseFloat(val);
          if (Number.isNaN(val)) val = 0;
        }
        data[k] = val;
      });
      saveGymLog(week, day, exId, data);
    });
    // No afecta los km; solo refrescamos por si hay otros cálculos futuros
    renderWeeksGrid();
  };
  btnWrap.appendChild(btn);
  container.appendChild(btnWrap);
}

function buildProgrammedGymTable(exRows) {
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Ejercicio</th>
      <th>Series</th>
      <th>Reps/Tiempo</th>
      <th>RPE Obj</th>
      <th>Zona/Intensidad</th>
      <th>Descanso (s)</th>
      <th>Notas</th>
    </tr>
  `;
  const tbody = document.createElement('tbody');
  exRows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.Item || ''}</td>
      <td>${r.Sets || ''}</td>
      <td>${r.Reps_or_Time || ''}</td>
      <td>${r.Target_RPE || ''}</td>
      <td>${r.Zone_or_Intensity || ''}</td>
      <td>${r.Rest_s || ''}</td>
      <td>${r.Notes || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

// -----------------------
// Render de día: RUN
// -----------------------
function renderRunDay(container, week, day, items) {
  // Programado: agrupar componentes relevantes (Warm-up, Main, Note/Notes)
  const warm = items.filter(r => (r.Component||'').toLowerCase().includes('warm'));
  const main = items.filter(r => (r.Component||'').toLowerCase()==='main');
  const notes = items.filter(r => (r.Component||'').toLowerCase().includes('note'));

  const block = document.createElement('div');
  block.className = 'p-3 border border-secondary rounded-3';
  block.innerHTML = `
    <div class="mb-2"><strong>Programado</strong></div>
    ${renderRunProgrammedSection('Warm-up', warm)}
    ${renderRunProgrammedSection('Main', main)}
    ${renderRunProgrammedSection('Notas', notes)}
  `;
  container.appendChild(block);

  // Tu registro RUN
  const prev = getRunLog(week, day) || {};
  const form = document.createElement('div');
  form.className = 'p-3 border border-secondary rounded-3 mt-3';
  form.innerHTML = `
    <div class="mb-2"><strong>Tu registro</strong></div>
    <div class="row g-3">
      <div class="col-6 col-md-3">
        <label class="form-label">Distancia (km)</label>
        <input type="number" step="0.01" class="form-control" id="km" value="${prev.km ?? ''}">
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">Tiempo (min)</label>
        <input type="number" step="1" class="form-control" id="minutes" value="${prev.minutes ?? ''}">
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">Pace (min/km)</label>
        <input type="text" class="form-control" id="pace" placeholder="ej: 5:10" value="${prev.pace ?? ''}">
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label">FC prom.</label>
        <input type="number" class="form-control" id="hr" value="${prev.hr ?? ''}">
      </div>
      <div class="col-12">
        <label class="form-label">Notas</label>
        <textarea class="form-control" id="notes" rows="2" placeholder="Sensación, terreno, clima...">${prev.notes ?? ''}</textarea>
      </div>
    </div>
    <div class="mt-3">
      <button class="btn btn-save" id="saveRunBtn">Guardar registro RUN</button>
    </div>
  `;
  container.appendChild(form);

  form.querySelector('#saveRunBtn').addEventListener('click', () => {
    const data = {
      km: parseFloat(form.querySelector('#km').value || 0) || 0,
      minutes: parseFloat(form.querySelector('#minutes').value || 0) || 0,
      pace: form.querySelector('#pace').value || '',
      hr: parseFloat(form.querySelector('#hr').value || 0) || 0,
      notes: form.querySelector('#notes').value || ''
    };
    saveRunLog(week, day, data);
    renderWeeksGrid();
    renderWeeklyKmChart();
  });
}

function renderRunProgrammedSection(title, rows) {
  if (!rows || rows.length === 0) return '';
  // Unimos las descripciones en un solo bloque legible
  const list = rows.map(r => {
    // Preferimos mostrar el "Item" o "Reps_or_Time" + notas si existen
    const parts = [];
    if (r.Item) parts.push(`<span class="fw-semibold">${escapeHtml(r.Item)}</span>`);
    if (r.Reps_or_Time) parts.push(escapeHtml(r.Reps_or_Time));
    if (r.Zone_or_Intensity) parts.push(`<span class="text-info">${escapeHtml(r.Zone_or_Intensity)}</span>`);
    if (r.Target_RPE) parts.push(`<span class="text-warning">${escapeHtml(r.Target_RPE)}</span>`);
    if (r.Notes) parts.push(`<em>${escapeHtml(r.Notes)}</em>`);
    return `• ${parts.join(' · ')}`;
  }).join('<br>');
  return `
    <div class="mb-2">
      <div class="text-secondary small mb-1">${title}</div>
      <div>${list}</div>
    </div>
  `;
}

// -----------------------
// Render de día: genérico
// -----------------------
function renderGenericDay(container, items) {
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Fecha</th>
      <th>Tipo</th>
      <th>Componente</th>
      <th>Detalle</th>
      <th>Notas</th>
    </tr>
  `;
  const tbody = document.createElement('tbody');
  items.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.Date || ''}</td>
      <td>${r.SessionType || ''}</td>
      <td>${r.Component || ''}</td>
      <td>${r.Item || r.Reps_or_Time || ''}</td>
      <td>${r.Notes || ''}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

// ---------------------------
// Gráfico de Km por semana
// ---------------------------
let kmChart;
function renderWeeklyKmChart() {
  const ctx = document.getElementById('weeklyKmChart');
  const weeks = getWeeks();
  const kms = weeks.map(w => getWeeklyKmFromStorage(w));
  if (kmChart) kmChart.destroy();
  kmChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Km totales por semana',
        data: kms,
        backgroundColor: '#00d1b266',
        borderColor: '#00d1b2',
        borderWidth: 1.5
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true, grid: { color: '#2a2a2a' }, ticks: { color: '#bdbdbd' } },
        x: { grid: { color: '#1a1a1a' }, ticks: { color: '#bdbdbd' } },
      },
      plugins: { legend: { labels: { color: '#eaeaea' } } }
    }
  });
}

// ---------------------------
// Helpers
// ---------------------------
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// Init
window.addEventListener('DOMContentLoaded', loadPlan);
