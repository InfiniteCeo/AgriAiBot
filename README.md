# AgriAI Bot 🌾
TEAM===> **AGRIBOT**

Leader=>JAMES BOND ONYANGO    role===>web developer
      =>STRAVEN MACHUKI       role===>web  designer 
      =>STANLY ONCHANGO       role===>whatsapp bot developer
      



An AI-powered agricultural assistant system that provides expert farming advice through WhatsApp and a web-based interface, specifically designed for Kenyan farmers.

## Features

- 🤖 **AI-Powered Chat**: Uses Google Gemini AI to provide expert agricultural advice
- 📱 **WhatsApp Integration**: Receive and respond to messages via WhatsApp(To be fully intergrated)
- 🌐 **Web Interface**: Modern, responsive web chat interface
- 📊 **Admin Commands**: Manage users, view statistics, and broadcast messages
- 🖼️ **Image Analysis**: Send crop/disease images for AI-powered diagnosis
- ⏱️ **Rate Limiting**: 8 requests per minute per user
- 💾 **Database Logging**: All conversations stored in Supabase

## Tech Stack

- **Backend**: Node.js, Express.js
- **AI**: Google Gemini API
- **Database**: Supabase (PostgreSQL)
- **WhatsApp**: @whiskeysockets/baileys
- **Frontend**: HTML, TailwindCSS, Vanilla JavaScript

## Setup Instructions

### 1. Prerequisites

- Node.js (v20.0.0 or higher)
- npm (v9.7.2 or higher)
- A Supabase account
- A Google Gemini API key

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
```

### 4. Set Up Supabase Database

#### Create Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Users Table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queries Table
CREATE TABLE queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- (Optional) Market Data Table
CREATE TABLE market_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  crop TEXT NOT NULL,
  region TEXT NOT NULL,
  price DECIMAL(10, 2),
  date DATE DEFAULT CURRENT_DATE
);
```

### 5. Configure Admin Users

Edit `admins.json` and add phone numbers (without + or country code with 254):

```json
["254712345678", "254712345679"]
```

### 6. Run the Application

```bash
npm start
```

The server will start on `http://localhost:3000`

## Usage

### WhatsApp Bot

1. The bot will generate a QR code in the terminal
2. Scan the QR code with WhatsApp on your phone
3. Start chatting with the bot!

**Example Messages:**

- "What are best practices for tomato farming in Kenya?"
- "How do I control aphids on my maize crop?"
- "What's the current market price for beans?"

**Image Analysis:**

- Send a photo of your crop, plant, or disease
- Add an optional caption describing the issue
- The AI will diagnose and provide treatment recommendations

### Web Interface

1. Open your browser to `http://localhost:3000`
2. Type your questions in the chat interface
3. Get instant AI-powered agricultural advice

### Admin Commands

Only numbers in `admins.json` can use these commands:

- `!users` - List all registered users
- `!stats` - Show total users and query count
- `!broadcast <message>` - Send message to all users

Example:

```
!broadcast Weather alert: Expect heavy rainfall this week
```

## API Endpoints

### POST /api/chat

Send a chat message to the AI

**Request:**

```json
{
  "message": "Your question here",
  "user": "phone_number_or_id"
}
```

**Response:**

```json
{
  "message": "AI response here"
}
```

### GET /api/history?user=<phone>

Get chat history for a user

**Response:**

```json
{
  "history": [
    {
      "question": "What is...",
      "answer": "The answer is...",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## AI Response Format

The AI always responds in this structured format:

1. **Short Answer** (2-4 lines)
2. **Step-by-Step Recommendations**
3. **Inputs / Tools Needed**
4. **Estimated Costs or Expected Outcome**
5. **Warnings** (if any)

## Rate Limiting

- Maximum 8 requests per minute per user
- If exceeded, users receive: "Please wait, I am still processing earlier requests."

## Security

- All user input is sanitized
- Only authorized admins can use admin commands
- No external code execution allowed
- WhatsApp authentication handled securely

## Project Structure

```
agribotai/
├── index.js                 # Main bot file
├── commands/                # Command handlers
├── services/
│   ├── gemini.js           # Gemini AI integration
│   ├── supabase.js         # Supabase client
│   └── db.js               # Database functions
├── web/
│   ├── index.html          # Web chat interface
│   └── script.js           # Frontend JavaScript
├── auth_info/              # WhatsApp session data
├── admins.json             # Admin phone numbers
└── package.json            # Dependencies
```

## Features in Detail

### Image Analysis

When a user sends an image with or without a caption:

1. Image is downloaded from WhatsApp
2. Converted to base64
3. Sent to Gemini Vision API
4. AI provides:
   - Diagnosis
   - Cause
   - Treatment steps
   - Prevention steps
   - Required inputs/tools
   - Expected outcomes

### Localization

The AI is specifically trained for:

- Kenyan crops and market conditions
- Kenyan agricultural practices
- Local pricing and market information
- Regional climate considerations

## Troubleshooting

### Bot Not Responding

1. Check if the bot is connected to WhatsApp (check terminal)
2. Verify environment variables are set correctly
3. Check Supabase connection
4. Review rate limiting (max 8 requests/minute)

### QR Code Not Appearing

1. Delete `auth_info` folder
2. Restart the application
3. Scan new QR code

### Database Errors

1. Verify Supabase credentials in `.env`
2. Ensure tables are created correctly
3. Check Supabase project is active

## License

GPL-3.0

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing style
- All features are tested
- Documentation is updated

## Support

For issues or questions, please check:

- GitHub Issues
- Documentation
- Supabase Dashboard for database status

---

**Built with ❤️ for Kenyan Farmers**
