from flask import Flask, render_template, request, jsonify
import requests
import json
import os
from duckduckgo_search import DDGS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# GenerAI API Configuration
GENERAI_API_URL = "https://amogaddy-generai.hf.space/ask"

# Mistral Fallback Configuration
MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")

def query_ai(prompt):
    # Try GenerAI first
    payload = {"prompt": prompt}
    try:
        response = requests.post(GENERAI_API_URL, json=payload, timeout=10)
        result = response.json()
        if result.get('result') and "Non ho trovato informazioni" not in result.get('result'):
            return result.get('result')
    except Exception as e:
        print(f"GenerAI Error: {e}")

    # Fallback to Mistral (Ministral)
    print("Falling back to Mistral...")
    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json"
    }
    mistral_payload = {
        "model": "ministral-3b-latest",
        "messages": [{"role": "user", "content": prompt}]
    }
    try:
        response = requests.post(MISTRAL_API_URL, headers=headers, json=mistral_payload, timeout=15)
        result = response.json()
        return result['choices'][0]['message']['content']
    except Exception as e:
        print(f"Mistral API Error: {e}")
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

    prompt = f"Sei holydAI, l'assistente di viaggio più lussuoso al mondo. Crea un itinerario dettagliato per un viaggio di {days} giorni a {dest}. Stile: {budget}. Passeggeri: {trip_type}. Interessi: {interests}. Dividi la risposta per 'Giorno X'."

    itinerary = query_ai(prompt)
    if not itinerary:
        itinerary = "Il servizio AI è momentaneamente occupato. Riprova tra pochi secondi."

    # Coordinates
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
    web_results = []
    try:
        with DDGS() as ddgs:
            results = ddgs.text(f"offerte viaggio {dest}", max_results=3)
            for r in results:
                web_results.append({"title": r['title'], "link": r['href'], "snippet": r['body'][:150] + "..."})
    except: pass

    booking_cards = [
        {"partner": "Skyscanner", "type": "Voli", "icon": "fas fa-plane", "url": f"https://www.skyscanner.it/search?q={dest}", "price_info": "Da 49€"},
        {"partner": "Booking.com", "type": "Hotel", "icon": "fas fa-hotel", "url": f"https://www.booking.com/searchresults.html?ss={dest}", "price_info": "Da 85€/notte"},
        {"partner": "Omio", "type": "Treni & Bus", "icon": "fas fa-train", "url": f"https://www.omio.it/search-frontend/results/L3796D56B/{dest}", "price_info": "Miglior Prezzo"}
    ]
    return jsonify({"cards": booking_cards, "web_results": web_results})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
