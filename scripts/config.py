FPS = "2fps"
MODELS = ["gemini", "qwen3vl", "gpt", "llama", "claude"]
# Maps logical model name -> HuggingFace CSV filename prefix (if different)
HF_PREFIXES = {
    "llama": "llama4_scout",
    "claude": "claude_sonnet46",
}
VERSION = "v3"
VIDEO_FILENAME = "animation_30fps.mp4"
PROLIFIC_LINK = "https://app.prolific.com/submissions/complete?cc=CCRO1X41"

HF_BASE = "https://huggingface.co/datasets/anim2code/baselines/resolve/main"
FIREBASE_KEY = "firebase_key.json"
DATA_DIR = "data"
