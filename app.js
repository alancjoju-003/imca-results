/**
 * IMCA Results & Ranks Portal - Application Logic
 * Mahatma Gandhi University - Batch 2022-2027
 */

(function () {
  'use strict';

  // Global State
  let appData = null;
  let currentStudent = null;
  let activeLeaderboardTab = 'univ';

  // DOM Elements
  const searchInput = document.getElementById('prn-input');
  const searchSuggestions = document.getElementById('search-suggestions');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorBanner = document.getElementById('error-banner');
  const errorTitle = document.getElementById('error-title');
  const errorMessage = document.getElementById('error-message');
  const resultsDashboard = document.getElementById('results-dashboard');

  // Load Data on Startup
  async function init() {
    showLoading(true);
    try {
      // Try minified data first, fallback to unminified
      let response = await fetch('data/students_data.min.json');
      if (!response.ok) {
        response = await fetch('data/students_data.json');
      }
      appData = await response.json();
      console.log('Loaded IMCA database:', Object.keys(appData.students).length, 'students');
    } catch (err) {
      console.warn('Failed to load JSON via fetch, attempting fallback:', err);
      // In case opened directly via file://, display notification
      showError('Data Loading Notice', 'If opening directly via file://, please run via local server (npm start or python -m http.server) to allow data fetching.');
    } finally {
      showLoading(false);
    }

    setupEventListeners();

    // Check URL parameters for direct link (e.g. ?prn=223242110032)
    const urlParams = new URLSearchParams(window.location.search);
    const prnFromUrl = urlParams.get('prn');
    if (prnFromUrl && appData && appData.students[prnFromUrl]) {
      loadPRN(prnFromUrl);
    } else {
      // Auto-focus search input
      if (searchInput) searchInput.focus();
    }
  }

  // Event Listeners Setup
  function setupEventListeners() {
    if (searchInput) {
      searchInput.addEventListener('input', onSearchInput);
      searchInput.addEventListener('keydown', onSearchKeyDown);
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
        searchSuggestions.style.display = 'none';
        searchInput.focus();
      });
    }

    // Modal buttons
    const btnLeaderboard = document.getElementById('btn-leaderboard');
    if (btnLeaderboard) {
      btnLeaderboard.addEventListener('click', openLeaderboard);
    }

    const btnBatchStats = document.getElementById('btn-batch-stats');
    if (btnBatchStats) {
      btnBatchStats.addEventListener('click', openBatchStats);
    }

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-input-wrapper') && !e.target.closest('.search-suggestions')) {
        if (searchSuggestions) searchSuggestions.style.display = 'none';
      }
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.prn) {
        loadPRN(e.state.prn, false);
      }
    });
  }

  // Handle Search Input & Auto-suggestions
  function onSearchInput(e) {
    const query = e.target.value.trim().toLowerCase();
    btnClearSearch.style.display = query.length > 0 ? 'block' : 'none';

    if (!appData || !query || query.length < 2) {
      searchSuggestions.style.display = 'none';
      return;
    }

    const matches = [];
    const students = Object.values(appData.students);

    for (const s of students) {
      const prnMatch = s.prn.toLowerCase().includes(query);
      const nameMatch = s.name.toLowerCase().includes(query);
      if (prnMatch || nameMatch) {
        matches.push(s);
        if (matches.length >= 8) break; // limit to 8 suggestions
      }
    }

    if (matches.length === 0) {
      searchSuggestions.style.display = 'none';
      return;
    }

    searchSuggestions.innerHTML = matches.map(s => `
      <div class="suggestion-item" onclick="window.loadPRN('${s.prn}')">
        <div>
          <div class="suggestion-name">${highlightMatch(s.name, query)}</div>
          <div class="suggestion-sub">${s.college_short}</div>
        </div>
        <span class="suggestion-prn">${highlightMatch(s.prn, query)}</span>
      </div>
    `).join('');

    searchSuggestions.style.display = 'block';
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return text.substring(0, idx) + '<strong>' + text.substring(idx, idx + query.length) + '</strong>' + text.substring(idx + query.length);
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchStudent();
    } else if (e.key === 'Escape') {
      searchSuggestions.style.display = 'none';
    }
  }

  // Execute Student Search
  window.searchStudent = function () {
    if (!appData) return;
    searchSuggestions.style.display = 'none';

    let rawVal = searchInput.value.trim();
    if (!rawVal) {
      showError('Please Enter Register Number', 'Please enter your Permanent Register Number (e.g. 223242110032).');
      return;
    }

    // Direct PRN match
    if (appData.students[rawVal]) {
      loadPRN(rawVal);
      return;
    }

    // Try finding by last 2-4 digits or name
    const matches = Object.values(appData.students).filter(s => 
      s.prn.endsWith(rawVal) || 
      s.name.toLowerCase().includes(rawVal.toLowerCase())
    );

    if (matches.length === 1) {
      loadPRN(matches[0].prn);
    } else if (matches.length > 1) {
      // Show suggestions
      onSearchInput({ target: { value: rawVal } });
    } else {
      showError(
        'Student Not Found', 
        `No record found for "${rawVal}". Please verify the register number (De Paul: 223242110001–50, SCMS: 223242110101–50).`
      );
    }
  };

  // Load and Render Student Details
  window.loadPRN = function (prn, pushState = true) {
    if (!appData || !appData.students[prn]) {
      showError('Record Not Found', `Registration Number ${prn} was not found in the database.`);
      return;
    }

    hideError();
    searchSuggestions.style.display = 'none';
    searchInput.value = prn;
    btnClearSearch.style.display = 'block';

    currentStudent = appData.students[prn];

    // Push URL state for shareable link
    if (pushState) {
      const newUrl = `${window.location.pathname}?prn=${prn}`;
      window.history.pushState({ prn }, '', newUrl);
    }

    renderStudentProfile(currentStudent);
    resultsDashboard.style.display = 'block';

    // Scroll smoothly to results
    resultsDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.loadRandomStudent = function () {
    if (!appData) return;
    const prns = Object.keys(appData.students);
    const randomPrn = prns[Math.floor(Math.random() * prns.length)];
    loadPRN(randomPrn);
  };

  // Dynamic Computation Engine for Student Metrics (Handles S1 to S10)
  function computeStudentMetrics(student) {
    const semCredits = appData.meta.semesterCredits || {
      S1: 24, S2: 24, S3: 24, S4: 24, S5: 24, S6: 20, S7: 24, S8: 24, S9: 24, S10: 20
    };

    const sems = student.semesters || {};
    const semKeys = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];

    let passedSems = [];
    let failedSems = [];
    let publishedSems = [];
    let allFailedCourses = [];
    let earnedCredits = 0;
    let earnedCP = 0.0;
    let overallMarks = 0;
    let totalPublishedCredits = 0;

    semKeys.forEach(sem => {
      const sData = sems[sem];
      if (sData && sData.appeared && sData.status !== 'Not Appeared / Not Published') {
        publishedSems.push(sem);
        const credit = semCredits[sem] || 24;
        totalPublishedCredits += credit;

        if (sData.status === 'Passed' || sData.status === 'Passed (Supply)') {
          passedSems.push(sem);
          earnedCredits += credit;
          earnedCP += (sData.total_cp || 0.0);
          overallMarks += (sData.total_marks || 0);
        } else if (sData.status === 'Failed') {
          failedSems.push(sem);
          if (sData.failed_courses && sData.failed_courses.length) {
            allFailedCourses.push(...sData.failed_courses);
          }
        }
      }
    });

    const isAllPublishedPassed = (publishedSems.length > 0 && passedSems.length === publishedSems.length);
    let overallStatus = isAllPublishedPassed ? 'Passed' : 'Failed';
    let cgpa = 0.0;

    if (isAllPublishedPassed) {
      cgpa = totalPublishedCredits > 0 ? Number((earnedCP / totalPublishedCredits).toFixed(2)) : 0.0;
    } else {
      cgpa = earnedCredits > 0 ? Number((earnedCP / earnedCredits).toFixed(2)) : 0.0;
    }

    let passType = '';
    if (isAllPublishedPassed) {
      const hasSupply = publishedSems.some(s => sems[s].cleared_via_supply);
      passType = hasSupply ? 'Passed with Supplementary' : 'Passed Regular (All Semesters)';
    } else {
      passType = `Backlogs: ${allFailedCourses.length} ${allFailedCourses.length === 1 ? 'subject' : 'subjects'}`;
    }

    // Academic Classification
    let classification = '';
    if (!isAllPublishedPassed) {
      classification = `Pending Backlogs (${allFailedCourses.length} ${allFailedCourses.length === 1 ? 'subject' : 'subjects'})`;
    } else {
      const hasSupply = (passType.includes('Supplementary'));
      if (cgpa >= 8.00) {
        classification = hasSupply ? 'First Class (Distinction CGPA)' : 'First Class with Distinction';
      } else if (cgpa >= 6.75) {
        classification = 'First Class';
      } else if (cgpa >= 5.00) {
        classification = 'Second Class';
      } else {
        classification = 'Passed';
      }
    }

    return {
      publishedSems,
      passedSems,
      failedSems,
      allFailedCourses,
      earnedCredits,
      totalPublishedCredits,
      earnedCP: Number(earnedCP.toFixed(2)),
      overallMarks,
      cgpa,
      overallStatus,
      passType,
      classification
    };
  }

  // Render Student Profile to DOM
  function renderStudentProfile(student) {
    const computed = computeStudentMetrics(student);
    const summary = student.summary || {};

    // Avatar & Identity
    const initials = student.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('');
    document.getElementById('avatar-initials').textContent = initials;
    document.getElementById('avatar-rank-badge').textContent = `#${summary.univ_rank || '--'}`;

    document.getElementById('student-name').textContent = student.name;
    document.getElementById('student-prn').textContent = student.prn;
    document.getElementById('student-exam-centre').textContent = student.college || student.college_short;

    const tagCollege = document.getElementById('tag-college');
    tagCollege.textContent = student.college_short || (student.college_group === 'College 1' ? 'De Paul Institute (DIST)' : 'SCMS School of Technology');

    // Status Badges
    const overallBadge = document.getElementById('overall-status-badge');
    const classBadge = document.getElementById('classification-badge');

    if (computed.overallStatus === 'Passed') {
      if (computed.passType.includes('Supplementary')) {
        overallBadge.className = 'badge-status-lg badge-status-supply';
        overallBadge.textContent = 'Passed (Supplementary)';
      } else {
        overallBadge.className = 'badge-status-lg badge-status-passed';
        overallBadge.textContent = 'Passed (Regular)';
      }
    } else {
      overallBadge.className = 'badge-status-lg badge-status-failed';
      overallBadge.textContent = `Pending Backlogs (${computed.allFailedCourses.length})`;
    }

    classBadge.textContent = computed.classification;

    // KPI 1: CGPA
    const cgpaVal = computed.cgpa.toFixed(2);
    document.getElementById('kpi-cgpa').textContent = cgpaVal;
    const cgpaPct = Math.min(100, Math.max(0, (computed.cgpa / 10.0) * 100));
    document.getElementById('cgpa-bar-fill').style.width = `${cgpaPct}%`;
    document.getElementById('kpi-cgpa-note').textContent = `Computed from ${computed.publishedSems.length} published semesters (${computed.publishedSems[0]}–${computed.publishedSems[computed.publishedSems.length - 1]})`;

    // KPI 2: University Rank
    document.getElementById('kpi-univ-rank').textContent = `#${summary.univ_rank || '--'}`;
    document.getElementById('kpi-univ-cleared').textContent = `Cleared Rank: #${summary.univ_cleared_rank || '--'}`;

    // KPI 3: College Rank
    const collegeTitle = student.college_code === 'DIST' ? 'De Paul (DIST) Rank' : 'SCMS Rank';
    document.getElementById('kpi-college-title').textContent = collegeTitle;
    document.getElementById('kpi-college-rank').textContent = `#${summary.college_rank || '--'}`;
    document.getElementById('kpi-college-cleared').textContent = `College Cleared: #${summary.college_cleared_rank || '--'}`;
    const collegeTotal = student.college_code === 'DIST' ? appData.meta.stats.college1.total : appData.meta.stats.college2.total;
    document.getElementById('kpi-college-context').textContent = `Rank among ${collegeTotal} candidates in ${student.college_code}`;

    // KPI 4: Total Marks & CP
    document.getElementById('kpi-tot-marks').textContent = computed.overallMarks.toLocaleString();
    document.getElementById('kpi-tot-cp').textContent = `${computed.earnedCP.toFixed(2)} Total Credit Points`;

    // KPI 5: Programme Credits
    const totalProgCredits = computed.totalPublishedCredits || 188;
    document.getElementById('kpi-credits').textContent = `${computed.earnedCredits} / ${totalProgCredits}`;
    const creditPct = Math.round((computed.earnedCredits / totalProgCredits) * 100);
    document.getElementById('kpi-credits-pct').textContent = `${creditPct}% Degree Requirements`;
    document.getElementById('kpi-credits-context').textContent = `${computed.publishedSems.length} semesters cleared • S9 & S10 pending`;

    // KPI 6: Backlogs
    const iconBacklog = document.getElementById('icon-backlog');
    const valBacklog = document.getElementById('kpi-backlogs-count');
    const descBacklog = document.getElementById('kpi-backlogs-desc');
    const passTypeDesc = document.getElementById('kpi-pass-type');

    if (computed.allFailedCourses.length === 0) {
      iconBacklog.textContent = '✅';
      valBacklog.textContent = '0';
      valBacklog.style.color = '#34d399';
      descBacklog.textContent = 'All subjects successfully cleared';
      passTypeDesc.textContent = computed.passType;
    } else {
      iconBacklog.textContent = '⚠️';
      valBacklog.textContent = computed.allFailedCourses.length;
      valBacklog.style.color = '#f87171';
      descBacklog.textContent = `Backlogs in: ${computed.allFailedCourses.join(', ')}`;
      passTypeDesc.textContent = 'Supplementary needed';
    }

    // Render SGPA Progression Chart
    renderSGPAChart(student, computed);

    // Initialize Simulator Values with Current Student CGPA
    initSimulator(computed);

    // Render Semesters S1 to S10 Grid
    renderSemestersGrid(student);
  }

  // Render Interactive SGPA Progression SVG Chart
  function renderSGPAChart(student, computed) {
    const container = document.getElementById('chart-container');
    const sems = student.semesters || {};
    const semKeys = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

    // Collect SGPAs
    const points = [];
    semKeys.forEach((sem, idx) => {
      const s = sems[sem];
      if (s && s.sgpa !== null && s.sgpa !== undefined) {
        points.push({ sem, sgpa: s.sgpa, idx, status: s.status });
      }
    });

    if (points.length === 0) {
      container.innerHTML = '<p style="text-align:center; padding: 40px; color: #64748b;">No semester SGPA data available to plot.</p>';
      return;
    }

    const width = 1000;
    const height = 220;
    const padX = 60;
    const padY = 30;

    const minSGPA = 4.0;
    const maxSGPA = 10.0;

    const getX = (idx) => padX + (idx / (semKeys.length - 1)) * (width - 2 * padX);
    const getY = (val) => height - padY - ((val - minSGPA) / (maxSGPA - minSGPA)) * (height - 2 * padY);

    // Grid lines for SGPA 5, 6, 7, 8, 9, 10
    let gridLinesSvg = '';
    for (let g = 5; g <= 10; g += 1) {
      const y = getY(g);
      gridLinesSvg += `
        <line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4,4" />
        <text x="${padX - 12}" y="${y + 4}" fill="#64748b" font-size="11" text-anchor="end" font-family="JetBrains Mono">${g.toFixed(1)}</text>
      `;
    }

    // Semester Labels along X axis
    let semLabelsSvg = '';
    semKeys.forEach((sem, idx) => {
      const x = getX(idx);
      semLabelsSvg += `
        <text x="${x}" y="${height - 8}" fill="#94a3b8" font-size="12" font-weight="600" text-anchor="middle" font-family="Outfit">${sem}</text>
      `;
    });

    // Path coordinates
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.idx)} ${getY(p.sgpa)}`).join(' ');
    const areaD = `${pathD} L ${getX(points[points.length - 1].idx)} ${height - padY} L ${getX(points[0].idx)} ${height - padY} Z`;

    // Data dots
    let dotsSvg = '';
    points.forEach(p => {
      const x = getX(p.idx);
      const y = getY(p.sgpa);
      const isPass = p.status.includes('Passed');
      const dotColor = isPass ? '#6366f1' : '#ef4444';
      dotsSvg += `
        <g class="chart-point" data-sem="${p.sem}" data-sgpa="${p.sgpa}">
          <circle cx="${x}" cy="${y}" r="6" fill="${dotColor}" stroke="#fff" stroke-width="2.5" />
          <circle cx="${x}" cy="${y}" r="14" fill="${dotColor}" opacity="0.2" />
          <text x="${x}" y="${y - 12}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle" font-family="JetBrains Mono">${p.sgpa.toFixed(2)}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLinesSvg}
        ${semLabelsSvg}
        <path d="${areaD}" fill="url(#chartGradient)" />
        <path d="${pathD}" fill="none" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        ${dotsSvg}
      </svg>
    `;
  }

  // Render All Semesters Grid (S1 to S10)
  function renderSemestersGrid(student) {
    const grid = document.getElementById('semesters-grid');
    const sems = student.semesters || {};
    const semKeys = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
    const semCredits = appData.meta.semesterCredits || {
      S1: 24, S2: 24, S3: 24, S4: 24, S5: 24, S6: 20, S7: 24, S8: 24, S9: 24, S10: 20
    };
    const semNames = appData.meta.semesterNames || {
      S1: 'Semester I', S2: 'Semester II', S3: 'Semester III', S4: 'Semester IV',
      S5: 'Semester V', S6: 'Semester VI', S7: 'Semester VII', S8: 'Semester VIII',
      S9: 'Semester IX', S10: 'Semester X'
    };

    let html = '';

    semKeys.forEach(sem => {
      const s = sems[sem];
      const credit = semCredits[sem] || 24;
      const title = semNames[sem] || sem;

      // Case 1: Result is published and available
      if (s && s.appeared && s.courses && Object.keys(s.courses).length > 0) {
        const isPassed = s.status === 'Passed';
        const isSupply = s.status === 'Passed (Supply)' || s.cleared_via_supply;
        const isFailed = s.status === 'Failed';

        let badgeClass = 'passed';
        let pillClass = 'pass';
        let statusText = 'Passed (Regular)';

        if (isSupply) {
          badgeClass = 'supply';
          pillClass = 'supply';
          statusText = 'Passed (Supply)';
        } else if (isFailed) {
          badgeClass = 'failed';
          pillClass = 'fail';
          statusText = `Failed (${s.failed_courses ? s.failed_courses.length : 0} Backlog)`;
        }

        const sgpaDisplay = (s.sgpa !== null && s.sgpa !== undefined) ? Number(s.sgpa).toFixed(2) : '--';
        const marksDisplay = (s.total_marks !== null && s.total_marks !== undefined) ? s.total_marks : '--';
        const cpDisplay = (s.total_cp !== null && s.total_cp !== undefined) ? Number(s.total_cp).toFixed(2) : '--';

        // Courses Table
        const coursesList = Object.values(s.courses);
        const coursesRows = coursesList.map(c => {
          const gradeClass = getGradeClass(c.grade);
          return `
            <tr>
              <td class="course-code">${c.code}</td>
              <td class="course-title">${c.title}</td>
              <td>${c.esa || '--'} <span class="text-dim">/ ${c.esa_max || '--'}</span></td>
              <td>${c.isa || '--'} <span class="text-dim">/ ${c.isa_max || '--'}</span></td>
              <td><strong>${c.total || '--'}</strong> <span class="text-dim">/ ${c.total_max || '--'}</span></td>
              <td>${c.gp || '--'}</td>
              <td>${c.cp || '--'}</td>
              <td><span class="grade-badge ${gradeClass}">${c.grade || '--'}</span></td>
              <td><span class="status-pill ${c.result === 'Passed' ? 'pass' : 'fail'}">${c.result || '--'}</span></td>
              <td><span class="clearance-tag">${c.cleared_in || 'Regular'}</span></td>
            </tr>
          `;
        }).join('');

        html += `
          <div class="sem-card" id="sem-card-${sem}">
            <div class="sem-card-header" onclick="window.toggleSemester('${sem}')">
              <div class="sem-header-left">
                <div class="sem-badge ${badgeClass}">${sem}</div>
                <div class="sem-title-box">
                  <h4>${title}</h4>
                  <span class="sem-credits-tag">${credit} Credits • ${s.attempts_count || 1} Attempt${(s.attempts_count || 1) > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div class="sem-header-right">
                <div class="sem-metrics-preview">
                  <div class="sem-metric-item">
                    <span class="sem-metric-lbl">Marks</span>
                    <span class="sem-metric-val">${marksDisplay}</span>
                  </div>
                  <div class="sem-metric-item">
                    <span class="sem-metric-lbl">Credit Points</span>
                    <span class="sem-metric-val">${cpDisplay}</span>
                  </div>
                  <div class="sem-metric-item">
                    <span class="sem-metric-lbl">SGPA</span>
                    <span class="sem-metric-val highlight-mono">${sgpaDisplay}</span>
                  </div>
                  <span class="status-pill ${pillClass}">${statusText}</span>
                </div>
                <div class="sem-toggle-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
            <div class="sem-details">
              <div class="course-table-wrapper">
                <table class="course-table">
                  <thead>
                    <tr>
                      <th>Course Code</th>
                      <th>Course Title</th>
                      <th>ESA</th>
                      <th>ISA</th>
                      <th>Total</th>
                      <th>GP</th>
                      <th>CP</th>
                      <th>Grade</th>
                      <th>Result</th>
                      <th>Attempt</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${coursesRows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      } 
      // Case 2: Semester 9 or 10 (or unpublished semester)
      else {
        html += `
          <div class="sem-card sem-upcoming" id="sem-card-${sem}">
            <div class="sem-card-header" onclick="window.toggleSemester('${sem}')">
              <div class="sem-header-left">
                <div class="sem-badge upcoming">${sem}</div>
                <div class="sem-title-box">
                  <h4>${title}</h4>
                  <span class="sem-credits-tag">${credit} Syllabus Credits • Dynamic Engine Ready</span>
                </div>
              </div>
              <div class="sem-header-right">
                <span class="status-pill upcoming">Pending Publication</span>
                <div class="sem-toggle-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
            <div class="sem-details">
              <div class="sem-upcoming-box">
                <div class="upcoming-icon">⏳</div>
                <div class="upcoming-title">${title} Results Awaited</div>
                <p class="upcoming-desc">
                  Examination results for ${title} are not yet published by MG University. 
                  Our dynamic computation engine will automatically calculate SGPA (${credit} credits), 
                  credit points, and integrate with your overall CGPA and university ranks the moment results are out.
                </p>
              </div>
            </div>
          </div>
        `;
      }
    });

    grid.innerHTML = html;
  }

  function getGradeClass(grade) {
    if (!grade) return '';
    const g = grade.toUpperCase();
    if (g.includes('A+')) return 'grade-a-plus';
    if (g.includes('A')) return 'grade-a';
    if (g.includes('B+')) return 'grade-b-plus';
    if (g.includes('B')) return 'grade-b';
    if (g.includes('C')) return 'grade-c';
    if (g.includes('D')) return 'grade-d';
    if (g.includes('E')) return 'grade-e';
    if (g.includes('F')) return 'grade-f';
    return '';
  }

  // Toggle Semester Expansion
  window.toggleSemester = function (sem) {
    const card = document.getElementById(`sem-card-${sem}`);
    if (card) {
      card.classList.toggle('expanded');
    }
  };

  window.expandAllSemesters = function (expand) {
    const cards = document.querySelectorAll('.sem-card');
    cards.forEach(c => {
      if (expand) c.classList.add('expanded');
      else c.classList.remove('expanded');
    });
  };

  // S9 & S10 Target Simulator
  function initSimulator(computed) {
    const currCgpa = document.getElementById('sim-curr-cgpa');
    if (currCgpa) {
      currCgpa.textContent = computed.cgpa.toFixed(2);
    }
    updateSimCalculation();
  }

  window.toggleSimulator = function () {
    const card = document.getElementById('simulator-card');
    const isHidden = (card.style.display === 'none' || !card.style.display);
    card.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  window.syncSimFromInput = function (sem) {
    const numInput = document.getElementById(`sim-${sem}-val`);
    const slider = document.getElementById(`sim-${sem}-slider`);
    slider.value = numInput.value;
    updateSimCalculation();
  };

  window.updateSimCalculation = function () {
    if (!currentStudent) return;

    const s9Slider = document.getElementById('sim-s9-slider');
    const s9Val = document.getElementById('sim-s9-val');
    const s10Slider = document.getElementById('sim-s10-slider');
    const s10Val = document.getElementById('sim-s10-val');

    s9Val.value = s9Slider.value;
    s10Val.value = s10Slider.value;

    const s9Sgpa = parseFloat(s9Slider.value) || 0;
    const s10Sgpa = parseFloat(s10Slider.value) || 0;

    const s9Credits = 24;
    const s10Credits = 20;

    const s9CP = s9Sgpa * s9Credits;
    const s10CP = s10Sgpa * s10Credits;

    const computed = computeStudentMetrics(currentStudent);
    const existingEarnedCP = computed.earnedCP;
    const existingCredits = computed.earnedCredits;

    const totalProjectedCredits = existingCredits + s9Credits + s10Credits;
    const totalProjectedCP = existingEarnedCP + s9CP + s10CP;

    const projectedCGPA = Number((totalProjectedCP / totalProjectedCredits).toFixed(2));

    document.getElementById('sim-projected-cgpa').textContent = projectedCGPA.toFixed(2);

    let projClass = 'Passed';
    const hasSupply = computed.passType.includes('Supplementary');
    if (projectedCGPA >= 8.00) {
      projClass = hasSupply ? 'First Class (Distinction CGPA)' : 'First Class with Distinction';
    } else if (projectedCGPA >= 6.75) {
      projClass = 'First Class';
    } else if (projectedCGPA >= 5.00) {
      projClass = 'Second Class';
    }
    document.getElementById('sim-projected-class').textContent = projClass;
  };

  // Leaderboard Modal
  function openLeaderboard() {
    if (!appData) return;
    renderLeaderboardContent(activeLeaderboardTab);
    document.getElementById('leaderboard-modal').style.display = 'flex';
  }

  window.switchLeaderboardTab = function (tab) {
    activeLeaderboardTab = tab;
    document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-btn-${tab}`).classList.add('active');
    renderLeaderboardContent(tab);
  };

  function renderLeaderboardContent(tab) {
    const body = document.getElementById('leaderboard-body');
    const students = Object.values(appData.students);

    let filtered = [];
    if (tab === 'univ') {
      filtered = students.filter(s => s.summary.univ_rank <= 10).sort((a, b) => a.summary.univ_rank - b.summary.univ_rank);
    } else if (tab === 'c1') {
      filtered = students.filter(s => s.college_code === 'DIST' && s.summary.college_rank <= 10).sort((a, b) => a.summary.college_rank - b.summary.college_rank);
    } else if (tab === 'c2') {
      filtered = students.filter(s => s.college_code === 'SCMS' && s.summary.college_rank <= 10).sort((a, b) => a.summary.college_rank - b.summary.college_rank);
    }

    const rows = filtered.map((s, idx) => {
      const rank = tab === 'univ' ? s.summary.univ_rank : s.summary.college_rank;
      const rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
      return `
        <tr>
          <td><span class="leader-rank-badge ${rankClass}">#${rank}</span></td>
          <td>
            <a class="leader-name" onclick="window.loadPRN('${s.prn}'); window.closeModal('leaderboard-modal');">${s.name}</a>
            <div style="font-size: 11px; color: #64748b;">${s.college_short} • PRN: ${s.prn}</div>
          </td>
          <td class="leader-cgpa">${s.summary.cgpa.toFixed(2)}</td>
          <td>${s.summary.overall_tot_marks}</td>
          <td><span class="status-pill pass">${s.summary.pass_type.includes('Supplementary') ? 'Passed (Supply)' : 'Passed (Regular)'}</span></td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <table class="leader-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Candidate</th>
            <th>CGPA</th>
            <th>Total Marks</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  // Batch Overview Analytics Modal
  function openBatchStats() {
    if (!appData) return;
    const stats = appData.meta.stats;
    const body = document.getElementById('batch-stats-body');

    body.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="sim-res-card highlight-glow">
          <span class="sim-res-lbl">Overall Batch Pass Rate</span>
          <span class="sim-res-val text-gold">${stats.passPercentage}%</span>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${stats.clearedStudents} / ${stats.totalStudents} Cleared All S1-S8</div>
        </div>
        <div class="sim-res-card">
          <span class="sim-res-lbl">Top University CGPA</span>
          <span class="sim-res-val text-cyan">${stats.highestCGPA.toFixed(2)}</span>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${stats.topStudent ? stats.topStudent.name : ''}</div>
        </div>
        <div class="sim-res-card">
          <span class="sim-res-lbl">First Class with Distinction</span>
          <span class="sim-res-val">${stats.totalDistinctions}</span>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">CGPA ≥ 8.00 (No Supplies)</div>
        </div>
        <div class="sim-res-card">
          <span class="sim-res-lbl">First Class</span>
          <span class="sim-res-val">${stats.totalFirstClass}</span>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">CGPA 6.75 to 7.99</div>
        </div>
      </div>

      <h4 style="font-family: var(--font-heading); color: #fff; margin-bottom: 12px; font-size: 16px;">College-wise Performance Comparison</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="sim-res-card" style="text-align: left;">
          <h5 style="color: #38bdf8; font-size: 14px; margin-bottom: 8px;">De Paul Institute (DIST)</h5>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Total Students: <strong>${stats.college1.total}</strong></p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Cleared (S1-S8): <strong>${stats.college1.cleared} (${stats.college1.passPercentage}%)</strong></p>
          <p style="font-size: 12px; color: #94a3b8;">Top Candidate: <strong>${stats.college1.topStudent ? stats.college1.topStudent.name : ''} (${stats.college1.topStudent ? stats.college1.topStudent.cgpa : ''})</strong></p>
        </div>
        <div class="sim-res-card" style="text-align: left;">
          <h5 style="color: #c084fc; font-size: 14px; margin-bottom: 8px;">SCMS School of Technology</h5>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Total Students: <strong>${stats.college2.total}</strong></p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">Cleared (S1-S8): <strong>${stats.college2.cleared} (${stats.college2.passPercentage}%)</strong></p>
          <p style="font-size: 12px; color: #94a3b8;">Top Candidate: <strong>${stats.college2.topStudent ? stats.college2.topStudent.name : ''} (${stats.college2.topStudent ? stats.college2.topStudent.cgpa : ''})</strong></p>
        </div>
      </div>
    `;

    document.getElementById('batch-stats-modal').style.display = 'flex';
  }

  window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
  };

  // Share Profile Link
  window.shareCurrentProfile = function () {
    if (!currentStudent) return;
    const url = `${window.location.origin}${window.location.pathname}?prn=${currentStudent.prn}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard! Anyone with this link can view this result directly.');
      });
    } else {
      showToast(`Share URL: ${url}`);
    }
  };

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 4000);
  }

  // Error Banner Utilities
  function showError(title, message) {
    if (errorBanner) {
      errorTitle.textContent = title;
      errorMessage.textContent = message;
      errorBanner.style.display = 'flex';
      errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideError() {
    if (errorBanner) errorBanner.style.display = 'none';
  }

  function showLoading(show) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }
  }

  // Initialize Application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
