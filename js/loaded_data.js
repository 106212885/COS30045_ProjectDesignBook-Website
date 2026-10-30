/* ==========================================================================
  Loads the CSV, formats the data, and handles responsive redrawing.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {


  // ==========================================
  // 1. G1: National Trends Chart
  // ==========================================
  d3.csv("data/(G1) national_by_year_roaduser_group.csv").then(data => {
    
    // 1. Data Cleaning: Convert strings to numbers
    data.forEach(d => {
      d.year = parseInt(d["Calendar year"], 10);
      d.hospitalisations = parseInt(d.hospitalisations, 10);
    });

    // 2. State Storage: Save globally so the resize event can reuse it
    window.roadSafetyData = data;

    // Initial chart render
    if (typeof renderNationalTrendsChart === "function") {
      renderNationalTrendsChart(window.roadSafetyData);
    }

  }).catch(error => console.error("Error loading G1 dataset:", error));


  // ==========================================
  // 2. G2: Injury Severity Chart
  // ==========================================
  d3.csv("data/(G2) national_roaduser_severity.csv").then(data => {
    
    // 1. Data Cleaning: Map column names and convert strings to numbers
    data.forEach(d => {
      d.roadUser = d["Road user"];
      d.group = d.road_user_group;
      d.hospitalisations = parseInt(d.hospitalisations, 10);
      d.bedDaysPerCase = parseFloat(d.bed_days_per_case);
      d.diedCases = parseInt(d.died_cases, 10);
      d.diedPct = parseFloat(d.died_pct);
    });

    // 2. State Storage: Save globally for resize
    window.severityData = data;

    // Initial chart render
    if (typeof renderSeverityChart === "function") {
      renderSeverityChart(window.severityData);
    }

  }).catch(error => console.error("Error loading G2 dataset:", error));


  // ==========================================
  // 3. G3: State Rates Chart
  // ==========================================
  d3.csv("data/(G3) state_by_year_rate.csv").then(data => {
    
    // 1. Data Cleaning: Map column names and convert strings to numbers
    data.forEach(d => {
      d.year = parseInt(d.Year, 10);
      d.state = d.state;
      d.cases = parseInt(d.cases, 10);
      d.population = parseInt(d.population, 10);
      d.rate = parseFloat(d.rate_per_100k);
    });

    // 2. State Storage: Save globally for resize
    window.stateRatesData = data;

    // Initial chart render
    if (typeof renderStateRatesChart === "function") {
      renderStateRatesChart(window.stateRatesData);
    }

  }).catch(error => console.error("Error loading G3 dataset:", error));


  // ==========================================
  // 4. Responsive Resize: Debounced listener to redraw all charts
  // ==========================================
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.roadSafetyData && typeof renderNationalTrendsChart === "function") {
        renderNationalTrendsChart(window.roadSafetyData);
      }
      if (window.severityData && typeof renderSeverityChart === "function") {
        renderSeverityChart(window.severityData);
      }
      if (window.stateRatesData && typeof renderStateRatesChart === "function") {
        renderStateRatesChart(window.stateRatesData);
      }
    }, 200);
  });

});