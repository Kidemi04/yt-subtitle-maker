import json
import google.generativeai as genai
from typing import List, Dict
import time

def translate_segments_with_gemini(
    segments: List[Dict],
    target_lang: str,
    api_key: str,
    model_name: str = "gemini-2.5-flash-lite",
    progress_callback = None,
) -> None:
    """
    Mutates the `segments` list in-place, adding 'translated' for each segment.
    progress_callback: function(current_batch_index, total_batches)
    """
    if not api_key:
        raise ValueError("Gemini API key is required for translation.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    # Batch size
    BATCH_SIZE = 30
    
    total_segments = len(segments)
    total_batches = (total_segments + BATCH_SIZE - 1) // BATCH_SIZE
    
    for batch_idx, i in enumerate(range(0, total_segments, BATCH_SIZE)):
        if progress_callback:
            progress_callback(batch_idx, total_batches)
            
        batch = segments[i : i + BATCH_SIZE]
        
        # Prepare input for Gemini
        # We only send ID and text to save tokens and context
        input_data = [{"id": seg["id"], "text": seg["text"]} for seg in batch]
        
        prompt = f"""
        You are a professional subtitle translator.
        Translate the following subtitles into {target_lang}.
        
        Input is a JSON array of objects with 'id' and 'text'.
        Output MUST be a valid JSON array of objects with 'id' and 'translated'.
        
        Rules:
        1. Keep 'id' exactly the same.
        2. Do not merge or split items. The number of output items must match input.
        3. Make translations suitable for video subtitles (concise, natural).
        4. Output ONLY the JSON array, no markdown formatting or backticks.
        
        Input:
        {json.dumps(input_data, ensure_ascii=False)}
        """
        
        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Clean up potential markdown code blocks if Gemini adds them
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            translated_batch = json.loads(response_text)
            
            # Map back to segments
            # Create a map for O(1) lookup
            trans_map = {item["id"]: item.get("translated", "") for item in translated_batch}
            
            for seg in batch:
                seg_id = seg["id"]
                if seg_id in trans_map:
                    seg["translated"] = trans_map[seg_id]
                else:
                    # Fallback if ID missing
                    seg["translated"] = "[Translation Error]"
                    
            # Rate limiting / politeness
            time.sleep(1)
            
        except Exception as e:
            # If a batch fails, we mark them as failed but continue?
            # Or raise? Let's log and mark as error in text.
            print(f"Batch translation failed: {e}")
            for seg in batch:
                seg["translated"] = f"[Translation Failed: {str(e)}]"
            # We might want to re-raise if it's an auth error, but for now continue
            if "API_KEY" in str(e).upper():
                raise e

def test_gemini_api_key(api_key: str, model_name: str = "gemini-2.5-flash-lite") -> bool:
    """
    Test if the provided Gemini API key is valid by making a small request.
    Returns True if successful, raises exception otherwise.
    """
    if not api_key:
        raise ValueError("API key is empty.")
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    
    try:
        # Generate a very short response to test auth
        response = model.generate_content("Say OK")
        return True
    except Exception as e:
        raise Exception(f"API Key Test Failed: {str(e)}")
    except Exception as e:
        raise Exception(f"API Key Test Failed: {str(e)}")

def translate_title_with_gemini(
    title: str,
    target_lang: str,
    api_key: str,
    model_name: str = "gemini-2.5-flash-lite",
) -> str:
    """
    Use Gemini to translate a short video title into the target language.
    """
    if not api_key:
        raise ValueError("Gemini API key is required.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    
    prompt = f"""
    You are a translation assistant.
    Translate this YouTube video title into {target_lang}.
    Keep the original meaning and style.
    Return ONLY the translated title text, no explanation or quotes.
    
    Original Title: {title}
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        raise Exception(f"Title Translation Failed: {str(e)}")
