const fs = require('fs');
const path = require('path');

const parsedPath = path.join(__dirname, '..', 'parsed_students_data.json');
if (!fs.existsSync(parsedPath)) {
  console.error('parsed_students_data.json not found!');
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));

const PRNS_COLLEGE_1 = Array.from({ length: 50 }, (_, i) => '2232421100' + String(i + 1).padStart(2, '0'));
const PRNS_COLLEGE_2 = Array.from({ length: 50 }, (_, i) => '2232421101' + String(i + 1).padStart(2, '0'));

const SEMESTER_CREDITS = {
  S1: 24,
  S2: 24,
  S3: 24,
  S4: 24,
  S5: 24,
  S6: 20,
  S7: 24,
  S8: 24,
  S9: 24, // configured for when S9 results arrive
  S10: 20 // configured for when S10 results arrive
};

const SEMESTER_NAMES = {
  S1: 'Semester I',
  S2: 'Semester II',
  S3: 'Semester III',
  S4: 'Semester IV',
  S5: 'Semester V',
  S6: 'Semester VI',
  S7: 'Semester VII',
  S8: 'Semester VIII',
  S9: 'Semester IX',
  S10: 'Semester X'
};

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

function getClassification(s) {
  const sum = s.summary;
  if (sum.overall_status !== 'Passed') {
    return `Pending Backlogs (${sum.total_backlogs} ${sum.total_backlogs === 1 ? 'subject' : 'subjects'})`;
  }
  const cgpa = sum.cgpa;
  const hasSupply = (sum.pass_type || '').includes('Supplementary');
  if (cgpa >= 8.00) {
    return hasSupply ? 'First Class (Distinction CGPA)' : 'First Class with Distinction';
  } else if (cgpa >= 6.75) {
    return 'First Class';
  } else if (cgpa >= 5.00) {
    return 'Second Class';
  }
  return 'Passed';
}

const allStudents = Object.values(rawData);
const c1Students = PRNS_COLLEGE_1.filter(p => rawData[p]).map(p => rawData[p]);
const c2Students = PRNS_COLLEGE_2.filter(p => rawData[p]).map(p => rawData[p]);

// Sort
allStudents.sort(compareStudents);
c1Students.sort(compareStudents);
c2Students.sort(compareStudents);

// Assign Ranks
function assignRanks(list, rankField, clearedRankField) {
  let clearedCount = 1;
  list.forEach((s, idx) => {
    s.summary[rankField] = idx + 1;
    if (s.summary.overall_status === 'Passed') {
      s.summary[clearedRankField] = clearedCount;
      clearedCount++;
    } else {
      s.summary[clearedRankField] = `Backlog (${s.summary.total_backlogs})`;
    }
  });
}

assignRanks(allStudents, 'univ_rank', 'univ_cleared_rank');
assignRanks(c1Students, 'college_rank', 'college_cleared_rank');
assignRanks(c2Students, 'college_rank', 'college_cleared_rank');

// Add classification and ensure college info
allStudents.forEach(s => {
  s.summary.classification = getClassification(s);
  if (!s.college_short) {
    if (s.college && s.college.includes('De Paul')) {
      s.college_short = 'De Paul Institute, Angamaly';
      s.college_code = 'DIST';
    } else {
      s.college_short = 'SCMS School of Technology, Aluva';
      s.college_code = 'SCMS';
    }
  } else {
    s.college_code = s.college_short.includes('De Paul') ? 'DIST' : 'SCMS';
  }
});

// Calculate Overall Statistics
const totalStudents = allStudents.length;
const clearedStudents = allStudents.filter(s => s.summary.overall_status === 'Passed').length;
const totalDistinctions = allStudents.filter(s => s.summary.overall_status === 'Passed' && s.summary.cgpa >= 8.0).length;
const totalFirstClass = allStudents.filter(s => s.summary.overall_status === 'Passed' && s.summary.cgpa >= 6.75 && s.summary.cgpa < 8.0).length;

const c1Cleared = c1Students.filter(s => s.summary.overall_status === 'Passed').length;
const c2Cleared = c2Students.filter(s => s.summary.overall_status === 'Passed').length;

const highestCGPA = allStudents[0] ? allStudents[0].summary.cgpa : 0;
const topStudent = allStudents[0] ? {
  name: allStudents[0].name,
  prn: allStudents[0].prn,
  college: allStudents[0].college_short,
  cgpa: allStudents[0].summary.cgpa
} : null;

// Re-map into key-value map keyed by PRN for O(1) lookup
const studentsMap = {};
allStudents.forEach(s => {
  studentsMap[s.prn] = s;
});

const outputData = {
  meta: {
    programme: 'Integrated Master of Computer Applications (IMCA)',
    batch: '2022 - 2027',
    university: 'Mahatma Gandhi University, Kottayam, Kerala',
    publishedSemesters: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'],
    pendingSemesters: ['S9', 'S10'],
    semesterCredits: SEMESTER_CREDITS,
    semesterNames: SEMESTER_NAMES,
    stats: {
      totalStudents,
      clearedStudents,
      passPercentage: Number(((clearedStudents / totalStudents) * 100).toFixed(1)),
      totalDistinctions,
      totalFirstClass,
      highestCGPA,
      topStudent,
      college1: {
        name: 'De Paul Institute of Science & Technology, Angamaly',
        code: 'DIST',
        total: c1Students.length,
        cleared: c1Cleared,
        passPercentage: Number(((c1Cleared / c1Students.length) * 100).toFixed(1)),
        topStudent: c1Students[0] ? { name: c1Students[0].name, prn: c1Students[0].prn, cgpa: c1Students[0].summary.cgpa } : null
      },
      college2: {
        name: 'SCMS School of Technology and Management, Aluva',
        code: 'SCMS',
        total: c2Students.length,
        cleared: c2Cleared,
        passPercentage: Number(((c2Cleared / c2Students.length) * 100).toFixed(1)),
        topStudent: c2Students[0] ? { name: c2Students[0].name, prn: c2Students[0].prn, cgpa: c2Students[0].summary.cgpa } : null
      }
    },
    updatedAt: new Date().toISOString()
  },
  students: studentsMap
};

const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'students_data.json');
fs.writeFileSync(outPath, JSON.stringify(outputData, null, 2), 'utf8');

const outMinPath = path.join(outDir, 'students_data.min.json');
fs.writeFileSync(outMinPath, JSON.stringify(outputData), 'utf8');

console.log(`Successfully generated:`);
console.log(`- ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`- ${outMinPath} (${(fs.statSync(outMinPath).size / 1024 / 1024).toFixed(2)} MB)`);

