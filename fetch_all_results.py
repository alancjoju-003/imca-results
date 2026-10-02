import requests
from bs4 import BeautifulSoup
import urllib3
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

urllib3.disable_warnings()

BASE_URL = 'https://pareeksha.mgu.ac.in/Pareeksha/index.php/Public/PareekshaResultView_ctrl/index/3/421'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL
}

# 20 exams in chronological order
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

# PRN Ranges
PRNS_COLLEGE_1 = [f'2232421100{i:02d}' for i in range(1, 51)]
PRNS_COLLEGE_2 = [f'2232421101{i:02d}' for i in range(1, 51)]
ALL_PRNS = PRNS_COLLEGE_1 + PRNS_COLLEGE_2

CACHE_DIR = 'raw_cache'
os.makedirs(CACHE_DIR, exist_ok=True)

def fetch_single(item):
    prn, exam_id, exam_name, sem, exam_type = item
    cache_file = os.path.join(CACHE_DIR, f'{prn}_{exam_id}.html')
    if os.path.exists(cache_file):
        with open(cache_file, 'r', encoding='utf-8') as f:
            html = f.read()
        return (prn, exam_id, exam_name, sem, exam_type, html, True)
    
    s = requests.Session()
    s.headers.update(HEADERS)
    data = {
        'cs_id': '421',
        'exam_id': exam_id,
        'prn': prn,
        'btnresult': 'Submit'
    }
    for attempt in range(3):
        try:
            resp = s.post(BASE_URL, data=data, verify=False, timeout=15)
            if resp.status_code == 200:
                html = resp.text
                with open(cache_file, 'w', encoding='utf-8') as f:
                    f.write(html)
                return (prn, exam_id, exam_name, sem, exam_type, html, False)
        except Exception as e:
            time.sleep(1)
    return (prn, exam_id, exam_name, sem, exam_type, '', False)

def main():
    tasks = []
    for prn in ALL_PRNS:
        for eid, ename, sem, etype in EXAMS:
            tasks.append((prn, eid, ename, sem, etype))
    
    print(f"Total fetch tasks: {len(tasks)}", flush=True)
    completed = 0
    hit_count = 0
    with ThreadPoolExecutor(max_workers=12) as executor:
        futures = [executor.submit(fetch_single, t) for t in tasks]
        for f in as_completed(futures):
            prn, eid, ename, sem, etype, html, cached = f.result()
            completed += 1
            if 'Permanent Register Number' in html:
                hit_count += 1
            if completed % 100 == 0 or completed == len(tasks):
                print(f"Progress: {completed}/{len(tasks)} tasks completed. Hits found: {hit_count}", flush=True)

if __name__ == '__main__':
    main()
