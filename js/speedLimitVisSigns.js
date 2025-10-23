
// ===============================
// Constants
// ===============================
const margin = { top: 50, right: 40, bottom: 40, left: 80 };
const width = 1200 - margin.left - margin.right;
const height = 460 - margin.top - margin.bottom;
const carHeight = 22;
const carWidth = 44;
const signSize = 60;
const signWidth = 96;
const poleWidth = 8;
const roadY = height - margin.bottom;

let xBand, yScale;
let speedKeys = [];
let allYears = [];
let cachedByYear = {};

// data cleaning helper
function getYear(d) {
    if (d.Year && String(d.Year).trim() !== "") return +d.Year;
    if (d.Month) {
        const y = parseInt(String(d.Month).slice(0, 4));
        return Number.isFinite(y) ? y : null;
    }
    return null;
}

function getCarPath(x, y, w, h) {
    const head = x + w * 0.2;
    const tail = x + w * 0.8;
    const topY = y - h;

    return `
    M${x},${y}
    L${x},${topY + h * 0.2}
    L${head},${topY + h * 0.2}
    L${head},${topY}
    L${tail},${topY}
    L${tail},${topY + h * 0.2}
    L${x + w},${topY + h * 0.2}
    L${x + w},${y}
    Z
  `;
}

//preprocess data
function preprocessData(rawData) {
    const filtered = rawData.filter(d => d.Measures === "Number of collisions");
    speedKeys = Object.keys(filtered[0]).filter(k => k.endsWith("per hour"));

    const yearSet = new Set();
    filtered.forEach(d => {
        const y = getYear(d);
        if (y) yearSet.add(y);
    });
    allYears = Array.from(yearSet).sort((a, b) => a - b);

    cachedByYear = {};
    allYears.forEach(y => {
        const rows = filtered.filter(d => getYear(d) === y);
        const arr = speedKeys.map(sk => {
            const sum = d3.sum(rows, r => +r[sk]);
            return {
                speed: sk.replace(" per hour", "").trim(),
                value: sum
            };
        });
        cachedByYear[y] = arr.sort((a, b) => parseInt(a.speed, 10) - parseInt(b.speed, 10));
    });
}

// initialize visualization
function initializeVisualization(rawData) {
    preprocessData(rawData);

    if (allYears.length === 0) {
        d3.select("#car-speed-limit-crashes-vis-nathan").append("p").text("No data available");
        return;
    }

    const defaultYear = allYears[allYears.length - 1];
    const yearSel = d3.select("#car-speed-limit-crashes-vis-nathan-year-select");
    yearSel
        .selectAll("option")
        .data(allYears)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);
    yearSel.property("value", defaultYear);

    const svg = d3
        .select("#car-speed-limit-crashes-vis-nathan")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Road gradient background
    const defs = svg.append("defs");
    const gradient = defs
        .append("linearGradient")
        .attr("id", "road-gradient")
        .attr("x1", "0%")
        .attr("x2", "0%")
        .attr("y1", "0%")
        .attr("y2", "100%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#dee2e6");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#adb5bd");

    svg
        .append("rect")
        .attr("class", "road")
        .attr("x", 0)
        .attr("y", roadY - 10)
        .attr("width", width)
        .attr("height", height - roadY + 10)
        .attr("fill", "url(#road-gradient)");

    xBand = d3.scaleBand().range([0, width]).padding(0.5);
    yScale = d3.scaleLinear().range([roadY - signSize / 2, 40]); // top safe padding

    // y-axis group
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(-30,0)`);

    // car
    svg
        .append("path")
        .attr("class", "car")
        .attr("transform", `translate(-${carWidth}, ${roadY - carHeight})`)
        .attr("d", getCarPath(0, carHeight, carWidth, carHeight))
        .attr("id", "animated-car")
        .attr("fill", "#e63946");

    updateVisualization(defaultYear);

    yearSel.on("change", function () {
        updateVisualization(+this.value);
    });

    animateCar();
}

// update visualization for a given year
function updateVisualization(year) {
    const svg = d3.select("#car-speed-limit-crashes-vis-nathan svg g");
    const data = cachedByYear[year];
    xBand.domain(data.map(d => d.speed));

    // y domain and limit
    const maxVal = d3.max(data, d => d.value);
    yScale.domain([0, maxVal * 1.05]); // leave 5% headroom

    // y-axis with subtle grid lines
    const axis = d3
        .axisLeft(yScale)
        .ticks(6)
        .tickSize(-width)
        .tickFormat(d3.format(".2s"));

    svg
        .select(".y-axis")
        .transition()
        .duration(600)
        .call(axis)
        .call(g =>
            g.selectAll(".tick line")
                .attr("stroke", "#bbb")
                .attr("stroke-opacity", 0.3)
        )
        .call(g => g.selectAll(".domain").attr("stroke", "#888"));

    const signs = svg.selectAll(".speed-sign").data(data, d => d.speed);
    const enter = signs
        .enter()
        .append("g")
        .attr("class", "speed-sign")
        .attr("transform", d => `translate(${xBand(d.speed) + xBand.bandwidth() / 2}, 0)`);

    // Pole
    enter
        .append("rect")
        .attr("class", "sign-pole")
        .attr("x", -poleWidth / 2)
        .attr("width", poleWidth)
        .attr("fill", "#444")
        .attr("y", roadY - signSize / 2)
        .attr("height", 0);

    // Square sign
    enter
        .append("rect")
        .attr("class", "sign-square")
        .attr("width", signWidth)
        .attr("height", signSize)
        .attr("x", -signWidth / 2)
        .attr("y", roadY - signSize / 2)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("stroke", "#d62828")
        .attr("stroke-width", 3)
        .attr("fill", "#fff");

    // Text (speed label)
    enter
        .append("text")
        .attr("class", "sign-text")
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", 700)
        .attr("y", roadY - signSize / 3)
        .text(d => `${d.speed}`);

    const merged = enter.merge(signs);

    const safeY = d => Math.max(yScale(d.value), 60); // prevent overshoot

    merged
        .transition()
        .duration(800)
        .attr("transform", d => `translate(${xBand(d.speed) + xBand.bandwidth() / 2},0)`);

    merged
        .select(".sign-pole")
        .transition()
        .duration(900)
        .attr("y", d => safeY(d))
        .attr("height", d => roadY - safeY(d));

    merged
        .select(".sign-square")
        .transition()
        .duration(900)
        .attr("y", d => safeY(d) - signSize);

    merged
        .select(".sign-text")
        .transition()
        .duration(900)
        .attr("y", d => safeY(d) - signSize / 2 + 5)
        .text(d => `${d.speed}`);

    signs.exit().remove();

    // Update title
    const titleSel = d3.select("#car-speed-limit-crashes-vis-nathan h1");
    if (!titleSel.empty()) {
        titleSel.text(`Number of Collisions by Speed Limit — ${year}`);
    }
}

//car animation.
function animateCar() {
    const car = d3.select("#animated-car");
    function repeat() {
        car
            .attr("transform", `translate(-${carWidth}, ${roadY - carHeight})`)
            .transition()
            .duration(10000)
            .ease(d3.easeLinear)
            .attr("transform", `translate(${width}, ${roadY - carHeight})`)
            .on("end", repeat);
    }
    repeat();
}
