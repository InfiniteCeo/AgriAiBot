require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { processWithGemini } = require("./services/gemini");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static("web"));

// Home route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to AgriAI Bot API',
    version: '2.0.0',
    status: 'running',
    features: {
      ai_chat: process.env.GEMINI_API_KEY ? 'enabled' : 'fallback_mode',
      sacco_groups: 'enabled',
      marketplace: 'enabled'
    },
    endpoints: {
      chat: '/api/chat',
      sacco: '/api/sacco',
      marketplace: '/api/marketplace'
    }
  });
});

// Simple chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const response = await processWithGemini(message);
    
    res.json({
      message: 'Chat response generated',
      response: response
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Chat processing failed',
      message: 'Unable to process your message at this time'
    });
  }
});

// Add SACCO routes
const saccoRoutes = require('./routes/sacco');
app.use('/api/sacco', saccoRoutes);

// Add auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Add marketplace routes
const marketplaceRoutes = require('./routes/marketplace');
app.use('/api/marketplace', marketplaceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    gemini_api: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured'
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 AgriAI Bot server running on port ${port}`);
  console.log(`📱 Web interface: http://localhost:${port}`);
  console.log(`🤖 Chat API: http://localhost:${port}/api/chat`);
  console.log(`👥 SACCO API: http://localhost:${port}/api/sacco`);
});