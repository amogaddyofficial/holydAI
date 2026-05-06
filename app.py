from flask import Flask, render_template, request, jsonify
import torch
from transformers import pipeline
from duckduckgo_search import DDGS
import json
import os

app = Flask(__name__)

# Initialize AI Pipeline
print("Loading AI Model (SmolLM2-135M)... This might take a moment on first run.")
model_id = "HuggingFaceTB/SmolLM2-135M-Instruct"
try:
    generator = pipeline(
        "text-generation", 
        model=model_id, 
        device="cpu",
        torch_dtype=torch.float32,
        model_kwargs={"low_cpu_mem_usage": True}
    )
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    generator = None

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

    if not generator:
        return jsonify({"itinerary": "Modello AI non caricato. Installa le dipendenze con 'pip install torch transformers'."}), 500

    prompt = f"<|im_start|>system\nSei holydAI, l'assistente di viaggio più sofisticato al mondo. Il tuo stile è professionale, ispirante e lussuoso. Crei itinerari densi di dettagli in italiano.<|im_end|>\n"
    prompt += f"<|im_start|>user\nOrganizza un viaggio di {days} giorni a {dest}. Stile: {budget}. Passeggeri: {trip_type}. Interessi: {interests}. Dividi per 'Giorno X'.<|im_end|>\n<|im_start|>assistant\n"

    try:
        with torch.no_grad():
            sequences = generator(
                prompt,
                max_new_tokens=600,
                do_sample=True,
                temperature=0.8,
                top_p=0.95,
                return_full_text=False
            )
            itinerary = sequences[0]['generated_text']
    except Exception as e:
        itinerary = f"Errore locale: {str(e)}"

    # Simulated Geocoding
    coords = {"lat": 41.9028, "lon": 12.4964} 
    locations = {
        "venezia": {"lat": 45.4408, "lon": 12.3155}, "parigi": {"lat": 48.8566, "lon": 2.3522},
        "tokyo": {"lat": 35.6762, "lon": 139.6503}, "londra": {"lat": 51.5074, "lon": -0.1278},
        "new york": {"lat": 40.7128, "lon": -74.0060}, "roma": {"lat": 41.9028, "lon": 12.4964},
        "milano": {"lat": 45.4642, "lon": 9.1900}, "barcellona": {"lat": 41.3851, "lon": 2.1734}
    }
    for loc, c in locations.items():
        if loc in dest.lower():
            coords = c
            break

    return jsonify({"itinerary": itinerary, "coords": coords})

@app.route('/search_offers', methods=['POST'])
def search_offers():
    data = request.json
    dest = data.get('destination')
    budget = data.get('budget', 'medio')
    
    web_results = []
    try:
        with DDGS() as ddgs:
            query = f"offerte viaggio {dest} {budget} 2024 2025"
            results = ddgs.text(query, max_results=3)
            for r in results:
                web_results.append({"title": r['title'], "link": r['href'], "snippet": r['body'][:150] + "..."})
    except Exception as e:
        print(f"Web search error: {e}")

    booking_cards = [
        {"partner": "Skyscanner", "type": "Voli", "icon": "fas fa-plane", "url": f"https://www.skyscanner.it/search?q={dest}", "price_info": "Da 49€"},
        {"partner": "Booking.com", "type": "Hotel", "icon": "fas fa-hotel", "url": f"https://www.booking.com/searchresults.html?ss={dest}", "price_info": "Da 85€/notte"},
        {"partner": "Omio", "type": "Treni & Bus", "icon": "fas fa-train", "url": f"https://www.omio.it/search-frontend/results/L3796D56B/{dest}", "price_info": "Miglior Prezzo"}
    ]
    
    return jsonify({"cards": booking_cards, "web_results": web_results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
