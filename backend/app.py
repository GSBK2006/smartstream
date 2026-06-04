import os
import json
import csv
import io
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS

from pipeline import clean_and_process_data
from nlp_engine import get_pipeline_summary, answer_dataset_question
from database import (
    init_db, register_user, verify_user,
    save_staged_data, get_staged_data, clear_staged_data
)

app = Flask(__name__)
CORS(app)

# Initialize Supabase Connection
init_db()

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

# --- AUTH ROUTES ---

@app.route('/api/register', methods=['POST'])
def register():
    body = request.json or {}
    username = body.get('username', '')
    password = body.get('password', '')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
        
    success, message = register_user(username, password)
    if success:
        return jsonify({"message": message})
    else:
        return jsonify({"error": message}), 400

@app.route('/api/login', methods=['POST'])
def login():
    body = request.json or {}
    username = body.get('username', '')
    password = body.get('password', '')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
        
    success, result = verify_user(username, password)
    if success:
        return jsonify({
            "message": "Login successful",
            "user": result
        })
    else:
        return jsonify({"error": result}), 401


# --- PIPELINE ROUTES ---

@app.route('/api/upload-raw', methods=['POST'])
def upload_raw():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    target = request.form.get('target', 'A')  # Staged in A or B
    username = request.form.get('username', 'default_user')
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    if not (file.filename.endswith('.csv') or file.filename.endswith('.json')):
        return jsonify({"error": "Only CSV or JSON files are supported"}), 400
        
    try:
        content = file.read().decode('utf-8')
        
        # Parse file content into list of dicts
        if file.filename.endswith('.json'):
            records = json.loads(content)
            if not isinstance(records, list):
                records = [records]
        else:
            reader = csv.DictReader(content.splitlines())
            records = [dict(row) for row in reader]
            
        stats = get_raw_stats(records)
        
        # Save to Supabase (Overwrite/Upsert raw data, clear previous cleaned/report outputs)
        save_staged_data(
            username=username,
            target=target,
            raw_data=json.dumps(records),
            raw_stats=json.dumps(stats),
            cleaned_data=None,
            report=None
        )
        
        return jsonify({
            "message": f"File uploaded and staged successfully to dataset {target}",
            "stats": stats,
            "target": target
        })
    except Exception as e:
        return jsonify({"error": f"Failed to stage raw file: {str(e)}"}), 500

@app.route('/api/process', methods=['POST'])
def process_data():
    body = request.json or {}
    username = body.get('username', 'default_user')
    
    # Retrieve raw data staged for A and B
    staged_a = get_staged_data(username, 'A')
    staged_b = get_staged_data(username, 'B')
    
    has_a = staged_a is not None and staged_a.get('raw_data') is not None
    has_b = staged_b is not None and staged_b.get('raw_data') is not None
    
    if not has_a and not has_b:
        return jsonify({"error": "No raw data staged for processing"}), 400
        
    try:
        response_data = {}
        
        if has_a:
            raw_records_a = json.loads(staged_a['raw_data'])
            cleaned_records_a, report_a = clean_and_process_data(raw_records_a)
            
            # Save back to Supabase
            save_staged_data(
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
            cleaned_records_b, report_b = clean_and_process_data(raw_records_b)
            
            # Save back to Supabase
            save_staged_data(
                username=username,
                target='B',
                raw_data=staged_b['raw_data'],
                raw_stats=staged_b['raw_stats'],
                cleaned_data=json.dumps(cleaned_records_b),
                report=json.dumps(report_b)
            )
            response_data['reportB'] = report_b
            
        return jsonify({
            "message": "Pipeline processing completed successfully",
            **response_data
        })
    except Exception as e:
        return jsonify({"error": f"Failed to process dataset: {str(e)}"}), 500

@app.route('/api/download-cleaned', methods=['GET'])
def download_cleaned():
    target = request.args.get('target', 'A')
    username = request.args.get('username', 'default_user')
    
    staged = get_staged_data(username, target)
    if not staged or not staged.get('cleaned_data'):
        return jsonify({"error": f"No cleaned file available to download for dataset {target}"}), 404
        
    try:
        cleaned_records = json.loads(staged['cleaned_data'])
        
        # Exclude anomaly_reason from the exported CSV as requested
        for r in cleaned_records:
            if 'anomaly_reason' in r:
                del r['anomaly_reason']
                
        # Generate CSV in memory
        output = io.StringIO()
        if cleaned_records:
            writer = csv.DictWriter(output, fieldnames=cleaned_records[0].keys())
            writer.writeheader()
            writer.writerows(cleaned_records)
            
        csv_data = output.getvalue()
        
        response = make_response(csv_data)
        response.headers["Content-Disposition"] = f"attachment; filename=smartstream_cleaned_data_{target}.csv"
        response.headers["Content-Type"] = "text/csv"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        return jsonify({"error": f"Download failed: {str(e)}"}), 500

@app.route('/api/summary', methods=['POST'])
def generate_summary():
    body = request.json or {}
    target = body.get('target', 'A')
    username = body.get('username', 'default_user')
    
    staged = get_staged_data(username, target)
    if not staged or not staged.get('cleaned_data'):
        return jsonify({"error": f"No active dataset {target} loaded"}), 400
        
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
                
        summary = get_pipeline_summary(cleaned_records, anom_count, provider, model_name, api_key)
        return jsonify({"summary": summary})
    except Exception as e:
        return jsonify({"error": f"Summary generation failed: {str(e)}"}), 500

@app.route('/api/query', methods=['POST'])
def query_data():
    body = request.json or {}
    target = body.get('target', 'A')
    username = body.get('username', 'default_user')
    
    staged = get_staged_data(username, target)
    if not staged or not staged.get('cleaned_data'):
        return jsonify({"error": f"No active dataset {target} loaded"}), 400
        
    question = body.get('question', '')
    chat_history = body.get('chat_history', [])
    provider = body.get('provider', 'offline')
    model_name = body.get('model_name', '')
    api_key = body.get('api_key', '')
    
    if not question:
        return jsonify({"error": "Question is required"}), 400
        
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
        answer = answer_dataset_question(cleaned_records, question, chat_history, provider, model_name, api_key)
        return jsonify({"answer": answer})
    except Exception as e:
        return jsonify({"error": f"Query processing failed: {str(e)}"}), 500

@app.route('/api/reset-dual', methods=['POST'])
def reset_dual():
    body = request.json or {}
    username = body.get('username', 'default_user')
    
    success, message = clear_staged_data(username)
    if success:
        return jsonify({"message": "Successfully reset pipeline."})
    else:
        return jsonify({"error": message}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
