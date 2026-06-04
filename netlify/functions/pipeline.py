import csv
import json
import math
import html
import datetime
from collections import Counter

def parse_datetime(val):
    """
    Attempt to parse a datetime string. Returns datetime object or None.
    """
    if not val:
        return None
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val
    val_str = str(val).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.datetime.strptime(val_str, fmt)
        except ValueError:
            continue
    return None

def is_numeric_col(records, col):
    """
    Check if a column is numeric (all non-null values can be converted to float).
    """
    has_values = False
    for r in records:
        val = r.get(col)
        if val is not None and val != "":
            # Check if it looks like float
            try:
                float(val)
                has_values = True
            except ValueError:
                return False
    return has_values

def is_datetime_col(records, col):
    """
    Check if a column name suggests datetime and contains parseable datetime strings.
    """
    col_lower = col.lower()
    if not any(k in col_lower for k in ['time', 'date', 'created', 'updated', 'logged']):
        return False
        
    has_values = False
    for r in records:
        val = r.get(col)
        if val is not None and val != "":
            dt = parse_datetime(val)
            if dt is not None:
                has_values = True
            else:
                return False
    return has_values

def calculate_median(values):
    """
    Calculate median of a numeric list in pure Python.
    """
    if not values:
        return 0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 1:
        return sorted_vals[n // 2]
    else:
        return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / 2.0

def clean_and_process_data(filepath_or_data):
    """
    Cleans, imputes, and runs anomaly detection on a dataset in pure Python.
    Returns: (cleaned_records, report_dict)
    """
    # 1. Parse input data into a list of dicts
    records = []
    if isinstance(filepath_or_data, str):
        # Determine if JSON or CSV
        striped_input = filepath_or_data.strip()
        if striped_input.startswith('[') or striped_input.startswith('{'):
            try:
                parsed = json.loads(striped_input)
                records = parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                pass
        else:
            # Check if file path
            if os.path.exists(filepath_or_data):
                with open(filepath_or_data, 'r', encoding='utf-8-sig') as f:
                    content = f.read().strip()
                    if content.startswith('[') or content.startswith('{'):
                        records = json.loads(content)
                    else:
                        f.seek(0)
                        reader = csv.DictReader(f)
                        records = [dict(row) for row in reader]
            else:
                # Treat as CSV string
                reader = csv.DictReader(filepath_or_data.splitlines())
                records = [dict(row) for row in reader]
    elif isinstance(filepath_or_data, list):
        # Deep copy list of dicts
        records = [dict(row) for row in filepath_or_data]
    else:
        raise ValueError("Invalid input format for data processing.")

    total_rows_before = len(records)
    if total_rows_before == 0:
        return [], {
            'stats': {
                'before': {'row_count': 0, 'column_count': 0, 'duplicates': 0, 'nulls': {}},
                'after': {'row_count': 0, 'column_count': 0, 'duplicates': 0, 'nulls': {}}
            },
            'data': [],
            'anomalies': [],
            'columns': []
        }

    columns = list(records[0].keys())

    # Calculate duplicate count
    seen = set()
    deduped_records = []
    duplicates_count = 0
    for r in records:
        row_tuple = tuple((k, r[k]) for k in sorted(r.keys()))
        if row_tuple in seen:
            duplicates_count += 1
        else:
            seen.add(row_tuple)
            deduped_records.append(r)
            
    records = deduped_records

    # Capture initial nulls & types count
    nulls_before = {col: 0 for col in columns}
    dtypes_before = {col: 'object' for col in columns}
    
    # Pre-clean string values (unescape HTML, strip spaces)
    for r in records:
        for col in columns:
            val = r.get(col)
            if val is None or str(val).strip() == "" or str(val).lower() in ("nan", "null", "none"):
                r[col] = None
                nulls_before[col] += 1
            else:
                cleaned_val = html.unescape(str(val)).strip()
                if cleaned_val == "" or cleaned_val.lower() in ("nan", "null", "none"):
                    r[col] = None
                    nulls_before[col] += 1
                else:
                    r[col] = cleaned_val

    # Detect column types
    col_types = {}
    for col in columns:
        if is_numeric_col(records, col):
            col_types[col] = 'numeric'
            dtypes_before[col] = 'float64'
        elif is_datetime_col(records, col):
            col_types[col] = 'datetime'
            dtypes_before[col] = 'datetime64[ns]'
        else:
            col_types[col] = 'categorical'
            dtypes_before[col] = 'object'

    # Impute missing values
    for col in columns:
        col_type = col_types[col]
        
        if col_type == 'numeric':
            # Gather numerical values
            numeric_vals = []
            for r in records:
                if r[col] is not None:
                    try:
                        numeric_vals.append(float(r[col]))
                    except ValueError:
                        pass
            median_val = calculate_median(numeric_vals)
            
            # Fill nulls with median
            for r in records:
                if r[col] is None:
                    r[col] = median_val
                else:
                    r[col] = float(r[col])
                    
        elif col_type == 'datetime':
            # Run forward-fill and backward-fill
            last_valid = None
            # Ffill
            for r in records:
                val = r[col]
                if val is not None:
                    dt = parse_datetime(val)
                    if dt:
                        last_valid = dt.strftime('%Y-%m-%d %H:%M:%S')
                if val is None and last_valid is not None:
                    r[col] = last_valid
            
            # Bfill
            last_valid = None
            for r in reversed(records):
                val = r[col]
                if val is not None:
                    dt = parse_datetime(val)
                    if dt:
                        last_valid = dt.strftime('%Y-%m-%d %H:%M:%S')
                if val is None and last_valid is not None:
                    r[col] = last_valid
                    
            # Fallback to now
            now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            for r in records:
                if r[col] is None:
                    r[col] = now_str
                else:
                    dt = parse_datetime(r[col])
                    if dt:
                        r[col] = dt.strftime('%Y-%m-%d %H:%M:%S')
                        
        else: # categorical
            # Gather mode
            non_null_cats = [r[col] for r in records if r[col] is not None]
            if non_null_cats:
                mode_val = Counter(non_null_cats).most_common(1)[0][0]
            else:
                mode_val = 'Unknown'
                
            for r in records:
                if r[col] is None:
                    r[col] = mode_val

    # Anomaly Detection
    for r in records:
        r['is_anomaly'] = False
        r['anomaly_reason'] = ""

    anomalies = []
    
    # 1. Z-score anomaly detection for numerical columns (excluding rating)
    numeric_cols = [col for col, t in col_types.items() if t == 'numeric' and col != 'rating']
    
    for col in numeric_cols:
        vals = [float(r[col]) for r in records]
        n = len(vals)
        if n > 1:
            mean = sum(vals) / n
            variance = sum((x - mean) ** 2 for x in vals) / (n - 1)
            std_dev = math.sqrt(variance)
            
            if std_dev > 0:
                for idx, r in enumerate(records):
                    val = float(r[col])
                    z_score = (val - mean) / std_dev
                    if abs(z_score) > 3.0:
                        r['is_anomaly'] = True
                        reason = f"Outlier in {col}: value {val:.1f} (Z-score: {z_score:.1f})"
                        if r['anomaly_reason']:
                            r['anomaly_reason'] += f" | {reason}"
                        else:
                            r['anomaly_reason'] = reason

    # 2. Bounded rule check for rating
    if 'rating' in columns:
        for idx, r in enumerate(records):
            val = r.get('rating')
            if val is not None:
                try:
                    f_val = float(val)
                    if f_val < 1.0 or f_val > 5.0:
                        r['is_anomaly'] = True
                        reason = f"Out-of-bounds rating: {f_val} (expected 1 to 5)"
                        if r['anomaly_reason']:
                            r['anomaly_reason'] += f" | {reason}"
                        else:
                            r['anomaly_reason'] = reason
                except ValueError:
                    r['is_anomaly'] = True
                    reason = f"Invalid rating format: {val}"
                    if r['anomaly_reason']:
                        r['anomaly_reason'] += f" | {reason}"
                    else:
                        r['anomaly_reason'] = reason

    # Package findings
    for idx, r in enumerate(records):
        if r['is_anomaly']:
            anomalies.append({
                'row_index': idx,
                'data': r,
                'reason': r['anomaly_reason']
            })

    # Prepare report metadata
    report = {}
    report['before'] = {
        'row_count': total_rows_before,
        'column_count': len(columns),
        'duplicates': duplicates_count,
        'nulls': nulls_before,
        'dtypes': dtypes_before
    }
    
    report['after'] = {
        'row_count': len(records),
        'column_count': len(columns),
        'duplicates': 0,
        'nulls': {col: 0 for col in columns},
        'dtypes': {col: 'float64' if col_types[col] == 'numeric' else ('datetime64[ns]' if col_types[col] == 'datetime' else 'object') for col in columns}
    }
    
    report['anomaly_count'] = len(anomalies)

    cols_meta = []
    for col in columns:
        cols_meta.append({
            'name': col,
            'type': 'float64' if col_types[col] == 'numeric' else ('datetime64[ns]' if col_types[col] == 'datetime' else 'object'),
            'is_numerical': bool(col_types[col] == 'numeric'),
            'is_datetime': bool(col_types[col] == 'datetime'),
            'is_anomaly_candidate': bool(col_types[col] == 'numeric' and col != 'rating')
        })

    return records, {
        'stats': report,
        'data': records,
        'anomalies': anomalies,
        'columns': cols_meta
    }

# Import guard
import os
