const apiKey = 'AIzaSyCkoK0vUiTppNceyF2sZKsmufLqgPK_AVA'; // Reemplaza con tu clave de API
const spreadsheetId = '1a2avgToqmMTziejnlxSAomqnzypB9XzYNtNijEfGok8';
const rangePH = 'pH!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja pH
const rangeOD = 'OD!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja OD
const rangeORP = 'ORP!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja ORP
const rangeTemperatura = 'Temperatura!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja Temperatura
const rangeConductividad = 'Conductividad!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja Conductividad
const rangeTurbiedad = 'Turbiedad!A1:Z2001'; // Ajusta el rango según tus necesidades para la hoja Turbiedad

async function fetchSpreadsheetData(range, elementId, loadStatusId, headers) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    const loadStatus = document.getElementById(loadStatusId);

    try {
        console.log('Fetching data from URL:', url);
        const response = await fetch(url);
        const data = await response.json();
        console.log('Data fetched:', data);

        const values = data.values;
        if (!values || values.length <= 1) {
            document.getElementById(elementId).innerHTML = 'No data found.';
            loadStatus.innerHTML = 'Datos cargados correctamente.';
            return [];
        }

        // Obtener solo los últimos 5 registros
        const lastFiveValues = values.slice(-5); 

        // Crear tabla de datos
        let table = `<table border="1"><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>`;
        lastFiveValues.forEach(row => {
            table += '<tr>';
            row.forEach(cell => {
                table += `<td>${cell}</td>`;
            });
            table += '</tr>';
        });
        table += '</table>';
        document.getElementById(elementId).innerHTML = table;
        loadStatus.innerHTML = 'Datos cargados correctamente.';

        // Convertir los datos para la gráfica
        return values.slice(1).map(d => {
            let dateTimeParts = d[0].split(" "); // Separar fecha y hora
            let dateParts = dateTimeParts[0].split("/"); // Separar día, mes y año
            let timeParts = dateTimeParts[1].split(":"); // Separar horas, minutos y segundos

            let formattedDate = new Date(
                dateParts[2],      // Año
                dateParts[1] - 1,  // Mes (restamos 1 porque en JS los meses van de 0 a 11)
                dateParts[0],      // Día
                timeParts[0],      // Hora
                timeParts[1],      // Minutos
                timeParts[2]       // Segundos
            );

            return {
                date: formattedDate,
                value: parseFloat(d[1]) // Convertir el valor del sensor a número
            };
        });

    } catch (error) {
        console.error('Error fetching data:', error);
        loadStatus.innerHTML = 'Error cargando los datos.';
        return [];
    }
}

// ...existing code...

function drawChart(data, containerId, color, label) {
    const container = d3.select(`#${containerId}`);
    if (!container.node()) {
        console.error(`Error: Contenedor del gráfico ${containerId} no encontrado.`);
        return;
    }
    const containerWidth = container.node().getBoundingClientRect().width; // Obtener ancho del contenedor
    const width = containerWidth - 50; // Ajustar tamaño con margen
    const height = 400;
    const margin = { top: 50, right: 50, bottom: 80, left: 60 };

    // Limpiar gráfico anterior si existe
    container.selectAll("*").remove();

    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right}, ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMinYMin meet") // Hacer responsivo
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Escala del eje X (TIEMPO)
    const xScale = d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width]); // Rango de 0 al ancho de la escala

    // Escala del eje Y (VALORES DEL SENSOR)
    const yScale = d3.scaleLinear()
        .domain([
            d3.min(data, d => d.value) - 0.5,
            d3.max(data, d => d.value) + 0.5
        ])
        .range([height, 0]);

    // Eje X (Fechas)
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat("%d/%m/%Y %H:%M:%S")))
        .selectAll("text")
        .attr("transform", "rotate(-30)")
        .style("text-anchor", "end")
        .style("font-size", "12px");

    // Eje Y (Valores)
    svg.append("g").call(d3.axisLeft(yScale));

    // Línea de datos
    const line = d3.line()
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", line);

    // Último dato registrado
    const lastDataPoint = data[data.length - 1];
    const formattedDate = d3.timeFormat("%d/%m/%Y %H:%M:%S")(lastDataPoint.date);

    svg.append("circle")
        .attr("cx", xScale(lastDataPoint.date))
        .attr("cy", yScale(lastDataPoint.value))
        .attr("r", 6)
        .attr("fill", "red");

    let labelX = xScale(lastDataPoint.date) + 10;
    if (labelX + 150 > width) {
        labelX -= 160;
    }

    svg.append("text")
        .attr("x", labelX)
        .attr("y", yScale(lastDataPoint.value) - 10)
        .html(`<tspan fill="red">${lastDataPoint.value.toFixed(2)}</tspan> - ${formattedDate}`)
        .attr("font-size", "14px")
        .attr("font-weight", "bold");

    // Agregar leyenda
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 150}, ${margin.top})`);

    legend.append("rect")
        .attr("x", -640)
        .attr("y", -90)
        .attr("width", 10)
        .attr("height", 10)
        .attr("fill", color);

    legend.append("text")
        .attr("x", -625)
        .attr("y", -85)
        .text(label)
        .attr("font-size", "12px")
        .attr("alignment-baseline", "middle");

    // Agregar interactividad
    const focus = svg.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("circle")
        .attr("r", 5)
        .attr("fill", "black");

    focus.append("text")
        .attr("x", 10)
        .attr("y", -10);

    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

    function mousemove(event) {
        const bisectDate = d3.bisector(d => d.date).left;
        const x0 = xScale.invert(d3.pointer(event)[0]);
        const i = bisectDate(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;
        focus.attr("transform", `translate(${xScale(d.date)},${yScale(d.value)})`);
        
        const text = focus.select("text");
        text.text(`${d3.timeFormat("%d/%m/%Y %H:%M:%S")(d.date)}: ${d.value.toFixed(2)}`);
        
        // Ajustar la posición del texto si se sale del borde derecho
        const textWidth = text.node().getBBox().width;
        if (xScale(d.date) + textWidth + 15 > width) {
            text.attr("x", -textWidth - 10);
        } else {
            text.attr("x", 10);
        }
    }
}

// Llamar las funciones cuando se cargue la página
document.addEventListener('DOMContentLoaded', async () => {
    const dataPH = await fetchSpreadsheetData(rangePH, 'spreadsheet-data-ph', 'load-status-ph', ['FECHA', 'SENSOR']);
    const dataOD = await fetchSpreadsheetData(rangeOD, 'spreadsheet-data-od', 'load-status-od', ['FECHA', 'Valor (mgO₂/L)']);
    const dataORP = await fetchSpreadsheetData(rangeORP, 'spreadsheet-data-orp', 'load-status-orp', ['FECHA', 'Valor (Mv)']);
    const dataTemperatura = await fetchSpreadsheetData(rangeTemperatura, 'spreadsheet-data-temperatura', 'load-status-temperatura', ['FECHA', 'Valor (°C)']);
    const dataConductividad = await fetchSpreadsheetData(rangeConductividad, 'spreadsheet-data-conductividad', 'load-status-conductividad', ['FECHA', 'Valor (Microsiemens)', 'Valor (Milisimens)']);
    const dataTurbiedad = await fetchSpreadsheetData(rangeTurbiedad, 'spreadsheet-data-turbiedad', 'load-status-turbiedad', ['FECHA', 'Valor (UNT)']);
    
    drawChart(dataPH, 'chart-ph', 'steelblue', 'pH');
    drawChart(dataOD, 'chart-od', 'orange', 'OD');
    drawChart(dataORP, 'chart-orp', 'purple', 'ORP');
    drawChart(dataTemperatura, 'chart-temperatura', 'red', 'Temperatura');
    drawChart(dataConductividad, 'chart-conductividad', 'green', 'Conductividad');
    drawChart(dataTurbiedad, 'chart-turbiedad', 'brown', 'Turbiedad');
});