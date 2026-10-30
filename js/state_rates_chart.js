/* ==========================================================================
   js/state_rates_chart.js  (Graph 3)
   Multi-line chart of hospitalisations per 100,000 people, by state, 2011-2021.
   The highest state (vermillion) and a user-chosen comparison state (green)
   are emphasised; the other states are grey context lines.
   Dashed lines mark the Victoria (2012) and NSW (2017) counting changes.
   ========================================================================== */

const STATE_MIN_WIDTH = 900;
const STATE_YEARS = [2011, 2021];
const STATE_BREAKS = [
  { year: 2012, label: "Vic counting change" },
  { year: 2017, label: "NSW counting change" }
];
let stateCompareChoice = "NSW"; // survives resize redraws

/**
 * Renders Graph 3.
 * @param {Array<Object>} data - rows with year, state, cases, population, rate.
 */
function renderStateRatesChart(data) {
  const container = d3.select("#state-chart-container");
  const containerNode = container.node();
  if (!containerNode) return;
  if (!data || data.length === 0) {
    container.html("<p>No state data available.</p>");
    return;
  }

  // ---- 1. Dimensions ----
  containerNode.style.overflowX = "auto";
  const svgWidth = Math.max(containerNode.getBoundingClientRect().width || 900, STATE_MIN_WIDTH);
  const margin = { top: 70, right: 150, bottom: 90, left: 110 };
  const width = svgWidth - margin.left - margin.right;
  const height = 560 - margin.top - margin.bottom;
  container.html("");

  // ---- 2. Data structure and the dropdown ----
  const nested = d3.group(data, d => d.state);
  const states = Array.from(nested.keys()).sort();
  const latest = d => nested.get(d).find(r => r.year === STATE_YEARS[1]);
  const highestState = states.reduce((a, b) => (latest(b).rate > latest(a).rate ? b : a));

  const select = d3.select("#state-compare-select");
  if (!select.empty() && select.selectAll("option").size() === 0) {
    select.selectAll("option").data(states).join("option").attr("value", d => d).text(d => d);
    select.on("change", (event) => { stateCompareChoice = event.target.value; renderStateRatesChart(window.stateRatesData); });
  }
  if (!states.includes(stateCompareChoice)) stateCompareChoice = states[0];
  if (!select.empty()) select.property("value", stateCompareChoice);

  // Colour rule: highest = vermillion, chosen state = green, others = grey context
  function stateColour(s) {
    if (s === highestState) return PALETTE.VERMILLION;
    if (s === stateCompareChoice) return PALETTE.GREEN;
    return PALETTE.GREY_CONTEXT;
  }
  const isHighlighted = s => s === highestState || s === stateCompareChoice;

  // ---- 3. Scales and axes (y starts at zero) ----
  const x = d3.scaleLinear().domain(STATE_YEARS).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.rate)]).nice().range([height, 0]);

  const svgParent = container.append("svg")
    .attr("width", svgWidth).attr("height", height + margin.top + margin.bottom)
    .attr("tabindex", 0)
    .attr("aria-label", "Line chart of hospitalisations per 100,000 people by state. Use Left and Right arrow keys to move between years.")
    .style("overflow", "visible");
  const svg = svgParent.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  svg.append("g").attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(11).tickFormat(d3.format("d")).tickPadding(12).tickSizeOuter(0)).attr("font-size", "1rem");
  svg.append("g").call(d3.axisLeft(y).ticks(6).tickPadding(10).tickSizeOuter(0)).attr("font-size", "1rem");
  svg.append("text").attr("x", width / 2).attr("y", height + 60).attr("text-anchor", "middle")
    .style("font-size", "1.15rem").style("font-weight", 700).style("fill", PALETTE.GREY_CONTEXT).text("Calendar Year");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -margin.left + 35).attr("text-anchor", "middle")
    .style("font-size", "1.15rem").style("font-weight", 700).style("fill", PALETTE.GREY_CONTEXT).text("Hospitalisations per 100,000 people");

  // ---- 4. Series-break annotations ----
  STATE_BREAKS.forEach(b => {
    svg.append("line").attr("x1", x(b.year)).attr("x2", x(b.year)).attr("y1", -10).attr("y2", height)
      .attr("stroke", PALETTE.PURPLE).attr("stroke-dasharray", "2,4").attr("stroke-width", 1.5);
    svg.append("text").attr("x", x(b.year)).attr("y", -16).attr("text-anchor", "middle")
      .style("font-size", "0.85rem").style("font-weight", 600).style("fill", PALETTE.PURPLE).text(b.label);
  });

  // ---- 5. Lines: grey context first, highlighted states drawn on top ----
  const line = d3.line().x(d => x(d.year)).y(d => y(d.rate));
  const drawOrder = [...states].sort((a, b) => Number(isHighlighted(a)) - Number(isHighlighted(b)));
  drawOrder.forEach(s => {
    svg.append("path").datum(nested.get(s)).attr("fill", "none")
      .attr("stroke", stateColour(s)).attr("stroke-width", isHighlighted(s) ? 4 : 2).attr("d", line);
  });

  // ---- 6. Direct end labels with simple anti-collision ----
  const labels = states.map(s => ({ state: s, y: y(latest(s).rate), value: latest(s).rate })).sort((a, b) => a.y - b.y);
  const gap = 20;
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < gap) labels[i].y = labels[i - 1].y + gap;
  labels.forEach(l => {
    svg.append("text").attr("x", width + 10).attr("y", l.y).attr("dy", "0.35em")
      .style("font-size", "0.95rem").style("font-weight", isHighlighted(l.state) ? 800 : 500)
      .style("fill", isHighlighted(l.state) ? stateColour(l.state) : "#2A2730")
      .text(`${l.state} ${d3.format(".0f")(l.value)}`);
  });

  // ---- 7. Tooltip, crosshair, mouse and keyboard ----
  d3.selectAll(".state-tooltip").remove();
  const tooltip = d3.select("body").append("div").attr("class", "chart-tooltip state-tooltip")
    .attr("aria-live", "polite").style("opacity", 0);
  const crosshair = svg.append("line").attr("y1", 0).attr("y2", height).attr("stroke", "#C3B1E0")
    .attr("stroke-dasharray", "4,4").style("opacity", 0);

  function drawTooltip(year, left, top) {
    crosshair.style("opacity", 1).attr("x1", x(year)).attr("x2", x(year));
    const rowsAtYear = states.map(s => ({ s, d: nested.get(s).find(r => r.year === year) }))
      .filter(r => r.d).sort((a, b) => b.d.rate - a.d.rate);
    let html = `<div style="font-size:1.1rem; font-weight:700; border-bottom:1.5px solid #C3B1E0; padding-bottom:6px; margin-bottom:8px;">Year: ${year}</div>`;
    rowsAtYear.forEach(r => {
      html += `<div style="font-weight:${isHighlighted(r.s) ? 800 : 400};"><span style="color:${stateColour(r.s)}">●</span> ${r.s}: <strong>${d3.format(".1f")(r.d.rate)}</strong> per 100k (${d3.format(",")(r.d.cases)} cases)</div>`;
    });
    tooltip.html(html).style("left", left + "px").style("top", top + "px").style("opacity", 1);
  }
  const hideAll = () => { crosshair.style("opacity", 0); tooltip.style("opacity", 0); };
  const clampYear = v => Math.max(STATE_YEARS[0], Math.min(STATE_YEARS[1], Math.round(v)));

  svg.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
    .on("mousemove", (event) => drawTooltip(clampYear(x.invert(d3.pointer(event)[0])), event.pageX + 20, event.pageY - 20))
    .on("mouseout", hideAll);

  let keyYear = STATE_YEARS[1];
  svgParent.on("keydown", (event) => {
    if (event.key === "ArrowRight") keyYear = clampYear(keyYear + 1);
    else if (event.key === "ArrowLeft") keyYear = clampYear(keyYear - 1);
    else if (event.key === "Escape") { hideAll(); return; }
    else return;
    event.preventDefault();
    const r = containerNode.getBoundingClientRect();
    drawTooltip(keyYear, r.left + window.scrollX + margin.left + x(keyYear) + 20, r.top + window.scrollY + margin.top);
  });
  svgParent.on("blur", hideAll);
}