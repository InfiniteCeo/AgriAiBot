AgriBot: AI-Powered Agricultural Assistant 🇰🇪

Expert Farming Advice via WhatsApp and Web for Kenyan Farmers

An AI-powered agricultural assistant system that provides expert farming advice through WhatsApp and a web-based interface, specifically designed for Kenyan farmers. AgriBot aims to increase yield and efficiency by delivering personalized, actionable intelligence directly to the field.

👥 The AgriBot Team (AGRIBOT)

Name

Role

Focus

James Bond Onyango

Team Leader & Web Developer

Full-Stack Development, Project Coordination

Straven Machuki

Web Designer

UI/UX, Frontend Responsiveness

Stanly Onchango

WhatsApp Bot Developer

Core WhatsApp Integration, Messaging Logic

🚀 Live Demos & Access

🌐 Web Chat Interface

See the web interface in action:
Launch AgriBot Web App

📱 WhatsApp Agent

Our primary communication channel is on WhatsApp. Click the button below to start a direct chat with our Agri AI Agent:

(Note: The full spectrum of features is continuously being deployed and integrated into the live WhatsApp agent.)

✨ Core Features

Feature

Description

🧠 Gemini-Powered Expert Advice

Utilizes the Google Gemini API to provide fast, reliable, and context-aware agricultural consultation.

📱 WhatsApp Integration

Seamless two-way communication allowing farmers to manage their crops without needing a separate application.

🔬 Visual Disease Diagnosis

Send an image of a crop or disease, and the AI will provide an immediate diagnosis, cause, and treatment plan.

🌐 Modern Web Interface

A responsive, alternative interface for accessing chat history and AI advice.

📢 Community Management Tools

Admin commands for managing users, viewing statistics, and broadcasting critical alerts (e.g., weather warnings) to all users.

🛡️ Built-in Rate Limiting

Ensures system stability and prevents abuse with a limit of 8 requests per minute per user.

💾 Database Logging

All conversations and user data are securely stored in Supabase for history tracking and analytics.

🛠️ Tech Stack

Backend: Node.js, Express.js (Server)

AI: Google Gemini API (Core intelligence)

Database: Supabase (PostgreSQL)

WhatsApp: @whiskeysockets/baileys (WhatsApp client library)

Frontend: HTML, TailwindCSS, Vanilla JavaScript

💡 Unique Value: Structured AI Guidance

The AgriBot is engineered to move beyond simple chat, providing actionable and easy-to-follow advice in a fixed, structured format for maximum utility:

Short Answer: A concise summary (2-4 lines).

Step-by-Step Recommendations: Clear, numbered actions to be taken immediately.

Inputs / Tools Needed: Direct list of required materials (seeds, fertilizers, tools).

Estimated Costs or Expected Outcome: Financial and yield impact insights.

Warnings: Critical precautions (e.g., proper chemical handling and timing).

⚙️ Setup Instructions

1. Prerequisites

Node.js (v20.0.0 or higher)

npm (v9.7.2 or higher)

A Supabase account

A Google Gemini API key

2. Install Dependencies

npm install


3. Configure Environment Variables

Create a .env file in the root directory by copying the example:

cp .env.example .env


Edit .env and add your credentials:

GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000


4. Set Up Supabase Database

Run these SQL commands in your Supabase SQL Editor:

-- Users Table (Stores chat users)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries Table (Stores conversation history)
CREATE TABLE queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- (Optional) Market Data Table: Use this table if you integrate market price features
CREATE TABLE market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop TEXT NOT NULL,
  region TEXT NOT NULL,
  price DECIMAL(10, 2),
  date DATE DEFAULT CURRENT_DATE
);


5. Configure Admin Users

Edit admins.json and add the phone numbers of trusted admins. Ensure the numbers follow the format shown (no +, no country code, e.g., 254712345678):

["254712345678", "254712345679"]


6. Run the Application

npm start


The server will start on http://localhost:3000.

📖 Usage Guide

WhatsApp Bot

Start the app and scan the QR code that appears in the terminal using the WhatsApp companion app feature on your phone.

Start chatting!

Example Queries:

"What is the best fertilizer mix for my 1-month-old kale crop in a high-altitude area?"

"How do I control aphids on my maize crop without harmful pesticides?"

Visual Diagnosis:
Simply send a photo of your problematic crop, plant, or disease. The AI will analyze the image and provide a full diagnosis and treatment plan.

Web Interface

Open your browser to the hosted URL or http://localhost:3000.

Type your questions in the chat interface to receive instant advice.

Admin Commands

These commands are only executable by numbers listed in admins.json:

!users - List all registered users.

!stats - Show total users and query count.

!broadcast <message> - Send a specific message to all registered users.

Example Broadcast:

!broadcast Weather alert: Expect heavy rainfall this week. Please secure your harvested produce.


📡 API Endpoints

POST /api/chat

Sends a chat message to the AI.

Request:

{
  "message": "Your question here",
  "user": "phone_number_or_id"
}


Response:

{
  "message": "AI response here"
}


GET /api/history?user=<phone>

Retrieves the chat history for a specific user.

Response:

{
  "history": [
    {
      "question": "What is...",
      "answer": "The answer is...",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}


🗺️ Project Structure

agribotai/
├── index.js                 # Main bot file and server setup
├── commands/                # Command handlers for admin functions
├── services/
│   ├── gemini.js           # Gemini AI integration logic
│   ├── supabase.js         # Supabase client initialization
│   └── db.js               # Database query functions (save user, log query)
├── web/
│   ├── index.html          # Web chat interface HTML
│   └── script.js           # Frontend JavaScript logic
├── auth_info/              # WhatsApp session data (automatically generated)
├── admins.json             # List of authorized admin phone numbers
└── package.json            # Project dependencies


⚠️ Troubleshooting

Bot Not Responding

Verify the bot is connected to WhatsApp (check terminal status).

Check the Rate Limiting section (max 8 requests/minute).

Ensure GEMINI_API_KEY is correct in .env.

Check the Supabase project connection status.

QR Code Not Appearing

Delete the entire auth_info folder.

Restart the application (npm start).

Scan the newly generated QR code.

Database Errors

Verify Supabase credentials in .env are accurate.

Ensure all tables (users, queries, etc.) were created successfully using the SQL scripts.

✅ Security and Localization

Security

All user input is sanitized.

Admin commands are strictly gated by admins.json.

WhatsApp authentication is handled securely by baileys sessions.

Localization

The AI's knowledge base and response formatting are specifically tuned for:

Kenyan crops and local market conditions.

Region-specific agricultural practices and climate considerations.

Providing locally relevant inputs and tools.

🤝 Contributing

Contributions are welcome! Please feel free to open a pull request after ensuring:

Code adheres to existing style conventions.

New features include appropriate test coverage.

All documentation (especially the README) is updated.

📝 License

This project is licensed under the GPL-3.0 License.

Built with ❤️ for Kenyan Farmers
