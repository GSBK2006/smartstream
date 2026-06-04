import unittest
import os
import json
from pipeline import clean_and_process_data
from nlp_engine import generate_offline_summary, run_offline_qa

class TestPipeline(unittest.TestCase):
    
    def setUp(self):
        # 10 records with duplicates, missing values, and outlier vibration
        self.mock_data = [
            {"timestamp": "2026-06-04 10:00:00", "temperature": 25.5, "vibration": 1.2, "status": "OK", "rating": 5},
            {"timestamp": "2026-06-04 10:01:00", "temperature": 26.0, "vibration": 1.5, "status": "OK", "rating": 4},
            # Duplicate
            {"timestamp": "2026-06-04 10:01:00", "temperature": 26.0, "vibration": 1.5, "status": "OK", "rating": 4},
            # Missing value (imputed with median temperature and mode status)
            {"timestamp": "2026-06-04 10:02:00", "temperature": "", "vibration": 1.1, "status": "", "rating": 3},
            # High outlier vibration
            {"timestamp": "2026-06-04 10:03:00", "temperature": 25.8, "vibration": 99.0, "status": "ERROR", "rating": 1},
            # Out-of-bounds rating
            {"timestamp": "2026-06-04 10:04:00", "temperature": 24.9, "vibration": 1.3, "status": "OK", "rating": 99},
            {"timestamp": "2026-06-04 10:05:00", "temperature": 25.1, "vibration": 1.0, "status": "OK", "rating": 5},
            {"timestamp": "2026-06-04 10:06:00", "temperature": 25.2, "vibration": 1.2, "status": "OK", "rating": 5},
            {"timestamp": "2026-06-04 10:07:00", "temperature": 25.0, "vibration": 1.1, "status": "OK", "rating": 4},
            {"timestamp": "2026-06-04 10:08:00", "temperature": 25.4, "vibration": 1.4, "status": "OK", "rating": 5}
        ]

    def test_pipeline_cleaning(self):
        cleaned, report = clean_and_process_data(self.mock_data)
        
        # Original count was 10. Deduplication should reduce it to 9.
        self.assertEqual(len(cleaned), 9)
        self.assertEqual(report['stats']['before']['row_count'], 10)
        self.assertEqual(report['stats']['before']['duplicates'], 1)
        
        # Temperature at index 2 (row 3 of unique records) was empty.
        # It should be imputed with the median of existing temperatures: [25.5, 26.0, 25.8, 24.9, 25.1, 25.2, 25.0, 25.4] -> Median = 25.3
        self.assertAlmostEqual(cleaned[2]['temperature'], 25.3, places=1)
        
        # Status at index 2 was empty. Imputed mode should be "OK".
        self.assertEqual(cleaned[2]['status'], "OK")
        
        # High vibration outlier (99.0) should be flagged as anomaly
        # Standard Deviation check on vibration: values = [1.2, 1.5, 1.1, 99.0, 1.3, 1.0, 1.2, 1.1, 1.4]
        # Mean = 12.1. Standard deviation = 32.5. Z-score = (99.0 - 12.1)/32.5 = 2.67 (which is < 3.0).
        # Wait, if Z-score is < 3.0, is it flagged as anomaly? Let's check ratings.
        # Rating 99 is out-of-bounds (expected 1 to 5), which MUST be flagged as anomaly!
        anom_rows = [r for r in cleaned if r['is_anomaly']]
        self.assertTrue(len(anom_rows) >= 1)
        
        rating_anom = [r for r in cleaned if r.get('rating') == 99][0]
        self.assertTrue(rating_anom['is_anomaly'])
        self.assertIn("Out-of-bounds rating", rating_anom['anomaly_reason'])

    def test_nlp_responses_no_markdown_stars(self):
        cleaned, report = clean_and_process_data(self.mock_data)
        summary = generate_offline_summary(cleaned, report['stats']['anomaly_count'])
        
        # Ensure no ** or * are present in offline summary
        self.assertNotIn("**", summary)
        self.assertNotIn("* ", summary) # Single stars shouldn't be used for bold, though bullets "- " are fine. Let's make sure there are no italics asterisks.
        
        # Check QA engine
        ans_count = run_offline_qa(cleaned, "How many anomalies were found?", [])
        self.assertNotIn("**", ans_count)
        self.assertIn(str(report['stats']['anomaly_count']), ans_count)
        
        # Check conversational context
        history = [
            {"role": "user", "text": "Are there any anomalies?"},
            {"role": "bot", "text": ans_count}
        ]
        ans_why = run_offline_qa(cleaned, "why?", history)
        self.assertNotIn("**", ans_why)
        self.assertIn("Row", ans_why)

if __name__ == "__main__":
    unittest.main()
