import os
import json
import csv
import io
import base64
import email
from email.message import Message

import pipeline
import nlp_engine
import database

# Initialize Database connection
database.init_db()

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

def make_response(status_code, body_dict_or_str, content_type="application/json"):
    headers = CORS_HEADERS.copy()
    headers["Content-Type"] = content_type
    
    if isinstance(body_dict_or_str, (dict, list)):
        body = json.dumps(body_dict_or_str)
    else:
        body = body_dict_or_str
        
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": body
    }

def make_csv_response(status_code, csv_data, filename):
    headers = CORS_HEADERS.copy()
    headers["Content-Type"] = "text/csv"
    headers["Content-Disposition"] = f"attachment; filename={filename}"
    headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    headers["Pragma"] = "no-cache"
    headers["Expires"] = "0"
    
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": csv_data
    }

def parse_multipart(body_bytes, content_type_header):
    """
    Parse multipart form data using python's built-in email package.
    """
    msg_content = b"Content-Type: " + content_type_header.encode('utf-8') + b"\r\n\r\n" + body_bytes
    msg = email.message_from_bytes(msg_content)
    
    parts = {}
    files = {}
    
    if msg.is_multipart():
        for part in msg.get_payload():
            name = part.get_param('name', header='content-disposition')
            filename = part.get_filename()
            
            if filename:
                file_content = part.get_payload(decode=True)
                files[name] = {
                    'filename': filename,
                    'content': file_content,
                    'content_type': part.get_content_type()
                }
            else:
                payload = part.get_payload(decode=True)
                if payload is not None:
                    parts[name] = payload.decode('utf-8')
    return parts, files

def get_raw_stats(records):
    """
    Generate statistics for raw records using pure Python.
    """
    if not records:
        return {
            'row_count': 0,
            'column_count': 0,
            'duplicates': 0,
            'nulls': {},
            'dtypes': {},
            'columns': [],
            'sample': []
        }
        
    columns = list(records[0].keys())
    
    # Duplicate check
    seen = set()
    dups = 0
    for r in records:
        row_tuple = tuple((k, r[k]) for k in sorted(r.keys()))
        if row_tuple in seen:
            dups += 1
        else:
            seen.add(row_tuple)
            
    # Null counts check
    nulls = {col: 0 for col in columns}
    for r in records:
        for col in columns:
            val = r.get(col)
            if val is None or str(val).strip() == "" or str(val).lower() in ("nan", "null", "none"):
                nulls[col] += 1
                
    # Type inference
    dtypes = {}
    for col in columns:
        is_num = True
        for r in records:
            val = r.get(col)
            if val is not None and str(val).strip() != "":
                try:
                    float(val)
                except ValueError:
                    is_num = False
                    break
        dtypes[col] = 'float64' if is_num else 'object'
        
    return {
        'row_count': len(records),
        'column_count': len(columns),
        'duplicates': dups,
        'nulls': nulls,
        'dtypes': dtypes,
        'columns': columns,
        'sample': records[:15]
    }

def handler(event, context):
    method = event.get("httpMethod", "GET").upper()
    path = event.get("path", "")
    
    # CORS Preflight
    if method == "OPTIONS":
        return make_response(200, "")
        
    # Standardize path checking (strip domain/prefix if any)
    path_suffix = path.split("/api/")[-1] if "/api/" in path else path.split("/")[-1]
    
    # Route matching
    if path_suffix == "register" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            return make_response(400, {"error": "Invalid JSON body"})
            
        username = body.get('username', '')
        password = body.get('password', '')
        
        if not username or not password:
            return make_response(400, {"error": "Username and password are required"})
            
        success, message = database.register_user(username, password)
        if success:
            return make_response(200, {"message": message})
        else:
            return make_response(400, {"error": message})
            
    elif path_suffix == "login" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            return make_response(400, {"error": "Invalid JSON body"})
            
        username = body.get('username', '')
        password = body.get('password', '')
        
        if not username or not password:
            return make_response(400, {"error": "Username and password are required"})
            
        success, result = database.verify_user(username, password)
        if success:
            return make_response(200, {
                "message": "Login successful",
                "user": result
            })
        else:
            return make_response(401, {"error": result})
            
    elif path_suffix == "upload-raw" and method == "POST":
        content_type = ""
        headers = event.get("headers", {})
        # Headers can be case-insensitive
        for k, v in headers.items():
            if k.lower() == "content-type":
                content_type = v
                break
                
        if "multipart/form-data" not in content_type:
            return make_response(400, {"error": "Expected multipart/form-data content type"})
            
        is_b64 = event.get("isBase64Encoded", False)
        body_str = event.get("body", "")
        body_bytes = base64.b64decode(body_str) if is_b64 else body_str.encode('utf-8')
        
        try:
            fields, files = parse_multipart(body_bytes, content_type)
            target = fields.get('target', 'A')
            username = fields.get('username', 'default_user')
            
            file_info = files.get('file')
            if not file_info:
                return make_response(400, {"error": "No file uploaded"})
                
            filename = file_info['filename']
            file_content = file_info['content'].decode('utf-8')
            
            if not (filename.endswith('.csv') or filename.endswith('.json')):
                return make_response(400, {"error": "Only CSV or JSON files are supported"})
                
            if filename.endswith('.json'):
                records = json.loads(file_content)
                if not isinstance(records, list):
                    records = [records]
            else:
                reader = csv.DictReader(file_content.splitlines())
                records = [dict(row) for row in reader]
                
            stats = get_raw_stats(records)
            
            # Save to Supabase
            database.save_staged_data(
                username=username,
                target=target,
                raw_data=json.dumps(records),
                raw_stats=json.dumps(stats),
                cleaned_data=None,
                report=None
            )
            
            return make_response(200, {
                "message": f"File uploaded and staged successfully to dataset {target}",
                "stats": stats,
                "target": target
            })
        except Exception as e:
            return make_response(500, {"error": f"Failed to stage raw file: {str(e)}"})
            
    elif path_suffix == "process" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            body = {}
            
        username = body.get('username', 'default_user')
        
        staged_a = database.get_staged_data(username, 'A')
        staged_b = database.get_staged_data(username, 'B')
        
        has_a = staged_a is not None and staged_a.get('raw_data') is not None
        has_b = staged_b is not None and staged_b.get('raw_data') is not None
        
        if not has_a and not has_b:
            return make_response(400, {"error": "No raw data staged for processing"})
            
        try:
            response_data = {}
            
            if has_a:
                raw_records_a = json.loads(staged_a['raw_data'])
                cleaned_records_a, report_a = pipeline.clean_and_process_data(raw_records_a)
                
                database.save_staged_data(
                    username=username,
                    target='A',
                    raw_data=staged_a['raw_data'],
                    raw_stats=staged_a['raw_stats'],
                    cleaned_data=json.dumps(cleaned_records_a),
                    report=json.dumps(report_a)
                )
                response_data['reportA'] = report_a
                
            if has_b:
                raw_records_b = json.loads(staged_b['raw_data'])
                cleaned_records_b, report_b = pipeline.clean_and_process_data(raw_records_b)
                
                database.save_staged_data(
                    username=username,
                    target='B',
                    raw_data=staged_b['raw_data'],
                    raw_stats=staged_b['raw_stats'],
                    cleaned_data=json.dumps(cleaned_records_b),
                    report=json.dumps(report_b)
                )
                response_data['reportB'] = report_b
                
            return make_response(200, {
                "message": "Pipeline processing completed successfully",
                **response_data
            })
        except Exception as e:
            return make_response(500, {"error": f"Failed to process dataset: {str(e)}"})
            
    elif path_suffix == "download-cleaned" and method == "GET":
        query_params = event.get("queryStringParameters", {}) or {}
        target = query_params.get("target", "A")
        username = query_params.get("username", "default_user")
        
        staged = database.get_staged_data(username, target)
        if not staged or not staged.get('cleaned_data'):
            return make_response(404, {"error": f"No cleaned file available to download for dataset {target}"})
            
        try:
            cleaned_records = json.loads(staged['cleaned_data'])
            
            # Exclude anomaly_reason from the exported CSV
            for r in cleaned_records:
                if 'anomaly_reason' in r:
                    del r['anomaly_reason']
                    
            output = io.StringIO()
            if cleaned_records:
                writer = csv.DictWriter(output, fieldnames=cleaned_records[0].keys())
                writer.writeheader()
                writer.writerows(cleaned_records)
                
            csv_data = output.getvalue()
            return make_csv_response(200, csv_data, f"smartstream_cleaned_data_{target}.csv")
        except Exception as e:
            return make_response(500, {"error": f"Download failed: {str(e)}"})
            
    elif path_suffix == "summary" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            return make_response(400, {"error": "Invalid JSON body"})
            
        target = body.get('target', 'A')
        username = body.get('username', 'default_user')
        
        staged = database.get_staged_data(username, target)
        if not staged or not staged.get('cleaned_data'):
            return make_response(400, {"error": f"No active dataset {target} loaded"})
            
        try:
            cleaned_records = json.loads(staged['cleaned_data'])
            report_data = json.loads(staged['report'])
            anom_count = report_data.get('stats', {}).get('anomaly_count', 0)
            
            provider = body.get('provider', 'offline')
            model_name = body.get('model_name', '')
            api_key = body.get('api_key', '')
            
            if not api_key:
                if provider == 'gemini':
                    api_key = os.environ.get('GEMINI_API_KEY', '')
                elif provider == 'openai':
                    api_key = os.environ.get('OPENAI_API_KEY', '')
                elif provider == 'anthropic':
                    api_key = os.environ.get('CLAUDE_API_KEY') or os.environ.get('ANTHROPIC_API_KEY', '')
                elif provider == 'huggingface':
                    api_key = os.environ.get('HUGGINGFACE_API_KEY') or os.environ.get('HF_API_KEY', '')
                    
            summary = nlp_engine.get_pipeline_summary(cleaned_records, anom_count, provider, model_name, api_key)
            return make_response(200, {"summary": summary})
        except Exception as e:
            return make_response(500, {"error": f"Summary generation failed: {str(e)}"})
            
    elif path_suffix == "query" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            return make_response(400, {"error": "Invalid JSON body"})
            
        target = body.get('target', 'A')
        username = body.get('username', 'default_user')
        
        staged = database.get_staged_data(username, target)
        if not staged or not staged.get('cleaned_data'):
            return make_response(400, {"error": f"No active dataset {target} loaded"})
            
        question = body.get('question', '')
        chat_history = body.get('chat_history', [])
        provider = body.get('provider', 'offline')
        model_name = body.get('model_name', '')
        api_key = body.get('api_key', '')
        
        if not question:
            return make_response(400, {"error": "Question is required"})
            
        if not api_key:
            if provider == 'gemini':
                api_key = os.environ.get('GEMINI_API_KEY', '')
            elif provider == 'openai':
                api_key = os.environ.get('OPENAI_API_KEY', '')
            elif provider == 'anthropic':
                api_key = os.environ.get('CLAUDE_API_KEY') or os.environ.get('ANTHROPIC_API_KEY', '')
            elif provider == 'huggingface':
                api_key = os.environ.get('HUGGINGFACE_API_KEY') or os.environ.get('HF_API_KEY', '')
                
        try:
            cleaned_records = json.loads(staged['cleaned_data'])
            answer = nlp_engine.answer_dataset_question(cleaned_records, question, chat_history, provider, model_name, api_key)
            return make_response(200, {"answer": answer})
        except Exception as e:
            return make_response(500, {"error": f"Query processing failed: {str(e)}"})
            
    elif path_suffix == "reset-dual" and method == "POST":
        try:
            body = json.loads(event.get("body", "{}"))
        except Exception:
            body = {}
            
        username = body.get('username', 'default_user')
        success, message = database.clear_staged_data(username)
        if success:
            return make_response(200, {"message": "Successfully reset pipeline."})
        else:
            return make_response(500, {"error": message})
            
    # Default Route Not Found
    return make_response(404, {"error": f"Not Found: {method} {path}"})
