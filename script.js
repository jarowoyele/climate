let DATA = null;
let mainChart = null;
let extremeChart = null;
let validationChart = null;

let state = { zone: "nigeria", variable: "temp" };

const COLORS = {
  nigeria: "#2e6da4",
  Tropical_Monsoon: "#1a9e8f",
  Tropical_Savannah: "#5a9e3c",
  Tropical_Dry_Sahel: "#e08a2e",
  Montane: "#7a5ea8",
};

const ZONE_LABELS = {
  nigeria: "Nigeria (whole country)",
  Tropical_Monsoon: "Tropical Monsoon",
  Tropical_Savannah: "Tropical Savannah",
  Tropical_Dry_Sahel: "Tropical Dry / Sahel",
  Montane: "Montane",
};

const IMPACT_TEXT = {
  "nigeria|temp": {
    title: "Rising temperatures, nationwide",
    points: [
      "Nigeria has warmed by roughly 1.1°C since 1980 — a small-sounding number that translates into measurably more hot days every year.",
      "Heat stress particularly affects outdoor workers, the elderly, and anyone without reliable cooling or shade.",
      "Hospitals and clinics may see increased heat-related illness during peak hot seasons."
    ]
  },
  "nigeria|rain": {
    title: "Rainfall is declining nationally",
    points: [
      "Nigeria's total annual rainfall has dropped by roughly 116mm since 1980 — enough to affect water availability and crop planning at a national scale.",
      "Farmers relying on rain-fed agriculture face growing uncertainty in planting-season timing.",
      "Reduced rainfall affects river levels, hydropower generation, and water supply systems."
    ]
  },
  "Tropical_Monsoon|temp": {
    title: "The fastest-warming zone in Nigeria",
    points: [
      "Despite being Nigeria's coolest zone on average, the Monsoon region (Lagos, Niger Delta, and the southern coast) is warming faster than anywhere else in the country.",
      "Combined with high humidity, rising heat here increases the risk of dangerous heat-index conditions in dense coastal cities like Lagos and Port Harcourt.",
      "Faster warming over the Gulf of Guinea may also intensify coastal storms and flooding."
    ]
  },
  "Tropical_Monsoon|rain": {
    title: "Heavy rainfall days increasing fastest here",
    points: [
      "While the overall rainfall trend here isn't statistically significant, extreme heavy-rain days are increasing faster in the Monsoon zone than anywhere else in Nigeria.",
      "This raises flood risk in low-lying coastal and delta communities, including parts of Lagos and the Niger Delta.",
      "Urban drainage infrastructure built for historical rainfall patterns may increasingly be overwhelmed."
    ]
  },
  "Tropical_Savannah|temp": {
    title: "Steady, significant warming across the Middle Belt",
    points: [
      "The Savannah zone — Nigeria's agricultural heartland — is warming significantly, affecting crop stress and livestock conditions.",
      "Higher temperatures increase water demand for both farming and households.",
      "Longer, hotter dry spells can stress staple crops like maize, sorghum, and millet."
    ]
  },
  "Tropical_Savannah|rain": {
    title: "The sharpest rainfall decline in Nigeria",
    points: [
      "The Savannah zone shows the single steepest, most statistically significant rainfall decline of any zone — about 182mm less per year than in 1980.",
      "This directly threatens rain-fed agriculture across the Middle Belt, a region that feeds much of the rest of the country.",
      "Reduced rainfall increases competition for water between farming communities and herders, a known driver of regional tension."
    ]
  },
  "Tropical_Dry_Sahel|temp": {
    title: "Extreme heat in an already-hot region",
    points: [
      "The Sahel has Nigeria's highest absolute temperatures and the largest seasonal temperature swings.",
      "Hot days here can exceed 40°C, with direct risks to health, livestock, and labor productivity.",
      "Heat combined with limited water access compounds the burden on already water-stressed communities."
    ]
  },
  "Tropical_Dry_Sahel|rain": {
    title: "Rainfall is NOT significantly declining here — a surprising finding",
    points: [
      "Despite the Sahel's reputation for desertification, this analysis found no statistically significant rainfall decline in the region over 1980–2025.",
      "This challenges the common assumption that the Sahel is Nigeria's primary rainfall-decline story — the data points south instead.",
      "This doesn't mean the Sahel faces no water stress — it remains Nigeria's driest zone by far — but the *trend* here is flat, not worsening, in this dataset."
    ]
  },
  "Montane|temp": {
    title: "Nigeria's cool refuge is warming too",
    points: [
      "The Jos Plateau highlands are Nigeria's coolest region, but are still warming significantly — nearly 1°C since 1980.",
      "Agriculture and settlement patterns that rely on the Plateau's naturally cooler climate may face gradually shifting conditions.",
      "Montane's elevation-driven cooling effect is real but weaker and more spatially scattered than often assumed — see the Zone Validation findings."
    ]
  },
  "Montane|rain": {
    title: "A significant, steady rainfall decline",
    points: [
      "The Montane zone shows a statistically significant rainfall decline, similar in magnitude to the national trend.",
      "This affects highland agriculture and water supply for Plateau State communities.",
      "Because this zone's cool-climate signature is geographically diffuse (see Zone Validation), impacts likely extend into neighbouring Middle Belt areas too."
    ]
  },
};

async function loadData() {
  const res = await fetch('data.json');
  DATA = await res.json();
  render();
}

function getSeries(zoneKey, varKey) {
  const field = varKey === "temp" ? "temp_annual_mean" : "rain_annual_total";
  if (zoneKey === "nigeria") return DATA.nigeria[field];
  return DATA.zones[zoneKey][field];
}

function getTrend(zoneKey, varKey) {
  const bucket = varKey === "temp" ? DATA.trends.temperature : DATA.trends.rainfall;
  return bucket[zoneKey];
}

function projectForward(series, slope, lastYear, nYears) {
  const lastVal = series[lastYear];
  const years = [];
  const vals = [];
  for (let i = 1; i <= nYears; i++) {
    years.push(lastYear + i);
    vals.push(+(lastVal + slope * i).toFixed(3));
  }
  return { years, vals };
}

function renderMainChart() {
  const series = getSeries(state.zone, state.variable);
  const years = Object.keys(series).map(Number).sort((a, b) => a - b);
  const vals = years.map(y => series[y]);
  const trend = getTrend(state.zone, state.variable);

  const lastYear = years[years.length - 1];
  const proj = projectForward(series, trend.slope_per_yr, lastYear, 10);

  const bridgeYears = [lastYear, ...proj.years];
  const bridgeVals = [vals[vals.length - 1], ...proj.vals];

  const color = COLORS[state.zone];
  const unit = state.variable === "temp" ? "°C" : "mm";
  const varLabel = state.variable === "temp" ? "Mean Annual Temperature" : "Total Annual Rainfall";

  document.getElementById('chartTitle').textContent = `${varLabel} — ${ZONE_LABELS[state.zone]}`;

  const ctx = document.getElementById('mainChart').getContext('2d');
  if (mainChart) mainChart.destroy();
  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [...years, ...proj.years],
      datasets: [
        {
          label: 'Observed (1980–2025)',
          data: [...vals, ...Array(proj.years.length).fill(null)],
          borderColor: color,
          backgroundColor: color + '22',
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2.5,
        },
        {
          label: 'Projected trend (2026–2035)',
          data: [...Array(years.length - 1).fill(null), ...bridgeVals],
          borderColor: color,
          borderDash: [6, 5],
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (c) => c.parsed.y === null ? null : `${c.dataset.label}: ${c.parsed.y} ${unit}`
          }
        }
      },
      scales: {
        y: { title: { display: true, text: unit }, grid: { color: '#eef2f6' } },
        x: { grid: { display: false } }
      }
    }
  });

  const sig = trend.significant;
  const badge = document.getElementById('trendBadge');
  const dir = trend.slope_per_yr >= 0 ? 'increasing' : 'decreasing';
  badge.className = 'trend-badge ' + (sig ? 'sig' : 'not-sig');
  badge.innerHTML = `Trend: <strong>${trend.slope_per_yr >= 0 ? '+' : ''}${trend.slope_per_yr} ${unit}/year</strong> (${dir}) &mdash; ${sig ? 'statistically significant' : 'NOT statistically significant'} (p=${trend.p})`;
}

function renderImpact() {
  const key = `${state.zone}|${state.variable}`;
  const info = IMPACT_TEXT[key];
  const box = document.getElementById('impactBox');
  if (!info) { box.innerHTML = ''; return; }
  box.innerHTML = `<h3>${info.title}</h3><ul>${info.points.map(p => `<li>${p}</li>`).join('')}</ul>`;
}

function renderStats() {
  const grid = document.getElementById('statsGrid');
  const tempTrend = DATA.trends.temperature;
  const rainTrend = DATA.trends.rainfall;

  const fastestWarming = Object.entries(tempTrend).filter(([k]) => k !== 'nigeria')
    .sort((a, b) => b[1].slope_per_yr - a[1].slope_per_yr)[0];
  const steepestDecline = Object.entries(rainTrend).filter(([k]) => k !== 'nigeria')
    .sort((a, b) => a[1].slope_per_yr - b[1].slope_per_yr)[0];

  const cards = [
    { value: `+${tempTrend.nigeria.total_46yr}°C`, label: 'National warming since 1980' },
    { value: `${rainTrend.nigeria.total_46yr}mm`, label: 'National rainfall change since 1980' },
    { value: ZONE_LABELS[fastestWarming[0]], label: `Fastest-warming zone (+${fastestWarming[1].slope_per_yr}°C/yr)` },
    { value: ZONE_LABELS[steepestDecline[0]], label: `Steepest rainfall decline (${steepestDecline[1].slope_per_yr}mm/yr)` },
    { value: '97.3%', label: 'Hot-day prediction accuracy (ROC-AUC)' },
    { value: '0.513', label: 'Zone-boundary validation score (0–1)' },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>`).join('');
}

function renderExtremeChart() {
  const ex = DATA.extremes;
  const zones = ['nigeria', 'Tropical_Monsoon', 'Tropical_Savannah', 'Tropical_Dry_Sahel', 'Montane'];
  const labels = zones.map(z => ZONE_LABELS[z]);
  const hot = zones.map(z => ex[z].hot_day_trend_per_yr);
  const heavy = zones.map(z => ex[z].heavy_rain_trend_per_yr);

  const ctx = document.getElementById('extremeChart').getContext('2d');
  if (extremeChart) extremeChart.destroy();
  extremeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Extra hot days / year', data: hot, backgroundColor: '#c0442c' },
        { label: 'Extra heavy-rain days / year', data: heavy, backgroundColor: '#2e6da4' },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { title: { display: true, text: 'Additional days per year' } } }
    }
  });
}

function renderValidation() {
  const v = DATA.validation_2026;
  const ctx = document.getElementById('validationChart').getContext('2d');
  if (validationChart) validationChart.destroy();
  validationChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: v.dates.map(d => d.slice(5)),
      datasets: [
        { label: 'Actual', data: v.actual_temp, borderColor: '#10253f', borderWidth: 3, pointRadius: 4 },
        { label: 'Naive baseline', data: v.naive_temp, borderColor: '#9aa7b2', borderDash: [4, 3], pointRadius: 2 },
        { label: 'Random Forest', data: v.rf_temp, borderColor: '#2e6da4', borderDash: [4, 3], pointRadius: 2 },
        { label: 'LSTM', data: v.lstm_temp, borderColor: '#c0442c', borderDash: [4, 3], pointRadius: 2 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { y: { title: { display: true, text: '°C (Jan 2026 temperature)' } } }
    }
  });

  const rmse = v.rmse;
  const best = Object.entries(rmse).sort((a, b) => a[1].temp - b[1].temp)[0][0];
  const names = { naive: 'Naive Baseline', rf: 'Random Forest', lstm: 'LSTM' };
  document.getElementById('rmseTable').innerHTML = Object.entries(rmse).map(([k, v2]) => `
    <div class="rmse-card ${k === best ? 'best' : ''}">
      <div class="model-name">${names[k]}${k === best ? ' ✓ Best' : ''}</div>
      <div>Temp error: ${v2.temp}°C</div>
      <div>Rain error: ${v2.rain}mm</div>
    </div>`).join('');
}

function render() {
  renderMainChart();
  renderImpact();
  renderStats();
  renderExtremeChart();
  renderValidation();
}

document.getElementById('zoneGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.zone-card');
  if (!btn) return;
  state.zone = btn.dataset.zone;
  document.querySelectorAll('.zone-card').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderMainChart();
  renderImpact();
});

document.getElementById('varToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;
  state.variable = btn.dataset.var;
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMainChart();
  renderImpact();
});

document.querySelector('.zone-card[data-zone="nigeria"]').classList.add('active');
loadData();
