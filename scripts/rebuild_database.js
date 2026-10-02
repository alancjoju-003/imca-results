const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'raw_cache');

const EXAMS = [
  ['273', 'First Semester IMCA Examination September  2023', 'S1', 'Regular'],
  ['334', 'Second Semester IMCA Examination January  2024', 'S2', 'Regular'],
  ['356', 'First Semester IMCA Examination March 2024', 'S1', 'Supply'],
  ['364', 'Third Semester IMCA Examination April 2024', 'S3', 'Regular'],
  ['434', 'Second Semester IMCA Examination October 2024', 'S2', 'Supply'],
  ['467', 'First Semester IMCA Examination November 2024', 'S1', 'Supply'],
  ['476', 'Third Semester IMCA Examination December 2024', 'S3', 'Supply'],
  ['485', 'Fourth Semester IMCA Examination January 2025', 'S4', 'Regular'],
  ['523', 'Fifth Semester IMCA Examination April 2025', 'S5', 'Regular'],
  ['533', 'Second Semester IMCA Examination April 2025', 'S2', 'Supply'],
  ['550', 'Fourth Semester IMCA Examination May 2025', 'S4', 'Supply'],
  ['580', 'Sixth Semester IMCA Examination September 2025', 'S6', 'Regular'],
  ['602', 'Third Semester IMCA Examination October 2025', 'S3', 'Supply'],
  ['610', 'Fifth Semester IMCA Examination October 2025', 'S5', 'Supply'],
  ['627', 'First Semester IMCA Examination November 2025', 'S1', 'Supply'],
  ['646', 'Seventh Semester IMCA Examination December 2025', 'S7', 'Regular'],
  ['681', 'Fourth Semester IMCA Examination April 2026', 'S4', 'Supply'],
  ['707', 'Sixth Semester IMCA Examination April 2026', 'S6', 'Supply'],
  ['710', 'Second Semester IMCA Examination April 2026', 'S2', 'Supply'],
  ['732', 'Eighth Semester IMCA Examination June 2026', 'S8', 'Regular'],
];

const SEMESTER_CREDITS = {
  S1: 24, S2: 24, S3: 24, S4: 24, S5: 24, S6: 20, S7: 24, S8: 24
};
const SEMESTER_ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

// College 1: 01 to 65
const PRNS_COLLEGE_1 = Array.from({ length: 65 }, (_, i) => '2232421100' + String(i + 1).padStart(2, '0'));
// College 2: 01 to 66
const PRNS_COLLEGE_2 = Array.from({ length: 66 }, (_, i) => '2232421101' + String(i + 1).padStart(2, '0'));
const ALL_PRNS = [...PRNS_COLLEGE_1, ...PRNS_COLLEGE_2];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseHtmlTable(html) {
  if (!html.includes('Permanent Register Number')) return null;

  const info = {};
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const tds = (tr.match(/<(td|th)[\s\S]*?<\/(td|th)>/gi) || []).map(td => stripHtml(td));
    if (tds.length >= 3 && tds[1] === ':') {
      const label = tds[0].replace(':', '').trim();
      const val = tds[2].trim();
      if (label.includes('Permanent Register Number')) info.prn = val;
      else if (label.includes('Name of Student') || label.includes('Name of Candidate')) info.name = val;
      else if (label.includes('Semester')) info.semester = val;
      else if (label.includes('Programme')) info.programme = val;
      else if (label.includes('Exam Centre')) info.exam_centre = val;
    }
  }

  const courses = [];
  let semResult = {};

  for (const tr of trMatches) {
    const cells = (tr.match(/<(td|th)[\s\S]*?<\/(td|th)>/gi) || []).map(c => stripHtml(c));
    if (!cells || cells.length === 0) continue;

    if (cells[0].includes('SEMESTER RESULT')) {
      let sgpa = null;
      const m = cells[1] ? cells[1].match(/SCPA\s*\/\s*SGPA:\s*([\d\.]+)/i) : null;
      if (m) sgpa = parseFloat(m[1]);
      let totMarks = null;
      if (cells.length > 2 && /^\d+$/.test(cells[2])) totMarks = parseInt(cells[2], 10);
      let totCp = null;
      if (cells.length > 5 && !isNaN(parseFloat(cells[5]))) totCp = parseFloat(cells[5]);
      const res = cells.length > 7 ? cells[cells.length - 1] : '';
      semResult = { sgpa, total_marks: totMarks, total_cp: totCp, result: res };
      continue;
    }

    if (['Course Code', 'ESA', 'NOTE:'].includes(cells[0]) || cells[0].includes('NOTE:')) continue;

    if (cells.length >= 10) {
      const cCode = cells[0].trim();
      const cTitle = cells[1].trim();
      const esa = cells[2].trim();
      const esaMax = cells[3].trim();
      const isa = cells[4].trim();
      const isaMax = cells[5].trim();
      const total = cells[6].trim();
      const totalMax = cells[7].trim();
      const gp = cells[8].trim();
      const cp = cells[9].trim();
      const grade = cells.length > 10 ? cells[10].trim() : '';
      const res = cells.length > 11 ? cells[11].trim() : cells[cells.length - 1].trim();

      const totalNum = isNaN(parseFloat(total)) ? null : parseFloat(total);
      const gpNum = isNaN(parseFloat(gp)) ? null : parseFloat(gp);
      const cpNum = isNaN(parseFloat(cp)) ? null : parseFloat(cp);

      courses.push({
        code: cCode,
        title: cTitle,
        esa,
        esa_max: esaMax,
        isa,
        isa_max: isaMax,
        total,
        total_num: totalNum,
        total_max: totalMax,
        gp,
        gp_num: gpNum,
        cp,
        cp_num: cpNum,
        grade,
        result: res
      });
    }
  }

  return { info, courses, sem_result: semResult };
}

function runRebuild() {
  console.log(`Processing ${ALL_PRNS.length} PRNs (College 1: 1-65, College 2: 1-66)...`);
  const students = {};

  for (const prn of ALL_PRNS) {
    let studentInfo = null;
    const semAttempts = {};
    for (const sem of SEMESTER_ORDER) semAttempts[sem] = [];

    for (const [eid, ename, sem, etype] of EXAMS) {
      const cf = path.join(CACHE_DIR, `${prn}_${eid}.html`);
      if (fs.existsSync(cf)) {
        const html = fs.readFileSync(cf, 'utf8');
        const parsed = parseHtmlTable(html);
        if (parsed && parsed.courses && parsed.courses.length > 0) {
          if (!studentInfo && parsed.info && parsed.info.name) {
            studentInfo = parsed.info;
          }
          semAttempts[sem].push({
            exam_id: eid,
            exam_name: ename,
            type: etype,
            courses: parsed.courses,
            sem_result: parsed.sem_result
          });
        }
      }
    }

    if (!studentInfo) continue;

    const college = studentInfo.exam_centre || '';
    const isC1 = college.includes('De Paul') || prn.startsWith('2232421100');
    const collegeShort = isC1 ? 'De Paul Institute, Angamaly' : 'SCMS School of Technology, Aluva';
    const collegeGroup = isC1 ? 'College 1' : 'College 2';

    const studentData = {
      prn,
      name: studentInfo.name || '',
      college,
      college_short: collegeShort,
      college_group: collegeGroup,
      semesters: {}
    };

    for (const sem of SEMESTER_ORDER) {
      const attempts = semAttempts[sem] || [];
      if (attempts.length === 0) {
        studentData.semesters[sem] = {
          status: 'Not Appeared / Not Published',
          appeared: false,
          regular_result: null,
          courses: {},
          sgpa: null,
          total_marks: null,
          total_cp: null,
          cleared_via_supply: false,
          failed_courses: []
        };
        continue;
      }

      const regularAttempt = attempts[0];
      const coursesDict = {};
      for (const c of regularAttempt.courses) {
        coursesDict[c.code] = { ...c, cleared_in: regularAttempt.type };
      }

      const regularPassed = regularAttempt.sem_result && regularAttempt.sem_result.result === 'Passed';
      const regularSgpa = regularAttempt.sem_result ? regularAttempt.sem_result.sgpa : null;
      const regularTotMarks = regularAttempt.sem_result ? regularAttempt.sem_result.total_marks : null;
      const regularTotCp = regularAttempt.sem_result ? regularAttempt.sem_result.total_cp : null;

      let clearedViaSupply = false;
      for (const att of attempts.slice(1)) {
        for (const sc of att.courses) {
          const code = sc.code;
          if (coursesDict[code]) {
            const oldRes = coursesDict[code].result;
            if (oldRes !== 'Passed' && sc.result === 'Passed') {
              coursesDict[code] = { ...sc, cleared_in: `Supply (${att.exam_name})` };
              clearedViaSupply = true;
            } else if (sc.result === 'Passed' && (sc.total_num || 0) > (coursesDict[code].total_num || 0)) {
              coursesDict[code] = { ...sc, cleared_in: `Supply Improvement (${att.exam_name})` };
            }
          } else {
            coursesDict[code] = { ...sc, cleared_in: `Supply (${att.exam_name})` };
            if (sc.result === 'Passed') clearedViaSupply = true;
          }
        }
      }

      const failedCourses = Object.values(coursesDict).filter(c => c.result !== 'Passed').map(c => c.code);

      const semCred = SEMESTER_CREDITS[sem] || 24;
      let calcMarks = 0;
      let calcCp = 0.0;
      let allMarksPresent = true;

      for (const c of Object.values(coursesDict)) {
        if (c.total_num !== null) calcMarks += c.total_num;
        else allMarksPresent = false;
        if (c.cp_num !== null) calcCp += c.cp_num;
      }

      let finalStatus, finalSgpa, finalTotMarks, finalTotCp;
      if (failedCourses.length === 0) {
        if (regularPassed && !clearedViaSupply) {
          finalStatus = 'Passed';
          finalSgpa = regularSgpa !== null ? regularSgpa : Math.round((calcCp / semCred) * 100) / 100;
          finalTotMarks = regularTotMarks !== null ? regularTotMarks : Math.round(calcMarks);
          finalTotCp = regularTotCp !== null ? regularTotCp : Math.round(calcCp * 100) / 100;
        } else {
          finalStatus = 'Passed (Supply)';
          finalSgpa = Math.round((calcCp / semCred) * 100) / 100;
          finalTotMarks = Math.round(calcMarks);
          finalTotCp = Math.round(calcCp * 100) / 100;
        }
      } else {
        finalStatus = 'Failed';
        finalSgpa = null;
        finalTotMarks = allMarksPresent ? Math.round(calcMarks) : null;
        finalTotCp = Math.round(calcCp * 100) / 100;
      }

      studentData.semesters[sem] = {
        status: finalStatus,
        appeared: true,
        regular_passed: regularPassed,
        regular_sgpa: regularSgpa,
        regular_tot_marks: regularTotMarks,
        cleared_via_supply: clearedViaSupply,
        attempts_count: attempts.length,
        courses: coursesDict,
        sgpa: finalSgpa,
        total_marks: finalTotMarks,
        total_cp: finalTotCp,
        failed_courses: failedCourses
      };
    }

    const passedSems = SEMESTER_ORDER.filter(s => ['Passed', 'Passed (Supply)'].includes(studentData.semesters[s].status));
    const failedSems = SEMESTER_ORDER.filter(s => studentData.semesters[s].status === 'Failed');
    const allFailedCourses = [];
    for (const s of SEMESTER_ORDER) {
      if (studentData.semesters[s].failed_courses) {
        allFailedCourses.push(...studentData.semesters[s].failed_courses);
      }
    }

    const totProgCredits = 188;
    const earnedCredits = passedSems.reduce((sum, s) => sum + SEMESTER_CREDITS[s], 0);
    const earnedCp = passedSems.reduce((sum, s) => sum + (studentData.semesters[s].total_cp || 0.0), 0.0);
    const overallTotMarks = passedSems.reduce((sum, s) => sum + (studentData.semesters[s].total_marks || 0), 0);

    let overallStatus, passType, cgpa;
    if (passedSems.length === SEMESTER_ORDER.length) {
      overallStatus = 'Passed';
      cgpa = Math.round((earnedCp / totProgCredits) * 100) / 100;
      if (SEMESTER_ORDER.some(s => studentData.semesters[s].cleared_via_supply)) {
        passType = 'Passed with Supplementary';
      } else {
        passType = 'Passed Regular (All Semesters)';
      }
    } else {
      overallStatus = 'Failed';
      passType = `Backlogs: ${allFailedCourses.length} subjects`;
      cgpa = earnedCredits > 0 ? Math.round((earnedCp / earnedCredits) * 100) / 100 : 0.0;
    }

    studentData.summary = {
      overall_status: overallStatus,
      pass_type: passType,
      passed_sems_count: passedSems.length,
      failed_sems_count: failedSems.length,
      total_backlogs: allFailedCourses.length,
      all_failed_courses: allFailedCourses,
      cgpa,
      earned_credits: earnedCredits,
      total_credits: totProgCredits,
      earned_cp: Math.round(earnedCp * 100) / 100,
      overall_tot_marks: overallTotMarks
    };

    students[prn] = studentData;
  }

  const parsedOut = path.join(__dirname, '..', 'parsed_students_data.json');
  fs.writeFileSync(parsedOut, JSON.stringify(students, null, 2), 'utf8');

  const c1Count = Object.values(students).filter(s => s.college_group === 'College 1').length;
  const c2Count = Object.values(students).filter(s => s.college_group === 'College 2').length;
  console.log(`✅ Success! Total students parsed: ${Object.keys(students).length}`);
  console.log(`   De Paul (College 1): ${c1Count} students`);
  console.log(`   SCMS (College 2):    ${c2Count} students`);
}

runRebuild();
