import os
import google.generativeai as genai

# Try to get the key from the environment
api_key = os.environ.get('GEMINI_API_KEY')

if not api_key:
    print("GEMINI_API_KEY environment variable is not set.")
    api_key = input("Please paste your Gemini API Key here: ").strip()

if not api_key:
    print("No API key provided. Exiting.")
    exit(1)

print("\nConfiguring Gemini API client...")
genai.configure(api_key=api_key)

try:
    print("\nQuerying available models on your account:")
    models = list(genai.list_models())
    generate_models = [m for m in models if 'generateContent' in m.supported_generation_methods]
    
    if generate_models:
        print(f"Found {len(generate_models)} models supporting content generation:")
        for m in generate_models:
            # Strip the 'models/' prefix for readability if present
            name_clean = m.name.replace('models/', '')
            print(f"  - {name_clean} (Full: {m.name})")
    else:
        print("No models found supporting generateContent.")
        
except Exception as e:
    print(f"\n❌ Error listing models: {e}")
    print("Please verify that your API key is valid and has not expired.")
