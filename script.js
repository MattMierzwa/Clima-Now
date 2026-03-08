// Configuração da API
const API_KEY = 'fb5da73546482815b42af679e90b0b4f'; // Sua chave API
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

// ========== EVENT LISTENERS ==========
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

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    loadLastCity();
    loadFavorites();
});

// ========== FUNÇÃO PRINCIPAL ==========
async function getWeather(city) {
    showLoading();
    currentCity = city;
    
    try {
        const [currentWeather, forecast] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric&lang=pt_br`),
            fetch(`${BASE_URL}/forecast?q=${city}&appid=${API_KEY}&units=metric&lang=pt_br&cnt=40`)
        ]);

        if (!currentWeather.ok || !forecast.ok) {
            throw new Error('Cidade não encontrada');
        }

        currentData = await currentWeather.json();
        forecastData = await forecast.json();

        // Atualizar interface
        updateCurrentWeather(currentData);
        updateHourlyForecast(forecastData);
        updateDailyForecast(forecastData);
        updateExtraInfo(currentData, forecastData);
        updateMap(currentData.coord.lat, currentData.coord.lon);
        updateChart('hourly');
        updateWeatherAnimation(currentData.weather[0].main);
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

// ========== FUNÇÕES DE ATUALIZAÇÃO ==========
function updateCurrentWeather(data) {
    document.getElementById('cityName').textContent = data.name;
    document.getElementById('country').textContent = data.sys.country;
    document.getElementById('temp').textContent = Math.round(data.main.temp);
    document.getElementById('weatherDesc').textContent = data.weather[0].description;
    document.getElementById('feelsLike').textContent = `Sensação: ${Math.round(data.main.feels_like)}°C`;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('wind').textContent = Math.round(data.wind.speed * 3.6);
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    document.getElementById('visibility').textContent = `${(data.visibility / 1000).toFixed(1)} km`;
    
    const iconCode = data.weather[0].icon;
    document.getElementById('weatherIcon').src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function updateHourlyForecast(data) {
    const container = document.getElementById('hourlyContainer');
    container.innerHTML = '';
    
    const hourlyData = data.list.slice(0, 8);
    
    hourlyData.forEach(item => {
        const date = new Date(item.dt * 1000);
        const hour = date.getHours().toString().padStart(2, '0');
        
        const card = document.createElement('div');
        card.className = 'hour-card';
        card.innerHTML = `
            <div class="time">${hour}:00</div>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="Ícone">
            <div class="hour-temp">${Math.round(item.main.temp)}°C</div>
            <small>${item.weather[0].description}</small>
        `;
        
        container.appendChild(card);
    });
}

function updateDailyForecast(data) {
    const container = document.getElementById('dailyContainer');
    container.innerHTML = '';
    
    const dailyData = {};
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'short' });
        if (!dailyData[date]) {
            dailyData[date] = {
                temps: [],
                weather: item.weather[0],
                icon: item.weather[0].icon,
                desc: item.weather[0].description
            };
        }
        dailyData[date].temps.push(item.main.temp);
    });
    
    Object.entries(dailyData).slice(0, 5).forEach(([day, data]) => {
        const maxTemp = Math.max(...data.temps);
        const minTemp = Math.min(...data.temps);
        
        const card = document.createElement('div');
        card.className = 'day-card';
        card.innerHTML = `
            <div class="day-name">${day}</div>
            <div class="day-icon">
                <img src="https://openweathermap.org/img/wn/${data.icon}.png" alt="Ícone">
            </div>
            <div class="day-temp">
                <span class="max">${Math.round(maxTemp)}°</span>
                <span class="min">${Math.round(minTemp)}°</span>
            </div>
            <div class="day-desc">${data.desc}</div>
        `;
        
        container.appendChild(card);
    });
}

function updateExtraInfo(currentData, forecastData) {
    const sunrise = new Date(currentData.sys.sunrise * 1000);
    const sunset = new Date(currentData.sys.sunset * 1000);
    
    document.getElementById('sunrise').textContent = sunrise.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunset').textContent = sunset.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('maxTemp').textContent = `${Math.round(currentData.main.temp_max)}°C`;
    document.getElementById('minTemp').textContent = `${Math.round(currentData.main.temp_min)}°C`;
    
    const rainChance = forecastData.list[0].pop * 100;
    document.getElementById('rainChance').textContent = `${Math.round(rainChance)}%`;
    document.getElementById('feelsLikeCard').textContent = `${Math.round(currentData.main.feels_like)}°C`;
}

function updateMap(lat, lon) {
    const mapFrame = document.getElementById('mapFrame');
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.1},${lat-0.1},${lon+0.1},${lat+0.1}&layer=mapnik&marker=${lat},${lon}`;
}

// ========== GRÁFICOS ==========
function updateChart(type) {
    if (!forecastData) return;
    
    const ctx = document.getElementById('tempChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    let labels = [];
    let temps = [];
    
    switch(type) {
        case 'hourly':
            labels = forecastData.list.slice(0, 8).map(item => {
                const date = new Date(item.dt * 1000);
                return `${date.getHours()}h`;
            });
            temps = forecastData.list.slice(0, 8).map(item => item.main.temp);
            break;
            
        case 'daily':
            const daily = {};
            forecastData.list.forEach(item => {
                const date = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'short' });
                if (!daily[date]) {
                    daily[date] = [];
                }
                daily[date].push(item.main.temp);
            });
            
            labels = Object.keys(daily).slice(0, 5);
            temps = Object.values(daily).slice(0, 5).map(d => 
                Math.max(...d)
            );
            break;
            
        case 'weekly':
            const weekly = {};
            forecastData.list.forEach(item => {
                const date = new Date(item.dt * 1000).toLocaleDateString('pt-BR', { weekday: 'long' });
                if (!weekly[date]) {
                    weekly[date] = [];
                }
                weekly[date].push(item.main.temp);
            });
            
            labels = Object.keys(weekly);
            temps = Object.values(weekly).map(d => 
                d.reduce((a, b) => a + b, 0) / d.length
            );
            break;
    }
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperatura (°C)',
                data: temps,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'white' }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'white' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'white' }
                }
            }
        }
    });
}

function changeChart(type, element) {
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    updateChart(type);
}

// ========== COMPARAÇÃO ==========
async function compareCities() {
    const city1 = document.getElementById('compareCity1').value;
    const city2 = document.getElementById('compareCity2').value;
    
    showLoading();
    
    try {
        const [data1, data2] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city1}&appid=${API_KEY}&units=metric&lang=pt_br`),
            fetch(`${BASE_URL}/weather?q=${city2}&appid=${API_KEY}&units=metric&lang=pt_br`)
        ]);
        
        if (!data1.ok || !data2.ok) {
            throw new Error('Cidade não encontrada');
        }
        
        const weather1 = await data1.json();
        const weather2 = await data2.json();
        
        const resultDiv = document.getElementById('comparisonResult');
        resultDiv.classList.remove('hidden');
        
        resultDiv.innerHTML = `
            <div class="comparison-city">
                <h4>${weather1.name}</h4>
                <div style="font-size: 2rem; margin: 10px 0;">${Math.round(weather1.main.temp)}°C</div>
                <div>Umidade: ${weather1.main.humidity}%</div>
                <div>Vento: ${Math.round(weather1.wind.speed * 3.6)} km/h</div>
            </div>
            <div class="comparison-city">
                <h4>${weather2.name}</h4>
                <div style="font-size: 2rem; margin: 10px 0;">${Math.round(weather2.main.temp)}°C</div>
                <div>Umidade: ${weather2.main.humidity}%</div>
                <div>Vento: ${Math.round(weather2.wind.speed * 3.6)} km/h</div>
            </div>
        `;
        
        hideLoading();
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao comparar cidades');
        hideLoading();
    }
}

// ========== ALERTAS ==========
function checkWeatherAlerts(currentData, forecastData) {
    const alerts = [];
    
    if (currentData.main.temp > 35) {
        alerts.push('🔥 Temperatura muito alta! Mantenha-se hidratado.');
    }
    if (currentData.main.temp < 10) {
        alerts.push('❄️ Temperatura baixa! Agasalhe-se bem.');
    }
    if (currentData.wind.speed * 3.6 > 50) {
        alerts.push('💨 Ventos fortes! Cuidado ao sair.');
    }
    if (forecastData.list[0].pop > 0.7) {
        alerts.push('🌧️ Alta probabilidade de chuva! Leve guarda-chuva.');
    }
    
    const alertsBanner = document.getElementById('alertsBanner');
    const alertMessage = document.getElementById('alertMessage');
    
    if (alerts.length > 0) {
        alertMessage.innerHTML = alerts.join('<br>');
        alertsBanner.classList.remove('hidden');
    } else {
        alertsBanner.classList.add('hidden');
    }
}

function closeAlerts() {
    document.getElementById('alertsBanner').classList.add('hidden');
}

// ========== ANIMAÇÕES ==========
function updateWeatherAnimation(weatherCondition) {
    const container = document.getElementById('weatherAnimation');
    weatherCondition = weatherCondition.toLowerCase();
    
    let animation = '';
    
    if (weatherCondition.includes('rain')) {
        animation = '<div class="rain-animation">';
        for (let i = 0; i < 30; i++) {
            animation += `<div class="rain-drop" style="left: ${Math.random() * 100}%; animation-delay: ${Math.random()}s;"></div>`;
        }
        animation += '</div>';
    }
    else if (weatherCondition.includes('cloud')) {
        animation = `
            <div class="cloud-animation">
                <div class="cloud" style="width: 150px; height: 60px; top: 20px;"></div>
                <div class="cloud" style="width: 120px; height: 40px; top: 40px; animation-delay: 5s;"></div>
            </div>
        `;
    }
    else if (weatherCondition.includes('clear')) {
        animation = '<div class="sun-animation"><div class="sun"></div></div>';
    }
    
    container.innerHTML = animation;
}

// ========== FAVORITOS ==========
function toggleFavorite(city) {
    const index = favorites.indexOf(city);
    
    if (index === -1) {
        favorites.push(city);
        alert(`⭐ ${city} adicionada aos favoritos!`);
    } else {
        favorites.splice(index, 1);
        alert(`🗑️ ${city} removida dos favoritos!`);
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
}

function loadFavorites() {
    const grid = document.getElementById('favoritesGrid');
    
    if (favorites.length === 0) {
        grid.innerHTML = '<div style="text-align: center; padding: 20px;">Nenhuma cidade favorita ainda</div>';
        return;
    }
    
    grid.innerHTML = favorites.map(city => `
        <div class="favorite-card" onclick="getWeather('${city}')">
            <button class="remove-fav" onclick="event.stopPropagation(); toggleFavorite('${city}')">
                <i class="fas fa-times"></i>
            </button>
            <div class="favorite-city">${city}</div>
            <div class="favorite-temp" id="fav-temp-${city}">-°C</div>
        </div>
    `).join('');
    
    favorites.forEach(updateFavoriteWeather);
}

async function updateFavoriteWeather(city) {
    try {
        const response = await fetch(`${BASE_URL}/weather?q=${city}&appid=${API_KEY}&units=metric`);
        const data = await response.json();
        
        const tempEl = document.getElementById(`fav-temp-${city}`);
        if (tempEl) {
            tempEl.textContent = `${Math.round(data.main.temp)}°C`;
        }
    } catch (error) {
        console.error(`Erro ao buscar ${city}:`, error);
    }
}

function checkIfFavorite(city) {
    const locationDiv = document.querySelector('.location');
    const existingBtn = document.querySelector('.favorite-btn');
    
    if (existingBtn) {
        existingBtn.remove();
    }
    
    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn';
    favBtn.innerHTML = favorites.includes(city) ? '⭐' : '☆';
    favBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        margin-left: 10px;
    `;
    favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(city);
    };
    
    locationDiv.appendChild(favBtn);
}

// ========== RECOMENDAÇÕES ==========
function updateRecommendations(data) {
    const container = document.getElementById('recommendations');
    const temp = data.main.temp;
    
    let recommendations = [];
    
    if (temp > 30) {
        recommendations.push({
            icon: '🥤',
            title: 'Hidratação',
            text: 'Beba bastante água'
        });
    } else if (temp < 15) {
        recommendations.push({
            icon: '🧥',
            title: 'Agasalho',
            text: 'Use casaco'
        });
    }
    
    if (data.main.humidity > 70) {
        recommendations.push({
            icon: '💧',
            title: 'Umidade',
            text: 'Cuidado com alergias'
        });
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-card">
            <div style="font-size: 2rem; margin-bottom: 10px;">${rec.icon}</div>
            <h4>${rec.title}</h4>
            <p>${rec.text}</p>
        </div>
    `).join('');
}

// ========== MODAL ==========
function showDetail(type) {
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    let content = '';
    
    switch(type) {
        case 'sunrise':
            title.textContent = 'Nascer do Sol';
            content = `<p>O sol nasceu às ${document.getElementById('sunrise').textContent}</p>`;
            break;
        case 'sunset':
            title.textContent = 'Pôr do Sol';
            content = `<p>O sol vai se pôr às ${document.getElementById('sunset').textContent}</p>`;
            break;
        case 'max':
            title.textContent = 'Temperatura Máxima';
            content = `<p>A máxima hoje é ${document.getElementById('maxTemp').textContent}</p>`;
            break;
    }
    
    body.innerHTML = content;
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

// ========== TEMA ==========
function toggleTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('themeToggle');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        body.classList.add('dark-theme');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ========== GEOLOCALIZAÇÃO ==========
function getUserLocation() {
    showLoading();
    welcomeScreen.classList.add('hidden');
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    const response = await fetch(
                        `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=pt_br`
                    );
                    
                    const data = await response.json();
                    getWeather(data.name);
                    
                } catch (error) {
                    console.error('Erro:', error);
                    showError();
                }
            },
            (error) => {
                console.error('Erro de geolocalização:', error);
                hideLoading();
                welcomeScreen.classList.remove('hidden');
                alert('Não foi possível obter sua localização');
            }
        );
    } else {
        alert('Seu navegador não suporta geolocalização');
        hideLoading();
        welcomeScreen.classList.remove('hidden');
    }
}

// ========== FUNÇÕES AUXILIARES ==========
function loadLastCity() {
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
        cityInput.value = lastCity;
        getWeather(lastCity);
    }
}

function toggleComparison() {
    const content = document.getElementById('comparisonContent');
    const btn = event.target.closest('button').querySelector('i');
    
    content.classList.toggle('hidden');
    btn.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function toggleFavorites() {
    const content = document.getElementById('favoritesContent');
    const btn = event.target.closest('button').querySelector('i');
    
    content.classList.toggle('hidden');
    btn.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

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
    weatherContent.classList.add('hidden');
    welcomeScreen.classList.add('hidden');
    errorMessage.classList.remove('hidden');
}