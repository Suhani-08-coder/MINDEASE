document.addEventListener('DOMContentLoaded', async () => {
    const userEmail = localStorage.getItem("userEmail");
    
    // Safety Check: Redirect if no email
    if (!userEmail || userEmail === "undefined") {
        window.location.href = "loginPage.html";
        return;
    }

    try {
        // Fetch stats from Backend
        const response = await fetch(`http://127.0.0.1:5000/api/user/stats/${encodeURIComponent(userEmail.trim())}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        // 1. Storage & Basic Info
        const scores = data.moodHistory && data.moodHistory.length > 0 ? data.moodHistory : [0];
        localStorage.setItem("moodHistory", JSON.stringify(scores));

        document.getElementById('userName').innerText = data.name || "Explorer";
        document.getElementById('currentStreakText').innerText = `${data.currentStreak || 0} Days 🔥`;
        
        // Handle Score Display
        const todayScore = data.todayScore || scores[scores.length - 1];
        const dailyScoreEl = document.getElementById('dailyScore');
        if (dailyScoreEl) dailyScoreEl.innerText = `${todayScore}/100`;

        // 2. Pattern Alert & Dynamic Coloring
        const alertBox = document.getElementById('patternAlert');
        if (alertBox) {
            alertBox.innerText = data.pattern || "Stable Pattern ✨";
            // Logic: Mood low hai toh Red, warna Teal
            alertBox.style.color = (todayScore < 40 || (data.pattern && data.pattern.toLowerCase().includes("down"))) ? "#f87171" : "#2dd4bf";
        }

        // 3. AI Passive Detection Logic
        if (data.detection) {
            const moodEl = document.getElementById('passiveMood');
            const confEl = document.getElementById('confidenceLevel');
            const reasonEl = document.getElementById('reasoningText');

            if (moodEl) {
                moodEl.innerText = data.detection.passiveMood;
                const riskyMoods = ["Tense", "Anxious", "Stressed", "Heavy", "Stormy", "Low"];
                moodEl.style.color = riskyMoods.includes(data.detection.passiveMood) ? "#f87171" : "#2dd4bf";
            }
            
            if (confEl) confEl.innerText = data.detection.confidence;
            if (reasonEl) reasonEl.innerText = data.detection.reasoning;
        }

        // 4. Render Charts (Both Monthly & Weekly)
        if (document.getElementById('monthlyChart')) renderMoodTrendChart(scores);
        if (document.getElementById('weeklyChart')) renderWeeklyChart(scores.slice(-7));
        
        // 5. Initial Wellness Advice
        refreshSuggestion();

    } catch (err) {
        console.error("Dashboard Load Error:", err);
        const reasoningEl = document.getElementById('reasoningText');
        if (reasoningEl) reasoningEl.innerText = "Please start journaling to see your insights!";
    }
});

// Monthly Line Chart Logic
function renderMoodTrendChart(history) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.mChart) window.mChart.destroy();
    
    window.mChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map((_, i) => `D${i + 1}`),
            datasets: [{
                label: 'Mood History',
                data: history,
                borderColor: '#2dd4bf',
                backgroundColor: 'rgba(45, 212, 191, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 3
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { 
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)' } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Weekly Bar Chart Logic
function renderWeeklyChart(weeklyData) {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.wChart) window.wChart.destroy();

    window.wChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, weeklyData.length),
            datasets: [{
                label: 'Intensity',
                data: weeklyData,
                backgroundColor: '#6366f1',
                borderRadius: 5
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { 
                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { display: false } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Random Suggestion Generator
function refreshSuggestion() {
    const suggestions = [
        "Try a 5-minute deep breathing exercise.",
        "Your patterns show late-night stress, try sleeping earlier.",
        "Take a short walk to clear your mind.",
        "Write one thing you're grateful for today.",
        "Hydrate and step away from screens for 10 minutes.",
        "Focus on one small task to regain a sense of control."
    ];
    const suggestionEl = document.getElementById('aiSuggestion');
    if (suggestionEl) {
        suggestionEl.innerText = suggestions[Math.floor(Math.random() * suggestions.length)];
    }
}


function logout() {
    localStorage.clear();
    window.location.href = "loginPage.html";
}