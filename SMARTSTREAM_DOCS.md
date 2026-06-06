# 🚀 SmartStream — Technical Documentation & Explainer

Welcome to the **SmartStream** documentation! This guide breaks down the technology, design, and mathematical concepts behind the system in a simple, visual, and human-readable way. 

Whether you are preparing a demo for judges, explaining the system to a classmate, or writing up a project report, this file contains everything you need to know.

---

## 💡 The Big Idea: What is SmartStream?

SmartStream is a **real-time browser-native data validation and cleaning pipeline**. 

In traditional data pipelines, when a user uploads a dataset (like a CSV file):
1. The file travels to a backend server.
2. A heavy library (like Python's Pandas) processes it.
3. The server sends the results back.

**SmartStream flips this script.** It runs **100% in the user's browser** using custom-built Javascript algorithms. It parses the files, cleans missing values, computes statistics, and runs machine learning outlier detection without ever sending your raw data to a server. 

### Why this is a game-changer:
*   **Zero Server Costs & Cold Starts:** No server hosting fees or waiting for serverless containers to "wake up."
*   **Complete Data Privacy:** Since the data is parsed locally in your browser, sensitive files never leak online.
*   **Persistent Cloud Staging:** It connects to **Supabase** (a cloud database) to securely stage data, track user accounts, and load previously cleaned metrics instantly.

---

## 🛡️ The Ensemble Anomaly Detection Pipeline

SmartStream identifies "anomalous" data points (like sensor malfunctions, corrupted telemetry, or wrong user inputs) using an **Ensemble Voting Pipeline**. 

Instead of relying on a single method, the pipeline runs **three fundamentally different algorithms** on the scaled data and combines their results. A row is flagged as a **confirmed anomaly** only if **at least 2 of the 3 methods agree**. This drastically reduces false alarms (false positives).

Here is how each method works in plain English:

### 1. Z-Score (Statistical Approach)
*   **The Analogy:** Imagine measuring the heights of people in a room. If the average height is 5'7" (170cm), and someone walks in who is 8'4" (254cm), they stand out immediately because they are far away from the average.
*   **How it works:** It assumes your data follows a normal bell curve. It calculates the **mean** (average) and the **standard deviation** (how spread out the values are) for each column. If a value is more than **3 standard deviations** away from the average, it is flagged.
*   **Formula:**
    $$Z = \frac{x - \mu}{\sigma}$$
    *   $x$: The actual value you are checking.
    *   $\mu$ (mu): The average (mean) of that column.
    *   $\sigma$ (sigma): The standard deviation of that column.
    *   *Rule: Flagged if $|Z| > 3.0$.*

### 2. Isolation Forest (Tree-Based Approach)
*   **The Analogy:** Imagine playing a game of "20 Questions" to isolate a specific person. If someone is extremely unique (e.g., wearing a neon green spacesuit), you can isolate them in just 1 or 2 questions ("Are they wearing a spacesuit?"). If they are average, it takes many more questions.
*   **How it works:** It builds a collection of random decision trees. Because outliers/anomalies are different and sparse, they require **fewer splits** to separate from the rest of the dataset. The algorithm measures how quickly each data point gets isolated. Points with short paths get high anomaly scores.
*   **Formula:**
    $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$
    *   $s(x, n)$: The anomaly score (ranges between 0 and 1; scores near 1 are anomalies).
    *   $E(h(x))$: The average number of split steps it took to isolate point $x$ across all trees.
    *   $c(n)$: The average path length of an unsuccessful search in a binary search tree (used to normalize the score for comparison).
    *   *Rule: The top 7% of points with the highest anomaly scores are flagged.*

### 3. DBSCAN (Density-Based Clustering)
*   **The Analogy:** Imagine people gathering in groups at a party. The crowded groups are clusters. The people standing completely alone in empty corners are outliers/noise.
*   **How it works:** DBSCAN stands for *Density-Based Spatial Clustering of Applications with Noise*. It groups points that are close to each other. It takes two parameters:
    1.  **Radius ($\epsilon$ - epsilon)**: How close points need to be to be considered "neighbors" (set to $0.8$).
    2.  **Min Samples**: The minimum number of neighbors required to form a dense group (set to $8$).
    *   Any point that does not have enough neighbors, and is not close to a cluster, is labeled as **noise (-1)** and flagged as an outlier.

---

## 📊 The Noise Fingerprint Heatmap Matrix

When you look at the simplified homepage, you see a **Noise Fingerprint Heatmap Matrix** table. It rates every column in your dataset across 5 criteria. Here is what they mean and how they are calculated:

### A. Completeness
*   **What it means:** Are there blank cells or missing values in this column?
*   **Calculation:** The percentage of cells that are not empty or null. A score of $100\%$ means no missing data.
*   **Formula:**
    $$\text{Completeness}_j = \frac{\text{Total Rows} - \text{Null Rows}}{\text{Total Rows}} \times 100$$

### B. Type Consistency
*   **What it means:** Do the values match the column's data type? (e.g., If it's a numeric temperature column, is every cell actually a number, or did a text string sneak in?)
*   **Calculation:** The percentage of non-empty cells that conform to the expected format.
*   **Formula:**
    $$\text{Consistency}_j = \frac{\text{Valid Formatted Cells}}{\text{Populated Cells}} \times 100$$

### C. Anomaly Density
*   **What it means:** How much "strange/malfunctional" data is in this column?
*   **Calculation:** The percentage of rows where this column's values were flagged by the ensemble anomaly detection pipeline. Lower is better!
*   **Formula:**
    $$\text{Anomaly Density}_j = \frac{\text{Flagged Outlier Rows in Column } j}{\text{Total Rows}} \times 100$$

### D. Correlation Strength
*   **What it means:** Does this column change in sync with another column? (e.g., If temperature goes up, does pressure go up too?)
*   **Calculation:** It calculates the **Pearson correlation coefficient ($r$)** between this column and every other numeric column. It displays the absolute value of the strongest relationship (highest $r$).
*   **Formula:**
    $$r_{xy} = \frac{\sum (x - \bar{x})(y - \bar{y})}{\sqrt{\sum (x - \bar{x})^2 \sum (y - \bar{y})^2}}$$
    $$\text{Correlation Strength} = \max (|r_{xy}|) \times 100$$

### E. Entropy (Randomness Measure)
*   **What it means:** How chaotic or random are the values in this column?
*   **Calculation:** It uses **Shannon Entropy**, normalized between $0\%$ and $100\%$:
    *   **Low Entropy ($0 \%$)**: The column is highly predictable (e.g., a constant status column like "OK" repeating in every row).
    *   **High Entropy ($100 \%$)**: The column is highly random (e.g., a unique timestamp or noisy sensory reading where every value is unique).
*   **Formula:**
    $$H(X) = -\sum P(v) \log_2 P(v)$$
    $$\text{Normalized Entropy} = \frac{H(X)}{\log_2(\text{Number of Rows})} \times 100$$

---

## 🛠️ The Tech Stack (Under the Hood)

SmartStream is built on a modern, lightweight, and responsive stack:

1.  **Frontend (React + Vite):** A single-page web app built on React for dynamic interface updates, and Vite for compiling the JS/CSS bundles in milliseconds.
2.  **Charts (Recharts):** A charting library built on SVG that handles responsive rendering of the radar and circle gauge meters smoothly.
3.  **Database & Authentication (Supabase):** 
    *   **User Sessions:** Stores secure user profiles.
    *   **Staged Slots:** Keeps track of raw datasets, cleaned results, and statistics partitioned by user so your work is never lost.
4.  **Security (Web Crypto API):** Passwords are securely hashed using client-side SHA-256 before transmission, ensuring database leaks cannot compromise plain passwords.
5.  **Styling (Sleek Glassmorphism):** High-end dark mode color palettes constructed using tailored HSL CSS variables, featuring translucent cards, linear gradient buttons, and micro-interactions.
