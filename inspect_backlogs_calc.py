import json

with open('parsed_students_data.json', encoding='utf-8') as f:
    data = json.load(f)

COURSE_CREDITS = {
    'IMCA1C01': 4.0, 'IMCA1C02': 4.0, 'IMCA1C03': 4.0, 'IMCA1C04': 4.0, 'IMCA1C05': 4.0, 'IMCA1P06': 2.0, 'IMCA1P07': 2.0,
    'IMCA2C01': 4.0, 'IMCA2C02': 4.0, 'IMCA2C03': 4.0, 'IMCA2C04': 4.0, 'IMCA2C05': 4.0, 'IMCA2P06': 2.0, 'IMCA2P07': 2.0,
    'IMCA3C01': 4.0, 'IMCA3C02': 4.0, 'IMCA3C03': 4.0, 'IMCA3C04': 4.0, 'IMCA3C05': 4.0, 'IMCA3P06': 2.0, 'IMCA3P07': 2.0,
    'IMCA4C01': 4.0, 'IMCA4C02': 4.0, 'IMCA4C03': 4.0, 'IMCA4C04': 4.0, 'IMCA4E01A': 4.0, 'IMCA4E01C': 4.0, 'IMCA4P05': 2.0, 'IMCA4P06': 2.0,
    'IMCA5C01': 4.0, 'IMCA5C02': 4.0, 'IMCA5C03': 4.0, 'IMCA5C04': 4.0, 'IMCA5C05': 4.0, 'IMCA5P06': 2.0, 'IMCA5P07': 2.0,
    'IMCA6C01': 4.0, 'IMCA6C02': 4.0, 'IMCA6CP1': 6.0, 'IMCA6E02A': 4.0, 'IMCA6E02C': 4.0, 'IMCA6S01': 2.0,
    'IMCA7C01': 4.0, 'IMCA7C02': 4.0, 'IMCA7C03': 4.0, 'IMCA7C04': 4.0, 'IMCA7C05': 4.0, 'IMCA7P06': 2.0, 'IMCA7P07': 2.0,
    'IMCA8C01': 4.0, 'IMCA8C02': 4.0, 'IMCA8C03': 4.0, 'IMCA8C04': 4.0, 'IMCA8CP2': 2.0, 'IMCA8E03A': 4.0, 'IMCA8E03C': 4.0, 'IMCA8P05': 2.0
}
SEM_CREDITS = {'S1': 24, 'S2': 24, 'S3': 24, 'S4': 24, 'S5': 24, 'S6': 20, 'S7': 24, 'S8': 24}

print("PRN          Name                 Backlogs EarnedCred CGPA_188 CGPA_Earned  S1   S2   S3   S4   S5   S6   S7   S8")
print("-" * 105)

for prn, s in list(data.items()):
    if s['summary']['overall_status'] != 'Passed':
        tot_earned_cp = 0.0
        tot_earned_cred = 0.0
        tot_marks = 0
        sem_sgpas = {}
        for sem in ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']:
            sdata = s['semesters'][sem]
            sem_cp = 0.0
            sem_cred = SEM_CREDITS[sem]
            sem_m = 0
            for code, c in sdata['courses'].items():
                c_cred = COURSE_CREDITS.get(code, 4.0)
                if c.get('result') == 'Passed':
                    cp = c.get('cp_num') or 0.0
                    sem_cp += cp
                    tot_earned_cp += cp
                    tot_earned_cred += c_cred
                m_val = c.get('total_num')
                if m_val is None:
                    try:
                        m_val = float(c.get('esa', 0)) + float(c.get('isa', 0))
                    except:
                        m_val = 0
                sem_m += m_val
                tot_marks += m_val
            sem_sgpa = round(sem_cp / sem_cred, 2)
            sem_sgpas[sem] = sem_sgpa
        cgpa_188 = round(tot_earned_cp / 188, 2)
        cgpa_earned = round(tot_earned_cp / tot_earned_cred, 2) if tot_earned_cred > 0 else 0.0
        name = s['name'][:18]
        bl = s['summary']['total_backlogs']
        sg_str = " ".join(f"{sem_sgpas[sem]:4.2f}" for sem in ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'])
        print(f"{prn} {name:18} {bl:8d} {tot_earned_cred:10.0f} {cgpa_188:8.2f} {cgpa_earned:11.2f}  {sg_str}")
