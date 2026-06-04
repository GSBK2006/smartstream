import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Create directories
os.makedirs('e:/MicrosoftHack/backend/data', exist_ok=True)

np.random.seed(42)

def generate_iot_data():
    # 150 rows of temperature & humidity readings with noise and anomalies
    start_time = datetime.now() - timedelta(hours=36)
    timestamps = [start_time + timedelta(minutes=15 * i) for i in range(150)]
    
    data = {
        "timestamp": [t.strftime("%Y-%m-%d %H:%M:%S") if i % 15 != 0 else t.strftime("%d/%m/%Y %I:%M %p") for i, t in enumerate(timestamps)], # Mixed formats
        "device_id": ["IoT-Sensor-A" if i % 2 == 0 else "iot-sensor-a" for i in range(150)], # Inconsistent casing
        "temperature": np.random.normal(25, 2, 150).tolist(),
        "humidity": np.random.normal(60, 5, 150).tolist(),
        "vibration": np.random.normal(0.5, 0.1, 150).tolist(),
        "status": ["Normal"] * 150
    }
    
    # Introduce anomalies
    # Extreme temperature spikes
    data["temperature"][20] = 95.2
    data["temperature"][85] = 98.6
    data["status"][20] = "Critical"
    data["status"][85] = "Critical"
    
    # Vibration anomalies
    data["vibration"][110] = 3.8
    data["vibration"][111] = 4.1
    
    # Introduce missing values (NaNs and empty strings)
    for i in [10, 35, 75]:
        data["temperature"][i] = None
    for i in [25, 90, 130]:
        data["humidity"][i] = np.nan
    for i in [50, 115]:
        data["device_id"][i] = ""
        
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Introduce duplicate rows (add 3 duplicate rows)
    duplicates = df.iloc[[12, 55, 102]].copy()
    df = pd.concat([df, duplicates], ignore_index=True)
    
    df.to_csv('e:/MicrosoftHack/backend/data/iot_sensors.csv', index=False)
    print("Generated iot_sensors.csv")

def generate_server_logs():
    # 200 rows of web server logs with high response times and errors
    start_time = datetime.now() - timedelta(days=1)
    timestamps = [start_time + timedelta(minutes=7 * i) for i in range(200)]
    
    methods = ["GET", "POST", "GET", "GET", "PUT", "DELETE"]
    endpoints = ["/api/v1/users", "/api/v1/login", "/index.html", "/api/v1/products", "/api/v1/checkout", "/api/v1/cart"]
    ips = ["192.168.1.10", "10.0.0.45", "172.16.254.1", "192.168.1.12", "192.168.1.10"]
    
    data = []
    for i, t in enumerate(timestamps):
        ip = ips[i % len(ips)]
        method = methods[i % len(methods)]
        endpoint = endpoints[i % len(endpoints)]
        
        # Normal behavior
        status = 200 if i % 12 != 0 else (304 if i % 20 == 0 else 404)
        response_time = int(np.random.exponential(120) + 30)
        error = ""
        
        # Anomalies / Outliers
        if i in [42, 105, 150, 175]:
            status = 500
            response_time = int(np.random.normal(8500, 500)) # Slow response
            error = "Database Connection Timeout Exception at connection pool pool-01" if i % 2 == 0 else "NullPointerException in user profile query service"
        elif i in [88, 120]:
            status = 403
            error = "Unauthorized access attempt - API key missing or invalid token signature"
            response_time = 15
            
        # Messy log format simulation
        data.append({
            "timestamp": t.strftime("[%d/%b/%Y:%H:%M:%S +0000]") if i % 10 != 0 else t.isoformat(), # Mixed format
            "client_ip": ip,
            "request": f"{method} {endpoint} HTTP/1.1",
            "status_code": status if i % 18 != 0 else None, # Null status codes
            "response_time_ms": response_time if i % 25 != 0 else np.nan, # Null times
            "error_message": error
        })
        
    df = pd.DataFrame(data)
    # Add duplicates
    df = pd.concat([df, df.iloc[[30, 80, 140]]], ignore_index=True)
    df.to_csv('e:/MicrosoftHack/backend/data/server_logs.csv', index=False)
    print("Generated server_logs.csv")

def generate_customer_tickets():
    # 100 rows of user feedback tickets with mixed sentiment and some noisy text formatting
    start_time = datetime.now() - timedelta(days=5)
    
    categories = ["Billing", "Technical Support", "Bug Report", "Feature Request", "Account Management"]
    names = ["Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright", "Fiona Gallagher"]
    
    feedbacks = [
        "The app crashed when I tried to export my report. Please fix this immediately!!",
        "Absolutely love the new dashboard interface! Extremely responsive and neat.",
        "Billing department charged me twice this month. I need a refund ASAP.",
        "Can you add a dark mode option? My eyes are hurting at night.",
        "Login is very slow. It takes almost 15 seconds to load my workspace.",
        "I'm unable to reset my password, the link in the email is invalid or expired.",
        "Great customer service! The agent solved my query in 5 minutes.",
        "The sensor telemetry data export has missing rows. Please look into it.",
        "This software is complete trash, full of bugs and glitches. Unusable.",
        "Is there a way to integrate this with Slack or Discord notifications?"
    ]
    
    data = []
    for i in range(100):
        t = start_time + timedelta(hours=1.2 * i)
        category = categories[i % len(categories)]
        name = names[i % len(names)]
        feedback = feedbacks[i % len(feedbacks)]
        rating = int(np.random.choice([1, 2, 3, 4, 5], p=[0.1, 0.15, 0.2, 0.25, 0.3]))
        
        # Adjust rating based on feedback sentiment
        if "trash" in feedback or "crashed" in feedback or "charged me twice" in feedback:
            rating = np.random.choice([1, 2])
        elif "love" in feedback or "Great" in feedback:
            rating = np.random.choice([4, 5])
            
        # Add some noise (HTML escapes, extra spacing)
        if i % 8 == 0:
            feedback = f"   {feedback}   "
        if i % 12 == 0:
            feedback = feedback.replace("crashed", "crashed &amp; locked up").replace("refund", "refund &lt;urgent&gt;")
            
        data.append({
            "ticket_id": f"TKT-{1000 + i}",
            "created_at": t.strftime("%Y-%m-%d %H:%M:%S"),
            "customer_name": name if i % 15 != 0 else np.nan, # Anonymous tickets
            "category": category,
            "priority": "High" if rating <= 2 else ("Medium" if rating == 3 else "Low"),
            "feedback_text": feedback if i % 25 != 0 else "", # Empty feedbacks
            "rating": rating
        })
        
    df = pd.DataFrame(data)
    # Add anomalies: rating value out of bounds
    df.loc[15, "rating"] = 45 # Extreme rating outlier
    df.loc[67, "rating"] = -5 # Negative rating outlier
    
    # Duplicates
    df = pd.concat([df, df.iloc[[5, 45]]], ignore_index=True)
    df.to_csv('e:/MicrosoftHack/backend/data/support_tickets.csv', index=False)
    print("Generated support_tickets.csv")

if __name__ == "__main__":
    generate_iot_data()
    generate_server_logs()
    generate_customer_tickets()
