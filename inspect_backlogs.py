import json

with open('parsed_students_data.json', encoding='utf-8') as f:
    data = json.load(f)

c1_fail = [s for s in data.values() if s['college_group'] == 'College 1' and s['summary']['overall_status'] != 'Passed']
c2_fail = [s for s in data.values() if s['college_group'] == 'College 2' and s['summary']['overall_status'] != 'Passed']

print(f"=== College 1 Failed / Backlogs ({len(c1_fail)}) ===")
for s in c1_fail:
    print(f"PRN: {s['prn']} | {s['name']:<25} | Backlogs: {s['summary']['total_backlogs']} | Cleared Sems: {s['summary']['passed_sems_count']}/8 | Failed Courses: {s['summary']['all_failed_courses']}")

print(f"\n=== College 2 Failed / Backlogs ({len(c2_fail)}) ===")
for s in c2_fail:
    print(f"PRN: {s['prn']} | {s['name']:<25} | Backlogs: {s['summary']['total_backlogs']} | Cleared Sems: {s['summary']['passed_sems_count']}/8 | Failed Courses: {s['summary']['all_failed_courses']}")
