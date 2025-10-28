require("dotenv").config();

const pino = require('pino');
const path = require('path');
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { processWithGemini } = require("./services/gemini");
const { createClient } = require('@supabase/supabase-js');
const { 
  makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { 
  sendMarketplaceNotification, 
  getMarketplaceProducts 
} = require("./services/marketplace");
const fs = require('fs').promises;
const qrcode = require('qrcode');
const {
  findOrCreateUser,
  getUserProfileByWhatsApp,
  saveQuery,
  getUserHistory,
  getUserStats,
  getAllUsers
} = require("./services/supabase");
const {
  autoLinkWhatsAppAccount
} = require("./services/whatsapp");
const {
  checkFeatureLimit,
  trackAIUsage
} = require("./middleware/usageLimits");
const {
  authenticateToken
} = require("./middleware/auth");
const {
  getUserSubscription,
  assignFreePlanToUser,
  incrementUsage
} = require("./services/subscription");

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: path.join(__dirname, 'app.log') }
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logger.error({ err }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error({ promise, reason }, 'Unhandled Rejection');
  process.exit(1);
});

const app = express();
const port = process.env.PORT || 3000;

// Security and middleware setup
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' })); // Increase limit for image uploads
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

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
      marketplace: 'enabled',
      whatsapp: 'enabled',
      web_interface: 'enabled'
    },
    endpoints: {
      chat: '/api/chat',
      auth: '/api/auth',
      sacco: '/api/sacco',
      marketplace: '/api/marketplace',
      health: '/api/debug/health'
    }
  });
});

// Authentication routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// User management routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// WhatsApp linking routes will be handled automatically based on phone numbers

// SACCO management routes
const saccoRoutes = require('./routes/sacco');
app.use('/api/sacco', saccoRoutes);

// Marketplace routes
const marketplaceRoutes = require('./routes/marketplace');
app.use('/api/marketplace', marketplaceRoutes);

// Order management routes
const orderRoutes = require('./routes/orders');
app.use('/api/orders', orderRoutes);

// Market Intelligence routes
const marketIntelligenceRoutes = require('./routes/marketIntelligence');
app.use('/api/market', marketIntelligenceRoutes);

// Subscription routes
const subscriptionRoutes = require('./routes/subscriptions');
app.use('/api/subscriptions', subscriptionRoutes);

// Debug endpoint for database connection testing
app.get('/api/debug/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: {
        supabase_url: process.env.SUPABASE_URL ? 'configured' : 'missing',
        supabase_key: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing',
        gemini_key: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test user creation
app.post('/api/debug/test-user', async (req, res) => {
  try {
    const testUser = {
      email: `test${Date.now()}@example.com`,
      password: 'testpass123',
      phone: `+25470000${Math.floor(Math.random() * 10000)}`,
      name: 'Test User',
      user_type: 'farmer'
    };
    
    const { createUser } = require('./services/supabase');
    const newUser = await createUser(testUser);
    
    res.json({
      success: true,
      message: 'Test user created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        user_type: newUser.user_type
      }
    });
  } catch (error) {
    logger.error('Test user creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * Utility function to delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter class for managing per-user request limits
 */
class RateLimiter {
  constructor(maxRequests = 8, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
    
    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if user is allowed to make a request
   * @param {string} userId - User identifier (phone number)
   * @returns {boolean} True if allowed, false if rate limited
   */
  isAllowed(userId) {
    const now = Date.now();
    
    if (!this.requests.has(userId)) {
      this.requests.set(userId, []);
    }

    const userRequests = this.requests.get(userId);
    
    // Remove expired requests
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    // Update the user's request list
    this.requests.set(userId, validRequests);

    // Check if user has exceeded limit
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request timestamp
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    return true;
  }

  /**
   * Get remaining requests for a user
   * @param {string} userId - User identifier
   * @returns {number} Number of remaining requests
   */
  getRemainingRequests(userId) {
    if (!this.requests.has(userId)) {
      return this.maxRequests;
    }

    const now = Date.now();
    const userRequests = this.requests.get(userId);
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Get time until next request is allowed
   * @param {string} userId - User identifier
   * @returns {number} Milliseconds until next request allowed, or 0 if allowed now
   */
  getTimeUntilReset(userId) {
    if (!this.requests.has(userId)) {
      return 0;
    }

    const userRequests = this.requests.get(userId);
    if (userRequests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = Math.min(...userRequests);
    const timeUntilReset = this.windowMs - (Date.now() - oldestRequest);
    
    return Math.max(0, timeUntilReset);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    
    for (const [userId, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        timestamp => now - timestamp < this.windowMs
      );
      
      if (validRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, validRequests);
      }
    }
  }

  /**
   * Reset rate limit for a specific user (admin function)
   * @param {string} userId - User identifier
   */
  resetUser(userId) {
    this.requests.delete(userId);
  }

  /**
   * Get current statistics
   * @returns {Object} Rate limiter statistics
   */
  getStats() {
    return {
      totalUsers: this.requests.size,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs
    };
  }
}

// Initialize rate limiter
const rateLimiter = new RateLimiter(8, 60000); // 8 requests per minute

/**
 * Process user message with rate limiting and AI integration
 * @param {string} senderPhone - User's phone number
 * @param {string} messageText - User's message text
 * @param {Function} sendMessageCallback - Callback to send response
 * @param {Buffer} imageBuffer - Optional image data
 */
async function processUserMessage(
  senderPhone,
  messageText,
  sendMessageCallback,
  imageBuffer = null
) {
  // Check rate limiting
  if (!rateLimiter.isAllowed(senderPhone)) {
    const timeUntilReset = rateLimiter.getTimeUntilReset(senderPhone);
    const minutesUntilReset = Math.ceil(timeUntilReset / 60000);
    
    const rateLimitMessage = `⏳ Please wait, I am still processing earlier requests.\n\n` +
      `You can send ${rateLimiter.maxRequests} messages per minute.\n` +
      `Try again in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}.`;
    
    return sendMessageCallback(rateLimitMessage);
  }

  try {
    // Find or create user in database
    const user = await findOrCreateUser(senderPhone);
    
    // Try to get enhanced user profile if WhatsApp is linked
    let userProfile = null;
    try {
      userProfile = await getUserProfileByWhatsApp(senderPhone);
    } catch (error) {
      logger.info('No linked profile found for WhatsApp user:', senderPhone);
    }
    
    // Process message with Gemini AI (with personalization if profile exists)
    const botResponse = await processWithGemini(messageText, imageBuffer, userProfile);
    
    // Save query to database
    await saveQuery(user.id, messageText, botResponse);
    
    // Send response to user
    sendMessageCallback(botResponse);
    
  } catch (error) {
    logger.error("Error processing user message:", error);
    
    // Send user-friendly error message
    const errorMessage = `❌ Sorry, something went wrong while processing your message.\n\n` +
      `Please try again in a few moments. If the problem persists, contact support.`;
    
    sendMessageCallback(errorMessage);
  }
}

app.post("/api/chat", authenticateToken, checkFeatureLimit('ai_query'), trackAIUsage, async (req, res) => {
  try {
    const { message, image } = req.body;
    
    if (!message && !image) {
      return res.status(400).json({
        success: false,
        message: 'Message or image is required'
      });
    }

    // Get user profile for personalization
    const user = req.user;
    const userProfile = {
      name: user.name,
      location: user.location,
      farm_size: user.farm_size,
      crops_grown: user.crops_grown,
      created_at: user.created_at
    };

    // Convert base64 image to buffer if provided
    let imageBuffer = null;
    if (image) {
      imageBuffer = Buffer.from(image, 'base64');
    }

    // Process message with Gemini AI
    const botResponse = await processWithGemini(message || "Analyze this image", imageBuffer, userProfile);
    
    // Save query to database
    await saveQuery(user.id, message || "Image analysis", botResponse);
    
    // Increment usage after successful AI response
    await incrementUsage(user.id, 'ai_query');
    
    res.json({
      success: true,
      message: botResponse,
      usage: {
        remaining: req.usageInfo.remaining - 1,
        limit: req.usageInfo.limit
      }
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({
      success: false,
      message: 'Failed to process your message. Please try again.',
      error: error.message
    });
  }
});

app.get("/api/history", async (req, res) => {
  const userPhone = req.query.user;
  if (!userPhone) {
    return res.status(400).json({ message: "User phone number is required." });
  }

  try {
    const history = await getUserHistory(userPhone);
    res.json({ history });
  } catch (error) {
    logger.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Sorry, something went wrong." });
  }
});

let sock;
let admins = [];

async function loadAdmins() {
  try {
    const adminData = await fs.readFile("./admins.json", "utf-8");
    admins = JSON.parse(adminData);
    logger.info("Admins loaded:", admins);
  } catch (error) {
    logger.error("Error loading admins.json:", error);
    admins = [];
  }
}

/**
 * Handle incoming WhatsApp messages (main webhook endpoint)
 * @param {Object} messageUpdate - WhatsApp message update object
 */
async function handleIncomingWhatsAppMessage(messageUpdate) {
  const msg = messageUpdate.messages[0];
  logger.error({ rawWhatsAppMessage: msg }, "Processing incoming WhatsApp message"); // Changed to logger.error
  
  // Skip if no message content or if message is from bot itself
  if (!msg.message || msg.key.fromMe) {
    logger.info("Skipping message: no content or from bot itself.");
    return;
  }

  // Extract sender information
  const senderPhone = (msg.key.remoteJid || '').split("@")[0];
  const chatId = msg.key.remoteJid;
  
  // Parse message content
  const { messageText, imageBuffer } = await parseWhatsAppMessage(msg);
  logger.info({ parsedMessageText: messageText, parsedImageBuffer: !!imageBuffer }, "Parsed WhatsApp message content");
  
  if (!messageText && !imageBuffer) {
    logger.info(`Unsupported message type from ${senderPhone}`);
    return;
  }

  logger.info(`Received message from ${senderPhone}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);

  // Handle admin commands
  if (messageText.startsWith("!")) {
    await handleAdminCommand(messageText, senderPhone, chatId);
    return;
  }

  // Load non-admin commands
  const commands = require('./commands');

  // Parse command and arguments
  const args = messageText.split(' ');
  const commandName = args[0].toLowerCase();
  const commandArgs = args.slice(1);

  // Check if it's a registered non-admin command
  if (commands[commandName]) {
    try {
      await commands[commandName].execute({ chat: chatId }, sock, commandArgs);
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      await sock.sendMessage(chatId, { text: `❌ Error executing command: ${commandName}. Please try again later.` });
    }
    return; // Command handled, exit
  }

  // Auto-link WhatsApp account if user exists in database
  await handleAutoWhatsAppLink(senderPhone, chatId);

  // Process regular user messages
  if (messageText || imageBuffer) {
    await processUserMessage(senderPhone, messageText, async (response) => {
      await sock.sendMessage(chatId, { text: response });
    }, imageBuffer);
  }
}

/**
 * Parse WhatsApp message to extract text and image data
 * @param {Object} msg - WhatsApp message object
 * @returns {Object} Object containing messageText and imageBuffer
 */
async function parseWhatsAppMessage(msg) {
  const messageType = Object.keys(msg.message)[0];
  let messageText = "";
  let imageBuffer = null;

  try {
    // Handle image messages
    if (msg.message.imageMessage) {
      try {
        const buffer = await downloadMediaMessage(msg, 'buffer', {}, { sock });
        imageBuffer = buffer;
        messageText = msg.message.imageMessage.caption || "Analyze this agricultural image";
        logger.info(`Image message received with caption: ${messageText}`);
      } catch (error) {
        logger.error("Error downloading image:", error);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Sorry, I couldn't process that image. Please try sending it again or check if the image is too large."
        });
        return { messageText: "", imageBuffer: null };
      }
    }
    // Handle text messages
    else if (messageType === "conversation") {
      messageText = msg.message.conversation;
    }
    // Handle extended text messages (with formatting, links, etc.)
    else if (messageType === "extendedTextMessage") {
      messageText = msg.message.extendedTextMessage.text;
    }
    // Handle other message types
    else {
      logger.info(`Unsupported message type: ${messageType}`);
      return { messageText: "", imageBuffer: null };
    }

    // Sanitize message text
    messageText = messageText.trim();
    
    return { messageText, imageBuffer };
    
  } catch (error) {
    logger.error("Error parsing WhatsApp message:", error);
    return { messageText: "", imageBuffer: null };
  }
}

/**
 * Auto-link WhatsApp account based on phone number from registration
 * @param {string} senderPhone - Phone number of the sender
 * @param {string} chatId - WhatsApp chat ID for response
 */
async function handleAutoWhatsAppLink(senderPhone, chatId) {
  try {
    const result = await autoLinkWhatsAppAccount(senderPhone);
    
    if (result.success && result.newlyLinked) {
      // Send welcome message for newly linked account
      const welcomeMessage = `✅ **WhatsApp Account Linked Successfully!**\n\n` +
        `Hello ${result.user.name}! 👋\n\n` +
        `Your WhatsApp is now connected to your AgriaiBot account. You'll now receive:\n\n` +
        `🌱 Personalized farming advice based on your profile\n` +
        `📢 Marketplace notifications and opportunities\n` +
        `👥 SACCO group updates and bulk order alerts\n` +
        `💡 Smart recommendations tailored to your crops\n\n` +
        `Try asking me about your crops or farming challenges!`;
      
      await sock.sendMessage(chatId, { text: welcomeMessage });
      logger.info(`Auto-linked WhatsApp for user: ${result.user.name} (${senderPhone})`);
    }
    
  } catch (error) {
    logger.error('Auto WhatsApp linking error:', error);
    // Don't send error messages to user for auto-linking failures
  }
}

/**
 * Handle admin commands with authentication
 * @param {string} messageText - The full command message
 * @param {string} senderPhone - Phone number of the sender
 * @param {string} chatId - WhatsApp chat ID for response
 */
async function handleAdminCommand(messageText, senderPhone, chatId) {
  // Check admin authentication
  if (!admins.includes(senderPhone)) {
    // Silently ignore non-admin commands (as per requirement 3.5)
    return;
  }

  const command = messageText.split(" ")[0];
  const args = messageText.split(" ").slice(1).join(" ");

  try {
    switch (command) {
      case "!users":
        const usersData = await getAllUsers();
        let usersList = `*📋 Registered Users (${usersData.length}):*\n\n`;
        
        if (usersData.length === 0) {
          usersList += "No users registered yet.";
        } else {
          usersData.forEach((user, index) => {
            const displayName = user.name || `User ${user.phone}`;
            const lastSeen = new Date(user.last_seen).toLocaleString();
            usersList += `${index + 1}. ${displayName}\n   📱 ${user.phone}\n   🕒 Last seen: ${lastSeen}\n\n`;
          });
        }
        
        await sock.sendMessage(chatId, { text: usersList });
        break;

      case "!stats":
        const stats = await getUserStats();
        const statsMessage = `*📊 Bot Statistics:*\n\n` +
          `👥 Total Users: ${stats.totalUsers}\n` +
          `💬 Total Queries: ${stats.totalQueries}\n` +
          `📅 Generated: ${new Date().toLocaleString()}`;
        
        await sock.sendMessage(chatId, { text: statsMessage });
        break;

      case "!broadcast":
        if (!args.trim()) {
          await sock.sendMessage(chatId, {
            text: "❌ Usage: !broadcast <message>\n\nExample: !broadcast Hello farmers! New weather update available."
          });
          return;
        }

        const allUsers = await getAllUsers();
        if (allUsers.length === 0) {
          await sock.sendMessage(chatId, {
            text: "❌ No users to broadcast to."
          });
          return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const user of allUsers) {
          try {
            await sock.sendMessage(`${user.phone}@s.whatsapp.net`, {
              text: `📢 *Broadcast Message:*\n\n${args}`
            });
            successCount++;
                        await delay(1000); // Delay to avoid rate limiting
                      } catch (error) {
                        logger.error(`Failed to send broadcast to ${user.phone}:`, error);
                        failCount++;
                      }
                    }
            
                    const broadcastResult = `✅ *Broadcast Complete*\n\n` +
                      `📤 Sent to: ${successCount} users\n` +
                      `❌ Failed: ${failCount} users\n` +
                      `📝 Message: "${args.substring(0, 50)}${args.length > 50 ? '...' : ''}"`;
                    
                    await sock.sendMessage(chatId, { text: broadcastResult });
                    break;
            
                  case "!ratelimit":
                    const rateLimitStats = rateLimiter.getStats();
                    const rateLimitMessage = `⏱️ *Rate Limit Status:*\n\n` +
                      `📊 Active Users: ${rateLimitStats.totalUsers}\n` +
                      `🚦 Max Requests: ${rateLimitStats.maxRequests} per minute\n` +
                      `⏰ Window: ${rateLimitStats.windowMs / 1000} seconds`;
                    
                    await sock.sendMessage(chatId, { text: rateLimitMessage });
                    break;
            
                  case "!testnotify":
                    // Test marketplace notification
                    const testNotification = {
                      type: 'new_product',
                      productName: 'Premium Maize Seeds',
                      price: 150,
                      unit: 'kg',
                      location: 'Nairobi',
                      targetCrops: ['maize', 'corn']
                    };
                    
                    try {
                      await sendMarketplaceNotification(testNotification, async (phone, message) => {
                        await sock.sendMessage(phone, { text: message });
                      });
                      
                      await sock.sendMessage(chatId, { 
                        text: "✅ Test marketplace notification sent to linked users" 
                      });
                    } catch (error) {
                      await sock.sendMessage(chatId, { 
                        text: `❌ Failed to send test notification: ${error.message}` 
                      });
                    }
                    break;
            
                  case "!testsacco":
                    // Test SACCO group update (using a mock SACCO ID)
                    const testUpdate = {
                      type: 'meeting',
                      date: 'Saturday, December 2nd',
                      time: '2:00 PM',
                      location: 'Community Center',
                      agenda: 'Discuss bulk fertilizer purchase'
                    };
                    
                    await sock.sendMessage(chatId, { 
                      text: "ℹ️ SACCO test requires a valid SACCO ID. Use: !testsacco <sacco_id>" 
                    });
                    break;
            
                  default:
                    await sock.sendMessage(chatId, {
                      text: `❌ Unknown admin command: ${command}\n\n` +
                        `Available commands:\n` +
                        `• !users - List all registered users\n` +
                        `• !stats - Show bot statistics\n` +
                        `• !broadcast <message> - Send message to all users\n` +
                        `• !ratelimit - Show rate limiting status\n` +
                        `• !testnotify - Test marketplace notification\n` +
                        `• !testsacco - Test SACCO group update`
                    });
                    break;
                }
              } catch (error) {
                logger.error(`Error executing admin command ${command}:`, error);
                await sock.sendMessage(chatId, {
                  text: `❌ Error executing command: ${command}\nPlease try again later.`
                });
              }
            }
// QR code functionality removed - using direct phone number linking

async function connectToWhatsApp() {
  await loadAdmins(); // Load admins on startup
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);

  sock = makeWASocket({
    logger: logger,
    auth: state,
    browser: ["AgriAIBot", "Safari", "1.0.0"],
  });

  logger.info("Registering messages.upsert event listener...");
  // WhatsApp message handler - main webhook endpoint
  sock.ev.on("messages.upsert", async (m) => {
    try {
      await handleIncomingWhatsAppMessage(m);
    } catch (error) {
      logger.error("Error handling WhatsApp message:", error);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      logger.info('\n📱 WhatsApp QR Code:');
      logger.info('Please scan this QR code with your WhatsApp to connect the bot:\n');
      qrcode.toFile("qr.png", qr, (err) => {
        if (err) {
          logger.error("Error generating QR code image:", err);
        } else {
          logger.info("✅ QR code image saved as qr.png");
        }
      });
      logger.info('\n📋 Instructions:');
      logger.info('1. Open WhatsApp on your phone');
      logger.info('2. Go to Settings > Linked Devices');
      logger.info('3. Tap "Link a Device"');
      logger.info('4. Scan the QR code above');
      logger.info('5. Once connected, the bot will be ready to receive messages\n');
    }
    
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      logger.info(
        "connection closed due to ",
        lastDisconnect.error,
        ", reconnecting ",
        shouldReconnect
      );

      if (
        lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut
      ) {
        logger.info(
          "Connection closed due to being logged out. Deleting auth_info directory."
        );
        (async () => {
          await fs.rm("./auth_info", { recursive: true, force: true });
        })();
      }

      // reconnect if not logged out
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      logger.info("✅ WhatsApp connection established successfully!");
      logger.info("🤖 Bot is now ready to receive messages");
      logger.info("📞 Users can now send messages to link their accounts automatically");
    }
  });
}

logger.info("Starting application...");

// WhatsApp feature disabled - will be re-enabled later
// connectToWhatsApp().then(() => {
//   logger.info("WhatsApp connection successful.");
// }).catch(err => {
//   logger.error({ err }, "An error occurred during WhatsApp connection:");
//   process.exit(1); // Exit the process with an error code
// });

logger.info("Attempting to start server...");
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
  logger.info("AI Integration: ✅ Active");
  logger.info("SACCO Creation: ✅ Active");  
  logger.info("WhatsApp: ⏸️ Disabled (will be enabled later)");
});
