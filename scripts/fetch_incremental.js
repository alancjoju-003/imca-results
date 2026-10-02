const https = require('https');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'raw_cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

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

// College 1: 51 to 65
const prnsC1 = [];
for (let i = 51; i <= 65; i++) {
  prnsC1.push('2232421100' + (i < 10 ? '0' + i : i));
}

// College 2: 51 to 66
const prnsC2 = [];
for (let i = 51; i <= 66; i++) {
  prnsC2.push('2232421101' + (i < 10 ? '0' + i : i));
}

const ALL_NEW_PRNS = [...prnsC1, ...prnsC2];

function fetchSingle(prn, examId) {
  const cacheFile = path.join(CACHE_DIR, `${prn}_${examId}.html`);
  if (fs.existsSync(cacheFile)) {
    return Promise.resolve({ prn, examId, cached: true });
  }

  const postData = `cs_id=421&exam_id=${examId}&prn=${prn}&btnresult=Submit`;
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'pareeksha.mgu.ac.in',
      path: '/Pareeksha/index.php/Public/PareekshaResultView_ctrl/index/3/421',
      method: 'POST',
      rejectUnauthorized: false,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        fs.writeFileSync(cacheFile, body, 'utf8');
        resolve({ prn, examId, cached: false, hit: body.includes('Permanent Register Number') });
      });
    });

    req.on('error', () => {
      resolve({ prn, examId, error: true });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ prn, examId, timeout: true });
    });
    req.write(postData);
    req.end();
  });
}

async function run() {
  const tasks = [];
  for (const prn of ALL_NEW_PRNS) {
    for (const [eid] of EXAMS) {
      tasks.push({ prn, eid });
    }
  }

  console.log(`Starting fetch of ${tasks.length} tasks across ${ALL_NEW_PRNS.length} new PRNs...`);
  const CONCURRENCY = 15;
  let index = 0;
  let completed = 0;
  let hits = 0;

  async function worker() {
    while (index < tasks.length) {
      const cur = tasks[index++];
      const res = await fetchSingle(cur.prn, cur.eid);
      completed++;
      if (res.hit) hits++;
      if (completed % 50 === 0 || completed === tasks.length) {
        console.log(`Progress: ${completed}/${tasks.length} completed. Valid exam results found: ${hits}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  console.log(`✅ All fetches completed! Total valid exam records cached: ${hits}`);
}

run();
