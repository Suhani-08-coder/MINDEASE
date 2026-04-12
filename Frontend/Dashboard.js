document.addEventListener('DOMContentLoaded', async () => {
    // Email ko yahan fetch kar rahe hain taaki load hote hi sahi value mile
    const userEmail = localStorage.getItem("userEmail");
    
    // Check karein ki email sach mein hai ya 'undefined' string toh nahi
    if (!userEmail || userEmail === "undefined") {
        console.error("Email found as:", userEmail);
        window.location.href = "loginPage.html";
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/user/stats/${userEmail}`);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);

        // UI Elements update karna
        document.getElementById('userName').innerText = data.name || "Explorer";
        document.getElementById('currentStreakText').innerText = `${data.currentStreak || 0} Days 🔥`;
        
        // Mood History handle karna
        const scores = data.moodHistory && data.moodHistory.length > 0 ? data.moodHistory : [50];
        const latestScore = scores[scores.length - 1];
        document.getElementById('dailyScore').innerText = `${latestScore}/100`;

        // Pattern Alert update karna (Backend se aane wala pattern priority hai)
        const alertBox = document.getElementById('patternAlert');
        if (alertBox) {
            alertBox.innerText = data.pattern || "Stable Pattern ✨";
            // Color set karna pattern ke hisaab se
            if (data.pattern && (data.pattern.includes("Low") || data.pattern.includes("Declining"))) {
                alertBox.style.color = "#f87171"; // Red for warnings
            } else {
                alertBox.style.color = "#2dd4bf"; // Teal for stable
            }
        }

        // Detection Card details
        if (data.detection) {
            document.getElementById('passiveMood').innerText = data.detection.passiveMood;
            document.getElementById('confidenceLevel').innerText = data.detection.confidence;
            document.getElementById('reasoningText').innerText = data.detection.reasoning;
            
            const moodEl = document.getElementById('passiveMood');
            const riskyMoods = ["Tense", "Anxious", "Stressed", "Heavy", "Stormy"];
            if (riskyMoods.includes(data.detection.passiveMood)) {
                moodEl.style.color = "#f87171";
            } else {
                moodEl.style.color = "#2dd4bf";
            }
        }

        // Charts render karna
        renderMoodTrendChart(scores);
        renderWeeklyChart();
        
        // Initial suggestion load karna
        refreshSuggestion();

    } catch (err) {
        console.error("Dashboard Load Error:", err);
        // Fallback for empty state
        const reasoningEl = document.getElementById('reasoningText');
        if (reasoningEl) {
            reasoningEl.innerText = "Start journaling to see your insights!";
        }
    }
});

function renderMoodTrendChart(history) {
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map((_, i) => `D${i + 1}`),
            datasets: [{
                label: 'Mood Score',
                data: history,
                borderColor: '#2dd4bf',
                borderWidth: 2,
                pointBackgroundColor: '#2dd4bf',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(45, 212, 191, 0.1)'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { 
                    min: 0, 
                    max: 100, 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                }
            },
            plugins: { 
                legend: { display: false } 
            }
        }
    });
}

function renderWeeklyChart() {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Intensity',
                data: [65, 59, 80, 81, 56, 55, 40], 
                backgroundColor: '#6366f1',
                borderRadius: 5
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: {
                y: { 
                    min: 0, 
                    max: 100, 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.6)' }
                }
            },
            plugins: { 
                legend: { display: false } 
            }
        }
    });
}

function refreshSuggestion() {
    const suggestions = [
        "Try a 5-minute deep breathing exercise.",
        "Your patterns show late-night stress, try sleeping 30 mins earlier.",
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