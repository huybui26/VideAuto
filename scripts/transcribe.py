#!/usr/bin/env python3
import sys
import json
import warnings
warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing audio path"}))
        sys.exit(1)
        
    audio_path = sys.argv[1]
    
    try:
        from transformers import pipeline
        # Use whisper-tiny. It's ~150MB, fast enough on CPU.
        pipe = pipeline("automatic-speech-recognition", model="openai/whisper-tiny", device="cpu")
        result = pipe(audio_path, return_timestamps="word")
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
