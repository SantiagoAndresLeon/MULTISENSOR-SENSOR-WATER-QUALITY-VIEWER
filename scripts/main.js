const apiKey = 'AIzaSyCkoK0vUiTppNceyF2sZKsmufLqgPK_AVA'; 

// ID del primer Spreadsheet (Humedal Entrada)
const spreadsheetId = '1a2avgToqmMTziejnlxSAomqnzypB9XzYNtNijEfGok8'; 

// ID del segundo Spreadsheet (Humedal Salida)
const secondSpreadsheetId = '1RtRAfTI26SKUmhv58u3chuYhqHe_0zCeseYCLEgf_1g';

// HUMEDAL ENTRADA (hoja principal)
const rangePH            = 'pH!A:B';
const rangeOD            = 'OD!A:B';
const rangeORP           = 'ORP!A:B';
const rangeTemperatura   = 'Temperatura!A:B';
const rangeConductividad = 'Conductividad!A:B'; // si solo lees la col B
const rangeTurbiedad     = 'Turbiedad!A:B';

// HUMEDAL SALIDA (segundo Spreadsheet)
const rangePH_2            = 'pH!A:B';
const rangeOD_2            = 'OD!A:B';
const rangeORP_2           = 'ORP!A:B';
const rangeTemperatura_2   = 'Temperatura!A:B';
const rangeConductividad_2 = 'Conductividad!A:B';
const rangeTurbiedad_2     = 'Turbiedad!A:B';

async function fetchSheet(range, sheetId = spreadsheetId) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

/**
 * Carga datos de la hoja principal y opcionalmente de una hoja secundaria.
 * - Muestra una tabla con: FECHA | SENSOR | (SENSOR 2 opcional)
 * - Devuelve datos [{date, value}] para graficar a partir de la hoja principal.
 */
async function fetchSpreadsheetData(range, elementId, loadStatusId, headers,
  extraRange = null, extraHeader = null) {

  const loadStatus = document.getElementById(loadStatusId);
  try {
    const [resMain, resExtra] = await Promise.allSettled([
      fetchSheet(range, spreadsheetId),
      extraRange ? fetchSheet(extraRange, secondSpreadsheetId) : Promise.resolve(null)
    ]);

    if (resMain.status !== 'fulfilled') {
      throw new Error(`No se pudo leer la hoja principal: ${resMain.reason}`);
    }
    const dataMain = resMain.value;
    const dataExtra = (resExtra.status === 'fulfilled') ? resExtra.value : null;

    const valuesMain = (dataMain && dataMain.values) ? dataMain.values : [];
    if (valuesMain.length <= 1) {
      document.getElementById(elementId).innerHTML = 'No data found.';
      loadStatus.innerHTML = 'Datos cargados correctamente.';
      return { main: [], extra: [] };
    }

    // Últimos 5 registros para la TABLA (alineados por índice, no por fecha)
    const mainRows = valuesMain.slice(-5);
    let extraRows = [];
    if (dataExtra && dataExtra.values && dataExtra.values.length) {
      extraRows = dataExtra.values.slice(-5);
    }

    let hdrs = [...headers];
    if (extraRange && extraHeader) hdrs.push(extraHeader);

    let table = `<table border="1"><tr>${hdrs.map(h => `<th>${h}</th>`).join('')}</tr>`;
    const maxLen = Math.max(mainRows.length, extraRows.length);
    for (let i = maxLen - 1; i >= 0; i--) {
      const rMain = mainRows[i] || [];
      const fecha = rMain[0] || '';
      const valMain = rMain[1] || '';
      let valExtra = '';
      if (extraRange) {
        const rExtra = extraRows[i] || [];
        valExtra = (rExtra[1] !== undefined) ? rExtra[1] : '';
      }
      table += `<tr><td>${fecha}</td><td>${valMain}</td>${extraRange ? `<td>${valExtra}</td>` : ''}</tr>`;
    }
    table += '</table>';
    document.getElementById(elementId).innerHTML = table;
    loadStatus.innerHTML = 'Datos cargados correctamente.';

    // Series para GRÁFICA
    const parseSeries = (vals) => vals.slice(1).map(d => {
      const [dateStr, timeStr] = String(d[0] || '').split(' ');
      const [dd, mm, yyyy] = (dateStr || '').split('/').map(Number);
      const [HH = 0, MM = 0, SS = 0] = (timeStr || '00:00:00').split(':').map(Number);
      const dt = new Date(yyyy, (mm || 1) - 1, dd || 1, HH, MM, SS);
      return { date: dt, value: parseFloat(d[1]) };
    }).filter(x => !Number.isNaN(x.value));

    const seriesMain = parseSeries(valuesMain);
    const seriesExtra = (dataExtra && dataExtra.values) ? parseSeries(dataExtra.values) : [];

    return { main: seriesMain, extra: seriesExtra };

  } catch (err) {
    console.error('Error fetching data:', err);
    loadStatus.innerHTML = 'Error cargando los datos.';
    return { main: [], extra: [] };
  }
}

// --------- Modales de info ---------
function showInfo(message, title = "Información") {
  const modal = document.getElementById('info-modal');
  document.getElementById('modal-title-info').textContent = title;
  document.getElementById('modal-text').textContent = message;
  modal.style.display = 'block';
}
function closeModal() {
  document.getElementById('info-modal').style.display = 'none';
}
window.addEventListener('click', (e) => {
  const modal = document.getElementById('info-modal');
  if (e.target === modal) modal.style.display = 'none';
});

// --------- Gráficas ---------
function drawChartTwoSeries(mainData, extraData, containerId, opts) {
  const { mainColor = 'steelblue', mainLabel = 'Serie 1',
          extraColor = 'limegreen', extraLabel = 'Serie 2' } = opts || {};

  const container = d3.select(`#${containerId}`);
  if (!container.node() || !mainData || mainData.length === 0) return;

  const containerWidth = container.node().getBoundingClientRect().width;
  const width = Math.max(300, containerWidth - 50);
  const height = 400;
  const margin = { top: 50, right: 60, bottom: 80, left: 60 };

  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('preserveAspectRatio', 'xMinYMin meet')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const allData = extraData && extraData.length ? mainData.concat(extraData) : mainData;

  const xScale = d3.scaleTime()
    .domain(d3.extent(allData, d => d.date))
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([
      d3.min(allData, d => d.value) - 0.5,
      d3.max(allData, d => d.value) + 0.5
    ])
    .nice()
    .range([height, 0]);

  // Ejes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%d/%m/%Y %H:%M:%S')))
    .selectAll('text')
    .attr('transform', 'rotate(-30)')
    .style('text-anchor', 'end')
    .style('font-size', '12px');

  svg.append('g').call(d3.axisLeft(yScale));

  // Generador de línea
  const line = d3.line().x(d => xScale(d.date)).y(d => yScale(d.value));

  // Serie principal
  svg.append('path')
    .datum(mainData)
    .attr('fill', 'none')
    .attr('stroke', mainColor)
    .attr('stroke-width', 2)
    .attr('d', line);

  // Serie extra (si existe)
  const hasExtra = extraData && extraData.length;
  if (hasExtra) {
    svg.append('path')
      .datum(extraData)
      .attr('fill', 'none')
      .attr('stroke', extraColor)
      .attr('stroke-width', 3) // un poco más gruesa para distinguir
      .attr('d', line);
  }

  // Último punto de la principal
  const last = mainData[mainData.length - 1];
  if (last) {
    svg.append('circle')
      .attr('cx', xScale(last.date))
      .attr('cy', yScale(last.value))
      .attr('r', 6)
      .attr('fill', 'red');

    const formattedDate = d3.timeFormat('%d/%m/%Y %H:%M:%S')(last.date);
    let labelX = xScale(last.date) + 10;
    if (labelX + 150 > width) labelX -= 160;

    svg.append('text')
      .attr('x', labelX)
      .attr('y', yScale(last.value) - 10)
      .html(`<tspan fill="red">${last.value.toFixed(2)}</tspan> - ${formattedDate}`)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold');
  }
  
  // --- Último punto de la SERIE EXTRA (Hoja 2) ---
if (hasExtra && extraData.length) {
  const last2 = extraData[extraData.length - 1];
  // Punto final (usa el color de la serie extra)
  svg.append('circle')
    .attr('cx', xScale(last2.date))
    .attr('cy', yScale(last2.value))
    .attr('r', 6)
    .attr('fill', 'red');

  const formattedDate2 = d3.timeFormat('%d/%m/%Y %H:%M:%S')(last2.date);
  let labelX2 = xScale(last2.date) + 10;
  if (labelX2 + 150 > width) labelX2 -= 160;

  svg.append('text')
    .attr('x', labelX2)
    .attr('y', yScale(last2.value) - 10)
    .html(`<tspan fill="${'red'}">${last2.value.toFixed(2)}</tspan> - ${formattedDate2}`)
    .attr('font-size', '14px')
    .attr('font-weight', 'bold');
}

  // Leyenda
  const legend = svg.append('g').attr('transform', `translate(${width - 150}, ${-20})`);
  legend.append('rect').attr('width', 10).attr('height', 10).attr('fill', mainColor);
  legend.append('text').attr('x', 15).attr('y', 9).attr('font-size', '12px').text(mainLabel);

  if (hasExtra) {
    const l2 = svg.append('g').attr('transform', `translate(${width - 150}, ${0})`);
    l2.append('rect').attr('width', 10).attr('height', 10).attr('fill', extraColor);
    l2.append('text').attr('x', 15).attr('y', 9).attr('font-size', '12px').text(extraLabel);
  }

  // -------- Hover para AMBAS series --------
  const focus1 = svg.append('g').style('display', 'none');
  focus1.append('circle').attr('r', 5).attr('fill', 'black');
  const f1txt = focus1.append('text').attr('x', 10).attr('y', -10).attr('font-size', '12px');

  const focus2 = svg.append('g').style('display', hasExtra ? null : 'none');
  focus2.append('circle').attr('r', 5).attr('fill', 'black');
  const f2txt = focus2.append('text').attr('x', 10).attr('y', -10).attr('font-size', '12px');

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('mouseover', () => { focus1.style('display', null); if (hasExtra) focus2.style('display', null); })
    .on('mouseout',  () => { focus1.style('display', 'none'); if (hasExtra) focus2.style('display', 'none'); })
    .on('mousemove', mousemove);

  const bisect = d3.bisector(d => d.date).left;
  const fmt = d3.timeFormat('%d/%m/%Y %H:%M:%S');

  function nearest(dataArr, x0) {
    let i = bisect(dataArr, x0, 1);
    if (i >= dataArr.length) i = dataArr.length - 1;
    const d0 = dataArr[i - 1] || dataArr[0];
    const d1 = dataArr[i] || dataArr[dataArr.length - 1];
    return (x0 - d0.date > d1.date - x0) ? d1 : d0;
  }

  function mousemove(event) {
    const x0 = xScale.invert(d3.pointer(event)[0]);

    // Serie 1
    const d1 = nearest(mainData, x0);
    const x1 = xScale(d1.date), y1 = yScale(d1.value);
    focus1.attr('transform', `translate(${x1},${y1})`);
    const t1 = `${fmt(d1.date)}: ${d1.value.toFixed(2)}`;
    f1txt.text(t1);
    const b1 = f1txt.node().getBBox();
    f1txt.attr('x', (x1 + b1.width + 15 > width) ? -b1.width - 10 : 10);

    // Serie 2 (si hay)
    if (hasExtra) {
      const d2 = nearest(extraData, x0);
      const x2 = xScale(d2.date), y2 = yScale(d2.value);
      focus2.attr('transform', `translate(${x2},${y2})`);
      const t2 = `${fmt(d2.date)}: ${d2.value.toFixed(2)}`;
      f2txt.text(t2);
      const b2 = f2txt.node().getBBox();
      f2txt.attr('x', (x2 + b2.width + 15 > width) ? -b2.width - 10 : 10);
    }
  }
}



// --------- Inicio ---------
document.addEventListener('DOMContentLoaded', async () => {
  const ph = await fetchSpreadsheetData(
    rangePH, 'spreadsheet-data-ph', 'load-status-ph',
    ['FECHA', 'Humedal Entrada'], rangePH_2, 'Humedal Salida'
  );
  drawChartTwoSeries(ph.main, ph.extra, 'chart-ph',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });

  const od = await fetchSpreadsheetData(
    rangeOD, 'spreadsheet-data-od', 'load-status-od',
    ['FECHA', 'Valor (mgO₂/L)'], rangeOD_2, 'Humedal Salida'
  );
  drawChartTwoSeries(od.main, od.extra, 'chart-od',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });

  const orp = await fetchSpreadsheetData(
    rangeORP, 'spreadsheet-data-orp', 'load-status-orp',
    ['FECHA', 'Valor (mV)'], rangeORP_2, 'Humedal Salida'
  );
  drawChartTwoSeries(orp.main, orp.extra, 'chart-orp',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });

  const tmp = await fetchSpreadsheetData(
    rangeTemperatura, 'spreadsheet-data-temperatura', 'load-status-temperatura',
    ['FECHA', 'Valor (°C)'], rangeTemperatura_2, 'Humedal Salida'
  );
  drawChartTwoSeries(tmp.main, tmp.extra, 'chart-temperatura',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });

  const ec = await fetchSpreadsheetData(
    rangeConductividad, 'spreadsheet-data-conductividad', 'load-status-conductividad',
    ['FECHA', 'Valor (mS/cm)'], rangeConductividad_2, 'Humedal Salida'
  );
  drawChartTwoSeries(ec.main, ec.extra, 'chart-conductividad',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });

  const ntu = await fetchSpreadsheetData(
    rangeTurbiedad, 'spreadsheet-data-turbiedad', 'load-status-turbiedad',
    ['FECHA', 'Valor (NTU)'], rangeTurbiedad_2, 'Humedal Salida'
  );
  drawChartTwoSeries(ntu.main, ntu.extra, 'chart-turbiedad',
    { mainColor: 'blue', mainLabel: 'Humedal Entrada', extraColor: 'green', extraLabel: 'Humedal Salida' });
});


