/**
 * AgriAI Bot - Main Application Controller
 * Handles routing, authentication, and page management
 */

class AgriAIApp {
  constructor() {
    this.currentUser = null;
    this.currentPage = null;
    this.isAuthenticated = false;

    // Initialize the application
    this.init();
  }

  async init() {
    console.log("Initializing AgriAI Bot...");

    // Check authentication status
    await this.checkAuthentication();

    // Set up event listeners
    this.setupEventListeners();

    // Determine initial page
    const initialPage = this.determineInitialPage();

    // Navigate to initial page
    await this.navigateTo(initialPage);

    // Hide loading screen
    this.hideLoadingScreen();
  }

  async checkAuthentication() {
    const token = localStorage.getItem("authToken");

    if (!token) {
      this.isAuthenticated = false;
      return;
    }

    try {
      const response = await fetch("/api/auth/validate", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        this.isAuthenticated = true;
        this.updateNavigation();
      } else {
        // Token is invalid
        localStorage.removeItem("authToken");
        this.isAuthenticated = false;
      }
    } catch (error) {
      console.error("Authentication check failed:", error);
      localStorage.removeItem("authToken");
      this.isAuthenticated = false;
    }
  }

  determineInitialPage() {
    // Check URL hash for routing
    const hash = window.location.hash.substring(1);

    if (hash && this.isValidRoute(hash)) {
      return hash;
    }

    // Default routing logic
    if (this.isAuthenticated) {
      return this.currentUser?.user_type === "wholesaler"
        ? "dashboard"
        : "dashboard";
    } else {
      return "welcome";
    }
  }

  isValidRoute(route) {
    const validRoutes = [
      "welcome",
      "login",
      "register",
      "dashboard",
      "chat",
      "marketplace",
      "profile",
      "sacco",
      "wholesaler",
      "recommendations",
      "admin",
    ];
    return validRoutes.includes(route);
  }

  setupEventListeners() {
    // Handle browser back/forward buttons
    window.addEventListener("popstate", (event) => {
      const page = event.state?.page || this.determineInitialPage();
      this.navigateTo(page, false); // Don't push to history
    });

    // Handle logout
    document.addEventListener("click", (e) => {
      if (e.target.id === "logoutBtn" || e.target.closest("#logoutBtn")) {
        this.logout();
      }
    });

    // Global navigation handler
    window.navigateTo = (page) => this.navigateTo(page);

    // Global notification handler
    window.showNotification = (message, type) =>
      this.showNotification(message, type);
  }

  updateNavigation() {
    const authNav = document.getElementById("authNav");
    const unauthNav = document.getElementById("unauthNav");
    const saccoNavBtn = document.getElementById("saccoNavBtn");
    const wholesalerNavBtn = document.getElementById("wholesalerNavBtn");
    const navUserName = document.getElementById("navUserName");

    if (this.isAuthenticated && this.currentUser) {
      // Show authenticated navigation
      authNav.classList.remove("hidden");
      authNav.classList.add("flex");
      unauthNav.classList.add("hidden");

      // Update user name
      if (navUserName) {
        navUserName.textContent = this.currentUser.name || "User";
      }

      // Show/hide user type specific navigation
      const adminNavBtn = document.getElementById("adminNavBtn");

      if (this.currentUser.user_type === "wholesaler") {
        saccoNavBtn?.classList.add("hidden");
        wholesalerNavBtn?.classList.remove("hidden");
        adminNavBtn?.classList.add("hidden");
      } else if (this.currentUser.user_type === "admin") {
        saccoNavBtn?.classList.add("hidden");
        wholesalerNavBtn?.classList.add("hidden");
        adminNavBtn?.classList.remove("hidden");
      } else {
        saccoNavBtn?.classList.remove("hidden");
        wholesalerNavBtn?.classList.add("hidden");
        adminNavBtn?.classList.add("hidden");
      }
    } else {
      // Show unauthenticated navigation
      authNav.classList.add("hidden");
      unauthNav.classList.remove("hidden");
    }

    // Update active navigation item
    this.updateActiveNavItem();
  }

  updateActiveNavItem() {
    // Remove active class from all nav items
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    // Add active class to current page nav item
    const currentNavItem = document.querySelector(
      `[onclick="navigateTo('${this.currentPage}')"]`
    );
    if (currentNavItem) {
      currentNavItem.classList.add("active");
    }
  }

  async navigateTo(page, pushToHistory = true) {
    console.log(`Navigating to: ${page}`);

    // Validate route
    if (!this.isValidRoute(page)) {
      console.error(`Invalid route: ${page}`);
      return;
    }

    // Check authentication requirements
    if (this.requiresAuth(page) && !this.isAuthenticated) {
      page = "login";
    }

    // Check user type requirements
    if (page === "wholesaler" && this.currentUser?.user_type !== "wholesaler") {
      page = "dashboard";
    }

    if (page === "sacco" && this.currentUser?.user_type !== "farmer") {
      page = "dashboard";
    }

    if (page === "admin" && this.currentUser?.user_type !== "admin") {
      page = "dashboard";
    }

    // Update browser history
    if (pushToHistory) {
      const url = page === "welcome" ? "/" : `/#${page}`;
      window.history.pushState({ page }, "", url);
    }

    // Update current page
    this.currentPage = page;

    // Load page content
    await this.loadPageContent(page);

    // Update navigation
    this.updateNavigation();
  }

  requiresAuth(page) {
    const authRequiredPages = [
      "dashboard",
      "profile",
      "sacco",
      "wholesaler",
      "recommendations",
      "admin",
    ];
    return authRequiredPages.includes(page);
  }

  async loadPageContent(page) {
    const pageContent = document.getElementById("pageContent");

    try {
      this.showGlobalLoading();

      let content = "";

      switch (page) {
        case "welcome":
          content = await this.loadWelcomePage();
          break;
        case "login":
          content = await this.loadLoginPage();
          break;
        case "register":
          content = await this.loadRegisterPage();
          break;
        case "dashboard":
          content = await this.loadDashboardPage();
          break;
        case "chat":
          content = await this.loadChatPage();
          break;
        case "marketplace":
          content = await this.loadMarketplacePage();
          break;
        case "profile":
          content = await this.loadProfilePage();
          break;
        case "sacco":
          content = await this.loadSACCOPage();
          break;
        case "wholesaler":
          content = await this.loadWholesalerPage();
          break;
        case "recommendations":
          content = await this.loadRecommendationsPage();
          break;
        case "admin":
          content = await this.loadAdminPage();
          break;
        default:
          content = await this.loadWelcomePage();
      }

      pageContent.innerHTML = content;
      pageContent.classList.remove("hidden");

      // Initialize page-specific functionality
      await this.initializePage(page);
    } catch (error) {
      console.error(`Error loading page ${page}:`, error);
      this.showNotification("Error loading page. Please try again.", "error");
    } finally {
      this.hideGlobalLoading();
    }
  }

  async loadWelcomePage() {
    return `
            <div class="max-w-4xl mx-auto px-4 py-6">
                <!-- Hero Section -->
                <div class="bg-white rounded-2xl shadow-xl mb-6 p-8 text-center fade-in">
                    <div class="inline-block bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-4 rounded-full mb-6">
                        <i class="fas fa-seedling text-3xl mr-3"></i>
                        <span class="font-bold text-xl">AgriAI Bot</span>
                    </div>
                    <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                        Your AI-Powered Agricultural Assistant
                    </h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-8 text-lg">
                        Get expert farming advice, access the marketplace, join SACCO groups, and grow your agricultural business with AI-powered insights.
                    </p>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onclick="navigateTo('login')" class="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium">
                            <i class="fas fa-sign-in-alt mr-2"></i>Get Started
                        </button>
                        <button onclick="navigateTo('chat')" class="bg-white text-green-600 border-2 border-green-600 px-8 py-3 rounded-xl hover:bg-green-50 transition-all duration-200 font-medium">
                            <i class="fas fa-comments mr-2"></i>Try AI Chat
                        </button>
                    </div>
                </div>

                <!-- Features Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div class="bg-white rounded-xl shadow-lg p-6 text-center fade-in">
                        <div class="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-robot text-blue-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">AI Assistant</h3>
                        <p class="text-gray-600">Get instant expert advice on crops, diseases, and farming techniques powered by advanced AI.</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-lg p-6 text-center fade-in">
                        <div class="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-store text-green-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Marketplace</h3>
                        <p class="text-gray-600">Buy and sell agricultural products, access bulk pricing, and connect with suppliers.</p>
                    </div>
                    
                    <div class="bg-white rounded-xl shadow-lg p-6 text-center fade-in">
                        <div class="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-users text-purple-600 text-2xl"></i>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">SACCO Groups</h3>
                        <p class="text-gray-600">Join farmer cooperatives for bulk purchasing and collective bargaining power.</p>
                    </div>
                </div>

                <!-- Call to Action -->
                <div class="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl shadow-xl p-8 text-center text-white fade-in">
                    <h3 class="text-2xl font-bold mb-4">Ready to Transform Your Farming?</h3>
                    <p class="text-green-100 mb-6 max-w-2xl mx-auto">
                        Join thousands of farmers already using AgriAI Bot to improve their yields, reduce costs, and increase profits.
                    </p>
                    <button onclick="navigateTo('login')" class="bg-white text-green-600 px-8 py-3 rounded-xl hover:bg-green-50 transition-all duration-200 font-bold shadow-lg">
                        <i class="fas fa-rocket mr-2"></i>Start Your Journey
                    </button>
                </div>
            </div>
        `;
  }

  async loadLoginPage() {
    const response = await fetch("login.html");
    let content = await response.text();

    // Extract only the body content
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
      // Remove the navigation bar from login page
      content = content.replace(/<nav[\s\S]*?<\/nav>/i, "");
    }

    return content;
  }

  async loadRegisterPage() {
    // For now, redirect to login page which has registration
    return await this.loadLoginPage();
  }

  async loadDashboardPage() {
    // Create dashboard content directly instead of trying to extract from HTML
    return `
      <div class="max-w-7xl mx-auto px-4 py-6">
        <!-- Welcome Section -->
        <div class="bg-white rounded-2xl shadow-xl mb-6 p-6 fade-in">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                Welcome back, <span id="welcomeName">${
                  this.currentUser?.name || "User"
                }</span>! 🌾
              </h2>
              <p class="text-gray-600" id="welcomeMessage">
                Your agricultural assistant and marketplace platform
              </p>
            </div>
            <div class="hidden md:block">
              <div class="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full">
                <i class="fas fa-calendar-alt mr-2"></i>
                <span id="currentDate">${new Date().toLocaleDateString(
                  "en-US",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-blue-100 p-3 rounded-full">
                <i class="fas fa-comments text-blue-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">AI Consultations</p>
                <p class="text-2xl font-bold text-gray-800" id="chatCount">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-green-100 p-3 rounded-full">
                <i class="fas fa-shopping-cart text-green-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">Active Orders</p>
                <p class="text-2xl font-bold text-gray-800" id="orderCount">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in" id="saccoStatsCard" ${
            this.currentUser?.user_type === "wholesaler"
              ? 'style="display:none"'
              : ""
          }>
            <div class="flex items-center">
              <div class="bg-purple-100 p-3 rounded-full">
                <i class="fas fa-users text-purple-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">SACCO Groups</p>
                <p class="text-2xl font-bold text-gray-800" id="saccoCount">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-yellow-100 p-3 rounded-full">
                <i class="fas fa-lightbulb text-yellow-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">Recommendations</p>
                <p class="text-2xl font-bold text-gray-800" id="recommendationCount">0</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Features Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          <!-- AI Chat Assistant -->
          <div class="bg-white rounded-2xl shadow-xl p-6 fade-in">
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-blue-500 to-blue-600 p-3 rounded-full">
                <i class="fas fa-robot text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">AI Assistant</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Get expert agricultural advice powered by AI. Ask about crops, diseases, market prices, and farming techniques.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('chat')" class="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 text-center">
                <i class="fas fa-comments mr-2"></i>Start Chat
              </button>
            </div>
          </div>

          <!-- Marketplace -->
          <div class="bg-white rounded-2xl shadow-xl p-6 fade-in">
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-green-500 to-green-600 p-3 rounded-full">
                <i class="fas fa-store text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">Marketplace</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Browse and purchase farm inputs, equipment, and services. Access bulk pricing through SACCO groups.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('marketplace')" class="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-2 px-4 rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 text-center">
                <i class="fas fa-shopping-bag mr-2"></i>Browse
              </button>
            </div>
          </div>

          <!-- SACCO Groups (Farmers only) -->
          <div class="bg-white rounded-2xl shadow-xl p-6 fade-in" id="saccoFeatureCard" ${
            this.currentUser?.user_type === "wholesaler"
              ? 'style="display:none"'
              : ""
          }>
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-purple-500 to-purple-600 p-3 rounded-full">
                <i class="fas fa-users text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">SACCO Groups</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Join farmer cooperatives for bulk purchasing, shared resources, and collective bargaining power.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('sacco')" class="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-2 px-4 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 text-center">
                <i class="fas fa-handshake mr-2"></i>Join Groups
              </button>
            </div>
          </div>

          <!-- Profile Management -->
          <div class="bg-white rounded-2xl shadow-xl p-6 fade-in">
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 p-3 rounded-full">
                <i class="fas fa-user-cog text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">Profile</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Manage your profile, link WhatsApp, and customize your agricultural preferences.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('profile')" class="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-2 px-4 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 text-center">
                <i class="fas fa-edit mr-2"></i>Edit Profile
              </button>
            </div>
          </div>

          <!-- Market Intelligence -->
          <div class="bg-white rounded-2xl shadow-xl p-6 fade-in">
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-orange-500 to-orange-600 p-3 rounded-full">
                <i class="fas fa-chart-line text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">Market Intelligence</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Get AI-powered market insights, price trends, and personalized recommendations.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('recommendations')" class="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 text-white py-2 px-4 rounded-lg hover:from-orange-700 hover:to-orange-800 transition-all duration-200 text-center">
                <i class="fas fa-brain mr-2"></i>View Insights
              </button>
            </div>
          </div>

          <!-- Wholesaler Dashboard (conditional) -->
          <div id="wholesalerCard" class="bg-white rounded-2xl shadow-xl p-6 fade-in" ${
            this.currentUser?.user_type !== "wholesaler"
              ? 'style="display:none"'
              : ""
          }>
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-teal-500 to-teal-600 p-3 rounded-full">
                <i class="fas fa-warehouse text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">Inventory</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Manage your product listings, inventory, and orders from farmers and SACCO groups.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('wholesaler')" class="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 text-white py-2 px-4 rounded-lg hover:from-teal-700 hover:to-teal-800 transition-all duration-200 text-center">
                <i class="fas fa-boxes mr-2"></i>Manage
              </button>
            </div>
          </div>

          <!-- Admin Panel (conditional) -->
          <div id="adminCard" class="bg-white rounded-2xl shadow-xl p-6 fade-in" ${
            this.currentUser?.user_type !== "admin"
              ? 'style="display:none"'
              : ""
          }>
            <div class="flex items-center mb-4">
              <div class="bg-gradient-to-r from-red-500 to-red-600 p-3 rounded-full">
                <i class="fas fa-user-shield text-white text-xl"></i>
              </div>
              <h3 class="text-xl font-bold text-gray-800 ml-3">Admin Panel</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Manage users, monitor system health, and configure platform settings.
            </p>
            <div class="flex space-x-3">
              <button onclick="navigateTo('admin')" class="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-2 px-4 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 text-center">
                <i class="fas fa-cogs mr-2"></i>Manage System
              </button>
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="bg-white rounded-2xl shadow-xl p-6 fade-in">
          <h3 class="text-xl font-bold text-gray-800 mb-4">
            <i class="fas fa-clock mr-2 text-green-600"></i>Recent Activity
          </h3>
          <div id="recentActivity" class="space-y-4">
            <div class="text-center text-gray-500 py-8">
              <i class="fas fa-history text-4xl mb-4"></i>
              <p>Loading recent activity...</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async loadChatPage() {
    return `
            <div class="max-w-4xl mx-auto px-4 py-6">
                <!-- Hero Section -->
                <div class="bg-white rounded-2xl shadow-xl mb-6 p-6 text-center">
                    <div class="inline-block bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-full mb-4">
                        <i class="fas fa-robot text-2xl mr-3"></i>
                        <span class="font-bold text-lg">Agricultural Intelligence</span>
                    </div>
                    <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-3">
                        Get Expert Farming Advice
                    </h2>
                    <p class="text-gray-600 max-w-2xl mx-auto">
                        Ask me anything about crops, diseases, pest control, market prices, or farming techniques 
                        specific to Kenyan agriculture.
                    </p>
                </div>

                <!-- Chat Container -->
                <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <!-- Chat Header -->
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                                <i class="fas fa-seedling text-green-600 text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-white font-bold">AgriBot Assistant</h3>
                                <p class="text-green-100 text-sm">Online • Ready to help</p>
                            </div>
                        </div>
                        <button id="clearChat" class="text-white hover:text-green-200 transition-colors">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>

                    <!-- Chat Messages Area -->
                    <div id="chatbox" class="h-96 overflow-y-auto p-6 space-y-4 bg-gray-50">
                        <!-- Welcome Message -->
                        <div class="flex items-start space-x-3 bot-message">
                            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-seedling text-white text-sm"></i>
                            </div>
                            <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-xs md:max-w-md">
                                <p class="text-gray-800">
                                    <strong>Welcome to AgriAI Bot! 🌾</strong><br><br>
                                    ${this.isAuthenticated ? 
                                        `I'm here to help you with personalized agricultural advice. Ask me about:
                                        <br>• Crop management for your ${this.currentUser?.location || 'area'}
                                        <br>• Pest and disease control
                                        <br>• Market prices and trends
                                        <br>• Farming techniques
                                        <br><br>
                                        Just type your question below!` :
                                        `I'm here to help with agricultural advice! To get personalized recommendations and access the AI assistant, please <strong><a href="#" onclick="navigateTo('login')" style="color: #059669; text-decoration: underline;">login or register</a></strong>.
                                        <br><br>
                                        You can still try asking a question below, but you'll need to login to get AI responses.`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="border-t border-gray-200 p-4">
                        <div class="flex space-x-3">
                            <input 
                                type="text" 
                                id="userInput" 
                                placeholder="Ask about crops, diseases, market prices..."
                                class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            >
                            <button 
                                id="sendButton" 
                                class="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <i class="fas fa-paper-plane mr-2"></i>
                                Send
                            </button>
                        </div>
                        <p class="text-sm text-gray-500 mt-3 text-center">
                            <i class="fas fa-shield-alt mr-2"></i>
                            Your data is secure and responses are powered by Google Gemini AI
                        </p>
                    </div>
                </div>

                <!-- Quick Suggestions -->
                <div class="mt-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-lightbulb mr-2 text-green-600"></i>
                        Quick Questions
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button class="suggestion-btn bg-white hover:bg-green-50 border border-gray-200 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md">
                            <i class="fas fa-tomato text-red-500 mr-2"></i>
                            <span class="text-gray-700">Best practices for tomato farming</span>
                        </button>
                        <button class="suggestion-btn bg-white hover:bg-green-50 border border-gray-200 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md">
                            <i class="fas fa-spray-can text-blue-500 mr-2"></i>
                            <span class="text-gray-700">How to control pests organically?</span>
                        </button>
                        <button class="suggestion-btn bg-white hover:bg-green-50 border border-gray-200 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md">
                            <i class="fas fa-chart-line text-green-500 mr-2"></i>
                            <span class="text-gray-700">Current maize market prices in Kenya</span>
                        </button>
                        <button class="suggestion-btn bg-white hover:bg-green-50 border border-gray-200 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md">
                            <i class="fas fa-droplet text-cyan-500 mr-2"></i>
                            <span class="text-gray-700">Optimal irrigation schedule for beans</span>
                        </button>
                    </div>
                </div>

                <!-- Footer -->
                <div class="mt-8 text-center text-gray-600 text-sm">
                    <p>
                        <i class="fas fa-heart text-red-500 mr-2"></i>
                        Powered by Google Gemini AI • Built for Kenyan Farmers
                    </p>
                </div>
            </div>
        `;
  }

  async loadMarketplacePage() {
    return `
      <div class="max-w-7xl mx-auto px-4 py-6">
        <!-- Header Section -->
        <div class="bg-white rounded-2xl shadow-lg mb-6 p-6 fade-in">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                <i class="fas fa-store mr-3 text-green-600"></i>Marketplace
              </h2>
              <p class="text-gray-600">
                Browse farm inputs, equipment, and services from trusted suppliers
              </p>
            </div>
            <div class="mt-4 md:mt-0 flex space-x-3">
              <button id="filterToggle" class="md:hidden bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg transition-colors">
                <i class="fas fa-filter mr-2"></i>Filters
              </button>
              <button id="viewToggle" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                <i class="fas fa-th-large mr-2"></i>Grid View
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-6">
          <!-- Filter Sidebar -->
          <div id="filterSidebar" class="lg:w-80">
            <div class="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800">
                  <i class="fas fa-filter mr-2 text-green-600"></i>Filters
                </h3>
                <button id="clearFilters" class="text-sm text-green-600 hover:text-green-700">
                  Clear All
                </button>
              </div>

              <!-- Search -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Search Products</label>
                <div class="relative">
                  <input type="text" id="searchInput" placeholder="Search by name or description..." 
                         class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                </div>
              </div>

              <!-- Category Filter -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select id="categoryFilter" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">All Categories</option>
                  <option value="Seeds">Seeds</option>
                  <option value="Fertilizers">Fertilizers</option>
                  <option value="Pesticides">Pesticides</option>
                  <option value="Tools">Tools & Equipment</option>
                  <option value="Irrigation">Irrigation</option>
                  <option value="Livestock">Livestock Feed</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <!-- Location Filter -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <select id="locationFilter" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">All Locations</option>
                  <option value="Nairobi">Nairobi</option>
                  <option value="Central">Central</option>
                  <option value="Coast">Coast</option>
                  <option value="Eastern">Eastern</option>
                  <option value="North Eastern">North Eastern</option>
                  <option value="Nyanza">Nyanza</option>
                  <option value="Rift Valley">Rift Valley</option>
                  <option value="Western">Western</option>
                </select>
              </div>

              <!-- Price Range -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Price Range (KES)</label>
                <div class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <input type="number" id="minPrice" placeholder="Min" 
                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                    <span class="text-gray-500">-</span>
                    <input type="number" id="maxPrice" placeholder="Max" 
                           class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  </div>
                </div>
              </div>

              <!-- Apply Filters Button -->
              <button id="applyFilters" class="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200">
                <i class="fas fa-search mr-2"></i>Apply Filters
              </button>
            </div>
          </div>

          <!-- Main Content -->
          <div class="flex-1">
            <!-- Results Header -->
            <div class="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
              <div>
                <span id="resultsCount" class="text-gray-600">Loading products...</span>
              </div>
              <div class="flex items-center space-x-3">
                <span class="text-sm text-gray-600">View:</span>
                <button id="gridViewBtn" class="p-2 text-green-600 bg-green-100 rounded">
                  <i class="fas fa-th-large"></i>
                </button>
                <button id="listViewBtn" class="p-2 text-gray-600 hover:text-green-600 hover:bg-green-100 rounded">
                  <i class="fas fa-list"></i>
                </button>
              </div>
            </div>

            <!-- Products Grid -->
            <div id="productsContainer" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <div class="col-span-full text-center py-12">
                <i class="fas fa-spinner fa-spin text-4xl text-green-600 mb-4"></i>
                <p class="text-gray-600">Loading products...</p>
              </div>
            </div>

            <!-- Load More Button -->
            <div id="loadMoreContainer" class="text-center mt-8 hidden">
              <button id="loadMoreBtn" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors">
                <i class="fas fa-plus mr-2"></i>Load More Products
              </button>
            </div>

            <!-- No Results -->
            <div id="noResults" class="hidden text-center py-12">
              <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
              <h3 class="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
              <p class="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
              <button onclick="clearAllFilters()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors">
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <!-- Shopping Cart Sidebar -->
        <div id="cartSidebar" class="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform translate-x-full transition-transform duration-300 z-50">
          <div class="flex flex-col h-full">
            <!-- Cart Header -->
            <div class="bg-green-600 text-white p-4 flex items-center justify-between">
              <h3 class="text-lg font-bold">
                <i class="fas fa-shopping-cart mr-2"></i>Shopping Cart
              </h3>
              <button id="closeCart" class="text-white hover:text-green-200">
                <i class="fas fa-times text-xl"></i>
              </button>
            </div>

            <!-- Cart Items -->
            <div id="cartItems" class="flex-1 overflow-y-auto p-4">
              <div class="text-center text-gray-500 py-8">
                <i class="fas fa-shopping-cart text-4xl mb-4"></i>
                <p>Your cart is empty</p>
                <p class="text-sm">Add some products to get started</p>
              </div>
            </div>

            <!-- Cart Footer -->
            <div id="cartFooter" class="border-t border-gray-200 p-4 hidden">
              <div class="mb-4">
                <div class="flex justify-between items-center text-lg font-bold">
                  <span>Total:</span>
                  <span id="cartTotal">KES 0</span>
                </div>
              </div>
              <div class="space-y-2">
                <button id="checkoutBtn" class="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors">
                  <i class="fas fa-credit-card mr-2"></i>Proceed to Checkout
                </button>
                <button id="clearCartBtn" class="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg transition-colors">
                  <i class="fas fa-trash mr-2"></i>Clear Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async loadProfilePage() {
    return `
      <div class="max-w-6xl mx-auto px-4 py-6">
        <!-- Profile Header -->
        <div class="bg-white rounded-2xl shadow-xl mb-6 p-6">
          <div class="flex items-center space-x-4 mb-4">
            <div class="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
              <i class="fas fa-user text-white text-2xl"></i>
            </div>
            <div>
              <h2 class="text-2xl font-bold text-gray-800" id="userName">${
                this.currentUser?.name || "User"
              }</h2>
              <p class="text-gray-600" id="userType">${
                this.currentUser?.user_type || "Farmer"
              }</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Profile Information -->
          <div class="bg-white rounded-2xl shadow-xl p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">
              <i class="fas fa-user-edit mr-2 text-green-600"></i>
              Profile Information
            </h3>
            
            <form id="profileForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input type="text" id="name" value="${
                  this.currentUser?.name || ""
                }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input type="email" id="email" value="${
                  this.currentUser?.email || ""
                }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" readonly>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input type="tel" id="phone" value="${
                  this.currentUser?.phone || ""
                }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input type="text" id="location" value="${
                  this.currentUser?.location || ""
                }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              
              <div id="farmerFields" class="space-y-4" ${
                this.currentUser?.user_type !== "farmer"
                  ? 'style="display:none"'
                  : ""
              }>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Farm Size (acres)</label>
                  <input type="number" id="farmSize" step="0.1" value="${
                    this.currentUser?.farm_size || ""
                  }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Crops Grown</label>
                  <input type="text" id="cropsGrown" placeholder="e.g., maize, beans, tomatoes" value="${
                    this.currentUser?.crops_grown
                      ? this.currentUser.crops_grown.join(", ")
                      : ""
                  }" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                </div>
              </div>
              
              <button type="submit" class="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200">
                <i class="fas fa-save mr-2"></i>Update Profile
              </button>
            </form>
          </div>

          <!-- WhatsApp Linking -->
          <div class="bg-white rounded-2xl shadow-xl p-6">
            <h3 class="text-xl font-bold text-gray-800 mb-4">
              <i class="fab fa-whatsapp mr-2 text-green-600"></i>
              WhatsApp Integration
            </h3>
            
            <div id="whatsappStatus" class="mb-6">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div class="flex items-center">
                  <i class="fas fa-info-circle text-blue-600 mr-3"></i>
                  <div>
                    <p class="font-medium text-blue-800">WhatsApp Status</p>
                    <p class="text-sm text-blue-600">
                      ${
                        this.currentUser?.whatsapp_linked
                          ? "Connected"
                          : "Not connected"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div id="linkingInstructions" ${
              this.currentUser?.whatsapp_linked ? 'class="hidden"' : ""
            }>
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div class="flex items-center">
                  <i class="fas fa-exclamation-triangle text-yellow-600 mr-3"></i>
                  <div>
                    <p class="font-medium text-yellow-800">WhatsApp Not Connected</p>
                    <p class="text-sm text-yellow-600">Send a message to our WhatsApp bot to automatically link your account</p>
                  </div>
                </div>
              </div>
              
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-medium text-blue-800 mb-2">
                  <i class="fas fa-mobile-alt mr-2"></i>Quick Setup Instructions
                </h4>
                <div class="text-sm text-blue-700 space-y-2">
                  <p><strong>Step 1:</strong> Make sure you're using WhatsApp on: <span class="font-mono bg-white px-2 py-1 rounded">${
                    this.currentUser?.phone || "your registered phone number"
                  }</span></p>
                  <p><strong>Step 2:</strong> Send any message to our WhatsApp bot</p>
                  <p><strong>Step 3:</strong> Your account will be automatically linked!</p>
                  <div class="mt-3 p-3 bg-white rounded border border-blue-300">
                    <p class="font-medium text-blue-800">WhatsApp Bot Number:</p>
                    <p class="text-blue-900 font-mono text-lg">+254 XXX XXX XXX</p>
                    <p class="text-xs text-blue-600 mt-1">Contact admin for the current WhatsApp bot number</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div id="linkedSection" ${
              !this.currentUser?.whatsapp_linked ? 'class="hidden"' : ""
            }>
              <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div class="flex items-center">
                  <i class="fas fa-check-circle text-green-600 mr-3"></i>
                  <div>
                    <p class="font-medium text-green-800">WhatsApp Connected</p>
                    <p class="text-sm text-green-600" id="linkedPhone">
                      ${this.currentUser?.phone || "Phone number"}
                    </p>
                  </div>
                </div>
              </div>
              
              <button id="unlinkBtn" class="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
                <i class="fas fa-unlink mr-2"></i>Unlink WhatsApp
              </button>
            </div>
            
            <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 class="font-medium text-blue-800 mb-2">
                <i class="fas fa-info-circle mr-2"></i>Benefits of Linking WhatsApp
              </h4>
              <ul class="text-sm text-blue-700 space-y-1">
                <li>• Personalized farming advice based on your profile</li>
                <li>• Marketplace notifications and opportunities</li>
                <li>• SACCO group updates and bulk order alerts</li>
                <li>• Smart recommendations for your crops</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async loadSACCOPage() {
    return `
      <div class="container mx-auto px-4 py-8">
        <!-- User's SACCO Groups -->
        <div class="mb-8">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold text-gray-800">My SACCO Groups</h2>
            <button id="createSACCOBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
              <i class="fas fa-plus mr-2"></i>Create SACCO
            </button>
          </div>
          <div id="mySACCOs" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="col-span-full text-center py-12">
              <i class="fas fa-spinner fa-spin text-4xl text-green-600 mb-4"></i>
              <p class="text-gray-600">Loading your SACCO groups...</p>
            </div>
          </div>
        </div>

        <!-- Available SACCO Groups -->
        <div class="mb-8">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-2xl font-bold text-gray-800">Available SACCO Groups</h2>
            <div class="flex space-x-2">
              <input type="text" id="searchInput" placeholder="Search SACCO groups..." 
                     class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              <select id="regionFilter" class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">All Regions</option>
                <option value="Nairobi">Nairobi</option>
                <option value="Central">Central</option>
                <option value="Coast">Coast</option>
                <option value="Eastern">Eastern</option>
                <option value="North Eastern">North Eastern</option>
                <option value="Nyanza">Nyanza</option>
                <option value="Rift Valley">Rift Valley</option>
                <option value="Western">Western</option>
              </select>
              <button id="searchSACCOsBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
          <div id="availableSACCOs" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="col-span-full text-center py-12">
              <i class="fas fa-spinner fa-spin text-4xl text-green-600 mb-4"></i>
              <p class="text-gray-600">Loading available SACCO groups...</p>
            </div>
          </div>
        </div>

        <!-- Create SACCO Modal -->
        <div id="createSACCOModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold">Create New SACCO Group</h3>
              <button id="closeSACCOModal" class="text-gray-500 hover:text-gray-700">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <form id="createSACCOForm">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">SACCO Name *</label>
                <input type="text" id="saccoName" required 
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Region *</label>
                <select id="saccoRegion" required 
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select Region</option>
                  <option value="Nairobi">Nairobi</option>
                  <option value="Central">Central</option>
                  <option value="Coast">Coast</option>
                  <option value="Eastern">Eastern</option>
                  <option value="North Eastern">North Eastern</option>
                  <option value="Nyanza">Nyanza</option>
                  <option value="Rift Valley">Rift Valley</option>
                  <option value="Western">Western</option>
                </select>
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea id="saccoDescription" rows="3" 
                          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Describe the purpose and goals of your SACCO group..."></textarea>
              </div>
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Member Limit</label>
                <input type="number" id="saccoMemberLimit" min="5" max="200" value="50"
                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              <div class="flex space-x-3">
                <button type="button" id="cancelSACCOBtn" 
                        class="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-lg">
                  Cancel
                </button>
                <button type="submit" 
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg">
                  Create SACCO
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  async loadWholesalerPage() {
    // Redirect to dedicated wholesaler page
    window.location.href = "wholesaler.html";
    return "";
  }

  async loadRecommendationsPage() {
    const response = await fetch("recommendations.html");
    let content = await response.text();

    // Extract main content without navigation
    const containerMatch = content.match(
      /<div class="max-w-7xl mx-auto px-4 py-6">([\s\S]*?)<\/div>\s*<\/div>/i
    );
    if (containerMatch) {
      return `<div class="max-w-7xl mx-auto px-4 py-6">${containerMatch[1]}</div>`;
    }

    return content;
  }

  async loadAdminPage() {
    return `
      <div class="max-w-7xl mx-auto px-4 py-6">
        <!-- Header Section -->
        <div class="bg-white rounded-2xl shadow-lg mb-6 p-6 fade-in">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
                <i class="fas fa-users-cog mr-3 text-green-600"></i>System Administration
              </h2>
              <p class="text-gray-600">
                Manage users, monitor system health, and configure platform settings
              </p>
            </div>
            <div class="mt-4 md:mt-0 flex space-x-3">
              <button id="refreshBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-blue-100 p-3 rounded-full">
                <i class="fas fa-users text-blue-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">Total Users</p>
                <p class="text-2xl font-bold text-gray-800" id="totalUsers">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-green-100 p-3 rounded-full">
                <i class="fas fa-user-friends text-green-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">Active Farmers</p>
                <p class="text-2xl font-bold text-gray-800" id="activeFarmers">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-purple-100 p-3 rounded-full">
                <i class="fas fa-store text-purple-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">Wholesalers</p>
                <p class="text-2xl font-bold text-gray-800" id="totalWholesalers">0</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white rounded-xl shadow-lg p-6 fade-in">
            <div class="flex items-center">
              <div class="bg-yellow-100 p-3 rounded-full">
                <i class="fas fa-comments text-yellow-600 text-xl"></i>
              </div>
              <div class="ml-4">
                <p class="text-gray-600 text-sm">AI Queries Today</p>
                <p class="text-2xl font-bold text-gray-800" id="todayQueries">0</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Tabs -->
        <div class="bg-white rounded-2xl shadow-lg mb-6">
          <div class="border-b border-gray-200">
            <nav class="flex space-x-8 px-6">
              <button id="usersTab" class="py-4 px-2 border-b-2 border-green-600 text-green-600 font-medium">
                <i class="fas fa-users mr-2"></i>Users
              </button>
              <button id="systemTab" class="py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium">
                <i class="fas fa-cog mr-2"></i>System Health
              </button>
            </nav>
          </div>

          <!-- Users Tab Content -->
          <div id="usersContent" class="p-6">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody id="usersTableBody" class="bg-white divide-y divide-gray-200">
                  <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                      <i class="fas fa-users text-4xl mb-4"></i>
                      <p>Loading users...</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- System Health Tab Content -->
          <div id="systemContent" class="p-6 hidden">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div class="bg-gray-50 rounded-lg p-6">
                <h3 class="text-lg font-bold text-gray-800 mb-4">System Status</h3>
                <div id="systemStatus" class="space-y-3">
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">Database</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Connected</span>
                  </div>
                  <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">AI Service</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Check Config</span>
                  </div>
                </div>
              </div>
              <div class="bg-gray-50 rounded-lg p-6">
                <h3 class="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
                <div class="space-y-3">
                  <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors">
                    <i class="fas fa-sync-alt mr-2"></i>Refresh System Status
                  </button>
                  <button class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                    <i class="fas fa-download mr-2"></i>Export User Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async initializePage(page) {
    // Initialize page-specific functionality
    switch (page) {
      case "login":
        await this.initializeLoginPage();
        break;
      case "dashboard":
        await this.initializeDashboardPage();
        break;
      case "chat":
        await this.initializeChatPage();
        break;
      case "marketplace":
        await this.initializeMarketplacePage();
        break;
      case "profile":
        await this.initializeProfilePage();
        break;
      case "sacco":
        await this.initializeSACCOPage();
        break;
      case "wholesaler":
        await this.initializeWholesalerPage();
        break;
      case "recommendations":
        await this.initializeRecommendationsPage();
        break;
      case "admin":
        await this.initializeAdminPage();
        break;
    }
  }

  async initializeLoginPage() {
    // Initialize login functionality directly
    this.setupLoginFunctionality();
  }

  async initializeDashboardPage() {
    // Initialize dashboard functionality directly
    await this.loadDashboardStats();
    this.setupDashboardInteractions();
  }

  async loadDashboardStats() {
    try {
      // Load stats in parallel
      const [chatStats, orderStats, saccoStats, recommendationStats] =
        await Promise.allSettled([
          this.loadChatStats(),
          this.loadOrderStats(),
          this.loadSACCOStats(),
          this.loadRecommendationStats(),
        ]);

      // Update stats display
      if (chatStats.status === "fulfilled") {
        const chatCountEl = document.getElementById("chatCount");
        if (chatCountEl) chatCountEl.textContent = chatStats.value;
      }

      if (orderStats.status === "fulfilled") {
        const orderCountEl = document.getElementById("orderCount");
        if (orderCountEl) orderCountEl.textContent = orderStats.value;
      }

      if (
        saccoStats.status === "fulfilled" &&
        this.currentUser?.user_type === "farmer"
      ) {
        const saccoCountEl = document.getElementById("saccoCount");
        if (saccoCountEl) saccoCountEl.textContent = saccoStats.value;
      }

      if (recommendationStats.status === "fulfilled") {
        const recommendationCountEl = document.getElementById(
          "recommendationCount"
        );
        if (recommendationCountEl)
          recommendationCountEl.textContent = recommendationStats.value;
      }

      // Load recent activity
      await this.loadRecentActivity();
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
    }
  }

  async loadChatStats() {
    try {
      const response = await fetch(
        `/api/history?user=${this.currentUser?.phone || this.currentUser?.id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.history ? data.history.length : 0;
      }
      return 0;
    } catch (error) {
      console.error("Error loading chat stats:", error);
      return 0;
    }
  }

  async loadOrderStats() {
    try {
      const response = await fetch("/api/orders/my-orders", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const activeOrders = data.orders
          ? data.orders.filter(
              (order) => !["delivered", "cancelled"].includes(order.status)
            ).length
          : 0;
        return activeOrders;
      }
      return 0;
    } catch (error) {
      console.error("Error loading order stats:", error);
      return 0;
    }
  }

  async loadSACCOStats() {
    if (this.currentUser?.user_type !== "farmer") return 0;

    try {
      const response = await fetch("/api/sacco/user/my-saccos", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.saccos ? data.saccos.length : 0;
      }
      return 0;
    } catch (error) {
      console.error("Error loading SACCO stats:", error);
      return 0;
    }
  }

  async loadRecommendationStats() {
    try {
      const response = await fetch("/api/market/recommendations", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const unreadCount = data.recommendations
          ? data.recommendations.filter((rec) => !rec.is_read).length
          : 0;
        return unreadCount;
      }
      return 0;
    } catch (error) {
      console.error("Error loading recommendation stats:", error);
      return 0;
    }
  }

  async loadRecentActivity() {
    const activityContainer = document.getElementById("recentActivity");
    if (!activityContainer) return;

    try {
      const activities = [];

      // Recent chat messages
      try {
        const chatResponse = await fetch(
          `/api/history?user=${
            this.currentUser?.phone || this.currentUser?.id
          }&limit=3`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          }
        );

        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          if (chatData.history) {
            chatData.history.forEach((chat) => {
              activities.push({
                type: "chat",
                title: "AI Consultation",
                description: chat.question.substring(0, 100) + "...",
                timestamp: chat.timestamp,
                icon: "fas fa-comments",
                color: "text-blue-600",
              });
            });
          }
        }
      } catch (error) {
        console.error("Error loading chat activity:", error);
      }

      // Sort activities by timestamp (most recent first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Display activities
      if (activities.length === 0) {
        activityContainer.innerHTML = `
          <div class="text-center text-gray-500 py-8">
            <i class="fas fa-history text-4xl mb-4"></i>
            <p>No recent activity</p>
            <p class="text-sm">Start by chatting with the AI assistant or browsing the marketplace</p>
          </div>
        `;
      } else {
        activityContainer.innerHTML = activities
          .slice(0, 5)
          .map(
            (activity) => `
          <div class="flex items-start space-x-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
            <div class="flex-shrink-0">
              <i class="${activity.icon} ${activity.color} text-lg"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-800">${activity.title}</p>
              <p class="text-sm text-gray-600 truncate">${
                activity.description
              }</p>
              <p class="text-xs text-gray-500 mt-1">${this.formatTimestamp(
                activity.timestamp
              )}</p>
            </div>
          </div>
        `
          )
          .join("");
      }
    } catch (error) {
      console.error("Error loading recent activity:", error);
      activityContainer.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
          <p>Error loading recent activity</p>
        </div>
      `;
    }
  }

  setupDashboardInteractions() {
    // Any dashboard-specific interactions can be set up here
    // For now, the navigation buttons are handled by the global navigateTo function
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  }

  async initializeChatPage() {
    // Initialize chat functionality
    this.setupChatFunctionality();
  }

  async initializeMarketplacePage() {
    // Initialize marketplace functionality directly
    await this.setupMarketplaceFunctionality();
  }

  async setupMarketplaceFunctionality() {
    // Load initial products
    await this.loadMarketplaceProducts();

    // Set up event listeners
    this.setupMarketplaceEvents();
  }

  async loadMarketplaceProducts() {
    try {
      const response = await fetch("/api/marketplace/products?limit=12", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const products = data.data || [];
        this.displayMarketplaceProducts(products);

        const resultsCount = document.getElementById("resultsCount");
        if (resultsCount) {
          resultsCount.textContent = `Showing ${products.length} products`;
        }
      } else {
        throw new Error("Failed to load products");
      }
    } catch (error) {
      console.error("Error loading marketplace products:", error);
      const container = document.getElementById("productsContainer");
      if (container) {
        container.innerHTML = `
          <div class="col-span-full text-center py-12">
            <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p class="text-gray-600">Error loading products</p>
            <button onclick="window.agriApp.loadMarketplaceProducts()" class="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
              Try Again
            </button>
          </div>
        `;
      }
    }
  }

  displayMarketplaceProducts(products) {
    const container = document.getElementById("productsContainer");
    if (!container) return;

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-search text-6xl text-gray-300 mb-4"></i>
          <h3 class="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
          <p class="text-gray-500">Check back later for new products</p>
        </div>
      `;
      return;
    }

    container.innerHTML = products
      .map((product) => this.createProductCard(product))
      .join("");
  }

  createProductCard(product) {
    const hasBulkPricing =
      product.bulk_pricing && Object.keys(product.bulk_pricing).length > 0;
    const isInStock = product.stock_quantity > 0;

    return `
      <div class="bg-white rounded-xl shadow-lg product-card fade-in" data-product-id="${
        product.id
      }">
        <div class="relative">
          ${
            product.image_url
              ? `<img src="${product.image_url}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-xl">`
              : `<div class="w-full h-48 bg-gradient-to-br from-green-100 to-emerald-100 rounded-t-xl flex items-center justify-center">
              <i class="fas fa-seedling text-4xl text-green-600"></i>
            </div>`
          }
          ${
            hasBulkPricing
              ? '<div class="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold">BULK PRICING</div>'
              : ""
          }
          ${
            !isInStock
              ? '<div class="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold">OUT OF STOCK</div>'
              : ""
          }
        </div>
        
        <div class="p-4">
          <h3 class="font-bold text-gray-800 text-lg mb-2">${product.name}</h3>
          <p class="text-gray-600 text-sm mb-3">${
            product.description || "No description available"
          }</p>
          
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-2">
              <i class="fas fa-map-marker-alt text-gray-400 text-sm"></i>
              <span class="text-gray-600 text-sm">${
                product.location || "Location not specified"
              }</span>
            </div>
            <div class="flex items-center space-x-2">
              <i class="fas fa-boxes text-gray-400 text-sm"></i>
              <span class="text-gray-600 text-sm">${product.stock_quantity} ${
      product.unit_type
    }</span>
            </div>
          </div>
          
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-2xl font-bold text-green-600">KES ${product.unit_price.toLocaleString()}</span>
              <span class="text-gray-500 text-sm">/${product.unit_type}</span>
            </div>
            ${
              product.wholesaler
                ? `<div class="text-right">
                <p class="text-xs text-gray-500">Sold by</p>
                <p class="text-sm font-medium text-gray-700">${product.wholesaler.name}</p>
              </div>`
                : ""
            }
          </div>
          
          <div class="flex space-x-2">
            <button onclick="window.agriApp.viewProduct('${product.id}')" 
                    class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-lg transition-colors text-sm">
              <i class="fas fa-eye mr-2"></i>View Details
            </button>
            ${
              isInStock
                ? `<button onclick="window.agriApp.addToCart('${product.id}', 1)" 
                      class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded-lg transition-colors text-sm">
                <i class="fas fa-cart-plus mr-2"></i>Add to Cart
              </button>`
                : `<button disabled class="flex-1 bg-gray-300 text-gray-500 py-2 px-3 rounded-lg cursor-not-allowed text-sm">
                Out of Stock
              </button>`
            }
          </div>
        </div>
      </div>
    `;
  }

  setupMarketplaceEvents() {
    // Set up marketplace-specific event listeners
    const applyFiltersBtn = document.getElementById("applyFilters");
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", () =>
        this.loadMarketplaceProducts()
      );
    }

    const clearFiltersBtn = document.getElementById("clearFilters");
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        // Clear all filter inputs
        document.getElementById("searchInput").value = "";
        document.getElementById("categoryFilter").value = "";
        document.getElementById("locationFilter").value = "";
        document.getElementById("minPrice").value = "";
        document.getElementById("maxPrice").value = "";
        this.loadMarketplaceProducts();
      });
    }
  }

  viewProduct(productId) {
    this.showNotification("Product details view coming soon", "info");
  }

  addToCart(productId, quantity) {
    this.showNotification(`Added ${quantity} item(s) to cart`, "success");
  }

  async initializeProfilePage() {
    // Initialize profile functionality directly
    this.setupProfileFunctionality();
  }

  setupProfileFunctionality() {
    const profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", (e) =>
        this.handleProfileUpdate(e)
      );
    }

    // QR functionality removed - using automatic linking

    const unlinkBtn = document.getElementById("unlinkBtn");
    if (unlinkBtn) {
      unlinkBtn.addEventListener("click", () => this.unlinkWhatsApp());
    }
  }

  async handleProfileUpdate(e) {
    e.preventDefault();

    try {
      this.showGlobalLoading();

      const formData = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        location: document.getElementById("location").value.trim(),
      };

      // Add farmer-specific fields
      if (this.currentUser?.user_type === "farmer") {
        const farmSize = document.getElementById("farmSize").value;
        const cropsGrown = document.getElementById("cropsGrown").value.trim();

        if (farmSize) formData.farm_size = parseFloat(farmSize);
        if (cropsGrown) {
          formData.crops_grown = cropsGrown
            .split(",")
            .map((crop) => crop.trim())
            .filter((crop) => crop);
        }
      }

      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      const data = await response.json();
      this.currentUser = data.user;

      this.showNotification("Profile updated successfully", "success");
    } catch (error) {
      console.error("Error updating profile:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideGlobalLoading();
    }
  }

  // QR code generation removed - using automatic linking

  async unlinkWhatsApp() {
    if (!confirm("Are you sure you want to unlink your WhatsApp account?")) {
      return;
    }

    try {
      this.showGlobalLoading();

      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({
          whatsapp_linked: false,
          whatsapp_phone: null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user;
        this.showNotification("WhatsApp unlinked successfully", "success");
        // Refresh the page to update the UI
        setTimeout(() => {
          this.navigateTo("profile");
        }, 1000);
      } else {
        throw new Error("Failed to unlink WhatsApp");
      }
    } catch (error) {
      console.error("Error unlinking WhatsApp:", error);
      this.showNotification("Failed to unlink WhatsApp", "error");
    } finally {
      this.hideGlobalLoading();
    }
  }

  async initializeSACCOPage() {
    // Load and execute sacco.js functionality
    const script = document.createElement("script");
    script.src = "sacco.js";
    document.head.appendChild(script);
  }

  async initializeWholesalerPage() {
    // Load and execute wholesaler.js functionality
    const script = document.createElement("script");
    script.src = "wholesaler.js";
    script.onload = () => {
      console.log("Wholesaler.js loaded successfully");
    };
    document.head.appendChild(script);
  }

  setupWholesalerFunctionality() {
    // Set up tab switching
    const productsTab = document.getElementById("productsTab");
    const ordersTab = document.getElementById("ordersTab");
    const aiInsightsTab = document.getElementById("aiInsightsTab");
    const analyticsTab = document.getElementById("analyticsTab");

    if (productsTab) {
      productsTab.addEventListener("click", () =>
        this.switchWholesalerTab("products")
      );
    }
    if (ordersTab) {
      ordersTab.addEventListener("click", () =>
        this.switchWholesalerTab("orders")
      );
    }
    if (aiInsightsTab) {
      aiInsightsTab.addEventListener("click", () =>
        this.switchWholesalerTab("aiInsights")
      );
    }
    if (analyticsTab) {
      analyticsTab.addEventListener("click", () =>
        this.switchWholesalerTab("analytics")
      );
    }

    // This function is now handled by wholesaler.js
    console.log("Wholesaler functionality delegated to wholesaler.js");
  }

  switchWholesalerTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('[id$="Tab"]').forEach((tab) => {
      tab.className =
        "py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium";
    });
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) {
      activeTab.className =
        "py-4 px-2 border-b-2 border-green-600 text-green-600 font-medium";
    }

    // Update content
    document.querySelectorAll('[id$="Content"]').forEach((content) => {
      content.classList.add("hidden");
    });
    const activeContent = document.getElementById(`${tabName}Content`);
    if (activeContent) {
      activeContent.classList.remove("hidden");
    }
  }

  async loadWholesalerData() {
    try {
      // Load products from API
      const response = await fetch("/api/marketplace/my-products", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const products = data.data || [];

        // Update stats
        document.getElementById("totalProducts").textContent = products.length;
        document.getElementById("lowStockItems").textContent = products.filter(
          (p) => p.stock_quantity <= 10
        ).length;

        // Display products
        this.displayWholesalerProducts(products);
      } else {
        // Show sample data if API fails
        this.displaySampleProducts();
      }
    } catch (error) {
      console.error("Error loading wholesaler data:", error);
      this.displaySampleProducts();
    }
  }

  displayWholesalerProducts(products) {
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-6 py-8 text-center text-gray-500">
            <i class="fas fa-box-open text-4xl mb-4"></i>
            <p>No products found</p>
            <button onclick="window.agriApp.showNotification('Add product functionality coming soon!', 'info')" 
                    class="mt-2 text-green-600 hover:text-green-700">
              Add your first product
            </button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products
      .map(
        (product) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-12 w-12">
              ${
                product.image_url
                  ? `<img class="h-12 w-12 rounded-lg object-cover" src="${product.image_url}" alt="${product.name}">`
                  : `<div class="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                  <i class="fas fa-seedling text-gray-500"></i>
                </div>`
              }
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">${
                product.name
              }</div>
              <div class="text-sm text-gray-500">${
                product.description
                  ? product.description.substring(0, 50) + "..."
                  : "No description"
              }</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          ${product.category || "Uncategorized"}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          KES ${product.unit_price.toLocaleString()}/${product.unit_type}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <span class="${
            product.stock_quantity <= 10 ? "text-red-600 font-medium" : ""
          }">
            ${product.stock_quantity} ${product.unit_type}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            product.is_active
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }">
            ${product.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div class="flex space-x-2">
            <button onclick="window.agriApp.showNotification('Edit functionality coming soon!', 'info')" class="text-indigo-600 hover:text-indigo-900">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="window.agriApp.showNotification('Toggle functionality coming soon!', 'info')" class="text-yellow-600 hover:text-yellow-900">
              <i class="fas fa-eye${product.is_active ? "-slash" : ""}"></i>
            </button>
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  }

  displaySampleProducts() {
    const sampleProducts = [
      {
        name: "Premium Maize Seeds",
        description:
          "High-yield hybrid maize seeds suitable for Kenyan climate",
        category: "Seeds",
        unit_price: 150,
        stock_quantity: 1000,
        unit_type: "kg",
        is_active: true,
      },
      {
        name: "Organic Fertilizer",
        description: "NPK 17-17-17 organic fertilizer for all crops",
        category: "Fertilizers",
        unit_price: 80,
        stock_quantity: 5,
        unit_type: "kg",
        is_active: true,
      },
    ];

    this.displayWholesalerProducts(sampleProducts);

    // Update stats with sample data
    document.getElementById("totalProducts").textContent =
      sampleProducts.length;
    document.getElementById("lowStockItems").textContent =
      sampleProducts.filter((p) => p.stock_quantity <= 10).length;
    document.getElementById("activeOrders").textContent = "3";
    document.getElementById("monthlySales").textContent = "KES 45,000";
  }

  async initializeRecommendationsPage() {
    // Load and execute recommendations.js functionality
    const script = document.createElement("script");
    script.src = "recommendations.js";
    document.head.appendChild(script);
  }

  async initializeAdminPage() {
    // Load and execute admin.js functionality
    const script = document.createElement("script");
    script.src = "admin.js";
    document.head.appendChild(script);
  }

  setupChatFunctionality() {
    const chatbox = document.getElementById("chatbox");
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const clearChat = document.getElementById("clearChat");

    if (!userInput || !sendButton) return;

    // Track current phone/user session
    let currentUser = this.currentUser?.phone || "web-" + Date.now();

    // Function to create a message bubble
    const appendMessage = (sender, message) => {
      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message", "flex", "items-start", "space-x-3");

      if (sender === "user") {
        messageDiv.innerHTML = `
                    <div class="flex-1"></div>
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl rounded-tr-none p-4 shadow-md max-w-xs md:max-w-md">
                        <p>${message}</p>
                    </div>
                    <div class="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-user text-gray-600 text-sm"></i>
                    </div>
                `;
      } else {
        messageDiv.innerHTML = `
                    <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-seedling text-white text-sm"></i>
                    </div>
                    <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-xs md:max-w-md">
                        <p class="text-gray-800">${this.formatMessage(
                          message
                        )}</p>
                    </div>
                    <div class="flex-1"></div>
                `;
      }

      chatbox.appendChild(messageDiv);
      chatbox.scrollTop = chatbox.scrollHeight;
    };

    // Function to send a message
    const sendMessage = async () => {
      const userText = userInput.value.trim();
      if (userText === "") return;

      // Disable input and button
      sendButton.disabled = true;
      userInput.disabled = true;

      // Add user message to chat
      appendMessage("user", userText);
      userInput.value = "";

      // Show typing indicator
      const typingIndicator = this.createTypingIndicator();
      chatbox.appendChild(typingIndicator);
      chatbox.scrollTop = chatbox.scrollHeight;

      try {
        // Check if user is authenticated
        const token = localStorage.getItem("authToken");
        const headers = {
          "Content-Type": "application/json",
        };
        
        // Add auth token if available
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ message: userText, user: currentUser }),
        });

        const data = await response.json();

        chatbox.removeChild(typingIndicator);
        
        // Handle authentication errors
        if (response.status === 401) {
          appendMessage("bot", `🔐 **Authentication Required**

To use the AI assistant, you need to be logged in. This helps us:
• Provide personalized farming advice
• Track your usage limits
• Keep your conversations secure

<div style="margin-top: 15px;">
  <button onclick="navigateTo('login')" style="background: linear-gradient(to right, #059669, #10b981); color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
    <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>Login / Register
  </button>
</div>`);
        } else if (data.message) {
          appendMessage("bot", data.message);
        } else {
          appendMessage("bot", data.error || "Sorry, something went wrong. Please try again.");
        }
      } catch (error) {
        console.error("Error:", error);
        chatbox.removeChild(typingIndicator);
        appendMessage("bot", "Sorry, something went wrong. Please try again.");
      } finally {
        sendButton.disabled = false;
        userInput.disabled = false;
        userInput.focus();
      }
    };

    // Event listeners
    sendButton.addEventListener("click", sendMessage);

    userInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Clear chat functionality
    if (clearChat) {
      clearChat.addEventListener("click", () => {
        if (confirm("Are you sure you want to clear the chat?")) {
          chatbox.innerHTML = `
                        <div class="flex items-start space-x-3 bot-message">
                            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <i class="fas fa-seedling text-white text-sm"></i>
                            </div>
                            <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-xs md:max-w-md">
                                <p class="text-gray-800">
                                    <strong>Chat cleared! 💬</strong><br><br>
                                    What would you like to know about agriculture today?
                                </p>
                            </div>
                        </div>
                    `;
        }
      });
    }

    // Quick suggestion buttons
    document.querySelectorAll(".suggestion-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const suggestionText = btn.querySelector("span").textContent;
        userInput.value = suggestionText;
        userInput.focus();
        sendMessage();
      });
    });
  }

  createTypingIndicator() {
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("flex", "items-start", "space-x-3");
    typingDiv.id = "typing-indicator";
    typingDiv.innerHTML = `
            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-seedling text-white text-sm"></i>
            </div>
            <div class="bg-white rounded-2xl rounded-tl-none p-4 shadow-md">
                <div class="flex space-x-1">
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading" style="animation-delay: 0.2s;"></div>
                    <div class="w-2 h-2 bg-gray-400 rounded-full loading" style="animation-delay: 0.4s;"></div>
                </div>
            </div>
        `;
    return typingDiv;
  }

  formatMessage(text) {
    // Convert numbered lists to proper format
    let formatted = text.replace(/\n/g, "<br>");
    // Wrap emoji codes in spans for better rendering
    formatted = formatted.replace(
      /(🌾|🌽|🌱|🌿|🔶|⚠️|✅|❌|💰|📊)/g,
      '<span class="text-xl">$1</span>'
    );
    return formatted;
  }

  logout() {
    localStorage.removeItem("authToken");
    this.currentUser = null;
    this.isAuthenticated = false;
    this.navigateTo("welcome");
    this.showNotification("Logged out successfully", "success");
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById("loadingScreen");
    const pageContent = document.getElementById("pageContent");

    loadingScreen.classList.add("hidden");
    pageContent.classList.remove("hidden");
  }

  showGlobalLoading() {
    document.getElementById("globalLoading").classList.remove("hidden");
  }

  hideGlobalLoading() {
    document.getElementById("globalLoading").classList.add("hidden");
  }

  setupLoginFunctionality() {
    // Set up login form handling
    const loginForm = document.getElementById("loginForm");
    const registrationForm = document.getElementById("registrationForm");
    const showRegisterBtn = document.getElementById("showRegisterForm");
    const showLoginBtn = document.getElementById("showLoginForm");
    const togglePassword = document.getElementById("togglePassword");
    const userTypeSelect = document.getElementById("regUserType");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => this.handleLogin(e));
    }

    if (registrationForm) {
      registrationForm.addEventListener("submit", (e) =>
        this.handleRegistration(e)
      );
    }

    if (showRegisterBtn) {
      showRegisterBtn.addEventListener("click", () => this.showRegisterForm());
    }

    if (showLoginBtn) {
      showLoginBtn.addEventListener("click", () => this.showLoginForm());
    }

    if (togglePassword) {
      togglePassword.addEventListener("click", () =>
        this.togglePasswordVisibility()
      );
    }

    if (userTypeSelect) {
      userTypeSelect.addEventListener("change", () =>
        this.handleUserTypeChange()
      );
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      this.showNotification("Please fill in all fields", "error");
      return;
    }

    try {
      this.showGlobalLoading();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store token and user info
      localStorage.setItem("authToken", data.token);
      this.currentUser = data.user;
      this.isAuthenticated = true;

      this.showNotification("Login successful! Redirecting...", "success");

      // Redirect to dashboard
      setTimeout(() => {
        this.navigateTo("dashboard");
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideGlobalLoading();
    }
  }

  async handleRegistration(e) {
    e.preventDefault();

    const formData = {
      name: document.getElementById("regName").value.trim(),
      email: document.getElementById("regEmail").value.trim(),
      phone: document.getElementById("regPhone").value.trim(),
      user_type: document.getElementById("regUserType").value,
      location: document.getElementById("regLocation").value.trim(),
      password: document.getElementById("regPassword").value,
      confirmPassword: document.getElementById("regConfirmPassword").value,
    };

    // Add farmer-specific fields if applicable
    if (formData.user_type === "farmer") {
      const farmSize = document.getElementById("regFarmSize")?.value;
      const cropsGrown = document.getElementById("regCropsGrown")?.value.trim();

      if (farmSize) formData.farm_size = parseFloat(farmSize);
      if (cropsGrown) {
        formData.crops_grown = cropsGrown
          .split(",")
          .map((crop) => crop.trim())
          .filter((crop) => crop);
      }
    }

    // Validation
    if (
      !formData.name ||
      !formData.email ||
      !formData.phone ||
      !formData.user_type ||
      !formData.password
    ) {
      this.showNotification("Please fill in all required fields", "error");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      this.showNotification("Passwords do not match", "error");
      return;
    }

    if (formData.password.length < 8) {
      this.showNotification(
        "Password must be at least 8 characters long",
        "error"
      );
      return;
    }

    const agreeTerms = document.getElementById("agreeTerms");
    if (agreeTerms && !agreeTerms.checked) {
      this.showNotification(
        "Please agree to the Terms of Service and Privacy Policy",
        "error"
      );
      return;
    }

    // Remove confirmPassword from data sent to server
    delete formData.confirmPassword;

    try {
      this.showGlobalLoading();

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Store token and user info
      localStorage.setItem("authToken", data.token);
      this.currentUser = data.user;
      this.isAuthenticated = true;

      this.showNotification(
        "Registration successful! Welcome to AgriAI Bot!",
        "success"
      );

      // Redirect to dashboard
      setTimeout(() => {
        this.navigateTo("dashboard");
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);
      this.showNotification(error.message, "error");
    } finally {
      this.hideGlobalLoading();
    }
  }

  showRegisterForm() {
    const loginContainer = document.getElementById("loginForm")?.parentElement;
    const registerContainer = document.getElementById("registerForm");

    if (loginContainer) loginContainer.classList.add("hidden");
    if (registerContainer) registerContainer.classList.remove("hidden");
  }

  showLoginForm() {
    const loginContainer = document.getElementById("loginForm")?.parentElement;
    const registerContainer = document.getElementById("registerForm");

    if (registerContainer) registerContainer.classList.add("hidden");
    if (loginContainer) loginContainer.classList.remove("hidden");
  }

  togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    const toggleButton = document.getElementById("togglePassword");
    const icon = toggleButton?.querySelector("i");

    if (passwordInput && icon) {
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        icon.className = "fas fa-eye-slash";
      } else {
        passwordInput.type = "password";
        icon.className = "fas fa-eye";
      }
    }
  }

  handleUserTypeChange() {
    const userType = document.getElementById("regUserType")?.value;
    const farmerFields = document.getElementById("farmerFields");

    if (farmerFields) {
      if (userType === "farmer") {
        farmerFields.classList.remove("hidden");
      } else {
        farmerFields.classList.add("hidden");
      }
    }
  }

  showNotification(message, type = "info") {
    const container = document.getElementById("notificationContainer");
    const notification = document.createElement("div");

    const bgColor =
      {
        success: "bg-green-600",
        error: "bg-red-600",
        warning: "bg-yellow-600",
        info: "bg-blue-600",
      }[type] || "bg-blue-600";

    const icon =
      {
        success: "fas fa-check-circle",
        error: "fas fa-exclamation-triangle",
        warning: "fas fa-exclamation-circle",
        info: "fas fa-info-circle",
      }[type] || "fas fa-info-circle";

    notification.className = `${bgColor} text-white px-6 py-3 rounded-lg shadow-lg max-w-sm`;
    notification.innerHTML = `
            <div class="flex items-center">
                <i class="${icon} mr-3"></i>
                <span>${message}</span>
            </div>
        `;

    container.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.agriApp = new AgriAIApp();
});
