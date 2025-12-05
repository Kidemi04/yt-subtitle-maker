import whisper
try:
    print("Available models:", whisper.available_models())
    if "turbo" in whisper._MODELS:
        print("Turbo URL:", whisper._MODELS["turbo"])
    elif "large-v3-turbo" in whisper._MODELS:
        print("Large-v3-turbo URL:", whisper._MODELS["large-v3-turbo"])
    else:
        print("Turbo model not found in _MODELS")
        print("Keys:", whisper._MODELS.keys())
except Exception as e:
    print(e)
