import os
import re
from bs4 import BeautifulSoup
import json
from collections import defaultdict

CACHE_DIR = 'raw_cache'

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

SEMESTER_CREDITS = {
    'S1': 24,
    'S2': 24,
    'S3': 24,
    'S4': 24,
    'S5': 24,
    'S6': 20,
    'S7': 24,
    'S8': 24
}

SEMESTER_ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']

PRNS_COLLEGE_1 = [f'2232421100{i:02d}' for i in range(1, 51)]
PRNS_COLLEGE_2 = [f'2232421101{i:02d}' for i in range(1, 51)]
ALL_PRNS = PRNS_COLLEGE_1 + PRNS_COLLEGE_2

def parse_html_table(html):
    if 'Permanent Register Number' not in html:
        return None
    
    soup = BeautifulSoup(html, 'html.parser')
    
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
                
    course_table = None
    for t in soup.find_all('table'):
        first_td = t.find('td')
        if first_td and first_td.get_text(strip=True) == 'Course Code':
            course_table = t
            break
            
    courses = []
    sem_result = {}
    
    if course_table:
        for tr in course_table.find_all('tr'):
            cells = [c.get_text(separator=' ', strip=True) for c in tr.find_all(['td', 'th'])]
            if not cells:
                continue
            if 'SEMESTER RESULT' in cells[0]:
                # ['SEMESTER RESULT', 'SCPA / SGPA:   6.08', '416', '700', '---', '146.00', '', 'Passed']
                sgpa = None
                m = re.search(r'SCPA\s*/\s*SGPA:\s*([\d\.]+)', cells[1])
                if m:
                    try:
                        sgpa = float(m.group(1))
                    except:
                        pass
                tot_marks = None
                if len(cells) > 2 and cells[2].isdigit():
                    tot_marks = int(cells[2])
                tot_cp = None
                if len(cells) > 5:
                    try:
                        tot_cp = float(cells[5])
                    except:
                        pass
                res = cells[-1] if len(cells) > 7 else ''
                sem_result = {
                    'sgpa': sgpa,
                    'total_marks': tot_marks,
                    'total_cp': tot_cp,
                    'result': res
                }
                continue
                
            if cells[0] in ['Course Code', 'ESA', 'NOTE:'] or 'NOTE:' in cells[0]:
                continue
                
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
                
                # convert numeric where possible
                total_num = None
                try:
                    total_num = float(total)
                except:
                    pass
                gp_num = None
                try:
                    gp_num = float(gp)
                except:
                    pass
                cp_num = None
                try:
                    cp_num = float(cp)
                except:
                    pass
                
                courses.append({
                    'code': c_code,
                    'title': c_title,
                    'esa': esa,
                    'esa_max': esa_max,
                    'isa': isa,
                    'isa_max': isa_max,
                    'total': total,
                    'total_num': total_num,
                    'total_max': total_max,
                    'gp': gp,
                    'gp_num': gp_num,
                    'cp': cp,
                    'cp_num': cp_num,
                    'grade': grade,
                    'result': res
                })
                
    return {
        'info': info,
        'courses': courses,
        'sem_result': sem_result
    }

def analyze_all():
    students = {}
    
    for prn in ALL_PRNS:
        # Check student in all exams
        student_info = None
        # results per semester: sem -> list of attempts in chronological order
        sem_attempts = defaultdict(list)
        
        for eid, ename, sem, etype in EXAMS:
            cf = os.path.join(CACHE_DIR, f'{prn}_{eid}.html')
            if os.path.exists(cf):
                with open(cf, 'r', encoding='utf-8') as f:
                    parsed = parse_html_table(f.read())
                if parsed and parsed['courses']:
                    if not student_info and parsed['info']:
                        student_info = parsed['info']
                    sem_attempts[sem].append({
                        'exam_id': eid,
                        'exam_name': ename,
                        'type': etype,
                        'courses': parsed['courses'],
                        'sem_result': parsed['sem_result']
                    })
                    
        if not student_info:
            continue
            
        college = student_info.get('exam_centre', '')
        if 'De Paul' in college or prn in PRNS_COLLEGE_1:
            college_short = 'De Paul Institute, Angamaly'
            college_group = 'College 1'
        else:
            college_short = 'SCMS School of Technology, Aluva'
            college_group = 'College 2'
            
        student_data = {
            'prn': prn,
            'name': student_info.get('name', ''),
            'college': college,
            'college_short': college_short,
            'college_group': college_group,
            'semesters': {}
        }
        
        # Now process each semester S1 to S8
        for sem in SEMESTER_ORDER:
            attempts = sem_attempts.get(sem, [])
            if not attempts:
                student_data['semesters'][sem] = {
                    'status': 'Not Appeared / Not Published',
                    'appeared': False,
                    'regular_result': None,
                    'courses': {},
                    'sgpa': None,
                    'total_marks': None,
                    'total_cp': None,
                    'cleared_via_supply': False,
                    'failed_courses': []
                }
                continue
                
            # First attempt is regular (or first chronologically)
            regular_attempt = attempts[0]
            # Build initial course dict from first attempt
            courses_dict = {}
            for c in regular_attempt['courses']:
                courses_dict[c['code']] = dict(c)
                courses_dict[c['code']]['cleared_in'] = regular_attempt['type']
                
            regular_passed = (regular_attempt['sem_result'].get('result') == 'Passed')
            regular_sgpa = regular_attempt['sem_result'].get('sgpa')
            regular_tot_marks = regular_attempt['sem_result'].get('total_marks')
            regular_tot_cp = regular_attempt['sem_result'].get('total_cp')
            
            # Now process subsequent attempts (supplies)
            cleared_via_supply = False
            for att in attempts[1:]:
                for sc in att['courses']:
                    code = sc['code']
                    # If this course was failed or not passed, and now passed in supply:
                    if code in courses_dict:
                        old_res = courses_dict[code].get('result')
                        if old_res != 'Passed' and sc.get('result') == 'Passed':
                            # replace with passed details
                            courses_dict[code] = dict(sc)
                            courses_dict[code]['cleared_in'] = f"Supply ({att['exam_name']})"
                            cleared_via_supply = True
                        elif sc.get('result') == 'Passed' and sc.get('total_num', 0) > courses_dict[code].get('total_num', 0):
                            courses_dict[code] = dict(sc)
                            courses_dict[code]['cleared_in'] = f"Supply Improvement ({att['exam_name']})"
                    else:
                        # course wasn't in regular (rare), add it
                        courses_dict[code] = dict(sc)
                        courses_dict[code]['cleared_in'] = f"Supply ({att['exam_name']})"
                        if sc.get('result') == 'Passed':
                            cleared_via_supply = True
                            
            # Check current final status of semester
            failed_courses = [c['code'] for c in courses_dict.values() if c.get('result') != 'Passed']
            
            # Calculate updated total marks, total cp, and sgpa
            sem_cred = SEMESTER_CREDITS.get(sem, 24)
            calc_marks = 0
            calc_cp = 0.0
            all_marks_present = True
            
            for c in courses_dict.values():
                if c.get('total_num') is not None:
                    calc_marks += c['total_num']
                else:
                    all_marks_present = False
                if c.get('cp_num') is not None:
                    calc_cp += c['cp_num']
                    
            if not failed_courses:
                if regular_passed and not cleared_via_supply:
                    final_status = 'Passed'
                    final_sgpa = regular_sgpa if regular_sgpa is not None else round(calc_cp / sem_cred, 2)
                    final_tot_marks = regular_tot_marks if regular_tot_marks is not None else int(calc_marks)
                    final_tot_cp = regular_tot_cp if regular_tot_cp is not None else round(calc_cp, 2)
                else:
                    final_status = 'Passed (Supply)'
                    final_sgpa = round(calc_cp / sem_cred, 2)
                    final_tot_marks = int(calc_marks)
                    final_tot_cp = round(calc_cp, 2)
            else:
                final_status = 'Failed'
                final_sgpa = None
                final_tot_marks = int(calc_marks) if all_marks_present else None
                final_tot_cp = round(calc_cp, 2)
                
            student_data['semesters'][sem] = {
                'status': final_status,
                'appeared': True,
                'regular_passed': regular_passed,
                'regular_sgpa': regular_sgpa,
                'regular_tot_marks': regular_tot_marks,
                'cleared_via_supply': cleared_via_supply,
                'attempts_count': len(attempts),
                'courses': courses_dict,
                'sgpa': final_sgpa,
                'total_marks': final_tot_marks,
                'total_cp': final_tot_cp,
                'failed_courses': failed_courses
            }
            
        # Overall Summary across S1-S8
        passed_sems = [s for s in SEMESTER_ORDER if student_data['semesters'][s]['status'] in ['Passed', 'Passed (Supply)']]
        failed_sems = [s for s in SEMESTER_ORDER if student_data['semesters'][s]['status'] == 'Failed']
        not_app_sems = [s for s in SEMESTER_ORDER if student_data['semesters'][s]['status'] == 'Not Appeared / Not Published']
        
        all_failed_courses = []
        for s in SEMESTER_ORDER:
            all_failed_courses.extend(student_data['semesters'][s].get('failed_courses', []))
            
        tot_prog_credits = sum(SEMESTER_CREDITS[s] for s in SEMESTER_ORDER) # 188
        earned_credits = sum(SEMESTER_CREDITS[s] for s in passed_sems)
        earned_cp = sum(student_data['semesters'][s]['total_cp'] or 0.0 for s in passed_sems)
        overall_tot_marks = sum(student_data['semesters'][s]['total_marks'] or 0 for s in passed_sems)
        
        if len(passed_sems) == len(SEMESTER_ORDER):
            overall_status = 'Passed'
            # Calculate CGPA = sum(Ci * Si) / sum(Ci)
            cgpa = round(earned_cp / tot_prog_credits, 2)
            if any(student_data['semesters'][s]['cleared_via_supply'] for s in SEMESTER_ORDER):
                pass_type = 'Passed with Supplementary'
            else:
                pass_type = 'Passed Regular (All Semesters)'
        else:
            overall_status = 'Failed'
            pass_type = f'Backlogs: {len(all_failed_courses)} subjects'
            # Tentative CGPA for earned credits
            cgpa = round(earned_cp / earned_credits, 2) if earned_credits > 0 else 0.0
            
        student_data['summary'] = {
            'overall_status': overall_status,
            'pass_type': pass_type,
            'passed_sems_count': len(passed_sems),
            'failed_sems_count': len(failed_sems),
            'total_backlogs': len(all_failed_courses),
            'all_failed_courses': all_failed_courses,
            'cgpa': cgpa,
            'earned_credits': earned_credits,
            'total_credits': tot_prog_credits,
            'earned_cp': round(earned_cp, 2),
            'overall_tot_marks': overall_tot_marks
        }
        
        students[prn] = student_data
        
    print(f"Total students parsed: {len(students)}")
    c1_students = [s for s in students.values() if s['college_group'] == 'College 1']
    c2_students = [s for s in students.values() if s['college_group'] == 'College 2']
    print(f"College 1 ({c1_students[0]['college_short'] if c1_students else ''}): {len(c1_students)} students")
    print(f"College 2 ({c2_students[0]['college_short'] if c2_students else ''}): {len(c2_students)} students")
    
    c1_passed = [s for s in c1_students if s['summary']['overall_status'] == 'Passed']
    c2_passed = [s for s in c2_students if s['summary']['overall_status'] == 'Passed']
    print(f"College 1 Passed All S1-S8: {len(c1_passed)} / {len(c1_students)}")
    print(f"College 2 Passed All S1-S8: {len(c2_passed)} / {len(c2_students)}")
    
    # Save parsed data to json
    with open('parsed_students_data.json', 'w', encoding='utf-8') as f:
        json.dump(students, f, indent=2)
    print("Saved parsed_students_data.json successfully!")

if __name__ == '__main__':
    analyze_all()
