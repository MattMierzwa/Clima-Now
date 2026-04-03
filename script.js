// Configuração da API (MANTIDA ORIGINAL)
const API_KEY = 'fb5da73546482815b42af679e90b0b4f'; 
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Elementos DOM
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const loading = document.getElementById('loading');
const weatherContent = document.getElementById('weatherContent');
const welcomeScreen = document.getElementById('welcomeScreen');
const errorMessage = document.getElementById('errorMessage');

// Variáveis globais
let currentCity = '';
let currentData = null;
let forecastData = null;
let chartInstance = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadLastCity();
    loadFavorites();
    updateDate();
});

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) getWeather(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) getWeather(city);
    }
});

function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if(dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('pt-BR', options);
    }
}

// ========== FUNÇÃO PRINCIPAL ==========
async function getWeather(city) {
    showLoading();
    currentCity = city;
    
    try {
        // Busca paralela para performance
        const [currentWeather, forecast] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric&lang=pt_br`),
            fetch(`${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&units=metric&lang=pt_br&cnt=40`)
        ]);

        if (!currentWeather.ok || !forecast.ok) {
            throw new Error('Cidade não encontrada');
        }

        currentData = await currentWeather.json();
        forecastData = await forecast.json();

        // Atualizar Interface
        updateCurrentWeather(currentData);
        updateHourlyForecast(forecastData);
        updateDailyForecast(forecastData);
        updateExtraInfo(currentData, forecastData);
        updateMap(currentData.coord.lat, currentData.coord.lon);
        updateChart('hourly');
        checkWeatherAlerts(currentData, forecastData);
        updateRecommendations(currentData);
        checkIfFavorite(currentData.name);

        localStorage.setItem('lastCity', city);
        
        hideLoading();
        showWeatherContent();
        
    } catch (error) {
        console.error('Erro:', error);
        showError();
    }
}

// ========== ATUALIZAÇÃO DA UI ==========
function updateCurrentWeather(data) {
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('country').textContent = data.sys.country;
    document.getElementById('temp').textContent = Math.round(data.main.temp);
    document.getElementById('weatherDesc').textContent = data.weather[0].description;
    
    const iconCode = data.weather[0].icon;
    document.getElementById('weatherIcon').src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
}

function updateHourlyForecast(data) {
    const container = document.getElementById('hourlyContainer');
    container.innerHTML = '';
    
    // Pega as próximas 8 previsões (3 horas cada = 24h)
    const hourlyData = data.list.slice(0, 8);
    
    hourlyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const hour = date.getHours().toString().padStart(2, '0') + ':00';
        
        const div = document.createElement('div');
        div.className = 'hour-card-mini';
        div.innerHTML = `
            <span>${hour}</span>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="Icon" width="30">
            <strong>${Math.round(item.main.temp)}°</strong>
        `;
        container.appendChild(div);
    });
}

function updateDailyForecast(data) {
    const container = document.getElementById('dailyContainer');
    container.innerHTML = '';
    
    const dailyData = {};
    
    // Agrupa por dia
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'short' });
        if (!dailyData[date]) {
            dailyData[date] = {
                temps: [],
                weather: item.weather[0],
                icon: item.weather[0].icon
            };
        }
        dailyData[date].temps.push(item.main.temp);
    });
    
    Object.entries(dailyData).slice(0, 5).forEach(([day, info]) => {
        const max = Math.max(...info.temps);
        const min = Math.min(...info.temps);
        
        const row = document.createElement('div');
        row.className = 'day-row';
        row.innerHTML = `
            <span style="text-transform: capitalize; width: 60px;">${day}</span>
            <div style="display:flex; align-items:center; gap:5px;">
                <img src="https://openweathermap.org/img/wn/${info.icon}.png" width="30" alt="icon">
                <span style="font-size:0.9rem; color:var(--text-secondary)">${info.weather.description}</span>
            </div>
            <div style="font-weight:600;">
                ${Math.round(max)}° <span style="color:var(--text-secondary); font-weight:400; font-size:0.8rem;">/ ${Math.round(min)}°</span>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateExtraInfo(current, forecast) {
    const sunrise = new Date(current.sys.sunrise * 1000);
    const sunset = new Date(current.sys.sunset * 1000);
    
    document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('sunset').textContent = sunset.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    
    document.getElementById('maxTemp').textContent = Math.round(current.main.temp_max);
    document.getElementById('minTemp').textContent = Math.round(current.main.temp_min);
    document.getElementById('wind').textContent = Math.round(current.wind.speed * 3.6) + ' km/h';
    document.getElementById('humidity').textContent = current.main.humidity + '%';
    document.getElementById('pressure').textContent = current.main.pressure + ' hPa';
    document.getElementById('visibility').textContent = (current.visibility / 1000).toFixed(1) + ' km';
    document.getElementById('feelsLikeCard').textContent = Math.round(current.main.feels_like) + '°C';
}

function updateMap(lat, lon) {
    const mapFrame = document.getElementById('mapFrame');
    // Usando OpenStreetMap embed simples
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.05},${lat-0.05},${lon+0.05},${lat+0.05}&layer=mapnik&marker=${lat},${lon}`;
}

// ========== GRÁFICOS (Chart.js) ==========
function updateChart(type) {
    if (!forecastData) return;
    
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy();
    
    let labels = [];
    let temps = [];
    
    // Configuração de cores baseada no tema
    const isDark = !document.body.classList.contains('light-theme');
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    if (type === 'hourly') {
        labels = forecastData.list.slice(0, 8).map(i => {
            const d = new Date(i.dt * 1000);
            return `${d.getHours()}h`;
        });
        temps = forecastData.list.slice(0, 8).map(i => i.main.temp);
    } else {
        // Daily aggregation logic simplified for chart
        const daily = {};
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'short' });
            if(!daily[date]) daily[date] = [];
            daily[date].push(item.main.temp);
        });
        labels = Object.keys(daily).slice(0, 5);
        temps = Object.values(daily).slice(0, 5).map(arr => Math.max(...arr));
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura',
                data: temps,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

function changeChart(type, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    updateChart(type);
}

// ========== ALERTAS E RECOMENDAÇÕES ==========
function checkWeatherAlerts(current, forecast) {
    const banner = document.getElementById('alertsBanner');
    const msg = document.getElementById('alertMessage');
    const alerts = [];

    if (current.main.temp > 30) alerts.push("Calor intenso. Hidrate-se!");
    if (current.main.temp < 15) alerts.push("Frio detectado. Agasalhe-se.");
    if (current.wind.speed > 10) alerts.push("Ventos fortes.");
    if (forecast.list[0].pop > 0.6) alerts.push("Alta chance de chuva.");

    if (alerts.length > 0) {
        msg.textContent = alerts.join(" • ");
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function closeAlerts() {
    document.getElementById('alertsBanner').classList.add('hidden');
}

function updateRecommendations(data) {
    const container = document.getElementById('recommendations');
    const temp = data.main.temp;
    let html = '';

    if (temp > 25) html += `<div class="rec-item">🕶️ Ótimo dia para atividades ao ar livre.</div>`;
    if (data.main.humidity > 70) html += `<div class="rec-item">💧 Ar úmido. Cuidado com alergias.</div>`;
    if (data.wind.speed * 3.6 > 20) html += `<div class="rec-item">🍃 Vento moderado, bom para ventilar a casa.</div>`;
    
    if (html === '') html = `<div class="rec-item">☀️ Clima agradável. Aproveite!</div>`;
    
    container.innerHTML = html;
}

// ========== COMPARAÇÃO E FAVORITOS ==========
async function compareCities() {
    const c1 = document.getElementById('compareCity1').value;
    const c2 = document.getElementById('compareCity2').value;
    const resDiv = document.getElementById('comparisonResult');
    
    try {
        const [d1, d2] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${c1}&appid=${API_KEY}&units=metric`),
            fetch(`${BASE_URL}/weather?q=${c2}&appid=${API_KEY}&units=metric`)
        ]);
        
        const w1 = await d1.json();
        const w2 = await d2.json();
        
        resDiv.classList.remove('hidden');
        resDiv.innerHTML = `
            <div style="display:flex; justify-content:space-around; margin-top:15px; text-align:center;">
                <div>
                    <h4>${w1.name}</h4>
                    <div style="font-size:1.5rem; color:var(--accent-color)">${Math.round(w1.main.temp)}°C</div>
                </div>
                <div style="align-self:center; color:var(--text-secondary)">VS</div>
                <div>
                    <h4>${w2.name}</h4>
                    <div style="font-size:1.5rem; color:var(--accent-color)">${Math.round(w2.main.temp)}°C</div>
                </div>
            </div>
        `;
    } catch(e) { alert('Erro ao comparar cidades'); }
}

function toggleComparison() {
    document.getElementById('comparisonContent').classList.toggle('hidden');
}

function checkIfFavorite(city) {
    // Lógica simplificada para UI
    const favSection = document.querySelector('.favorites-card h3');
    if(favorites.includes(city)) {
        favSection.innerHTML = '<i class="fas fa-star" style="color:#fbbf24"></i> Favoritos';
    } else {
        favSection.innerHTML = '<i class="far fa-star"></i> Favoritos';
        // Adiciona botão rápido para favoritar no Hero se não for favorito
        const hero = document.querySelector('.hero-header');
        if(!document.getElementById('addFavBtn')) {
            const btn = document.createElement('button');
            btn.id = 'addFavBtn';
            btn.innerHTML = '<i class="far fa-bookmark"></i>';
            btn.style.cssText = "background:none; border:none; color:white; cursor:pointer; font-size:1.2rem;";
            btn.onclick = () => { toggleFavorite(city); btn.remove(); };
            hero.appendChild(btn);
        }
    }
}

function toggleFavorite(city) {
    if (!favorites.includes(city)) {
        favorites.push(city);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        loadFavorites();
        alert(`${city} adicionada aos favoritos!`);
    }
}

function loadFavorites() {
    const grid = document.getElementById('favoritesGrid');
    if (favorites.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">Nenhum favorito salvo.</p>';
        return;
    }
    
    grid.innerHTML = favorites.map(city => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:5px; cursor:pointer;" onclick="getWeather('${city}')">
            <span>${city}</span>
            <i class="fas fa-trash" style="color:#ef4444; font-size:0.8rem;" onclick="event.stopPropagation(); removeFav('${city}')"></i>
        </div>
    `).join('');
}

function removeFav(city) {
    favorites = favorites.filter(c => c !== city);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

// ========== UTILITÁRIOS DE UI ==========
function showLoading() {
    loading.classList.remove('hidden');
    weatherContent.classList.add('hidden');
    welcomeScreen.classList.add('hidden');
    errorMessage.classList.add('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function showWeatherContent() {
    weatherContent.classList.remove('hidden');
}

function showError() {
    loading.classList.add('hidden');
    welcomeScreen.classList.add('hidden');
    weatherContent.classList.add('hidden');
    errorMessage.classList.remove('hidden');
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const btn = document.getElementById('themeToggle');
    if(document.body.classList.contains('light-theme')) {
        btn.innerHTML = '<i class="fas fa-sun"></i> Modo Claro';
    } else {
        btn.innerHTML = '<i class="fas fa-moon"></i> Modo Escuro';
    }
    // Re-render chart to update colors
    if(chartInstance) {
        const activeTab = document.querySelector('.tab.active');
        if(activeTab) updateChart(activeTab.textContent.includes('24h') ? 'hourly' : 'daily');
    }
}

function loadLastCity() {
    const last = localStorage.getItem('lastCity');
    if(last) {
        cityInput.value = last;
        getWeather(last);
    } else {
        welcomeScreen.classList.remove('hidden');
    }
}

// Modal Logic
function showDetail(type) {
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');
    
    if(type === 'sun') {
        title.textContent = "Ciclo Solar";
        body.innerHTML = `
            <p>Nascer do Sol: <strong>${document.getElementById('sunrise').textContent}</strong></p>
            <p>Pôr do Sol: <strong>${document.getElementById('sunset').textContent}</strong></p>
            <p style="margin-top:10px; font-size:0.9rem; color:var(--text-secondary)">A duração do dia influencia na temperatura percebida.</p>
        `;
    }
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

function getUserLocation() {
    showLoading();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const res = await fetch(`${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`);
                const data = await res.json();
                getWeather(data.name);
            } catch(e) { showError(); }
        }, () => {
            alert("Permissão de localização negada.");
            hideLoading();
            welcomeScreen.classList.remove('hidden');
        });
    }
}
