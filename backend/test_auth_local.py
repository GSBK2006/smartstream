import requests

BASE_URL = "http://localhost:5000"

def test_auth():
    print("Testing local Flask authentication endpoints...")
    
    # Try register
    payload = {
        "username": "test_verification_user",
        "password": "securepassword123"
    }
    
    try:
        r = requests.post(f"{BASE_URL}/api/register", json=payload)
        print(f"Register response status: {r.status_code}")
        print(f"Register response body: {r.text}")
        
        # Try login
        r2 = requests.post(f"{BASE_URL}/api/login", json=payload)
        print(f"Login response status: {r2.status_code}")
        print(f"Login response body: {r2.text}")
        
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_auth()
