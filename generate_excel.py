import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Load parsed data
with open('parsed_students_data.json', encoding='utf-8') as f:
    data = json.load(f)

# Sort students into College 1 and College 2
PRNS_COLLEGE_1 = [f'2232421100{i:02d}' for i in range(1, 66)]
PRNS_COLLEGE_2 = [f'2232421101{i:02d}' for i in range(1, 67)]

c1_students = [data[p] for p in PRNS_COLLEGE_1 if p in data]
c2_students = [data[p] for p in PRNS_COLLEGE_2 if p in data]
all_students = list(data.values())

# Ranking function:
# Cleared students first (CGPA desc, overall_tot_marks desc)
# Backlog students next (earned_credits desc, cgpa desc, overall_tot_marks desc)
def student_sort_key(s):
    is_cleared = (s['summary']['overall_status'] == 'Passed')
    cgpa = s['summary']['cgpa']
    marks = s['summary']['overall_tot_marks']
    credits = s['summary']['earned_credits']
    return (1 if is_cleared else 0, cgpa, marks, credits)

# Sort College 1
c1_sorted = sorted(c1_students, key=student_sort_key, reverse=True)
# Sort College 2
c2_sorted = sorted(c2_students, key=student_sort_key, reverse=True)
# Sort Combined
all_sorted = sorted(all_students, key=student_sort_key, reverse=True)

# Assign Ranks
def assign_ranks(student_list, rank_field_name, cleared_rank_field_name):
    cleared_counter = 1
    for idx, s in enumerate(student_list, 1):
        s['summary'][rank_field_name] = idx
        if s['summary']['overall_status'] == 'Passed':
            s['summary'][cleared_rank_field_name] = cleared_counter
            cleared_counter += 1
        else:
            s['summary'][cleared_rank_field_name] = f"Backlog ({s['summary']['total_backlogs']})"

assign_ranks(c1_sorted, 'c1_rank', 'c1_cleared_rank')
assign_ranks(c2_sorted, 'c2_rank', 'c2_cleared_rank')
assign_ranks(all_sorted, 'univ_rank', 'univ_cleared_rank')

# Classification rule from syllabus:
# CGPA >= 8.00 and no supply/breaks -> First Class with Distinction
# CGPA >= 8.00 with supply -> First Class
# CGPA >= 6.75 -> First Class
# CGPA >= 5.00 -> Second Class
# Backlogs -> With Backlogs
def get_classification(s):
    sum_data = s['summary']
    if sum_data['overall_status'] != 'Passed':
        return f"Pending Backlogs ({sum_data['total_backlogs']})"
    cgpa = sum_data['cgpa']
    has_supply = ('Supplementary' in sum_data['pass_type'])
    if cgpa >= 8.00:
        if not has_supply:
            return "First Class with Distinction"
        else:
            return "First Class (Distinction CGPA)"
    elif cgpa >= 6.75:
        return "First Class"
    elif cgpa >= 5.00:
        return "Second Class"
    else:
        return "Passed"

for s in all_students:
    s['summary']['classification'] = get_classification(s)

# Create Workbook
wb = openpyxl.Workbook()
# Remove default sheet
wb.remove(wb.active)

# Color styles
NAVY_HEADER = '1F4E79'
STEEL_BLUE = '2E75B6'
ACCENT_BLUE = 'D9E1F2'
PASS_GREEN = 'E2EFDA'
PASS_SUPPLY_YELLOW = 'FFF2CC'
FAIL_RED = 'FCE4D6'
LIGHT_GRAY = 'F2F2F2'

font_title = Font(name='Segoe UI', size=16, bold=True, color='1F4E79')
font_subtitle = Font(name='Segoe UI', size=11, italic=True, color='595959')
font_section = Font(name='Segoe UI', size=13, bold=True, color='1F4E79')
font_header = Font(name='Segoe UI', size=10, bold=True, color='FFFFFF')
font_data = Font(name='Segoe UI', size=10)
font_data_bold = Font(name='Segoe UI', size=10, bold=True)
font_kpi_val = Font(name='Segoe UI', size=16, bold=True, color='1F4E79')
font_kpi_lbl = Font(name='Segoe UI', size=9, bold=True, color='595959')

fill_header = PatternFill(start_color=NAVY_HEADER, end_color=NAVY_HEADER, fill_type='solid')
fill_subheader = PatternFill(start_color=STEEL_BLUE, end_color=STEEL_BLUE, fill_type='solid')
fill_kpi = PatternFill(start_color=ACCENT_BLUE, end_color=ACCENT_BLUE, fill_type='solid')
fill_pass = PatternFill(start_color=PASS_GREEN, end_color=PASS_GREEN, fill_type='solid')
fill_supply = PatternFill(start_color=PASS_SUPPLY_YELLOW, end_color=PASS_SUPPLY_YELLOW, fill_type='solid')
fill_fail = PatternFill(start_color=FAIL_RED, end_color=FAIL_RED, fill_type='solid')
fill_zebra = PatternFill(start_color='F9FAFB', end_color='F9FAFB', fill_type='solid')

thin_border = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9')
)
header_border = Border(
    left=Side(style='thin', color='FFFFFF'),
    right=Side(style='thin', color='FFFFFF'),
    top=Side(style='medium', color=NAVY_HEADER),
    bottom=Side(style='medium', color=NAVY_HEADER)
)

align_center = Alignment(horizontal='center', vertical='center')
align_left = Alignment(horizontal='left', vertical='center')
align_right = Alignment(horizontal='right', vertical='center')
align_header = Alignment(horizontal='center', vertical='center', wrap_text=True)

# -------------------------------------------------------------
# SHEET 1: Executive Summary & Overview
# -------------------------------------------------------------
ws_sum = wb.create_sheet('Summary & Analytics')
ws_sum.views.sheetView[0].showGridLines = True

ws_sum['A1'] = "MAHATMA GANDHI UNIVERSITY - IMCA BATCH 2022-2027"
ws_sum['A1'].font = font_title
ws_sum['A2'] = "Consolidated Performance Report & College Rankings (Semesters I to VIII - Including Supplementary Clearances)"
ws_sum['A2'].font = font_subtitle

# KPI Cards
kpis = [
    ("Total Students", len(all_students), f"Col 1: {len(c1_students)} | Col 2: {len(c2_students)}"),
    ("Overall Cleared (S1-S8)", f"{sum(1 for s in all_students if s['summary']['overall_status'] == 'Passed')} / {len(all_students)}", f"{round(sum(1 for s in all_students if s['summary']['overall_status'] == 'Passed')/len(all_students)*100, 1)}% Pass Rate"),
    ("De Paul Cleared", f"{sum(1 for s in c1_students if s['summary']['overall_status'] == 'Passed')} / {len(c1_students)}", f"{round(sum(1 for s in c1_students if s['summary']['overall_status'] == 'Passed')/len(c1_students)*100, 1)}% Pass Rate"),
    ("SCMS Cleared", f"{sum(1 for s in c2_students if s['summary']['overall_status'] == 'Passed')} / {len(c2_students)}", f"{round(sum(1 for s in c2_students if s['summary']['overall_status'] == 'Passed')/len(c2_students)*100, 1)}% Pass Rate"),
    ("Top University CGPA", f"{all_sorted[0]['summary']['cgpa']:.2f}", f"{all_sorted[0]['name']} ({all_sorted[0]['college_short']})"),
    ("Distinctions (CGPA >= 8)", sum(1 for s in all_students if s['summary']['cgpa'] >= 8.0 and s['summary']['overall_status'] == 'Passed'), "First Class with Distinction")
]

start_col = 1
for title, val, sub in kpis:
    c_start = start_col
    c_end = start_col + 2
    ws_sum.merge_cells(start_row=4, start_column=c_start, end_row=4, end_column=c_end)
    ws_sum.merge_cells(start_row=5, start_column=c_start, end_row=5, end_column=c_end)
    ws_sum.merge_cells(start_row=6, start_column=c_start, end_row=6, end_column=c_end)
    
    cell_lbl = ws_sum.cell(row=4, column=c_start, value=title.upper())
    cell_lbl.font = font_kpi_lbl
    cell_lbl.alignment = align_center
    cell_lbl.fill = fill_kpi
    
    cell_val = ws_sum.cell(row=5, column=c_start, value=val)
    cell_val.font = font_kpi_val
    cell_val.alignment = align_center
    cell_val.fill = fill_kpi
    
    cell_sub = ws_sum.cell(row=6, column=c_start, value=sub)
    cell_sub.font = Font(name='Segoe UI', size=8, italic=True, color='595959')
    cell_sub.alignment = align_center
    cell_sub.fill = fill_kpi
    
    for r in range(4, 7):
        for c in range(c_start, c_end + 1):
            ws_sum.cell(row=r, column=c).border = thin_border
            
    start_col += 3

# Section: College 1 Top 10
ws_sum.cell(row=8, column=1, value="TOP PERFORMERS - COLLEGE 1: DE PAUL INSTITUTE OF SCIENCE & TECHNOLOGY, ANGAMALY").font = font_section
c1_top_headers = ['Col Rank', 'Univ Rank', 'PRN', 'Student Name', 'CGPA', 'Total Marks', 'Status', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']
for col_idx, h in enumerate(c1_top_headers, 1):
    c = ws_sum.cell(row=9, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_header
    c.alignment = align_header
    c.border = header_border

row_ptr = 10
for s in c1_sorted[:10]:
    row_vals = [
        s['summary']['c1_cleared_rank'],
        s['summary']['univ_cleared_rank'],
        s['prn'],
        s['name'],
        s['summary']['cgpa'],
        s['summary']['overall_tot_marks'],
        s['summary']['pass_type'],
        s['semesters']['S1']['sgpa'],
        s['semesters']['S2']['sgpa'],
        s['semesters']['S3']['sgpa'],
        s['semesters']['S4']['sgpa'],
        s['semesters']['S5']['sgpa'],
        s['semesters']['S6']['sgpa'],
        s['semesters']['S7']['sgpa'],
        s['semesters']['S8']['sgpa'],
    ]
    for col_idx, v in enumerate(row_vals, 1):
        cell = ws_sum.cell(row=row_ptr, column=col_idx, value=v)
        cell.font = font_data
        cell.border = thin_border
        if col_idx in [1, 2, 3]:
            cell.alignment = align_center
        elif col_idx == 4:
            cell.alignment = align_left
        elif col_idx == 5:
            cell.alignment = align_center
            cell.number_format = '0.00'
            cell.font = font_data_bold
        elif col_idx == 6:
            cell.alignment = align_right
            cell.number_format = '#,##0'
        elif col_idx >= 8:
            cell.alignment = align_center
            cell.number_format = '0.00'
        else:
            cell.alignment = align_left
            
        if col_idx == 7:
            cell.fill = fill_pass if 'Regular' in str(v) else fill_supply
    row_ptr += 1

# Section: College 2 Top 10
row_ptr += 2
ws_sum.cell(row=row_ptr, column=1, value="TOP PERFORMERS - COLLEGE 2: SCMS SCHOOL OF TECHNOLOGY & MANAGEMENT, ALUVA").font = font_section
row_ptr += 1
for col_idx, h in enumerate(c1_top_headers, 1):
    c = ws_sum.cell(row=row_ptr, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_subheader
    c.alignment = align_header
    c.border = header_border

row_ptr += 1
for s in c2_sorted[:10]:
    row_vals = [
        s['summary']['c2_cleared_rank'],
        s['summary']['univ_cleared_rank'],
        s['prn'],
        s['name'],
        s['summary']['cgpa'],
        s['summary']['overall_tot_marks'],
        s['summary']['pass_type'],
        s['semesters']['S1']['sgpa'],
        s['semesters']['S2']['sgpa'],
        s['semesters']['S3']['sgpa'],
        s['semesters']['S4']['sgpa'],
        s['semesters']['S5']['sgpa'],
        s['semesters']['S6']['sgpa'],
        s['semesters']['S7']['sgpa'],
        s['semesters']['S8']['sgpa'],
    ]
    for col_idx, v in enumerate(row_vals, 1):
        cell = ws_sum.cell(row=row_ptr, column=col_idx, value=v)
        cell.font = font_data
        cell.border = thin_border
        if col_idx in [1, 2, 3]:
            cell.alignment = align_center
        elif col_idx == 4:
            cell.alignment = align_left
        elif col_idx == 5:
            cell.alignment = align_center
            cell.number_format = '0.00'
            cell.font = font_data_bold
        elif col_idx == 6:
            cell.alignment = align_right
            cell.number_format = '#,##0'
        elif col_idx >= 8:
            cell.alignment = align_center
            cell.number_format = '0.00'
        else:
            cell.alignment = align_left
            
        if col_idx == 7:
            cell.fill = fill_pass if 'Regular' in str(v) else fill_supply
    row_ptr += 1

# Auto-fit columns in summary sheet
for col in ws_sum.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws_sum.column_dimensions[col_letter].width = max(max_len + 3, 11)


# -------------------------------------------------------------
# HELPER TO BUILD COLLEGE SHEETS
# -------------------------------------------------------------
def build_college_sheet(ws, title, subtitle, student_list, rank_col_key, is_c1=True):
    ws.views.sheetView[0].showGridLines = True
    
    ws['A1'] = title
    ws['A1'].font = font_title
    ws['A2'] = subtitle
    ws['A2'].font = font_subtitle
    
    headers = [
        ('College Rank', 12, 'center'),
        ('Univ Rank', 11, 'center'),
        ('PRN', 15, 'center'),
        ('Student Name', 25, 'left'),
        ('Final CGPA', 12, 'center'),
        ('Total Marks', 12, 'right'),
        ('Credits Earned', 13, 'center'),
        ('Overall Status', 13, 'center'),
        ('Pass Category / Mode', 25, 'left'),
        ('Classification', 24, 'left'),
        ('Backlogs Count', 13, 'center'),
        ('Failed Courses (Active)', 30, 'left'),
        ('S1 SGPA', 10, 'center'), ('S1 Status', 12, 'center'), ('S1 Marks', 10, 'right'),
        ('S2 SGPA', 10, 'center'), ('S2 Status', 12, 'center'), ('S2 Marks', 10, 'right'),
        ('S3 SGPA', 10, 'center'), ('S3 Status', 12, 'center'), ('S3 Marks', 10, 'right'),
        ('S4 SGPA', 10, 'center'), ('S4 Status', 12, 'center'), ('S4 Marks', 10, 'right'),
        ('S5 SGPA', 10, 'center'), ('S5 Status', 12, 'center'), ('S5 Marks', 10, 'right'),
        ('S6 SGPA', 10, 'center'), ('S6 Status', 12, 'center'), ('S6 Marks', 10, 'right'),
        ('S7 SGPA', 10, 'center'), ('S7 Status', 12, 'center'), ('S7 Marks', 10, 'right'),
        ('S8 SGPA', 10, 'center'), ('S8 Status', 12, 'center'), ('S8 Marks', 10, 'right'),
    ]
    
    ws.row_dimensions[4].height = 28
    for col_idx, (h, width, align) in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_header if is_c1 else fill_subheader
        cell.alignment = align_header
        cell.border = header_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

    for row_idx, s in enumerate(student_list, 5):
        ws.row_dimensions[row_idx].height = 20
        sum_data = s['summary']
        sems = s['semesters']
        
        failed_courses_str = ", ".join(sum_data['all_failed_courses']) if sum_data['all_failed_courses'] else "None"
        
        row_vals = [
            sum_data[rank_col_key],
            sum_data['univ_cleared_rank'],
            s['prn'],
            s['name'],
            sum_data['cgpa'],
            sum_data['overall_tot_marks'],
            f"{sum_data['earned_credits']}/{sum_data['total_credits']}",
            sum_data['overall_status'],
            sum_data['pass_type'],
            sum_data['classification'],
            sum_data['total_backlogs'],
            failed_courses_str,
            # S1
            sems['S1']['sgpa'] if sems['S1']['status'] != 'Failed' else '---',
            sems['S1']['status'],
            sems['S1']['total_marks'] or '---',
            # S2
            sems['S2']['sgpa'] if sems['S2']['status'] != 'Failed' else '---',
            sems['S2']['status'],
            sems['S2']['total_marks'] or '---',
            # S3
            sems['S3']['sgpa'] if sems['S3']['status'] != 'Failed' else '---',
            sems['S3']['status'],
            sems['S3']['total_marks'] or '---',
            # S4
            sems['S4']['sgpa'] if sems['S4']['status'] != 'Failed' else '---',
            sems['S4']['status'],
            sems['S4']['total_marks'] or '---',
            # S5
            sems['S5']['sgpa'] if sems['S5']['status'] != 'Failed' else '---',
            sems['S5']['status'],
            sems['S5']['total_marks'] or '---',
            # S6
            sems['S6']['sgpa'] if sems['S6']['status'] != 'Failed' else '---',
            sems['S6']['status'],
            sems['S6']['total_marks'] or '---',
            # S7
            sems['S7']['sgpa'] if sems['S7']['status'] != 'Failed' else '---',
            sems['S7']['status'],
            sems['S7']['total_marks'] or '---',
            # S8
            sems['S8']['sgpa'] if sems['S8']['status'] != 'Failed' else '---',
            sems['S8']['status'],
            sems['S8']['total_marks'] or '---',
        ]
        
        is_cleared = (sum_data['overall_status'] == 'Passed')
        
        for col_idx, val in enumerate(row_vals, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = font_data
            cell.border = thin_border
            
            # Formats
            align_type = headers[col_idx-1][2]
            if align_type == 'center':
                cell.alignment = align_center
            elif align_type == 'right':
                cell.alignment = align_right
            else:
                cell.alignment = align_left
                
            if col_idx in [5]: # CGPA
                if isinstance(val, (int, float)):
                    cell.number_format = '0.00'
                cell.font = font_data_bold
            elif col_idx in [6]: # Total marks
                if isinstance(val, (int, float)):
                    cell.number_format = '#,##0'
                cell.font = font_data_bold
            elif col_idx in [13, 16, 19, 22, 25, 28, 31, 34]: # SGPAs
                if isinstance(val, (int, float)):
                    cell.number_format = '0.00'
                    
            # Color fills
            if col_idx == 8: # Overall status
                cell.fill = fill_pass if is_cleared else fill_fail
                cell.font = font_data_bold
            elif col_idx in [14, 17, 20, 23, 26, 29, 32, 35]: # Sem status
                if val == 'Passed':
                    cell.fill = fill_pass
                elif val == 'Passed (Supply)':
                    cell.fill = fill_supply
                elif val == 'Failed':
                    cell.fill = fill_fail
            elif not is_cleared and col_idx <= 4:
                cell.fill = fill_fail

    # Freeze panes at student names and headers
    ws.freeze_panes = 'E5'
    # Add auto-filter
    ws.auto_filter.ref = f"A4:{get_column_letter(len(headers))}{len(student_list)+4}"

# -------------------------------------------------------------
# SHEET 2: College 1 - De Paul Angamaly
# -------------------------------------------------------------
ws_c1 = wb.create_sheet('College 1 - De Paul')
build_college_sheet(
    ws_c1,
    "COLLEGE 1: DE PAUL INSTITUTE OF SCIENCE & TECHNOLOGY, ANGAMALY",
    "PRN Range: 223242110001 to 223242110065 | Integrated Master of Computer Applications (2022-2027)",
    c1_sorted,
    'c1_cleared_rank',
    is_c1=True
)

# -------------------------------------------------------------
# SHEET 3: College 2 - SCMS Aluva
# -------------------------------------------------------------
ws_c2 = wb.create_sheet('College 2 - SCMS')
build_college_sheet(
    ws_c2,
    "COLLEGE 2: SCMS SCHOOL OF TECHNOLOGY & MANAGEMENT, ALUVA",
    "PRN Range: 223242110101 to 223242110166 | Integrated Master of Computer Applications (2022-2027)",
    c2_sorted,
    'c2_cleared_rank',
    is_c1=False
)

# -------------------------------------------------------------
# SHEET 4: Combined Leaderboard
# -------------------------------------------------------------
ws_all = wb.create_sheet('Combined Leaderboard')
ws_all.views.sheetView[0].showGridLines = True
ws_all['A1'] = "MAHATMA GANDHI UNIVERSITY - COMBINED INTER-COLLEGE LEADERBOARD"
ws_all['A1'].font = font_title
ws_all['A2'] = "Rankings Across Both Colleges (De Paul Angamaly & SCMS Aluva) - Semesters I to VIII"
ws_all['A2'].font = font_subtitle

comb_headers = [
    ('Univ Rank', 11, 'center'),
    ('College Rank', 12, 'center'),
    ('PRN', 15, 'center'),
    ('Student Name', 25, 'left'),
    ('College', 28, 'left'),
    ('Final CGPA', 12, 'center'),
    ('Total Marks', 12, 'right'),
    ('Credits', 11, 'center'),
    ('Overall Status', 13, 'center'),
    ('Pass Category', 24, 'left'),
    ('Classification', 24, 'left'),
    ('Backlogs', 10, 'center'),
    ('Active Failed Courses', 28, 'left'),
    ('S1 SGPA', 10, 'center'),
    ('S2 SGPA', 10, 'center'),
    ('S3 SGPA', 10, 'center'),
    ('S4 SGPA', 10, 'center'),
    ('S5 SGPA', 10, 'center'),
    ('S6 SGPA', 10, 'center'),
    ('S7 SGPA', 10, 'center'),
    ('S8 SGPA', 10, 'center'),
]

ws_all.row_dimensions[4].height = 28
for col_idx, (h, width, align) in enumerate(comb_headers, 1):
    c = ws_all.cell(row=4, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_header
    c.alignment = align_header
    c.border = header_border
    col_letter = get_column_letter(col_idx)
    ws_all.column_dimensions[col_letter].width = width

for row_idx, s in enumerate(all_sorted, 5):
    ws_all.row_dimensions[row_idx].height = 20
    sum_data = s['summary']
    sems = s['semesters']
    is_c1 = (s['college_group'] == 'College 1')
    col_rank_val = sum_data['c1_cleared_rank'] if is_c1 else sum_data['c2_cleared_rank']
    is_cleared = (sum_data['overall_status'] == 'Passed')
    
    failed_courses_str = ", ".join(sum_data['all_failed_courses']) if sum_data['all_failed_courses'] else "None"
    
    row_vals = [
        sum_data['univ_cleared_rank'],
        f"{'C1' if is_c1 else 'C2'}: {col_rank_val}",
        s['prn'],
        s['name'],
        s['college_short'],
        sum_data['cgpa'],
        sum_data['overall_tot_marks'],
        f"{sum_data['earned_credits']}/{sum_data['total_credits']}",
        sum_data['overall_status'],
        sum_data['pass_type'],
        sum_data['classification'],
        sum_data['total_backlogs'],
        failed_courses_str,
        sems['S1']['sgpa'] if sems['S1']['status'] != 'Failed' else '---',
        sems['S2']['sgpa'] if sems['S2']['status'] != 'Failed' else '---',
        sems['S3']['sgpa'] if sems['S3']['status'] != 'Failed' else '---',
        sems['S4']['sgpa'] if sems['S4']['status'] != 'Failed' else '---',
        sems['S5']['sgpa'] if sems['S5']['status'] != 'Failed' else '---',
        sems['S6']['sgpa'] if sems['S6']['status'] != 'Failed' else '---',
        sems['S7']['sgpa'] if sems['S7']['status'] != 'Failed' else '---',
        sems['S8']['sgpa'] if sems['S8']['status'] != 'Failed' else '---',
    ]
    
    for col_idx, val in enumerate(row_vals, 1):
        cell = ws_all.cell(row=row_idx, column=col_idx, value=val)
        cell.font = font_data
        cell.border = thin_border
        
        align_type = comb_headers[col_idx-1][2]
        if align_type == 'center':
            cell.alignment = align_center
        elif align_type == 'right':
            cell.alignment = align_right
        else:
            cell.alignment = align_left
            
        if col_idx == 6: # CGPA
            if isinstance(val, (int, float)):
                cell.number_format = '0.00'
            cell.font = font_data_bold
        elif col_idx == 7: # Total Marks
            if isinstance(val, (int, float)):
                cell.number_format = '#,##0'
            cell.font = font_data_bold
        elif col_idx >= 14: # SGPAs
            if isinstance(val, (int, float)):
                cell.number_format = '0.00'
                
        if col_idx == 9: # Overall status
            cell.fill = fill_pass if is_cleared else fill_fail
            cell.font = font_data_bold
            
ws_all.freeze_panes = 'F5'
ws_all.auto_filter.ref = f"A4:{get_column_letter(len(comb_headers))}{len(all_sorted)+4}"

# -------------------------------------------------------------
# SHEET 5: Course-Level Detailed Audit Trail
# -------------------------------------------------------------
ws_audit = wb.create_sheet('Course-Level Details')
ws_audit.views.sheetView[0].showGridLines = True
ws_audit['A1'] = "DETAILED COURSE-LEVEL AUDIT SHEET (ALL SEMESTERS & SUPPLY CLEARANCES)"
ws_audit['A1'].font = font_title
ws_audit['A2'] = "Individual subject performance, regular vs supplementary attempts, internal/external marks, grade points, credit points"
ws_audit['A2'].font = font_subtitle

audit_headers = [
    ('PRN', 14, 'center'),
    ('Student Name', 25, 'left'),
    ('College', 28, 'left'),
    ('Semester', 11, 'center'),
    ('Course Code', 13, 'center'),
    ('Course Title', 32, 'left'),
    ('ESA', 8, 'center'),
    ('ESA Max', 9, 'center'),
    ('ISA', 8, 'center'),
    ('ISA Max', 9, 'center'),
    ('Total Marks', 12, 'center'),
    ('Max Marks', 11, 'center'),
    ('GP', 8, 'center'),
    ('CP', 8, 'center'),
    ('Grade', 8, 'center'),
    ('Final Result', 12, 'center'),
    ('Cleared In', 32, 'left')
]

ws_audit.row_dimensions[4].height = 25
for col_idx, (h, width, align) in enumerate(audit_headers, 1):
    c = ws_audit.cell(row=4, column=col_idx, value=h)
    c.font = font_header
    c.fill = fill_subheader
    c.alignment = align_header
    c.border = header_border
    col_letter = get_column_letter(col_idx)
    ws_audit.column_dimensions[col_letter].width = width

row_audit_ptr = 5
for s in all_sorted:
    prn = s['prn']
    name = s['name']
    col_name = s['college_short']
    for sem in ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']:
        sem_data = s['semesters'][sem]
        for c in sem_data.get('courses', {}).values():
            ws_audit.row_dimensions[row_audit_ptr].height = 19
            r_vals = [
                prn,
                name,
                col_name,
                sem,
                c['code'],
                c['title'],
                c['esa'],
                c['esa_max'],
                c['isa'],
                c['isa_max'],
                c['total'],
                c['total_max'],
                c['gp'],
                c['cp'],
                c['grade'],
                c['result'],
                c.get('cleared_in', 'Regular')
            ]
            for col_idx, val in enumerate(r_vals, 1):
                cell = ws_audit.cell(row=row_audit_ptr, column=col_idx, value=val)
                cell.font = font_data
                cell.border = thin_border
                align_type = audit_headers[col_idx-1][2]
                if align_type == 'center':
                    cell.alignment = align_center
                elif align_type == 'right':
                    cell.alignment = align_right
                else:
                    cell.alignment = align_left
                    
                if col_idx == 16: # Final Result
                    if val == 'Passed':
                        cell.fill = fill_pass
                    elif val == 'Failed':
                        cell.fill = fill_fail
                        cell.font = font_data_bold
                if 'Supply' in str(r_vals[16]) and col_idx == 17:
                    cell.fill = fill_supply
                    
            row_audit_ptr += 1

ws_audit.freeze_panes = 'G5'
ws_audit.auto_filter.ref = f"A4:{get_column_letter(len(audit_headers))}{row_audit_ptr-1}"

# Save workbook
output_path = 'MG_University_IMCA_Batch_2022_Semesters_1_to_8_Results_and_Ranks.xlsx'
try:
    wb.save(output_path)
    print(f"Excel workbook generated successfully at: {output_path}")
except PermissionError:
    alt_path = 'MG_University_IMCA_Batch_2022_Semesters_1_to_8_Results_and_Ranks_Updated.xlsx'
    wb.save(alt_path)
    print(f"Original file is locked by Excel. Saved updated workbook to: {alt_path}")
print(f"Total audit course rows: {row_audit_ptr - 5}")

