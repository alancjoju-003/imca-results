import requests
from bs4 import BeautifulSoup
import urllib3
from concurrent.futures import ThreadPoolExecutor
import time

urllib3.disable_warnings()

url = 'https://pareeksha.mgu.ac.in/Pareeksha/index.php/Public/PareekshaResultView_ctrl/index/3/421'
headers = {'User-Agent': 'Mozilla/5.0'}

r = requests.get(url, verify=False, timeout=20)
soup = BeautifulSoup(r.text, 'html.parser')
exams = [(opt.get('value'), opt.text.strip()) for opt in soup.find('select', {'name': 'exam_id'}).find_all('option') if opt.get('value')]

# 223242110001 to 223242110050
prns_r1 = [f'2232421100{i:02d}' for i in range(1, 51)]
# 223242110101 to 223242110150
prns_r2 = [f'2232421101{i:02d}' for i in range(1, 51)]
all_prns = prns_r1 + prns_r2

# Let's test a sample of 10 PRNs from each range across all exams first, to see which exams apply to 2022 batch
sample_prns = prns_r1[:5] + prns_r1[20:25] + prns_r2[:5] + prns_r2[20:25]

def probe_exam(item):
    exam_id, name = item
    s = requests.Session()
    count = 0
    for p in sample_prns:
        try:
            d = {'cs_id': '421', 'exam_id': exam_id, 'prn': p, 'btnresult': 'Submit'}
            res = s.post(url, data=d, headers=headers, verify=False, timeout=10)
            if 'Permanent Register Number' in res.text:
                count += 1
        except:
            pass
    return (exam_id, name, count)

with ThreadPoolExecutor(max_workers=8) as ex:
    exam_hits = list(ex.map(probe_exam, exams))

print("=== EXAM HITS FOR 2022 BATCH SAMPLES ===")
active_exams = []
for eid, name, cnt in exam_hits:
    if cnt > 0:
        print(f"Exam ID {eid:4s} | Hits {cnt:2d}/20 | {name}")
        active_exams.append((eid, name))
    else:
        # print(f"Exam ID {eid:4s} | 0 hits | {name}")
        pass
