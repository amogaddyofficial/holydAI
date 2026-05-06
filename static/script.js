let map;
let markers = [];
let routeLine;

// Initialize Map with custom style
function initMap(lat = 41.9028, lon = 12.4964) {
    if (!map) {
        map = L.map('map', {
            zoomControl: false,
            scrollWheelZoom: false
        }).setView([lat, lon], 12);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
    } else {
        map.setView([lat, lon], 12);
    }
    
    // Clear previous markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (routeLine) map.removeLayer(routeLine);
}

// Add animated marker
function addAnimatedMarker(lat, lon, title) {
    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: var(--secondary); width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,113,227,0.5); animation: pulse 2s infinite;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    const marker = L.marker([lat, lon], { icon }).addTo(map)
        .bindPopup(`<strong>${title}</strong>`);
    markers.push(marker);
    return marker;
}

// Persistent State Management
let currentItineraryData = null;

function saveToLocalStorage(data) {
    localStorage.setItem('holydai_saved_trip', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('holydai_saved_trip');
    if (saved) {
        currentItineraryData = JSON.parse(saved);
        renderItineraryState(currentItineraryData);
    }
}

function renderItineraryState(data) {
    if (!data) return;
    
    document.getElementById('main-content').style.display = 'grid';
    document.getElementById('itinerary-content').innerHTML = formatPremiumItinerary(data.itinerary);
    
    // Map
    if (data.coords) {
        initMap(data.coords.lat, data.coords.lon);
        setTimeout(() => map.invalidateSize(), 100);
        addAnimatedMarker(data.coords.lat, data.coords.lon, data.destination || 'Destinazione');
    }

    // Booking Cards
    const arsenal = document.getElementById('booking-arsenal');
    arsenal.innerHTML = '';
    data.cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'booking-card';
        cardEl.onclick = () => window.open(card.url, '_blank');
        cardEl.innerHTML = `
            <div class="verified-badge" style="background: #fff3e0; color: #ff9800;"><i class="fas fa-hourglass-start"></i> Target Partner</div>
            <i class="${card.icon}"></i>
            <span>${card.type}</span>
            <div class="partner-name">${card.partner}</div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--secondary); margin-top: 0.5rem;">${card.price_info}</div>
            <div class="commission-info" style="display: ${partnerMode ? 'block' : 'none'}; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ddd; font-size: 0.7rem; color: #4caf50; font-weight: 700;">
                <i class="fas fa-chart-line"></i> Est. Comm: 5-12%
            </div>
        `;
        arsenal.appendChild(cardEl);
    });

    // Web Results
    const webSection = document.getElementById('web-results-section');
    const webGrid = document.getElementById('web-results-grid');
    webGrid.innerHTML = '';
    if (data.web_results && data.web_results.length > 0) {
        webSection.style.display = 'block';
        data.web_results.forEach(res => {
            const resEl = document.createElement('div');
            resEl.className = 'glass-card'; // Reuse style
            resEl.style.padding = '1rem';
            resEl.style.marginBottom = '1rem';
            resEl.innerHTML = `
                <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.3rem;">
                    <a href="${res.link}" target="_blank" style="color: var(--secondary); text-decoration: none;">${res.title}</a>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-dim); line-height: 1.4;">${res.snippet}</div>
            `;
            webGrid.appendChild(resEl);
        });
    }

    // Insights
    document.getElementById('smart-insights').style.display = 'block';
    document.getElementById('insights-content').innerHTML = `
        <ul style="list-style: none; padding: 0;">
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-magic" style="color: var(--accent);"></i> Itinerario ottimizzato.</li>
            <li style="margin-bottom: 0.5rem;"><i class="fas fa-leaf" style="color: #4caf50;"></i> Scelte eco-friendly identificate.</li>
            <li><i class="fas fa-coins" style="color: #ffb100;"></i> Risparmio stimato del 15%.</li>
        </ul>
    `;
}

// Main Form Logic
document.getElementById('travel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        destination: document.getElementById('destination').value,
        duration: document.getElementById('duration').value,
        budget: document.getElementById('budget').value,
        trip_type: document.getElementById('trip_type').value,
        interests: document.getElementById('interests').value
    };

    document.getElementById('loader').style.display = 'block';
    document.getElementById('main-content').style.display = 'none';

    try {
        const [genRes, offersRes] = await Promise.all([
            fetch('/generate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            }),
            fetch('/search_offers', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            })
        ]);

        const genResult = await genRes.json();
        const offersResult = await offersRes.json();

        currentItineraryData = {
            ...data,
            itinerary: genResult.itinerary,
            coords: genResult.coords,
            cards: offersResult.cards,
            web_results: offersResult.web_results
        };

        document.getElementById('loader').style.display = 'none';
        renderItineraryState(currentItineraryData);
        saveToLocalStorage(currentItineraryData);

    } catch (error) {
        console.error(error);
        alert('Si è verificato un errore.');
        document.getElementById('loader').style.display = 'none';
    }
});

// Import/Export Logic
document.getElementById('export-btn').addEventListener('click', () => {
    if (!currentItineraryData) return alert('Nessun itinerario da esportare.');
    const blob = new Blob([JSON.stringify(currentItineraryData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holydAI_${currentItineraryData.destination.replace(/\s+/g, '_')}.json`;
    a.click();
});

document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            currentItineraryData = data;
            renderItineraryState(data);
            saveToLocalStorage(data);
            alert('Itinerario importato con successo!');
        } catch (err) {
            alert('File non valido.');
        }
    };
    reader.readAsText(file);
});

// Initialize
window.onload = loadFromLocalStorage;

// Share Button Feedback
document.getElementById('share-btn').addEventListener('click', function() {
    const btn = this;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        const originalText = btn.innerText;
        btn.innerText = 'COPIATO!';
        btn.style.background = 'var(--secondary)';
        btn.style.color = 'white';
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = 'white';
            btn.style.color = 'var(--secondary)';
        }, 2000);
    });
});

let partnerMode = false;

document.getElementById('partner-mode-toggle').addEventListener('click', () => {
    partnerMode = !partnerMode;
    const switchEl = document.getElementById('toggle-switch');
    const knob = document.getElementById('toggle-knob');
    
    if (partnerMode) {
        switchEl.style.background = 'var(--secondary)';
        knob.style.left = '16px';
        document.querySelectorAll('.commission-info').forEach(el => el.style.display = 'block');
    } else {
        switchEl.style.background = '#ccc';
        knob.style.left = '2px';
        document.querySelectorAll('.commission-info').forEach(el => el.style.display = 'none');
    }
});

function formatPremiumItinerary(text) {
    if (!text) return 'Nessun itinerario disponibile.';
    
    // Replace markdown bold
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace bullet points
    html = html.replace(/^\s*-\s+(.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul style="padding-left: 1.2rem; margin-top: 0.5rem;">$1</ul>');

    // Split by Days
    const days = html.split(/(Giorno \d+:)/gi);
    let finalHtml = '';

    for (let i = 1; i < days.length; i += 2) {
        const header = days[i];
        const content = days[i+1] || '';
        
        finalHtml += `
            <div class="day-card">
                <h3>${header.replace(':', '')}</h3>
                <p>${content.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }

    if (finalHtml === '') {
        finalHtml = `<div class="day-card"><p>${html.replace(/\n/g, '<br>')}</p></div>`;
    }

    return finalHtml;
}

document.getElementById('download-btn').addEventListener('click', () => {
    const content = document.getElementById('itinerary-content').innerText;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holydai_itinerary.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
});

// Pulse animation for markers
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);
