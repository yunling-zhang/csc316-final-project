(async function () {
  const container = d3.select("#heatmap").html("");
  const legendContainer = d3.select("#legend");
  const rangeContainer = d3.select("#year-range").html("");

  // Load CSV
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

  // Long data
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

  // Car + grid layout constants
  const carWidth = 1200;
  const carHeight = 620;

  const gridWidth = 540;
  const gridHeight = 260;
  const gridOriginX = (carWidth - gridWidth) / 2;
  const gridOriginY = 220;
  const weekdayLabelYOffset = -30;
  const yearLabelX = gridOriginX - 52;

  const cabinPath = [
    "M280 240",
    "Q312 160 440 150",
    "L760 150",
    "Q844 160 910 222",
    "L940 260",
    "Q956 276 956 298",
    "L956 480",
    "Q956 496 940 496",
    "L328 496",
    "Q312 496 304 478",
    "L264 398",
    "Q250 368 280 240",
    "Z"
  ].join(" ");

  const bodyOutlinePath = [
    "M140 340",
    "Q168 256 240 230",
    "Q320 118 500 110",
    "L780 108",
    "Q930 116 1010 222",
    "L1062 244",
    "Q1140 276 1140 360",
    "L1140 490",
    "Q1140 510 1118 510",
    "L908 510",
    "Q880 580 796 580",
    "Q712 580 684 510",
    "L516 510",
    "Q488 580 404 580",
    "Q320 580 292 510",
    "L224 510",
    "Q140 510 140 420",
    "Z"
  ].join(" ");

  // Wrapper + SVG scaffold
  const carWrapper = container.append("div").attr("class", "car-wrapper");

  const svg = carWrapper.append("svg")
    .attr("class", "car-svg")
    .attr("viewBox", `0 0 ${carWidth} ${carHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img")
    .attr("aria-label", "Heatmap of collisions inside a car icon");

  const defs = svg.append("defs");
  defs.append("clipPath")
    .attr("id", "car-body-clip")
    .append("path")
    .attr("d", cabinPath);

  // Cabin background
  const cabinLayer = svg.append("g").attr("id", "cabin-layer");
  cabinLayer.append("path")
    .attr("class", "car-cabin")
    .attr("d", cabinPath);

  // Heatmap + grid clipped to cabin
  const heatmapLayer = svg.append("g")
    .attr("id", "heatmap-layer")
    .attr("clip-path", "url(#car-body-clip)");

  const gridG = heatmapLayer.append("g").attr("class", "grid");
  const cellsG = heatmapLayer.append("g");

  // Labels (not clipped so they can sit slightly outside)
  const labelsLayer = svg.append("g").attr("id", "labels-layer");
  const yearsG = labelsLayer.append("g").attr("class", "year-labels");
  const weekdayLabelsG = labelsLayer.append("g").attr("class", "weekday-labels");

  // Car outline (stroke only) and wheels
  const outlineLayer = svg.append("g").attr("id", "car-outline-layer");
  outlineLayer.append("path")
    .attr("class", "car-body-outline")
    .attr("d", bodyOutlinePath);

  // Scales
  const x = d3.scaleBand()
    .domain(weekdayOrder)
    .range([gridOriginX, gridOriginX + gridWidth])
    .paddingInner(0.12)
    .paddingOuter(0.06);

  weekdayLabelsG.selectAll("text")
    .data(weekdayOrder)
    .join("text")
    .attr("class", "weekday-label")
    .attr("x", d => x(d) + x.bandwidth() / 2)
    .attr("y", gridOriginY + weekdayLabelYOffset)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("dominant-baseline", "middle")
    .text(d => d.toUpperCase());

  // Color scale
  const values = longData.map(d => d.value);
  const vmin = d3.min(values);
  const vmax = d3.max(values);
  const color = d3.scaleSequential([vmin, vmax], d3.interpolateYlOrRd);

  // Tooltip
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

  function updateYears(yearSubset, animate = true) {
    if (!yearSubset || !yearSubset.length) yearSubset = allYears;

    const y = d3.scaleBand()
      .domain(yearSubset)
      .range([gridOriginY, gridOriginY + gridHeight])
      .paddingInner(0.18)
      .paddingOuter(0.16);

    const yearLabels = yearsG.selectAll("text").data(yearSubset, d => d);
    yearLabels.join(
      enter => enter.append("text")
        .attr("class", "year-label")
        .attr("x", yearLabelX)
        .attr("y", d => y(d) + y.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .attr("dominant-baseline", "middle")
        .style("opacity", animate ? 0 : 1)
        .text(d => d)
        .call(sel => animate ? sel.transition(T()).style("opacity", 1) : sel),
      update => {
        const target = animate ? update.transition(T()) : update;
        return target
          .style("opacity", 1)
          .attr("x", yearLabelX)
          .attr("y", d => y(d) + y.bandwidth() / 2);
      },
      exit => animate
        ? exit.transition(T()).style("opacity", 0).remove()
        : exit.remove()
    );

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
        .attr("rx", 6).attr("ry", 6)
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

    const verticalEdges = weekdayOrder.flatMap(day => {
      const start = x(day);
      return [start, start + x.bandwidth()];
    });
    verticalEdges.push(gridOriginX, gridOriginX + gridWidth);

    gridG.selectAll("line.grid-v")
      .data(Array.from(new Set(verticalEdges)).sort((a, b) => a - b))
      .join(
        enter => enter.append("line").attr("class", "grid-line grid-v"),
        update => update,
        exit => exit.remove()
      )
      .attr("x1", d => d)
      .attr("x2", d => d)
      .attr("y1", gridOriginY)
      .attr("y2", gridOriginY + gridHeight);

    const horizontalEdges = yearSubset.flatMap(year => {
      const top = y(year);
      return [top, top + y.bandwidth()];
    });
    horizontalEdges.push(gridOriginY, gridOriginY + gridHeight);

    gridG.selectAll("line.grid-h")
      .data(Array.from(new Set(horizontalEdges)).sort((a, b) => a - b))
      .join(
        enter => enter.append("line").attr("class", "grid-line grid-h"),
        update => update,
        exit => exit.remove()
      )
      .attr("x1", gridOriginX)
      .attr("x2", gridOriginX + gridWidth)
      .attr("y1", d => d)
      .attr("y2", d => d);
  }

  // Initial render (latest five years)
  const defaultYears = allYears.slice(-Math.min(5, allYears.length));
  const defaultStartYear = defaultYears[0];
  const defaultEndYear = defaultYears[defaultYears.length - 1];
  updateYears(defaultYears, false);

  // Year range controls / timeline
  const timelineContainer = rangeContainer.append("div").attr("class", "timeline-container");

  const rangeHeader = timelineContainer.append("div")
    .attr("class", "year-range-header");

  const rangeLabel = rangeHeader.append("div")
    .attr("class", "range-label-text")
    .text(`Years selected: ${defaultStartYear === defaultEndYear ? defaultEndYear : `${defaultStartYear}–${defaultEndYear}`}`);

  const controls = rangeHeader.append("div").attr("class", "year-range-controls");
  const selectAllBtn = controls.append("button").attr("type", "button").text("Check all years");
  const resetBtn = controls.append("button").attr("type", "button").text("Reset");

  const brushWidth = Math.max(800, gridWidth + 320);
  const brushHeight = 120;
  const sliderPadding = 100;

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
  brushSel.call(brush.move, yearsToSelection(defaultStartYear, defaultEndYear));

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
  }

  selectAllBtn.on("click", () => moveToRange(minYear, maxYear));
  resetBtn.on("click", () => moveToRange(defaultStartYear, defaultEndYear));

  // Legend remains same
  renderLegend(legendContainer, color, vmin, vmax, brushWidth + sliderPadding * 2);
  function renderLegend(containerSel, colorScale, vminLocal, vmaxLocal, desiredWidth) {
    containerSel.selectAll("*").remove();
    containerSel.append("div").attr("class", "title").text("Value scale");
    const legendWidth = desiredWidth || Math.min(600, (containerSel.node().clientWidth || 600));
    const legendHeight = 52;
    const marginL = { top: 8, right: 12, bottom: 24, left: 12 };
    const svgL = containerSel.append("svg").attr("viewBox", [0, 0, legendWidth, legendHeight].join(" "));
    const w = legendWidth - marginL.left - marginL.right;
    const gL = svgL.append("g").attr("transform", `translate(${marginL.left},${marginL.top})`);
    const xL = d3.scaleLinear().domain([vminLocal, vmaxLocal]).range([0, w]);
    const n = 256;
    const data = d3.range(n).map(i => d3.interpolateNumber(vminLocal, vmaxLocal)(i / (n - 1)));
    gL.selectAll("rect").data(data).join("rect")
      .attr("x", d => xL(d)).attr("y", 0).attr("width", w / n + 1).attr("height", 16)
      .attr("fill", d => colorScale(d));
    const axisLegend = d3.axisBottom(xL).ticks(5).tickSizeOuter(0);
    gL.append("g").attr("transform", "translate(0,18)").attr("class", "axis").call(axisLegend);
  }
})();
