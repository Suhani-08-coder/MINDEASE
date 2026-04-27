import os
import random
import smtplib
from email.mime.text import MIMEText
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS 
from dotenv import load_dotenv
from pymongo import MongoClient
import google.generativeai as genai
from datetime import datetime, timezone 
from bson import ObjectId

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
MONGO_URI = os.getenv("MONGO_URI")
MAIL_SENDER = os.getenv("MAIL_SENDER")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
API_KEY = os.getenv("GEMINI_API_KEY")

# Gemini AI Setup
if API_KEY:
    genai.configure(api_key=API_KEY)

# MongoDB Connection
client = MongoClient(MONGO_URI)
db = client["mindease"]
users_collection = db["users"]
journals_collection = db["journals"]
chats_collection = db["chats"]

otp_store = {}

# --- HELPER FUNCTIONS ---

def send_real_email(to_email, otp_code):
    """Sends OTP via SMTP SSL"""
    if not MAIL_SENDER or not MAIL_PASSWORD:
        return False
    html_content = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6366f1;">MindEase Sanctuary</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 5px; color: #1e293b;">{otp_code}</h1>
        <p>Valid for 10 minutes. Do not share this code.</p>
    </div>
    """
    msg = MIMEText(html_content, 'html')
    msg['Subject'] = "MindEase Login Code"
    msg['From'] = MAIL_SENDER
    msg['To'] = to_email
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(MAIL_SENDER, MAIL_PASSWORD)
            server.sendmail(MAIL_SENDER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"Email Error: {e}")
        return False

# --- ROUTES ---

@app.route('/')
def home():
    return render_template("index.html")

@app.route('/bubble-wrap')
def bubble_wrap():
    return render_template('BubbleWrap.html')

# --- AUTHENTICATION API ---

@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    data = request.json
    email = data.get('email', '').strip().lower()
    if not email:
        return jsonify({"error": "Email required"}), 400
    otp = str(random.randint(100000, 999999))
    otp_store[email] = otp
    if send_real_email(email, otp):
        return jsonify({"message": f"OTP sent to {email}"})
    else:
        print(f"DEBUG OTP for {email}: {otp}")
        return jsonify({"message": "Email failed. Check console for OTP.", "otp": otp})

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json
    email = data.get('email', '').strip().lower()
    otp = data.get('otp')
    new_user_data = data.get('userData')

    if email in otp_store and otp_store[email] == otp:
        del otp_store[email]
        if new_user_data:
            existing_user = users_collection.find_one({"email": email})
            if not existing_user:
                users_collection.insert_one({
                    "name": new_user_data['name'],
                    "age": new_user_data['age'],
                    "gender": new_user_data['gender'],
                    "email": email
                })
        user = users_collection.find_one({"email": email}, {"_id": 0})
        return jsonify({"message": "Success", "user": user})
    return jsonify({"error": "Invalid OTP"}), 400

# --- CHAT & AI COMPANION ---

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '').strip()
        email = data.get('email', 'anonymous').lower()
        
        # Safety Check
        DANGER_KEYWORDS = ["marne", "suicide", "end my life", "kill myself", "harm", "marna", "zindagi khatam"]
        if any(kw in user_message.lower() for kw in DANGER_KEYWORDS):
            return jsonify({
                "action": "safety_alert",
                "reply": "I'm so sorry you're feeling this way. You are not alone. Please reach out to someone who can support you. Call Aasra: 9820466726",
                "hotlines": [{"name": "Aasra", "number": "9820466726", "link": "tel:9820466726"}]
            })

        persona = (
            "You are 'MindEase', a friendly and empathetic wellness companion. "
            "If user talks in Hinglish, respond in natural Hinglish. "
            "Be human-like, keep it under 3 sentences, and ask follow-up questions."
        )

        model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=persona)
        response = model.generate_content(user_message)
        
        # Auto-save chat history
        chats_collection.insert_one({
            "email": email,
            "message": user_message,
            "reply": response.text,
            "created_at": datetime.now(timezone.utc)
        })
        
        return jsonify({"reply": response.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-chat', methods=['POST'])
def save_chat():
    data = request.json
    chats_collection.insert_one({
        "email": data.get("email"),
        "message": data.get("message"),
        "reply": data.get("reply"),
        "created_at": datetime.now(timezone.utc)
    })
    return jsonify({"message": "Chat saved"})

# --- JOURNALING SYSTEM ---

@app.route('/api/save-journal', methods=['POST'])
def save_journal():
    data = request.json
    email = data.get("email", "").strip().lower() # Space hatao aur lowercase karo
    thought = data.get("thought", "").strip()
    mood = data.get("mood", "cloudy").lower() # Mood hamesha lowercase

    if not email or not thought:
        return jsonify({"error": "Kuch toh likhiye!"}), 400

    journal = {
        "email": email,
        "mood": mood,
        "thought": thought,
        "created_at": datetime.now(timezone.utc)
    }
    
    try:
        journals_collection.insert_one(journal)
        return jsonify({"message": "Journal saved successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/journals/<email>', methods=['GET'])
def get_all_journals(email):
    email = email.strip().lower()
    # Latest entries sabse upar dikhane ke liye sort(-1)
    journals = list(journals_collection.find({"email": email}).sort("created_at", -1))
    
    output = []
    for j in journals:
        output.append({
            "id": str(j["_id"]),
            "thought": j.get("thought", ""),
            "mood": j.get("mood", "cloudy").capitalize(), # Display ke liye Capital
            "date": j["created_at"].strftime("%b %d, %Y") 
        })
    return jsonify(output)
@app.route('/api/journal/<id>', methods=['DELETE'])
def delete_journal(id):
    journals_collection.delete_one({"_id": ObjectId(id)})
    return jsonify({"message": "Deleted successfully"})

# --- DASHBOARD & INSIGHTS ---

@app.route('/api/smart-insight/<email>', methods=['GET'])
def get_smart_insight(email):
    email = email.strip().lower()
    journals = list(journals_collection.find({"email": email}).sort("created_at", -1).limit(5))
    
    if not journals:
        return jsonify({"insight": "Apna pehla journal likhein sukoon ke liye. ✨"})
    
    moods = [j.get('mood', '').lower() for j in journals]
    # Agar 5 mein se 2 baar bhi stormy/heavy hai toh stress alert
    if moods.count('stormy') >= 2 or moods.count('heavy') >= 2:
        return jsonify({"insight": "Pichle kuch dino se stress zyada hai. Deep breathing try karein? 🌿"})
    
    return jsonify({"insight": "Aapka pattern stable hai. Keep it up! ✎"})

@app.route('/api/user/stats/<email>', methods=['GET'])
def get_user_stats(email):
    email = email.strip().lower()
    user = users_collection.find_one({"email": email})
    
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Last 15 entries fetch karein trend dikhane ke liye
    journals = list(journals_collection.find({"email": email}).sort("created_at", -1).limit(15))
    
    mood_map = {
        "radiant": 90, 
        "peaceful": 75, 
        "cloudy": 50, 
        "heavy": 30, 
        "stormy": 15
    }
    
    if not journals:
        return jsonify({
            "name": user.get("name", "Explorer"),
            "currentStreak": 0,
            "moodHistory": [],
            "todayScore": 0,
            "pattern": "No Data Yet ✨",
            "detection": {
                "passiveMood": "N/A", 
                "confidence": "0%", 
                "reasoning": "Start journaling to see your insights!"
            }
        })

    # Chart ke liye history (Oldest to Newest)
    history = [mood_map.get(j.get("mood", "cloudy").lower(), 50) for j in journals][::-1]
    today_score = history[-1]
    
    # Mood Improvement Logic
    insight = "Your mood is steady today. ✨"
    if len(history) > 1:
        diff = history[-1] - history[-2]
        if diff > 0:
            insight = f"Mood improved by {diff}% since yesterday! 🚀"
        elif diff < 0:
            insight = f"Mood is down by {abs(diff)}% today. Take some rest. ☕"

    return jsonify({
        "name": user.get("name"),
        "currentStreak": len(journals),
        "moodHistory": history,
        "pattern": insight,
        "todayScore": today_score,
        "detection": {
            "passiveMood": journals[0].get("mood", "cloudy").capitalize(),
            "confidence": "92%" if len(journals) > 5 else "65%",
            "reasoning": f"Based on your {len(journals)} recent journal entries."
        }
    })

   

# --- QUIZ ANALYSIS ---

@app.route('/api/analyze-quiz', methods=['POST'])
def analyze_quiz():
    data = request.json
    score = data.get('score', 0)
    prompt = f"Analyze wellness quiz score: {score}/50. Give gentle 2-sentence advice."
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return jsonify({"reply": response.text})
    except:
        return jsonify({"reply": "Great job completing the quiz! Take a deep breath."})

if __name__ == '__main__':
    app.run(debug=True, port=5000)