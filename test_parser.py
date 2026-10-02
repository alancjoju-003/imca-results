import os
import re
from bs4 import BeautifulSoup
import json

CACHE_DIR = 'raw_cache'

# The 20 exams in chronological order
EXAMS = [
    ('273', 'First Semester IMCA Examination September  2023', 'S1', 'Regular'),
    ('334', 'Second Semester IMCA Examination January  2024', 'S2', 'Regular'),
    ('356', 'First Semester IMCA Examination March 2024', 'S1', 'Supply'),
    ('364', 'Third Semester IMCA Examination April 2024', 'S3', 'Regular'),
    ('434', 'Second Semester IMCA Examination October 2024', 'S2', 'Supply'),
    ('467', 'First Semester IMCA Examination November 2024', 'S1', 'Supply'),
    ('476', 'Third Semester IMCA Examination December 2024', 'S3', 'Supply'),
    ('485', 'Fourth Semester IMCA Examination January 2025', 'S4', 'Regular'),
    ('523', 'Fifth Semester IMCA Examination April 2025', 'S5', 'Regular'),
    ('533', 'Second Semester IMCA Examination April 2025', 'S2', 'Supply'),
    ('550', 'Fourth Semester IMCA Examination May 2025', 'S4', 'Supply'),
    ('580', 'Sixth Semester IMCA Examination September 2025', 'S6', 'Regular'),
    ('602', 'Third Semester IMCA Examination October 2025', 'S3', 'Supply'),
    ('610', 'Fifth Semester IMCA Examination October 2025', 'S5', 'Supply'),
    ('627', 'First Semester IMCA Examination November 2025', 'S1', 'Supply'),
    ('646', 'Seventh Semester IMCA Examination December 2025', 'S7', 'Regular'),
    ('681', 'Fourth Semester IMCA Examination April 2026', 'S4', 'Supply'),
    ('707', 'Sixth Semester IMCA Examination April 2026', 'S6', 'Supply'),
    ('710', 'Second Semester IMCA Examination April 2026', 'S2', 'Supply'),
    ('732', 'Eighth Semester IMCA Examination June 2026', 'S8', 'Regular'),
]

PRNS_COLLEGE_1 = [f'2232421100{i:02d}' for i in range(1, 51)]
PRNS_COLLEGE_2 = [f'2232421101{i:02d}' for i in range(1, 51)]
ALL_PRNS = PRNS_COLLEGE_1 + PRNS_COLLEGE_2

def parse_html(html):
    if 'Permanent Register Number' not in html:
        return None
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Extract student info
    info = {}
    for tr in soup.find_all('tr'):
        tds = [td.get_text(separator=' ', strip=True) for td in tr.find_all(['td', 'th'])]
        if len(tds) >= 3 and tds[1] == ':':
            label = tds[0].replace(':', '').strip()
            val = tds[2].strip()
            if 'Permanent Register Number' in label:
                info['prn'] = val
            elif 'Name of Student' in label:
                info['name'] = val
            elif 'Semester' in label:
                info['semester'] = val
            elif 'Programme' in label:
                info['programme'] = val
            elif 'Exam Centre' in label:
                info['exam_centre'] = val
    
    # Extract courses table
    courses = []
    sem_result = {}
    
    # Find the table that contains Course Code
    course_table = None
    for t in soup.find_all('table'):
        if 'Course Code' in t.text:
            course_table = t
            break
            
    if course_table:
        rows = course_table.find_all('tr')
        for r in rows:
            cells = [c.get_text(separator=' ', strip=True) for c in r.find_all(['td', 'th'])]
            if not cells or len(cells) < 4:
                continue
            
            # Check for SEMESTER RESULT row
            if 'SEMESTER RESULT' in cells[0]:
                # Format: ['SEMESTER RESULT', 'SCPA / SGPA:   6.08', '416', '700', '---', '146.00', '', 'Passed']
                sgpa_str = ''
                for c in cells:
                    m = re.search(r'SCPA\s*/\s*SGPA:\s*([\d\.]+)', c)
                    if m:
                        sgpa_str = m.group(1)
                
                tot_marks = ''
                max_marks = ''
                tot_cp = ''
                res_status = ''
                
                for idx, c in enumerate(cells):
                    if c in ['Passed', 'Failed']:
                        res_status = c
                    if c == '700' or c == '500':
                        max_marks = c
                        if idx > 0 and cells[idx-1].isdigit():
                            tot_marks = cells[idx-1]
                    if re.match(r'^\d+\.\d{2}$', c) and not max_marks == c:
                        tot_cp = c
                
                sem_result = {
                    'sgpa_str': sgpa_str,
                    'total_marks': tot_marks,
                    'max_marks': max_marks,
                    'total_cp': tot_cp,
                    'result': res_status
                }
                continue
                
            # Header rows to skip
            if 'Course Code' in cells[0] or 'ESA' in cells[0] or 'NOTE' in cells[0]:
                continue
                
            # Normal course row
            # Format: [Code, Title, ESA, MAX, ISA, MAX, Total, MAX, GP, CP, Grade, Result]
            # e.g.: ['IMCA1C01', 'English', '44', '75', '20', '25', '64', '100', '7', '28.00', 'C', 'Passed']
            if len(cells) >= 10:
                c_code = cells[0].strip()
                c_title = cells[1].strip()
                esa = cells[2].strip()
                esa_max = cells[3].strip()
                isa = cells[4].strip()
                isa_max = cells[5].strip()
                total = cells[6].strip()
                total_max = cells[7].strip()
                gp = cells[8].strip()
                cp = cells[9].strip()
                grade = cells[10].strip() if len(cells) > 10 else ''
                res = cells[11].strip() if len(cells) > 11 else cells[-1].strip()
                
                courses.append({
                    'code': c_code,
                    'title': c_title,
                    'esa': esa,
                    'esa_max': esa_max,
                    'isa': isa,
                    'isa_max': isa_max,
                    'total': total,
                    'total_max': total_max,
                    'gp': gp,
                    'cp': cp,
                    'grade': grade,
                    'result': res
                })
    
    return {
        'info': info,
        'courses': courses,
        'sem_result': sem_result
    }

def test():
    # Let's inspect parsing for PRN 223242110001
    print("Testing parser on 223242110001...")
    for eid, ename, sem, etype in EXAMS:
        cf = os.path.join(CACHE_DIR, f'223242110001_{eid}.html')
        if os.path.exists(cf):
            with open(cf, 'r', encoding='utf-8') as f:
                parsed = parse_html(f.read())
            if parsed and parsed['courses']:
                print(f"Exam {eid} ({ename}) -> {len(parsed['courses'])} courses | SemResult: {parsed['sem_result']}")
                for c in parsed['courses'][:2]:
                    print("  ", c)

if __name__ == '__main__':
    test()
