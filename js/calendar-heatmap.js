(async function () {
  const container = d3.select("#heatmap").html("");
  const legendContainer = d3.select("#legend").html("");
  const rangeContainer = d3.select("#year-range").html("");
  const miniContainer = d3.select("#heatmap-mini"); // phone mini preview (Panel 2)

  // ---------- Load CSV ----------
  let raw;
  try {
    raw = await d3.csv("data/collisions_by_weekday_cleaned.csv");
  } catch (e) {
    console.error("Failed to load CSV at data/collisions_by_weekday_cleaned.csv", e);
    container.append("p").text("Could not load CSV at data/collisions_by_weekday_cleaned.csv");
    return;
  }

  // Normalize headers
  const normalizedColumns = raw.columns.map(c => (c || "").toString().trim());
  if (normalizedColumns.some((c, i) => c !== raw.columns[i])) {
    raw = raw.map(row => {
      const obj = {};
      for (const k in row) obj[(k || "").toString().trim()] = row[k];
      return obj;
    });
    raw.columns = normalizedColumns;
  }

  // Detect weekday column
  const weekdayCandidates = new Set(["day of week", "weekday", "day"]);
  let weekdayCol = raw.columns.find(c => weekdayCandidates.has(c.toLowerCase().trim()));
  if (!weekdayCol) weekdayCol = raw.columns.find(c => c.toLowerCase().includes("week") || c.toLowerCase().includes("day"));
  if (!weekdayCol) {
    console.warn("Could not detect the weekday column. Columns:", raw.columns);
    container.append("p").text("Could not detect the weekday column in the CSV.");
    return;
  }

  const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekdayMap = new Map(weekdayOrder.map(w => [w.toLowerCase(), w]));

  // SHORT LABELS for x-axis
  const weekdayShort = {
    Monday: "MON",
    Tuesday: "TUE",
    Wednesday: "WED",
    Thursday: "THU",
    Friday: "FRI",
    Saturday: "SAT",
    Sunday: "SUN"
  };

  const valueFormat = d3.format(",");

  // Year columns
  const yearCols = raw.columns
    .map(c => c.trim())
    .filter(c => /^\d{4}$/.test(c))
    .sort((a, b) => +a - +b);

  if (!yearCols.length) {
    console.warn("No year columns found.");
    container.append("p").text("No numeric year columns found in the CSV.");
    return;
  }

  // ---------- Long-form data ----------
  const longData = [];
  for (const row of raw) {
    const wdRaw = (row[weekdayCol] ?? "").toString().trim().toLowerCase();
    const wd = weekdayMap.get(wdRaw);
    if (!wd) continue;

    for (const y of yearCols) {
      const vRaw = row[y];
      const v = vRaw === "" || vRaw == null ? NaN : +vRaw;
      if (!Number.isNaN(v)) longData.push({ year: +y, weekday: wd, value: v });
    }
  }

  if (!longData.length) {
    container.append("p").text("No data found after reading the CSV.");
    return;
  }

  const allYears = Array.from(new Set(longData.map(d => d.year))).sort((a, b) => a - b);
  const minYear = d3.min(allYears);
  const maxYear = d3.max(allYears);
  const defaultStart = Math.max(minYear, maxYear - 4); // last 5 years
  const defaultEnd = maxYear;

  // ---------- Main heatmap SVG ----------
  const margin = { top: 60, right: 40, bottom: 20, left: 80 };
  const width = 960;
  const height = 480;

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3.scaleBand()
    .domain(weekdayOrder)
    .range([0, innerWidth])
    .paddingInner(0.12)
    .paddingOuter(0.06);

  const y = d3.scaleBand()
    .domain(allYears)
    .range([0, innerHeight])
    .paddingInner(0.18)
    .paddingOuter(0.16);

  const values = longData.map(d => d.value);
  const vmin = d3.min(values);
  const vmax = d3.max(values);
  const color = d3.scaleSequential([vmin, vmax], d3.interpolateYlOrRd);

  // Axes  (x-axis uses SHORT labels)
  const xAxis = d3.axisTop(x).tickFormat(d => weekdayShort[d] || d);
  const yAxis = d3.axisLeft(y).tickValues(allYears);

  g.append("g")
    .attr("class", "axis axis--x")
    .call(xAxis);

  g.append("g")
    .attr("class", "axis axis--y")
    .call(yAxis);

  // ---------- Tooltip ----------
  const tooltip = d3.select("body").append("div").attr("class", "tooltip");
  const show = (event, d) => {
    tooltip.html(`<strong>${d.weekday}</strong>, ${d.year}<br/>Value: ${valueFormat(d.value)}`)
      .style("left", event.clientX + "px")
      .style("top", event.clientY + "px")
      .classed("visible", true);
  };
  const move = (event) => tooltip.style("left", event.clientX + "px").style("top", event.clientY + "px");
  const hide = () => tooltip.classed("visible", false);

  const T = () => d3.transition().duration(200).ease(d3.easeQuadOut);

  const cellsG = g.append("g").attr("class", "cells");
  const gridG = g.append("g").attr("class", "grid");

  // ---------- Mini preview (phone) ----------
  function updateMiniPreview() {
    return;
  }

  // ---------- Update function ----------
  function updateYears(yearSubset, animate = true) {
    if (!yearSubset || !yearSubset.length) yearSubset = allYears;

    y.domain(yearSubset);

    // Axis
    const ySel = g.select(".axis--y");
    (animate ? ySel.transition(T()) : ySel)
      .call(d3.axisLeft(y).tickValues(yearSubset));

    // Data
    const data = longData
      .filter(d => yearSubset.includes(d.year))
      .sort((a, b) => a.year - b.year || weekdayOrder.indexOf(a.weekday) - weekdayOrder.indexOf(b.weekday));

    const rects = cellsG.selectAll("rect").data(data, d => `${d.year}-${d.weekday}`);

    const merged = rects.join(
      enter => enter.append("rect")
        .attr("class", "cell")
        .attr("x", d => x(d.weekday))
        .attr("y", d => y(d.year))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4).attr("ry", 4)
        .attr("fill", d => color(d.value))
        .style("opacity", animate ? 0 : 1)
        .on("mouseenter", show)
        .on("mousemove", move)
        .on("mouseleave", hide),
      update => update,
      exit => animate
        ? exit.interrupt().transition(T()).style("opacity", 0).remove()
        : exit.remove()
    );

    if (animate) {
      merged
        .interrupt()
        .transition(T())
        .attr("x", d => x(d.weekday))
        .attr("y", d => y(d.year))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.value))
        .style("opacity", 1);
    } else {
      merged
        .interrupt()
        .attr("x", d => x(d.weekday))
        .attr("y", d => y(d.year))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.value))
        .style("opacity", 1);
    }

    // Vertical grid lines
    gridG.selectAll("line.grid-v")
      .data(weekdayOrder)
      .join(
        enter => enter.append("line").attr("class", "grid-line grid-v"),
        update => update,
        exit => exit.remove()
      )
      .attr("x1", d => x(d))
      .attr("x2", d => x(d))
      .attr("y1", 0)
      .attr("y2", innerHeight);

    // Horizontal grid lines
    gridG.selectAll("line.grid-h")
      .data(yearSubset)
      .join(
        enter => enter.append("line").attr("class", "grid-line grid-h"),
        update => update,
        exit => exit.remove()
      )
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", d => y(d))
      .attr("y2", d => y(d));

    // // Keep mini preview in sync
    // updateMiniPreview();
  }

  // Initial render
  updateYears(d3.range(defaultStart, defaultEnd + 1), false);

  // ---------- Year range slider / brush ----------
  const timelineContainer = rangeContainer.append("div").attr("class", "timeline-container");

  const rangeHeader = timelineContainer.append("div")
    .attr("class", "year-range-header");

  const rangeLabel = rangeHeader.append("div")
    .attr("class", "range-label-text")
    .text(`Years selected: ${defaultStart}–${defaultEnd}`);

  const controls = rangeHeader.append("div").attr("class", "year-range-controls");
  const selectAllBtn = controls.append("button").attr("type", "button").text("Check all years");
  const resetBtn = controls.append("button").attr("type", "button").text("Reset");

  const brushWidth = 800;
  const brushHeight = 100;
  const sliderPadding = 40;

  const brushSvg = timelineContainer.append("svg")
    .attr("class", "year-range-svg")
    .attr("viewBox", `0 0 ${brushWidth + sliderPadding * 2} ${brushHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const brushG = brushSvg.append("g")
    .attr("transform", `translate(${sliderPadding},26)`);

  const xYear = d3.scaleLinear().domain([minYear, maxYear]).range([0, brushWidth]);
  const axis = d3.axisBottom(xYear)
    .tickValues(allYears)
    .tickFormat(d3.format("d"))
    .tickSizeOuter(0);

  brushSvg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${sliderPadding},72)`)
    .call(axis);

  const brush = d3.brushX()
    .extent([[0, -10], [brushWidth, 24]])
    .handleSize(12)
    .on("brush", brushed)
    .on("end", brushended);

  const brushSel = brushG.append("g").attr("class", "brush").call(brush);

  const yearsToSelection = (start, end) => [xYear(start), xYear(end)];
  brushSel.call(brush.move, yearsToSelection(defaultStart, defaultEnd));

  function updateRangeLabel(y0, y1) {
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    rangeLabel.text(`Years selected: ${lo === hi ? lo : `${lo}–${hi}`}`);
  }

  function brushed({ selection }) {
    if (!selection) return;
    const [x0, x1] = selection;
    const y0 = Math.round(xYear.invert(x0));
    const y1 = Math.round(xYear.invert(x1));
    updateRangeLabel(y0, y1);
  }

  function brushended({ selection, sourceEvent }) {
    if (!selection) return;

    let [x0, x1] = selection;
    let y0 = Math.round(xYear.invert(x0));
    let y1 = Math.round(xYear.invert(x1));

    if (y0 > y1) [y0, y1] = [y1, y0];
    y0 = Math.max(minYear, Math.min(maxYear, y0));
    y1 = Math.max(minYear, Math.min(maxYear, y1));

    updateRangeLabel(y0, y1);
    const snapped = yearsToSelection(y0, y1);

    // keep brush + heatmap in sync without recursive loops
    if (sourceEvent) {
      d3.select(this).transition().duration(140).call(brush.move, snapped);
    } else if (selection[0] !== snapped[0] || selection[1] !== snapped[1]) {
      brushSel.call(brush.move, snapped);
    }

    updateYears(d3.range(y0, y1 + 1));
  }

  function moveToRange(start, end) {
    const clampedStart = Math.max(minYear, Math.min(maxYear, start));
    const clampedEnd = Math.max(minYear, Math.min(maxYear, end));
    const lo = Math.min(clampedStart, clampedEnd);
    const hi = Math.max(clampedStart, clampedEnd);
    brushSel.call(brush.move, yearsToSelection(lo, hi));
    updateYears(d3.range(lo, hi + 1));
  }

  selectAllBtn.on("click", () => moveToRange(minYear, maxYear));
  resetBtn.on("click", () => moveToRange(defaultStart, defaultEnd));

  // ---------- Legend ----------
  renderLegend(legendContainer, color, vmin, vmax, width);

  function renderLegend(containerSel, colorScale, vminLocal, vmaxLocal, desiredWidth) {
    containerSel.selectAll("*").remove();

    containerSel.append("div")
      .attr("class", "title")
      .text("Value scale");

    const legendWidth = desiredWidth || Math.min(600, (containerSel.node().clientWidth || 600));
    const legendHeight = 52;
    const marginL = { top: 8, right: 12, bottom: 24, left: 12 };

    const svgL = containerSel.append("svg")
      .attr("viewBox", [0, 0, legendWidth, legendHeight].join(" "));

    const w = legendWidth - marginL.left - marginL.right;
    const gL = svgL.append("g").attr("transform", `translate(${marginL.left},${marginL.top})`);

    const xL = d3.scaleLinear().domain([vminLocal, vmaxLocal]).range([0, w]);

    const n = 256;
    const data = d3.range(n).map(i => d3.interpolateNumber(vminLocal, vmaxLocal)(i / (n - 1)));

    gL.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", d => xL(d))
      .attr("y", 0)
      .attr("width", w / n + 1)
      .attr("height", 16)
      .attr("fill", d => colorScale(d));

    const axisLegend = d3.axisBottom(xL).ticks(5).tickSizeOuter(0);

    gL.append("g")
      .attr("transform", "translate(0,18)")
      .attr("class", "axis")
      .call(axisLegend);
  }

  // Allow panels.js to refresh mini when modal closes
  document.addEventListener("heatmap-update-mini", updateMiniPreview);
})();
