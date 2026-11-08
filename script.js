let DATA = null;
let chart = null;
let state = { zone: "nigeria", variable: "temp" };

const ZONE_LABELS = {
  nigeria: "Nigeria",
  Tropical_Monsoon: "the Monsoon zone",
  Tropical_Savannah: "the Savannah zone",
  Tropical_Dry_Sahel: "the Sahel",
  Montane: "the Montane zone",
};

const ZONE_COLOR = {
  nigeria: "#0f1620",
  Tropical_Monsoon: "#0d7a6c",
  Tropical_Savannah: "#5c7a2e",
  Tropical_Dry_Sahel: "#b4651f",
  Montane: "#6a4fa0",
};

async function loadData() {
  const res = await fetch('zone_forecasts.json');
  DATA = await res.json();
  render();
}

function render() {
  const z = DATA[state.zone];
  const isTemp = state.variable === "temp";
  const vals = isTemp ? z.temp_forecast : z.rain_forecast;
  const lastVal = isTemp ? z.last_temp : z.last_rain;
  const unit = isTemp ? "°C" : "mm";
  const color = ZONE_COLOR[state.zone];

  document.getElementById('asOf').textContent = `as of ${z.generated_from}`;

  const labels = [z.generated_from, ...z.dates].map(d => d.slice(5));
  const data = [lastVal, ...vals];

  const ctx = document.getElementById('forecastChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: color + '18',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: (c) => c.dataIndex === 0 ? 4 : 0,
        pointBackgroundColor: color,
        pointHoverRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: (c) => `${c.parsed.y} ${unit}` }
        }
      },
      scales: {
        y: { grid: { color: '#eef1f6' }, ticks: { font: { size: 11 } } },
        x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 7 } }
      }
    }
  });

  const first = vals[0];
  const last = vals[vals.length - 1];
  const dir = last > first ? "rising toward" : last < first ? "easing toward" : "holding near";
  const zoneLabel = ZONE_LABELS[state.zone];
  const varLabel = isTemp ? "Temperatures" : "Rainfall";

  document.getElementById('caption').innerHTML =
    `${varLabel} in ${zoneLabel}: <strong>${first}${unit}</strong> tomorrow, ${dir} <strong>${last}${unit}</strong> by day ${vals.length}.`;
}

document.getElementById('zoneGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.zone-btn');
  if (!btn) return;
  state.zone = btn.dataset.zone;
  document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
});

document.getElementById('varToggle').addEventListener('click', (e) => {
  const btn = e.target.closest('.var-btn');
  if (!btn) return;
  state.variable = btn.dataset.var;
  document.querySelectorAll('.var-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
});

loadData();
