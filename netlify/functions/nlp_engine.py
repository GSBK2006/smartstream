import os
import re
import json
import html
import requests
import google.generativeai as genai
from openai import OpenAI
from collections import Counter

def is_numeric_list(values):
    """
    Check if a list of values is numeric.
    """
    if not values:
        return False
    # Exclude booleans since isinstance(True, int) is True in Python
    return all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values if v is not None)

def is_datetime_str(val):
    """
    Check if a string matches a standard date format.
    """
    if not isinstance(val, str):
        return False
    val = val.strip()
    # Simple check for YYYY-MM-DD or YYYY/MM/DD
    if len(val) >= 10 and ((val[4] == '-' and val[7] == '-') or (val[4] == '/' and val[7] == '/')):
        return True
    return False

def generate_offline_summary(records, anomalies_count):
    """
    Generate a detailed rule-based summary when no LLM key is configured.
    Strips all markdown bolding/asterisks as requested.
    """
    if not records:
        return "No data processed yet."
        
    columns = list(records[0].keys())
    
    summary = "### Pipeline Insights & Execution Summary (Offline Engine)\n\n"
    summary += f"- Dataset Health: Processing completed. Checked {len(records)} rows. Cleaned duplicated rows and resolved missing values.\n"
    summary += f"- Anomaly Count: Found {anomalies_count} anomalous events across the dataset.\n\n"
    
    summary += "#### Key Column Breakdown:\n"
    for col in columns:
        if col in ['is_anomaly', 'anomaly_reason']:
            continue
            
        vals = [r.get(col) for r in records if r.get(col) is not None]
        if is_numeric_list(vals):
            # Calculate metrics
            float_vals = [float(v) for v in vals]
            mean_val = sum(float_vals) / len(float_vals)
            max_val = max(float_vals)
            min_val = min(float_vals)
            summary += f"- {col}: Numerical. Average is {mean_val:.2f} (Range: {min_val:.2f} to {max_val:.2f}).\n"
        elif any(is_datetime_str(v) for v in vals):
            summary += f"- {col}: Chronological timeline parsed.\n"
        else:
            # Categorical distribution
            non_empty = [str(v) for v in vals if v != ""]
            if non_empty:
                counts = Counter(non_empty).most_common(3)
                counts_str = ", ".join([f"'{k}': {v}" for k, v in counts])
                summary += f"- {col}: Categorical. Primary distributions: {counts_str}.\n"
                
    if anomalies_count > 0:
        summary += "\n#### Detected Anomalies:\n"
        count = 0
        for idx, r in enumerate(records):
            if str(r.get('is_anomaly', '')).lower() in ('true', '1', 'yes'):
                reason = r.get('anomaly_reason', 'Threshold exceeded')
                summary += f"- Row {idx}: {reason}\n"
                count += 1
                if count >= 5:
                    break
                    
    return summary

def run_offline_qa(records, question, chat_history=[]):
    """
    Heuristics-based natural language parser to query a pure-Python records list.
    Strips all markdown bolding/asterisks from the output.
    """
    if not records:
        return "No data processed yet."
        
    q = question.lower().strip()
    columns = list(records[0].keys())
    
    # Identify anomaly status in rows
    anom_indices = []
    for idx, r in enumerate(records):
        is_anom = str(r.get('is_anomaly', '')).lower() in ('true', '1', '1.0', 'yes')
        if is_anom:
            anom_indices.append(idx)
            
    anom_count = len(anom_indices)

    # Contextual parsing for conversational flow
    has_anomaly_context = False
    active_col = None

    for msg in chat_history[-3:]:
        text = msg.get('text', '').lower()
        if any(k in text for k in ['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag', 'spike', 'spikes', 'jump', 'jumps']):
            has_anomaly_context = True
        for col in columns:
            if col in ['is_anomaly', 'anomaly_reason']:
                continue
            if col.lower() in text:
                active_col = col

    # If recent context was about anomalies, and current question is a follow-up, inject anomaly keyword
    if has_anomaly_context and any(k in q for k in ['why', 'explain', 'reason', 'detail', 'details', 'them', 'show', 'spikes', 'spike']):
        if not any(k in q for k in ['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag']):
            q += " anomalies"

    # If recent context was about a specific column, and current question requests an aggregation without column name
    if active_col and any(k in q for k in ['average', 'mean', 'avg', 'maximum', 'max', 'highest', 'peak', 'minimum', 'min', 'lowest', 'sum', 'total']):
        if not any(col.lower() in q for col in columns if col not in ['is_anomaly', 'anomaly_reason']):
            q += f" {active_col.lower()}"

    # 1. Anomaly count & spikes queries
    if any(k in q for k in ['anomaly', 'anomalies', 'outlier', 'outliers', 'flagged', 'flag', 'spike', 'spikes', 'jump', 'jumps']):
        if any(k in q for k in ['why', 'reason', 'explain', 'detail', 'details']):
            if anom_count == 0:
                return "No anomalies were detected in the dataset."
            response = f"Here are the explanations for the detected anomalies (Total: {anom_count}):\n\n"
            shown = 0
            for idx in anom_indices:
                reason = records[idx].get('anomaly_reason', 'Threshold exceeded')
                response += f"- Row {idx}: {reason}\n"
                shown += 1
                if shown >= 10:
                    break
            if anom_count > 10:
                response += f"\n(Showing first 10 of {anom_count} anomalies)"
            return response
        else:
            return f"There are {anom_count} anomalies detected in the dataset. You can view them highlighted on the dashboard or query details about them by asking 'why did it spike?' or 'explain anomalies'."

    # 2. Aggregations (average, max, min, mean, sum)
    for col in columns:
        if col in ['is_anomaly', 'anomaly_reason']:
            continue
        col_lower = col.lower()
        if col_lower in q:
            # Check if column values are numeric
            col_vals = [r.get(col) for r in records if r.get(col) is not None]
            if is_numeric_list(col_vals):
                float_vals = [float(v) for v in col_vals]
                if any(k in q for k in ['average', 'mean', 'avg']):
                    val = sum(float_vals) / len(float_vals)
                    return f"The average value of {col} is {val:.4f}."
                elif any(k in q for k in ['maximum', 'max', 'highest', 'peak']):
                    val = max(float_vals)
                    return f"The maximum value of {col} is {val:.4f}."
                elif any(k in q for k in ['minimum', 'min', 'lowest']):
                    val = min(float_vals)
                    return f"The minimum value of {col} is {val:.4f}."
                elif any(k in q for k in ['sum', 'total']):
                    val = sum(float_vals)
                    return f"The sum total of {col} is {val:.4f}."

    # 3. Categorical breakdown queries
    for col in columns:
        if col in ['is_anomaly', 'anomaly_reason']:
            continue
        col_lower = col.lower()
        if col_lower in q or (col_lower == 'status' and 'status' in q) or (col_lower == 'category' and 'category' in q):
            col_vals = [str(r.get(col)) for r in records if r.get(col) is not None and r.get(col) != ""]
            unique_vals = set(col_vals)
            if len(unique_vals) < 25:
                counts = Counter(col_vals)
                response = f"Here is the distribution breakdown for the {col} column:\n\n"
                total_valid = len(col_vals)
                for k, v in counts.most_common():
                    percentage = (v / total_valid) * 100 if total_valid > 0 else 0
                    response += f"- {k}: {v} records ({percentage:.1f}%)\n"
                return response

    # 4. Text/Keyword searches
    text_cols = [c for c in columns if c not in ['ticket_id', 'client_ip', 'device_id', 'is_anomaly', 'anomaly_reason']]
    for col in text_cols:
        # Check if question asks to search for something in quotes
        match = re.search(r'["\'](.*?)[["\']', question)
        if not match:
            # Fallback to direct check if a keyword matches
            pass
        else:
            search_term = match.group(1).lower()
            matching_rows = []
            for idx, r in enumerate(records):
                val_str = str(r.get(col, '')).lower()
                if search_term in val_str:
                    matching_rows.append((idx, r.get(col)))
            if len(matching_rows) > 0:
                response = f"Found {len(matching_rows)} records where {col} contains '{search_term}':\n\n"
                for idx, text in matching_rows[:5]:
                    response += f"- Row {idx}: {text}\n"
                if len(matching_rows) > 5:
                    response += f"\n(Showing 5 of {len(matching_rows)} matching records)"
                return response

    # 5. Row count/Info queries
    if any(k in q for k in ['row', 'record', 'how many', 'count', 'size']):
        clean_col_count = len(columns)
        return f"The dataset currently has {len(records)} processed rows and {clean_col_count} clean data columns."

    # Default fallback guide
    return (
        "I analyzed your request using the local offline parser, but couldn't resolve a precise database action.\n\n"
        "Here are examples of questions I can answer directly:\n"
        "- 'How many anomalies were found?'\n"
        "- 'Why did temperature spike?' (explanations of anomalies)\n"
        "- 'What is the average temperature?' (or humidity, vibration, response_time_ms)\n"
        "- 'What is the highest vibration?'\n"
        "- 'Show status code distribution'\n"
        "- 'Show category breakdown'\n\n"
        "Tip: Configure an LLM API key (Gemini, Hugging Face, or OpenAI) in the dashboard settings to unlock full natural language reasoning and custom reporting!"
    )

def query_llm_engine(provider, model_name, api_key, prompt, system_instruction=None):
    """
    Dispatch query to external LLM provider.
    """
    if provider == 'gemini':
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name=model_name or 'gemini-1.5-flash',
                system_instruction=system_instruction
            )
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Gemini API Error: {str(e)}"
            
    elif provider == 'openai':
        try:
            client = OpenAI(api_key=api_key)
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})
            
            completion = client.chat.completions.create(
                model=model_name or "gpt-4o-mini",
                messages=messages
            )
            return completion.choices[0].message.content
        except Exception as e:
            return f"OpenAI API Error: {str(e)}"
            
    elif provider == 'ollama':
        try:
            url = f"{api_key or 'http://localhost:11434'}/api/generate"
            payload = {
                "model": model_name or "llama3",
                "prompt": f"{system_instruction}\n\n{prompt}" if system_instruction else prompt,
                "stream": False
            }
            r = requests.post(url, json=payload, timeout=20)
            if r.status_code == 200:
                return r.json().get('response', '')
            else:
                return f"Ollama API Error: Received status code {r.status_code}"
        except Exception as e:
            return f"Ollama Connection Error: Make sure Ollama server is running locally on port 11434. ({str(e)})"
            
    elif provider == 'huggingface':
        try:
            model = model_name or "meta-llama/Meta-Llama-3-8B-Instruct"
            url = f"https://api-inference.huggingface.co/models/{model}"
            headers = {"Authorization": f"Bearer {api_key}"}
            
            combined_prompt = f"<|system|>\n{system_instruction or 'You are a data assistant.'}\n<|user|>\n{prompt}\n<|assistant|>\n"
            
            payload = {
                "inputs": combined_prompt,
                "parameters": {"max_new_tokens": 512, "return_full_text": False}
            }
            
            r = requests.post(url, headers=headers, json=payload, timeout=20)
            if r.status_code == 200:
                res = r.json()
                if isinstance(res, list) and len(res) > 0:
                    return res[0].get('generated_text', '')
                return str(res)
            elif r.status_code == 503:
                return "Hugging Face Error: Model is currently loading, please try again in a few seconds."
            else:
                return f"Hugging Face Inference Error: Status {r.status_code} - {r.text}"
        except Exception as e:
            return f"Hugging Face API Connection Error: {str(e)}"
            
    elif provider == 'anthropic':
        try:
            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
            payload = {
                "model": model_name or "claude-3-haiku-20240307",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            }
            if system_instruction:
                payload["system"] = system_instruction
                
            r = requests.post(url, headers=headers, json=payload, timeout=25)
            if r.status_code == 200:
                return r.json().get('content', [{}])[0].get('text', '')
            else:
                return f"Claude API Error: Status {r.status_code} - {r.text}"
        except Exception as e:
            return f"Claude API Connection Error: {str(e)}"
            
    return "Error: Unknown LLM provider configuration."

def get_dataset_context_summary(records):
    """
    Format a condensed summary of the dataset for LLM prompts.
    """
    total_rows = len(records)
    anom_records = [r for r in records if str(r.get('is_anomaly', '')).lower() in ('true', '1', 'yes')]
    anom_count = len(anom_records)
    columns = list(records[0].keys()) if records else []
    
    summary = f"Dataset statistics:\n"
    summary += f"- Total Rows: {total_rows}\n"
    summary += f"- Anomalous Rows: {anom_count}\n"
    summary += f"- Columns: {', '.join(columns)}\n\n"
    
    summary += "Sample records:\n"
    summary += json.dumps(records[:5], indent=2)
    summary += "\n\n"
    
    if anom_count > 0:
        summary += "Sample anomaly records:\n"
        summary += json.dumps(anom_records[:5], indent=2)
        summary += "\n\n"
        
    return summary

def get_pipeline_summary(records, anomalies_count, provider=None, model_name=None, api_key=None):
    """
    Generates the plain-English executive summary for the dashboard.
    """
    if not provider or provider == 'offline' or not api_key:
        return generate_offline_summary(records, anomalies_count)
        
    context = get_dataset_context_summary(records)
    system_inst = "You are SmartStream's Executive AI Insights engine. Your goal is to analyze the processed operational dataset context and write a premium, compelling executive summary. Identify patterns, key averages, and highlight specific anomalies."
    prompt = (
        f"Please analyze the following dataset context and write a comprehensive, professional summary of your findings.\n"
        f"Make it structured with markdown headings, bullet points, and high-impact conclusions.\n\n"
        f"{context}"
    )
    
    return query_llm_engine(provider, model_name, api_key, prompt, system_instruction=system_inst)

def answer_dataset_question(records, question, chat_history=[], provider=None, model_name=None, api_key=None):
    """
    Answers a natural language question about the dataset using LLM or offline heuristics.
    """
    if not provider or provider == 'offline' or not api_key:
        return run_offline_qa(records, question, chat_history)
        
    context = get_dataset_context_summary(records)
    
    # Format chat history
    history_str = ""
    for msg in chat_history[-6:]:
        role = msg.get('role', 'user')
        text = msg.get('text', '')
        history_str += f"{role.upper()}: {text}\n"
        
    system_inst = (
        "You are SmartStream Q&A, an advanced analytical agent. You answer user questions about the ingested dataset. "
        "Use the dataset context provided to answer accurately. If they ask for averages, counts, or anomalies, perform "
        "the mental calculation based on the sample records or the statistics provided. Keep responses structured and useful."
    )
    
    prompt = (
        f"Here is the dataset context:\n{context}\n\n"
        f"Chat History:\n{history_str}\n"
        f"User Question: {question}\n\n"
        f"Write your response to the user's question now:"
    )
    
    return query_llm_engine(provider, model_name, api_key, prompt, system_instruction=system_inst)
