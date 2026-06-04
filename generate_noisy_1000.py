import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_large_noisy_dataset():
    np.random.seed(101)
    n_rows = 1000
    
    # 1. Timestamps with mixed formats
    start_time = datetime.now() - timedelta(days=5)
    timestamps = [start_time + timedelta(minutes=7.2 * i) for i in range(n_rows)]
    
    formatted_times = []
    for i, t in enumerate(timestamps):
        if i % 15 == 0:
            formatted_times.append(t.strftime("%d/%m/%Y %I:%M %p"))
        elif i % 25 == 0:
            formatted_times.append(t.isoformat())
        else:
            formatted_times.append(t.strftime("%Y-%m-%d %H:%M:%S"))
            
    # 2. Sensor IDs with casing inconsistencies and whitespace
    sensor_choices = ["Sensor-Alpha", "sensor-alpha", "SENSOR-ALPHA", "Sensor-Beta", "sensor-beta", "SENSOR-BETA"]
    sensor_ids = [sensor_choices[i % len(sensor_choices)] for i in range(n_rows)]
    # Add trailing spaces occasionally
    sensor_ids = [f" {sid} " if i % 12 == 0 else sid for i, sid in enumerate(sensor_ids)]
    
    # 3. Numerical columns with normal distributions
    temperature = np.random.normal(32.5, 3.0, n_rows).tolist()
    pressure = np.random.normal(4.2, 0.5, n_rows).tolist()
    vibration = np.random.normal(0.45, 0.08, n_rows).tolist()
    flow_rate = np.random.normal(12.0, 1.5, n_rows).tolist()
    
    # 4. Inject explicit numerical anomalies
    # Temperature spikes/drops
    temperature[120] = 115.8
    temperature[345] = -42.5
    temperature[789] = 122.1
    
    # Pressure spikes
    pressure[202] = 29.4
    pressure[650] = 27.1
    
    # Vibration anomalies
    vibration[480] = 7.9
    vibration[812] = 8.5
    
    # Flow rate spikes
    flow_rate[310] = 85.0
    
    # 5. Status codes
    status_codes = [200 if i % 10 != 0 else (400 if i % 30 == 0 else 500) for i in range(n_rows)]
    
    # 6. Messy text comments (HTML escaping, extra spaces)
    base_messages = [
        "Normal operation &amp; telemetries synced",
        "System check: &lt;SUCCESS&gt;",
        "Warning: Pressure variance detected",
        "Error: Connection pool reset by peer",
        "Routine checkup performed by technician",
        "Critical limit reached on primary manifold"
    ]
    system_messages = []
    for i in range(n_rows):
        msg = base_messages[i % len(base_messages)]
        # Adjust message based on status
        if status_codes[i] == 500:
            msg = "Error: Database thread pool exhausted &lt;ConnectionException&gt;"
        elif temperature[i] > 100 or pressure[i] > 20:
            msg = "ALERT: Critical structural parameters breached!"
            
        # Add whitespace noise
        if i % 11 == 0:
            msg = f"    {msg}   "
        system_messages.append(msg)
        
    # Assemble raw dictionary
    data = {
        "timestamp": formatted_times,
        "sensor_id": sensor_ids,
        "temperature_c": temperature,
        "pressure_bar": pressure,
        "vibration_amplitude": vibration,
        "flow_rate_lps": flow_rate,
        "status_code": status_codes,
        "system_message": system_messages
    }
    
    # 7. Inject null values (None and NaN)
    for i in [55, 180, 290, 420, 560, 710, 890]:
        data["temperature_c"][i] = None
    for i in [90, 210, 380, 610, 820]:
        data["pressure_bar"][i] = np.nan
    for i in [112, 450, 780]:
        data["sensor_id"][i] = ""
    for i in [225, 675]:
        data["flow_rate_lps"][i] = None
        
    df = pd.DataFrame(data)
    
    # 8. Inject duplicate rows (add 40 duplicate rows scattered)
    duplicate_indices = np.random.choice(range(n_rows), 40, replace=False)
    duplicates = df.iloc[duplicate_indices].copy()
    df = pd.concat([df, duplicates], ignore_index=True)
    
    # Save file
    output_path = "e:/MicrosoftHack/noisy_sample_1000.csv"
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} rows of noisy dataset in {output_path}")

if __name__ == "__main__":
    generate_large_noisy_dataset()
