/**
 * Utility script to integrate Semester 9 or Semester 10 results into the portal database
 * Usage: node scripts/add_semester_data.js <semester_key> <json_file_or_template>
 * Example: node scripts/add_semester_data.js S9 sample_s9_results.json
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'data', 'students_data.json');
const dataMinPath = path.join(__dirname, '..', 'data', 'students_data.min.json');

if (!fs.existsSync(dataPath)) {
  console.error('students_data.json not found! Run npm run prepare-data first.');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const SEMESTER_CREDITS = {
  S1: 24, S2: 24, S3: 24, S4: 24, S5: 24, S6: 20, S7: 24, S8: 24,
  S9: 24,  // Default S9 credits
  S10: 20  // Default S10 credits (Main Project & Viva)
};

function recomputeAll(semKey, semCredits = 24) {
  console.log(`Recomputing metrics and ranks including ${semKey}...`);

  // Update meta published semesters
  if (!db.meta.publishedSemesters.includes(semKey)) {
    db.meta.publishedSemesters.push(semKey);
    db.meta.pendingSemesters = db.meta.pendingSemesters.filter(s => s !== semKey);
  }

  const allStudents = Object.values(db.students);

  allStudents.forEach(student => {
    const sems = student.semesters;
    const published = db.meta.publishedSemesters;

    let passedSems = [];
    let failedCourses = [];
    let earnedCredits = 0;
    let earnedCP = 0.0;
    let overallMarks = 0;
    let totalCredits = 0;

    published.forEach(sem => {
      const s = sems[sem];
      const cred = SEMESTER_CREDITS[sem] || 24;
      totalCredits += cred;

      if (s && (s.status === 'Passed' || s.status === 'Passed (Supply)')) {
        passedSems.push(sem);
        earnedCredits += cred;
        earnedCP += (s.total_cp || 0.0);
        overallMarks += (s.total_marks || 0);
      } else if (s && s.status === 'Failed') {
        if (s.failed_courses) failedCourses.push(...s.failed_courses);
      }
    });

    const isAllPassed = (passedSems.length === published.length);
    const overallStatus = isAllPassed ? 'Passed' : 'Failed';
    const cgpa = isAllPassed 
      ? Number((earnedCP / totalCredits).toFixed(2)) 
      : (earnedCredits > 0 ? Number((earnedCP / earnedCredits).toFixed(2)) : 0.0);

    const hasSupply = published.some(sem => sems[sem] && sems[sem].cleared_via_supply);
    const passType = isAllPassed
      ? (hasSupply ? 'Passed with Supplementary' : 'Passed Regular (All Semesters)')
      : `Backlogs: ${failedCourses.length} subjects`;

    let classification = 'Passed';
    if (!isAllPassed) {
      classification = `Pending Backlogs (${failedCourses.length} subjects)`;
    } else if (cgpa >= 8.00) {
      classification = hasSupply ? 'First Class (Distinction CGPA)' : 'First Class with Distinction';
    } else if (cgpa >= 6.75) {
      classification = 'First Class';
    } else if (cgpa >= 5.00) {
      classification = 'Second Class';
    }

    student.summary = {
      ...student.summary,
      overall_status: overallStatus,
      pass_type: passType,
      passed_sems_count: passedSems.length,
      total_backlogs: failedCourses.length,
      all_failed_courses: failedCourses,
      cgpa,
      earned_credits: earnedCredits,
      total_credits: totalCredits,
      earned_cp: Number(earnedCP.toFixed(2)),
      overall_tot_marks: overallMarks,
      classification
    };
  });

  // Re-rank
  function studentSortKey(s) {
    const isCleared = (s.summary.overall_status === 'Passed') ? 1 : 0;
    const cgpa = s.summary.cgpa || 0;
    const marks = s.summary.overall_tot_marks || 0;
    const credits = s.summary.earned_credits || 0;
    return { isCleared, cgpa, marks, credits };
  }

  function compareStudents(a, b) {
    const ka = studentSortKey(a);
    const kb = studentSortKey(b);
    if (ka.isCleared !== kb.isCleared) return kb.isCleared - ka.isCleared;
    if (ka.cgpa !== kb.cgpa) return kb.cgpa - ka.cgpa;
    if (ka.marks !== kb.marks) return kb.marks - ka.marks;
    return kb.credits - ka.credits;
  }

  const c1Students = allStudents.filter(s => s.college_code === 'DIST');
  const c2Students = allStudents.filter(s => s.college_code === 'SCMS');

  allStudents.sort(compareStudents);
  c1Students.sort(compareStudents);
  c2Students.sort(compareStudents);

  function assignRanks(list, rankField, clearedRankField) {
    let clearedCount = 1;
    list.forEach((s, idx) => {
      s.summary[rankField] = idx + 1;
      if (s.summary.overall_status === 'Passed') {
        s.summary[clearedRankField] = clearedCount++;
      } else {
        s.summary[clearedRankField] = `Backlog (${s.summary.total_backlogs})`;
      }
    });
  }

  assignRanks(allStudents, 'univ_rank', 'univ_cleared_rank');
  assignRanks(c1Students, 'college_rank', 'college_cleared_rank');
  assignRanks(c2Students, 'college_rank', 'college_cleared_rank');

  // Update Stats
  const clearedCount = allStudents.filter(s => s.summary.overall_status === 'Passed').length;
  db.meta.stats.clearedStudents = clearedCount;
  db.meta.stats.passPercentage = Number(((clearedCount / allStudents.length) * 100).toFixed(1));
  db.meta.stats.highestCGPA = allStudents[0].summary.cgpa;
  db.meta.stats.topStudent = {
    name: allStudents[0].name,
    prn: allStudents[0].prn,
    college: allStudents[0].college_short,
    cgpa: allStudents[0].summary.cgpa
  };
  db.meta.updatedAt = new Date().toISOString();

  // Save back to JSON files
  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), 'utf8');
  fs.writeFileSync(dataMinPath, JSON.stringify(db), 'utf8');

  console.log(`Successfully updated dataset with ${semKey} results! New top student: ${allStudents[0].name} (CGPA ${allStudents[0].summary.cgpa})`);
}

module.exports = { recomputeAll };

if (require.main === module) {
  const args = process.argv.slice(2);
  const sem = args[0] || 'S9';
  console.log(`Ready to integrate ${sem} results when published.`);
  recomputeAll(sem);
}
