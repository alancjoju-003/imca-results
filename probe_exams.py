import requests
from bs4 import BeautifulSoup
import urllib3
from concurrent.futures import ThreadPoolExecutor
import sys

urllib3.disable_warnings()

url = 'https://pareeksha.mgu.ac.in/Pareeksha/index.php/Public/PareekshaResultView_ctrl/index/3/421'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Referer': url
}

r = requests.get(url, verify=False, timeout=20)
soup = BeautifulSoup(r.text, 'html.parser')
exams = [(opt.get('value'), opt.text.strip()) for opt in soup.find('select', {'name': 'exam_id'}).find_all('option') if opt.get('value')]

print(f"Total exams in portal: {len(exams)}", flush=True)

test_prns = ['223242110001', '223242110005', '223242110101', '223242110105']

def check_exam(exam_tuple):
    exam_id, exam_name = exam_tuple
    s = requests.Session()
    s.headers.update(headers)
    found_info = []
    for prn in test_prns:
        try:
            data = {'cs_id': '421', 'exam_id': exam_id, 'prn': prn, 'btnresult': 'Submit'}
            resp = s.post(url, data=data, verify=False, timeout=12)
            if 'Permanent Register Number' in resp.text:
                found_info.append(prn)
        except Exception:
            pass
    if found_info:
        print(f"MATCH: Exam {exam_id} | {exam_name} | Found PRNs: {found_info}", flush=True)
        return (exam_id, exam_name, found_info)
    return None

with ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(check_exam, exams))

matched = [r for r in results if r]
print(f"\nTotal matched exams: {len(matched)}", flush=True)
for m in matched:
    print(m, flush=True)
