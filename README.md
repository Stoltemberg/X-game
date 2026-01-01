# GameHub - Real-time Multiplayer Games

A real-time gaming platform featuring Tic-Tac-Toe, Chess, and Battleship. Built with Node.js, Express, Socket.io, and Tailwind CSS.

## 🚀 How to Run Locally

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the Server**:
    ```bash
    node server.js
    ```

3.  **Play**:
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 How to Deploy (GitHub + Render)

Follow these steps to put your game online for free.

### Step 1: Push to GitHub

1.  Create a new repository on [GitHub](https://github.com/new).
2.  Run the following commands in your project folder (terminal):

    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    git push -u origin main
    ```

### Step 2: Deploy on Render

1.  Create an account on [Render.com](https://render.com/).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account and select your new repository.
4.  Configure the settings:
    *   **Name**: `my-game-hub` (or whatever you like)
    *   **Region**: Closest to you (e.g., Oregon, Frankfurt)
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node server.js`
5.  Click **Create Web Service**.

### Done!
Render will build your project. Once finished (about 1-2 minutes), it will give you a URL (e.g., `https://my-game-hub.onrender.com`). Share this link with your friends to play!
