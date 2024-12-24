from flask import Flask, render_template, url_for, request, redirect, jsonify
import os
import json

app = Flask(__name__)

LEADERBOARD_FILE = "leaderboard.json"

if not os.path.exists(LEADERBOARD_FILE):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump([], f)

def load_leaderboard():
    with open(LEADERBOARD_FILE, "r") as f:
        return json.load(f)

def save_leaderboard(leaderboard):
    with open(LEADERBOARD_FILE, "w") as f:
        json.dump(leaderboard, f, indent=4)

@app.route('/')
def index():
    pose_images = [
        {"name": f"Pose {i+1}", "image": url_for('static', filename=f'images/{i+1}.PNG')}
        for i in range(10)
    ]
    return render_template('index.html', poses=pose_images)

@app.route('/gameover', methods=["GET", "POST"])
def gameover():
    if request.method == "POST":
        name = request.form.get("name", "Anonymous")
        try:
            score = int(request.form.get("score", 0))
        except ValueError:
            score = 0
        
        leaderboard = load_leaderboard()
        leaderboard.append({"name": name, "score": score})
        leaderboard.sort(key=lambda x: x["score"], reverse=True)
        leaderboard = leaderboard[:10]
        save_leaderboard(leaderboard)

        return redirect(url_for('leaderboard_page'))
    return render_template('gameover.html')

@app.route('/leaderboard')
def leaderboard_page():
    leaderboard = load_leaderboard()
    return render_template('leaderboard.html', leaderboard=leaderboard)

if __name__ == '__main__':
    app.run(debug=True)
