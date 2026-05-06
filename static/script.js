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

document.getElementById('travel-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // UI Feedback
    document.getElementById('loader').style.display = 'block';
    document.getElementById('main-content').style.display = 'none';

    try {
        const [genResponse, offersResponse] = await Promise.all([
            fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }),
            fetch('/search_offers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
        ]);

        const genResult = await genResponse.json();
        const offersResult = await offersResponse.json();

        // Show Content
        document.getElementById('loader').style.display = 'none';
        const mainContent = document.getElementById('main-content');
        mainContent.style.display = 'grid';

        // Render Itinerary
        const itineraryContent = document.getElementById('itinerary-content');
        itineraryContent.innerHTML = formatPremiumItinerary(genResult.itinerary);
        
        // Initialize Map
        if (genResult.coords) {
            initMap(genResult.coords.lat, genResult.coords.lon);
            // Ensure map fills container correctly after display:grid
            setTimeout(() => map.invalidateSize(), 100);
            
            addAnimatedMarker(genResult.coords.lat, genResult.coords.lon, data.destination);
            
            // Add some "simulated" POI markers around the destination
            const offset = 0.01;
            addAnimatedMarker(genResult.coords.lat + offset, genResult.coords.lon + offset, "Attrazione 1");
            addAnimatedMarker(genResult.coords.lat - offset, genResult.coords.lon - offset, "Attrazione 2");
            
            // Draw path
            const pathPoints = [
                [genResult.coords.lat, genResult.coords.lon],
                [genResult.coords.lat + offset, genResult.coords.lon + offset],
                [genResult.coords.lat - offset, genResult.coords.lon - offset]
            ];
            routeLine = L.polyline(pathPoints, { color: 'var(--secondary)', weight: 3, dashArray: '5, 10', opacity: 0.6 }).addTo(map);
        }

        // Render Booking Cards
        const arsenal = document.getElementById('booking-arsenal');
        arsenal.innerHTML = '';
        
        offersResult.cards.forEach(card => {
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

        // Show Smart Insights (Demo Logic)
        const insights = document.getElementById('smart-insights');
        const insightsContent = document.getElementById('insights-content');
        insights.style.display = 'block';
        insightsContent.innerHTML = `
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 0.5rem;"><i class="fas fa-magic" style="color: var(--accent);"></i> Itinerario ottimizzato per evitare folle locali.</li>
                <li style="margin-bottom: 0.5rem;"><i class="fas fa-leaf" style="color: #4caf50;"></i> Scelte eco-friendly identificate in ${data.destination}.</li>
                <li><i class="fas fa-coins" style="color: #ffb100;"></i> Risparmio stimato del 15% sulle tariffe standard.</li>
            </ul>
        `;

        // Render Real Web Results
        const webSection = document.getElementById('web-results-section');
        const webGrid = document.getElementById('web-results-grid');
        webGrid.innerHTML = '';
        
        if (offersResult.web_results && offersResult.web_results.length > 0) {
            webSection.style.display = 'block';
            offersResult.web_results.forEach(res => {
                const resEl = document.createElement('div');
                resEl.style.padding = '1rem';
                resEl.style.background = 'white';
                resEl.style.borderRadius = '12px';
                resEl.style.border = '1px solid rgba(0,0,0,0.05)';
                resEl.innerHTML = `
                    <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 0.3rem;">
                        <a href="${res.link}" target="_blank" style="color: var(--secondary); text-decoration: none;">${res.title}</a>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-dim); line-height: 1.4;">${res.snippet}</div>
                `;
                webGrid.appendChild(resEl);
            });
        } else {
            webSection.style.display = 'none';
        }

    } catch (error) {
        console.error(error);
        alert('Si è verificato un errore. Riprova più tardi.');
        document.getElementById('loader').style.display = 'none';
    }
});

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
