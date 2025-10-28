document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize dashboard
    await initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load dashboard data
    await loadDashboardData();
    
    // Set current date
    updateCurrentDate();
    
    // Start periodic updates
    startPeriodicUpdates();
});

let currentUser = null;

async function initializeDashboard() {
    try {
        showLoading();
        
        // Get user profile
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Update UI based on user type
        updateUIForUserType();
        
        // Update user name displays
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('welcomeName').textContent = currentUser.name;
        
        // Update welcome message based on user type
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (currentUser.user_type === 'wholesaler') {
            welcomeMessage.textContent = 'Manage your inventory and connect with farmers';
        } else {
            welcomeMessage.textContent = 'Your agricultural assistant and marketplace platform';
        }
        
        hideLoading();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        hideLoading();
        // Redirect to login if authentication fails
        if (error.message.includes('Failed to load profile')) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
}

function updateUIForUserType() {
    if (currentUser.user_type === 'wholesaler') {
        // Show wholesaler-specific features
        document.getElementById('wholesalerCard').classList.remove('hidden');
        
        // Hide farmer-specific features
        document.getElementById('saccoFeatureCard').classList.add('hidden');
        document.getElementById('saccoStatsCard').classList.add('hidden');
    } else {
        // Show farmer-specific features
        document.getElementById('saccoFeatureCard').classList.remove('hidden');
        document.getElementById('saccoStatsCard').classList.remove('hidden');
        
        // Hide wholesaler-specific features
        document.getElementById('wholesalerCard').classList.add('hidden');
    }
}

async function loadDashboardData() {
    try {
        // Load stats in parallel
        const [chatStats, orderStats, saccoStats, recommendationStats] = await Promise.allSettled([
            loadChatStats(),
            loadOrderStats(),
            loadSACCOStats(),
            loadRecommendationStats()
        ]);
        
        // Update stats display
        if (chatStats.status === 'fulfilled') {
            document.getElementById('chatCount').textContent = chatStats.value;
        }
        
        if (orderStats.status === 'fulfilled') {
            document.getElementById('orderCount').textContent = orderStats.value;
        }
        
        if (saccoStats.status === 'fulfilled' && currentUser.user_type === 'farmer') {
            document.getElementById('saccoCount').textContent = saccoStats.value;
        }
        
        if (recommendationStats.status === 'fulfilled') {
            document.getElementById('recommendationCount').textContent = recommendationStats.value;
        }
        
        // Load recent activity
        await loadRecentActivity();
        
        // Load notifications
        await loadNotifications();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadChatStats() {
    try {
        const response = await fetch(`/api/history?user=${currentUser.phone || currentUser.id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.history ? data.history.length : 0;
        }
        return 0;
    } catch (error) {
        console.error('Error loading chat stats:', error);
        return 0;
    }
}

async function loadOrderStats() {
    try {
        const response = await fetch('/api/orders/my-orders', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Count active orders (not delivered or cancelled)
            const activeOrders = data.orders ? data.orders.filter(order => 
                !['delivered', 'cancelled'].includes(order.status)
            ).length : 0;
            return activeOrders;
        }
        return 0;
    } catch (error) {
        console.error('Error loading order stats:', error);
        return 0;
    }
}

async function loadSACCOStats() {
    if (currentUser.user_type !== 'farmer') return 0;
    
    try {
        const response = await fetch('/api/sacco/user/my-saccos', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.saccos ? data.saccos.length : 0;
        }
        return 0;
    } catch (error) {
        console.error('Error loading SACCO stats:', error);
        return 0;
    }
}

async function loadRecommendationStats() {
    try {
        const response = await fetch('/api/market/recommendations', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // Count unread recommendations
            const unreadCount = data.recommendations ? data.recommendations.filter(rec => !rec.is_read).length : 0;
            return unreadCount;
        }
        return 0;
    } catch (error) {
        console.error('Error loading recommendation stats:', error);
        return 0;
    }
}

async function loadRecentActivity() {
    const activityContainer = document.getElementById('recentActivity');
    
    try {
        // Load recent activities from different sources
        const activities = [];
        
        // Recent chat messages
        try {
            const chatResponse = await fetch(`/api/history?user=${currentUser.phone || currentUser.id}&limit=3`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (chatResponse.ok) {
                const chatData = await chatResponse.json();
                if (chatData.history) {
                    chatData.history.forEach(chat => {
                        activities.push({
                            type: 'chat',
                            title: 'AI Consultation',
                            description: chat.question.substring(0, 100) + '...',
                            timestamp: chat.timestamp,
                            icon: 'fas fa-comments',
                            color: 'text-blue-600'
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Error loading chat activity:', error);
        }
        
        // Recent orders
        try {
            const orderResponse = await fetch('/api/orders/my-orders?limit=3', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (orderResponse.ok) {
                const orderData = await orderResponse.json();
                if (orderData.orders) {
                    orderData.orders.forEach(order => {
                        activities.push({
                            type: 'order',
                            title: `Order ${order.status}`,
                            description: `${order.product?.name || 'Product'} - ${order.quantity} ${order.product?.unit_type || 'units'}`,
                            timestamp: order.created_at,
                            icon: 'fas fa-shopping-cart',
                            color: 'text-green-600'
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Error loading order activity:', error);
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
            activityContainer.innerHTML = activities.slice(0, 5).map(activity => `
                <div class="flex items-start space-x-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                    <div class="flex-shrink-0">
                        <i class="${activity.icon} ${activity.color} text-lg"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-gray-800">${activity.title}</p>
                        <p class="text-sm text-gray-600 truncate">${activity.description}</p>
                        <p class="text-xs text-gray-500 mt-1">${formatTimestamp(activity.timestamp)}</p>
                    </div>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        activityContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Error loading recent activity</p>
            </div>
        `;
    }
}

async function loadNotifications() {
    try {
        const response = await fetch('/api/market/recommendations', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const unreadCount = data.recommendations ? data.recommendations.filter(rec => !rec.is_read).length : 0;
            
            const badge = document.getElementById('notificationBadge');
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });
    
    // Notification button
    document.getElementById('notificationBtn').addEventListener('click', toggleNotificationPanel);
    document.getElementById('closeNotifications').addEventListener('click', hideNotificationPanel);
    
    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notificationPanel');
        const btn = document.getElementById('notificationBtn');
        
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
            hideNotificationPanel();
        }
    });
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (panel.classList.contains('hidden')) {
        showNotificationPanel();
    } else {
        hideNotificationPanel();
    }
}

async function showNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    const listContainer = document.getElementById('notificationList');
    
    panel.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/market/recommendations', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const recommendations = data.recommendations || [];
            
            if (recommendations.length === 0) {
                listContainer.innerHTML = `
                    <div class="p-4 text-center text-gray-500">
                        <i class="fas fa-bell-slash text-2xl mb-2"></i>
                        <p>No new notifications</p>
                    </div>
                `;
            } else {
                listContainer.innerHTML = recommendations.slice(0, 10).map(rec => `
                    <div class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${rec.is_read ? '' : 'bg-blue-50'}" 
                         onclick="markAsRead('${rec.id}')">
                        <div class="flex items-start space-x-3">
                            <i class="fas fa-lightbulb text-yellow-500 mt-1"></i>
                            <div class="flex-1">
                                <p class="font-medium text-gray-800 text-sm">${rec.title}</p>
                                <p class="text-xs text-gray-600 mt-1">${rec.description}</p>
                                <p class="text-xs text-gray-500 mt-2">${formatTimestamp(rec.created_at)}</p>
                            </div>
                            ${!rec.is_read ? '<div class="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>' : ''}
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        listContainer.innerHTML = `
            <div class="p-4 text-center text-gray-500">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>Error loading notifications</p>
            </div>
        `;
    }
}

function hideNotificationPanel() {
    document.getElementById('notificationPanel').classList.add('hidden');
}

async function markAsRead(recommendationId) {
    try {
        await fetch(`/api/market/recommendations/${recommendationId}/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        // Refresh notifications
        await loadNotifications();
        await showNotificationPanel();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function startPeriodicUpdates() {
    // Update notifications every 5 minutes
    setInterval(loadNotifications, 5 * 60 * 1000);
    
    // Update stats every 10 minutes
    setInterval(loadDashboardData, 10 * 60 * 1000);
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}