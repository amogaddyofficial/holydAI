from flask import Flask, render_template, request, jsonify
import torch
from transformers import pipeline
from duckduckgo_search import DDGS
import json
import os
import gc

app = Flask(__name__)

# Model optimized for low RAM
model_id = "HuggingFaceTB/SmolLM2-135M-Instruct"

def get_generator():
    try:
        return pipeline(
            "text-generation", 
            model=model_id, 
            device="cpu",
            torch_dtype=torch.float32,
            model_kwargs={"low_cpu_mem_usage": True}
        )
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate', methods=['POST'])
def generate_itinerary():
    data = request.json
    dest = data.get('destination')
    days = data.get('duration')
    budget = data.get('budget')
    trip_type = data.get('trip_type')
    interests = data.get('interests', 'generali')

    # Load generator only when needed (Lazy Loading) to save startup memory
    generator = get_generator()
    if not generator:
        return jsonify({"itinerary": "Memoria insufficiente sul server per caricare l'AI locale."}), 500

    prompt = f"<|im_start|>system\nSei holydAI, assistente di viaggio premium. Scrivi in italiano.<|im_end|>\n"
    prompt += f"<|im_start|>user\nViaggio di {days} giorni a {dest}. Stile {budget}.<|im_end|>\n<|im_start|>assistant\n"

    try:
        with torch.no_grad():
            sequences = generator(
                prompt,
                max_new_tokens=400,
                do_sample=True,
                temperature=0.7,
                return_full_text=False
            )
            itinerary = sequences[0]['generated_text']
        
        # Free memory after generation
        del generator
        gc.collect()
        
    except Exception as e:
        itinerary = f"Errore server: {str(e)}"

    coords = {"lat": 41.9028, "lon": 12.4964}
    return jsonify({"itinerary": itinerary, "coords": coords})

@app.route('/search_offers', methods=['POST'])
def search_offers():
    data = request.json
    dest = data.get('destination')
    web_results = []
    try:
        with DDGS() as ddgs:
            results = ddgs.text(f"offerte {dest}", max_results=3)
            for r in results:
                web_results.append({"title": r['title'], "link": r['href'], "snippet": r['body'][:100]})
    except: pass

    booking_cards = [
        {"partner": "Booking.com", "type": "Hotel", "icon": "fas fa-hotel", "url": f"https://www.booking.com/searchresults.html?ss={dest}", "price_info": "Da 85€"}
    ]
    return jsonify({"cards": booking_cards, "web_results": web_results})

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True)
