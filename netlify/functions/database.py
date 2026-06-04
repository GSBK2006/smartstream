import os
import hashlib
import secrets
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Default fallbacks for easy Netlify zero-config deployment
DEFAULT_URL = "https://fmhbqtbohyrhiyhthpmv.supabase.co"
DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtaGJxdGJvaHlyaGl5aHRocG12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzQwNTMsImV4cCI6MjA5NjE1MDA1M30.73NwxImAzCNk5JFbhNntMBxh3dpubi_1TDyHxIfJYjY"

SUPABASE_URL = os.environ.get("SUPABASE_URL") or DEFAULT_URL
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or DEFAULT_KEY

_supabase = None

def get_supabase() -> Client:
    """
    Initialize and return the Supabase client.
    """
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL") or DEFAULT_URL
        key = os.environ.get("SUPABASE_KEY") or DEFAULT_KEY
        _supabase = create_client(url, key)
    return _supabase

def hash_password(password: str) -> str:
    """
    Securely hash a password using PBKDF2.
    """
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"pbkdf2_sha256$100000${salt}${key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a PBKDF2 hashed password.
    """
    try:
        parts = hashed.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        iterations = int(parts[1])
        salt = parts[2]
        stored_key = parts[3]
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations)
        return key.hex() == stored_key
    except Exception:
        return False

def init_db():
    """
    Supabase initialization check.
    """
    try:
        get_supabase()
        print("Supabase client initialized successfully.")
    except Exception as e:
        print(f"Warning: Supabase client initialization failed: {e}")

def register_user(username, password):
    """
    Register a new user in the Supabase users table.
    Returns: (success, message)
    """
    username = username.strip().lower()
    if not username or not password:
        return False, "Username and password cannot be empty."
        
    pwd_hash = hash_password(password)
    
    try:
        supabase = get_supabase()
        # Check if user already exists
        res = supabase.table("users").select("username").eq("username", username).execute()
        if res.data and len(res.data) > 0:
            return False, "Username already exists."
            
        # Insert new user
        supabase.table("users").insert({
            "username": username,
            "password_hash": pwd_hash
        }).execute()
        
        return True, "User registered successfully."
    except Exception as e:
        return False, f"Supabase registration error: {str(e)}"

def verify_user(username, password):
    """
    Verify user credentials in the Supabase users table.
    Returns: (success, user_dict_or_error_msg)
    """
    username = username.strip().lower()
    try:
        supabase = get_supabase()
        res = supabase.table("users").select("username", "password_hash").eq("username", username).execute()
        
        if res.data and len(res.data) > 0:
            db_user = res.data[0]
            db_username = db_user["username"]
            db_pwd_hash = db_user["password_hash"]
            
            if verify_password(password, db_pwd_hash):
                return True, {"username": db_username}
            else:
                return False, "Incorrect password."
        else:
            return False, "Username not found."
    except Exception as e:
        return False, f"Supabase verification error: {str(e)}"

def save_staged_data(username, target, raw_data, raw_stats, cleaned_data=None, report=None):
    """
    Save staged CSV/JSON data for a user in the Supabase staged_data table.
    """
    try:
        supabase = get_supabase()
        payload = {
            "username": username,
            "target": target,
            "raw_data": raw_data,
            "raw_stats": raw_stats,
            "cleaned_data": cleaned_data,
            "report": report
        }
        supabase.table("staged_data").upsert(payload).execute()
        return True, "Staged data saved successfully."
    except Exception as e:
        return False, f"Supabase save staged data error: {str(e)}"

def get_staged_data(username, target):
    """
    Retrieve staged data for a user in the Supabase staged_data table.
    """
    try:
        supabase = get_supabase()
        res = supabase.table("staged_data").select("*").eq("username", username).eq("target", target).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        print(f"Error fetching staged data: {e}")
        return None

def clear_staged_data(username):
    """
    Clear all staged data for a user in Supabase.
    """
    try:
        supabase = get_supabase()
        supabase.table("staged_data").delete().eq("username", username).execute()
        return True, "Staged data cleared successfully."
    except Exception as e:
        return False, f"Supabase clear error: {str(e)}"
