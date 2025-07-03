# Lists App - Shared Setup

This guide will help you set up your lists app so you and your wife can share lists reliably.

## What You'll Need

1. **Node.js** installed on your computer
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose the LTS version (recommended)

## Setup Instructions

### 1. Install Dependencies
Open a terminal/command prompt in your Lists folder and run:
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

You should see:
```
Server running on http://localhost:3000
You can now share this URL with your wife!
```

### 3. Access Your App
- Open your browser and go to: `http://localhost:3000`
- Your app will work exactly like before, but now saves to a database!

## Sharing with Your Wife

### Option A: Same WiFi Network (Easiest)
1. Find your computer's IP address:
   - **Windows**: Open Command Prompt, type `ipconfig`, look for "IPv4 Address"
   - **Mac**: Open Terminal, type `ifconfig`, look for "inet" under your wifi adapter
   - **Example**: `192.168.1.100`

2. Share this URL with your wife: `http://YOUR-IP-ADDRESS:3000`
   - **Example**: `http://192.168.1.100:3000`

3. She can bookmark this on her phone/computer

### Option B: Internet Access (More Advanced)
- Use a service like [ngrok](https://ngrok.com/) to make it accessible from anywhere
- Or deploy to a cloud service like Railway, Render, or Heroku

## Data Storage

- **Where**: Your lists are saved in a file called `lists.db` in the same folder
- **Backup**: You can copy this file to backup your lists
- **Migration**: The app will automatically move your old browser-saved lists to the server the first time you run it

## Troubleshooting

### "npm install" doesn't work
- Make sure Node.js is installed: `node --version`
- Try: `npm install --legacy-peer-deps`

### Can't access from wife's device
- Make sure both devices are on the same WiFi
- Check your computer's firewall isn't blocking port 3000
- Try turning off "Public network" firewall settings temporarily

### App seems slow or doesn't save
- Check the terminal for error messages
- Make sure the server is still running (don't close the terminal)

## Development Mode (Optional)
For easier testing, you can run:
```bash
npm run dev
```
This will automatically restart the server when you make changes.

## Next Steps
Once this is working well, you might want to:
- Set up automatic startup when your computer boots
- Deploy to a cloud service for access from anywhere
- Add user accounts (if you want separate lists later) 