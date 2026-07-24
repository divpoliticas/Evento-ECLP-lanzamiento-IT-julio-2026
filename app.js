// URL del JSON limpio generado por el ETL Local
const DATA_URL = "data_clean.json";

// Estado global de la aplicación
let rawData = [];
let filteredData = [];
let themeColumns = []; // Mapeo de columnas de áreas de experiencia
let selectedSectors = new Set();
let selectedThemes = new Set();

// Referencias a los gráficos
let chartTreemap = null; // Highcharts Treemap
let chartGauge = null; // Chart.js
let chartGender = null; // Chart.js
let chartSector = null; // Chart.js
let chartAge = null; // Chart.js

// Configuración de Chart.js global
Chart.defaults.color = '#475569';
Chart.defaults.font.family = "'Inter', sans-serif";

// Al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupDropdownEvents();
});

// Inicialización de la aplicación
async function initApp() {
    const statusText = document.getElementById("data-status-text");
    const statusIndicator = document.querySelector(".status-indicator");
    
    statusIndicator.className = "status-indicator loading";
    statusText.innerText = "Cargando datos...";

    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error("No se pudo cargar el JSON limpio");
        rawData = await response.json();
        
        // Detectar columnas de temáticas desde las llaves del primer registro
        if (rawData.length > 0) {
            detectThemeColumns(Object.keys(rawData[0]));
        }
        
        initializeFilters();
        updateDashboard();
        
        statusText.innerText = "Datos actualizados";
        statusIndicator.className = "status-indicator online";
    } catch (e) {
        console.error("Error al cargar los datos del ETL:", e);
        statusText.innerText = "Error al leer los datos de asistencia.";
        statusIndicator.style.backgroundColor = "var(--accent-red)";
        statusIndicator.style.boxShadow = "0 0 10px var(--accent-red)";
    }
}

// Identificar las columnas de temáticas de interés
function detectThemeColumns(fields) {
    themeColumns = fields.filter(f => f.trim().startsWith("Áreas de experiencia ECLP"));
}

// Obtener el nombre limpio de la temática
function cleanThemeName(columnHeader) {
    const match = columnHeader.match(/\[(.*?)\]/);
    return match ? match[1].trim() : columnHeader;
}

// Inicializar Filtros Dropdowns
function initializeFilters() {
    // 1. Obtener todos los sectores únicos
    const sectors = [...new Set(rawData.map(r => r.Sector).filter(s => s !== null && s !== undefined))].sort();
    
    // Poblar Selector de Sector
    const sectorOptionsContainer = document.getElementById("sector-options");
    sectorOptionsContainer.innerHTML = "";
    
    // Opción Seleccionar Todos
    const allOption = createDropdownOption("select-all-sector", "Todos los Sectores", true);
    sectorOptionsContainer.appendChild(allOption);
    
    sectors.forEach((sec, idx) => {
        const option = createDropdownOption(`sector-${idx}`, sec, false, sec);
        sectorOptionsContainer.appendChild(option);
    });

    // 2. Poblar Selector de Temáticas
    const tematicasOptionsContainer = document.getElementById("tematicas-options");
    tematicasOptionsContainer.innerHTML = "";
    
    const allThemesOption = createDropdownOption("select-all-themes", "Todas las Temáticas", true);
    tematicasOptionsContainer.appendChild(allThemesOption);
    
    themeColumns.forEach((col, idx) => {
        const cleanName = cleanThemeName(col);
        const option = createDropdownOption(`theme-${idx}`, cleanName, false, col);
        tematicasOptionsContainer.appendChild(option);
    });

    // Eventos del Interruptor Organizador
    document.getElementById("toggle-organizer").addEventListener("change", () => {
        updateDashboard();
    });
}

// Crear elemento de opción del dropdown customizado
function createDropdownOption(id, text, isAllOption = false, val = null) {
    const div = document.createElement("div");
    div.className = "select-option" + (isAllOption ? " selected select-all" : "");
    div.dataset.value = val !== null ? val : text;
    
    div.innerHTML = `
        <div class="select-option-checkbox">
            <i class="fa-solid fa-check"></i>
        </div>
        <span class="select-option-text" title="${text}">${text}</span>
    `;

    div.addEventListener("click", (e) => {
        e.stopPropagation();
        
        const isSector = div.parentElement.id === "sector-options";
        const selectedSet = isSector ? selectedSectors : selectedThemes;
        const triggerId = isSector ? "sector-trigger" : "tematicas-trigger";
        const triggerText = document.getElementById(triggerId).querySelector(".trigger-text");
        const defaultText = isSector ? "Todos los Sectores" : "Todas las Temáticas";

        if (isAllOption) {
            div.parentElement.querySelectorAll(".select-option").forEach(opt => {
                opt.classList.remove("selected");
            });
            div.classList.add("selected");
            selectedSet.clear();
        } else {
            const allOpt = div.parentElement.querySelector(".select-all");
            if (allOpt.classList.contains("selected")) {
                allOpt.classList.remove("selected");
            }
            
            div.classList.toggle("selected");
            const value = div.dataset.value;
            
            if (div.classList.contains("selected")) {
                selectedSet.add(value);
            } else {
                selectedSet.delete(value);
            }

            if (selectedSet.size === 0) {
                allOpt.classList.add("selected");
            }
        }

        if (selectedSet.size === 0) {
            triggerText.innerText = defaultText;
        } else {
            triggerText.innerText = `${selectedSet.size} seleccionado(s)`;
        }

        updateDashboard();
        renderActiveFiltersTags();
    });

    return div;
}

// Dibujar los Tags de Filtros Activos
function renderActiveFiltersTags() {
    const bar = document.getElementById("active-filters-bar");
    bar.innerHTML = "";

    selectedSectors.forEach(sec => {
        const tag = document.createElement("div");
        tag.className = "filter-tag";
        tag.innerHTML = `Sector: ${sec} <i class="fa-solid fa-xmark"></i>`;
        tag.querySelector("i").addEventListener("click", () => {
            const opt = document.querySelector(`#sector-options .select-option[data-value="${sec}"]`);
            if (opt) opt.click();
        });
        bar.appendChild(tag);
    });

    selectedThemes.forEach(col => {
        const cleanName = cleanThemeName(col);
        const tag = document.createElement("div");
        tag.className = "filter-tag";
        tag.innerHTML = `Tema: ${cleanName.substring(0, 25)}... <i class="fa-solid fa-xmark"></i>`;
        tag.querySelector("i").addEventListener("click", () => {
            const opt = document.querySelector(`#tematicas-options .select-option[data-value="${col}"]`);
            if (opt) opt.click();
        });
        bar.appendChild(tag);
    });
}

// Configurar los eventos de despliegue de los selectores múltiples
function setupDropdownEvents() {
    const dropdowns = document.querySelectorAll(".custom-select");
    
    dropdowns.forEach(dd => {
        const trigger = dd.querySelector(".select-trigger");
        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdowns.forEach(other => {
                if (other !== dd) other.classList.remove("active");
            });
            dd.classList.toggle("active");
        });
    });

    document.addEventListener("click", () => {
        dropdowns.forEach(dd => dd.classList.remove("active"));
    });
}

// Filtrar la data según el estado de los filtros
function filterData() {
    const includeOrganizers = document.getElementById("toggle-organizer").checked;

    filteredData = rawData.filter(row => {
        // Filtro de organizador
        if (!includeOrganizers && row.Es_Organizador) {
            return false;
        }

        // Filtro de Sector
        if (selectedSectors.size > 0 && !selectedSectors.has(row.Sector)) {
            return false;
        }

        // Filtro de Temáticas de Interés
        if (selectedThemes.size > 0) {
            let matchesAnyTheme = false;
            for (const col of selectedThemes) {
                const val = row[col];
                if (val === 'Primera preferencia para participar' || 
                    val === 'Segunda preferencia para participar' || 
                    val === 'Temática de interés secundario' ||
                    val === 'Sí' || val === 1 || val === '1') {
                    matchesAnyTheme = true;
                    break;
                }
            }
            if (!matchesAnyTheme) return false;
        }

        return true;
    });
}

// Actualizar los KPIs y Gráficos del Dashboard
function updateDashboard() {
    filterData();
    
    // SECCIÓN A: KPIs de Visión General
    const totalInscritos = filteredData.length;
    
    // Asistentes Efectivos (Estado_Asistencia === 'Asistió')
    const asistentesEfectivos = filteredData.filter(r => r.Estado_Asistencia === 'Asistió').length;
    const tasaAsistencia = totalInscritos > 0 ? ((asistentesEfectivos / totalInscritos) * 100).toFixed(1) : "0.0";

    document.getElementById("kpi-total-val").innerText = totalInscritos.toLocaleString("es-CL");
    document.getElementById("kpi-asistentes-val").innerText = asistentesEfectivos.toLocaleString("es-CL");
    document.getElementById("kpi-asistentes-min-text").innerText = `Al menos ${asistentesEfectivos} asistentes (registro oficial mínimo)`;
    document.getElementById("kpi-tasa-val").innerText = `${tasaAsistencia}%`;

    // CRÍTICO: Filtrar datos para que los gráficos solo desmenucen la ASISTENCIA EFECTIVA
    const effectiveAttendanceData = filteredData.filter(r => r.Estado_Asistencia === 'Asistió');

    // Renderizar Gráficos con la data de asistencia efectiva
    renderRegionsTreemap(effectiveAttendanceData);
    renderDecentralizationGauge(effectiveAttendanceData);
    renderGenderChart(effectiveAttendanceData);
    renderSectorChart(effectiveAttendanceData);
    renderAgeChart(effectiveAttendanceData);
}

// SECCIÓN B: Geografía y Descentralización (Treemap)
function renderRegionsTreemap(effectiveData) {
    const dataRegiones = effectiveData.filter(r => r.Region_residencia !== 'No especificada');

    // Frecuencia por región
    const regionCounts = {};
    dataRegiones.forEach(r => {
        regionCounts[r.Region_residencia] = (regionCounts[r.Region_residencia] || 0) + 1;
    });

    // Ordenar de mayor a menor para dar un ordenamiento visual en los colores
    const sortedRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

    // Mapear a formato de serie de Highcharts Treemap
    const treemapSeriesData = sortedRegions.map(([name, value], idx) => {
        let color = '#355DFA'; // Azul Eléctrico por defecto
        
        if (name === 'Metropolitana de Santiago') {
            color = '#321F89'; // Índigo para RM
        } else {
            // Generar degradados elegantes para el resto de regiones
            const opacity = Math.max(0.3, 1 - (idx * 0.05));
            color = `rgba(53, 93, 250, ${opacity})`;
        }

        return {
            name: name,
            value: value,
            color: color
        };
    });

    if (chartTreemap) {
        chartTreemap.destroy();
    }

    chartTreemap = Highcharts.chart('treemap-regions-container', {
        chart: {
            type: 'treemap',
            backgroundColor: 'transparent',
            spacing: [0, 0, 0, 0]
        },
        title: { text: null },
        credits: { enabled: false },
        tooltip: {
            backgroundColor: '#ffffff',
            borderColor: '#321F89',
            borderRadius: 8,
            borderWidth: 1.5,
            shadow: true,
            style: {
                color: '#0f172a',
                fontFamily: 'Inter',
                fontSize: '12px'
            },
            formatter: function () {
                return `<b>${this.point.name}</b><br/>Asistentes Efectivos: <b>${this.point.value}</b>`;
            }
        },
        series: [{
            layoutAlgorithm: 'squarified',
            alternateStartingDirection: true,
            data: treemapSeriesData,
            borderWidth: 1.5,
            borderColor: '#ffffff',
            dataLabels: {
                enabled: true,
                style: {
                    fontFamily: 'Inter',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    textOutline: 'none',
                    color: '#ffffff'
                }
            }
        }]
    });
}

// Minigráfico de Descentralización (Gauge Semi-donut)
function renderDecentralizationGauge(effectiveData) {
    const totalEffective = effectiveData.length;
    const regionData = effectiveData.filter(r => r.Region_residencia !== 'Metropolitana de Santiago' && r.Region_residencia !== 'No especificada');
    const rmData = effectiveData.filter(r => r.Region_residencia === 'Metropolitana de Santiago');

    const regionesCount = regionData.length;
    const rmCount = rmData.length;

    // Actualizar KPI Mini
    document.getElementById("kpi-regiones-count").innerText = regionesCount;

    // Calcular Porcentaje
    const pctRegiones = totalEffective > 0 ? ((regionesCount / totalEffective) * 100).toFixed(0) : "0";
    document.getElementById("gauge-pct-val").innerText = `${pctRegiones}%`;

    if (chartGauge) {
        chartGauge.destroy();
    }

    const ctx = document.getElementById("chart-descentralizacion").getContext("2d");
    chartGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Regiones', 'Metropolitana de Santiago'],
            datasets: [{
                data: [regionesCount, rmCount],
                backgroundColor: [
                    '#355DFA', // Azul Eléctrico
                    '#321F89'  // Índigo
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            rotation: -90,
            circumference: 180,
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0f172a',
                    bodyColor: '#475569',
                    borderColor: '#cbd5e1',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const percentage = totalEffective > 0 ? ((val / totalEffective) * 100).toFixed(1) : 0;
                            return ` Asistentes: ${val} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// SECCIÓN C: Equidad de Género (solo confirmados, sin nulos)
function renderGenderChart(effectiveData) {
    const confirmadosConGenero = effectiveData.filter(r => r.género !== null && r.género !== undefined && String(r.género).trim() !== "");
    
    const genderCounts = {};
    confirmadosConGenero.forEach(r => {
        const g = r.género.trim();
        genderCounts[g] = (genderCounts[g] || 0) + 1;
    });

    const labels = Object.keys(genderCounts);
    const dataValues = Object.values(genderCounts);

    if (chartGender) {
        chartGender.destroy();
    }

    const ctx = document.getElementById("chart-gender").getContext("2d");
    chartGender = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: [
                    'rgba(53, 93, 250, 0.85)',  // Azul Eléctrico
                    'rgba(50, 31, 137, 0.85)',  // Índigo
                    'rgba(217, 34, 62, 0.85)'    // Carmesí
                ],
                borderColor: [
                    '#355DFA',
                    '#321F89',
                    '#D9223E'
                ],
                borderWidth: 1.5,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0f172a',
                    bodyColor: '#475569',
                    borderColor: '#cbd5e1',
                    borderWidth: 1
                }
            }
        }
    });
}

// SECCIÓN D1: Ecosistema (solo confirmados)
function renderSectorChart(effectiveData) {
    const sectorCounts = {};
    effectiveData.forEach(r => {
        const s = r.Sector || 'No especificado';
        sectorCounts[s] = (sectorCounts[s] || 0) + 1;
    });

    const sortedSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
    const labels = sortedSectors.map(item => item[0]);
    const dataValues = sortedSectors.map(item => item[1]);

    if (chartSector) {
        chartSector.destroy();
    }

    const ctx = document.getElementById("chart-sector").getContext("2d");
    chartSector = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Asistentes Efectivos',
                data: dataValues,
                backgroundColor: 'rgba(53, 93, 250, 0.85)', // Azul Eléctrico
                borderColor: '#355DFA',
                borderWidth: 1.5,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(50, 31, 137, 0.85)', // Índigo en hover
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0f172a',
                    bodyColor: '#475569',
                    borderColor: '#cbd5e1',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: 'rgba(15, 23, 42, 0.05)' },
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

// SECCIÓN D2: Edad (solo confirmados)
function renderAgeChart(effectiveData) {
    const ages = effectiveData.map(r => r.Edad).filter(e => e !== null && e !== undefined && !isNaN(e) && e > 0);
    
    if (ages.length === 0) {
        if (chartAge) chartAge.destroy();
        return;
    }

    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;

    const bins = {
        'Menores de 25': 0,
        '25 - 34': 0,
        '35 - 44': 0,
        '45 - 54': 0,
        '55 - 64': 0,
        '65 o más': 0
    };

    ages.forEach(age => {
        if (age < 25) bins['Menores de 25']++;
        else if (age >= 25 && age <= 34) bins['25 - 34']++;
        else if (age >= 35 && age <= 44) bins['35 - 44']++;
        else if (age >= 45 && age <= 54) bins['45 - 54']++;
        else if (age >= 55 && age <= 64) bins['55 - 64']++;
        else bins['65 o más']++;
    });

    const labels = Object.keys(bins);
    const dataValues = Object.values(bins);

    if (chartAge) {
        chartAge.destroy();
    }

    const ctx = document.getElementById("chart-age").getContext("2d");
    chartAge = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Asistentes',
                data: dataValues,
                backgroundColor: 'rgba(50, 31, 137, 0.85)', // Índigo
                borderColor: '#321F89',
                borderWidth: 1.5,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(53, 93, 250, 0.85)', // Azul Eléctrico en hover
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0f172a',
                    bodyColor: '#475569',
                    borderColor: '#cbd5e1',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    grid: { color: 'rgba(15, 23, 42, 0.05)' },
                    ticks: { precision: 0 }
                }
            },
            plugins: [{
                id: 'averageLine',
                afterDraw: (chart) => {
                    const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
                    
                    const centers = [20, 29.5, 39.5, 49.5, 59.5, 70];
                    let binIndex = 0;
                    if (avgAge < 25) binIndex = 0;
                    else if (avgAge <= 34) binIndex = 1 + (avgAge - 25) / 10;
                    else if (avgAge <= 44) binIndex = 2 + (avgAge - 35) / 10;
                    else if (avgAge <= 54) binIndex = 3 + (avgAge - 45) / 10;
                    else if (avgAge <= 64) binIndex = 4 + (avgAge - 55) / 10;
                    else binIndex = 5;

                    const meta = chart.getDatasetMeta(0);
                    if (!meta.data || meta.data.length === 0) return;

                    let xPos = left;
                    const intPart = Math.floor(binIndex);
                    const fracPart = binIndex - intPart;

                    if (intPart < meta.data.length - 1) {
                        const x1 = meta.data[intPart].x;
                        const x2 = meta.data[intPart + 1].x;
                        xPos = x1 + (x2 - x1) * fracPart;
                    } else if (intPart < meta.data.length) {
                        xPos = meta.data[intPart].x;
                    }

                    // Dibujar la línea de promedio (Color Carmesí)
                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = '#D9223E'; // Carmesí solicitado
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([5, 4]);
                    ctx.moveTo(xPos, top);
                    ctx.lineTo(xPos, bottom);
                    ctx.stroke();

                    // Etiqueta del promedio
                    ctx.fillStyle = '#D9223E';
                    ctx.font = 'bold 12px Inter';
                    ctx.fillText(`Promedio: ${avgAge.toFixed(1)} años`, xPos + 8, top + 15);
                    ctx.restore();
                }
            }]
        }
    });
}
