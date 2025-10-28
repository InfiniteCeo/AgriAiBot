document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication and admin privileges
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize admin panel
    await initializeAdminPanel();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    await loadDashboardData();
});

let currentUser = null;
let currentUsers = [];
let currentPage = 0;
let isLoading = false;

async function initializeAdminPanel() {
    try {
        showLoading();
        
        // Get user profile and verify admin access
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
        
        // Check if user is admin
        if (currentUser.user_type !== 'admin') {
            showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            return;
        }
        
        // Update admin name display
        document.getElementById('adminName').textContent = currentUser.name;
        
        hideLoading();
    } catch (error) {
        console.error('Error initializing admin panel:', error);
        hideLoading();
        // Redirect to login if authentication fails
        if (error.message.includes('Failed to load profile')) {
            localStorage.removeItem('authToken');
            window.location.href = 'login.html';
        }
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = 'login.html';
    });
    
    // Tab switching
    document.getElementById('usersTab').addEventListener('click', () => switchTab('users'));
    document.getElementById('systemTab').addEventListener('click', () => switchTab('system'));
    document.getElementById('analyticsTab').addEventListener('click', () => switchTab('analytics'));
    
    // User management
    document.getElementById('refreshBtn').addEventListener('click', loadDashboardData);
    document.getElementById('createUserBtn').addEventListener('click', showCreateUserModal);
    
    // User search and filters
    let searchTimeout;
    document.getElementById('userSearch').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadUsers();
        }, 500);
    });
    
    document.getElementById('userTypeFilter').addEventListener('change', loadUsers);
    document.getElementById('statusFilter').addEventListener('change', loadUsers);
    
    // Select all users
    document.getElementById('selectAllUsers').addEventListener('change', toggleSelectAllUsers);
    
    // Modal close on outside click
    document.getElementById('userModal').addEventListener('click', (e) => {
        if (e.target.id === 'userModal') {
            closeUserModal();
        }
    });
}

async function loadDashboardData() {
    try {
        showLoading();
        
        // Load stats in parallel
        const [users, systemHealth] = await Promise.allSettled([
            loadUsers(),
            loadSystemHealth()
        ]);
        
        // Update stats display
        updateStatsDisplay();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

async function loadUsers() {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        const search = document.getElementById('userSearch').value.trim();
        const userType = document.getElementById('userTypeFilter').value;
        const status = document.getElementById('statusFilter').value;
        
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (userType) queryParams.append('user_type', userType);
        if (status) queryParams.append('status', status);
        queryParams.append('limit', '50');
        queryParams.append('offset', '0');
        
        const response = await fetch(`/api/users?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const data = await response.json();
        currentUsers = data.users || [];
        
        displayUsers();
        updateStatsDisplay();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
        
        // Show fallback data if API fails
        currentUsers = [];
        displayUsers();
    } finally {
        isLoading = false;
    }
}

function displayUsers() {
    const tbody = document.getElementById('usersTableBody');
    
    if (currentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-users text-4xl mb-4"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = currentUsers.map(user => {
        const userTypeClass = `type-${user.user_type}`;
        const statusClass = user.last_seen && isRecentlyActive(user.last_seen) ? 'status-active' : 'status-inactive';
        const statusText = user.last_seen && isRecentlyActive(user.last_seen) ? 'Active' : 'Inactive';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" class="user-checkbox rounded border-gray-300" value="${user.id}">
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <div class="h-10 w-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                                <span class="text-white font-bold text-sm">${user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${user.name || 'Unknown'}</div>
                            <div class="text-sm text-gray-500">${user.email || user.phone || 'No contact'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${userTypeClass}">
                        ${user.user_type || 'farmer'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${user.location || 'Not specified'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.created_at ? formatDate(user.created_at) : 'Unknown'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.last_seen ? formatDate(user.last_seen) : 'Never'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="viewUser('${user.id}')" class="text-indigo-600 hover:text-indigo-900">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="editUser('${user.id}')" class="text-green-600 hover:text-green-900">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${user.user_type !== 'admin' ? 
                            `<button onclick="toggleUserStatus('${user.id}')" class="text-yellow-600 hover:text-yellow-900">
                                <i class="fas fa-user-slash"></i>
                            </button>` : ''
                        }
                        ${user.user_type !== 'admin' ? 
                            `<button onclick="deleteUser('${user.id}')" class="text-red-600 hover:text-red-900">
                                <i class="fas fa-trash"></i>
                            </button>` : ''
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update pagination info
    document.getElementById('usersShowing').textContent = currentUsers.length;
    document.getElementById('usersTotal').textContent = currentUsers.length;
}

async function loadSystemHealth() {
    try {
        const response = await fetch('/api/debug/health', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        const data = await response.json();
        
        const systemStatus = document.getElementById('systemStatus');
        const apiHealth = document.getElementById('apiHealth');
        
        if (systemStatus) {
            systemStatus.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">Database</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${data.database === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${data.database === 'connected' ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">System Status</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${data.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${data.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
                    </span>
                </div>
                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">Last Check</span>
                    <span class="text-sm text-gray-600">${formatDate(data.timestamp)}</span>
                </div>
            `;
        }
        
        if (apiHealth) {
            apiHealth.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">Supabase</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${data.environment.supabase_url === 'configured' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${data.environment.supabase_url === 'configured' ? 'Configured' : 'Missing'}
                    </span>
                </div>
                <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                    <span class="font-medium">Gemini AI</span>
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${data.environment.gemini_key === 'configured' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${data.environment.gemini_key === 'configured' ? 'Configured' : 'Missing'}
                    </span>
                </div>
                <div class="p-3 bg-white rounded-lg">
                    <div class="text-sm font-medium mb-2">Quick Fix</div>
                    ${data.environment.gemini_key !== 'configured' ? 
                        '<p class="text-xs text-red-600">Add GEMINI_API_KEY to your .env file to fix AI chat</p>' :
                        '<p class="text-xs text-green-600">All APIs are properly configured</p>'
                    }
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading system health:', error);
    }
}

function updateStatsDisplay() {
    // Update total users
    document.getElementById('totalUsers').textContent = currentUsers.length;
    
    // Update farmers count
    const farmersCount = currentUsers.filter(user => user.user_type === 'farmer').length;
    document.getElementById('activeFarmers').textContent = farmersCount;
    
    // Update wholesalers count
    const wholesalersCount = currentUsers.filter(user => user.user_type === 'wholesaler').length;
    document.getElementById('totalWholesalers').textContent = wholesalersCount;
    
    // Update today's queries (placeholder)
    document.getElementById('todayQueries').textContent = Math.floor(Math.random() * 100);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('[id$="Tab"]').forEach(tab => {
        tab.className = 'py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium';
    });
    document.getElementById(`${tabName}Tab`).className = 'py-4 px-2 border-b-2 border-green-600 text-green-600 font-medium';
    
    // Update content
    document.querySelectorAll('[id$="Content"]').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}Content`).classList.remove('hidden');
    
    // Load data for the active tab
    if (tabName === 'users') {
        loadUsers();
    } else if (tabName === 'system') {
        loadSystemHealth();
    } else if (tabName === 'analytics') {
        loadAnalytics();
    }
}

async function viewUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;
    
    showUserModal(user, 'view');
}

async function editUser(userId) {
    const user = currentUsers.find(u => u.id === userId);
    if (!user) return;
    
    showUserModal(user, 'edit');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        
        // For now, just show a message since we don't have a delete endpoint
        showNotification('User deletion functionality coming soon', 'info');
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Failed to delete user', 'error');
    } finally {
        hideLoading();
    }
}

function showUserModal(user, mode = 'view') {
    const modal = document.getElementById('userModal');
    const isEditing = mode === 'edit';
    
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 class="text-2xl font-bold text-gray-800">
                    ${isEditing ? 'Edit User' : 'User Details'}
                </h2>
                <button onclick="closeUserModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <!-- Modal Content -->
            <div class="p-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input type="text" value="${user.name || ''}" ${isEditing ? '' : 'readonly'} 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input type="email" value="${user.email || ''}" ${isEditing ? '' : 'readonly'} 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                        <input type="tel" value="${user.phone || ''}" ${isEditing ? '' : 'readonly'} 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">User Type</label>
                        <select ${isEditing ? '' : 'disabled'} 
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                            <option value="farmer" ${user.user_type === 'farmer' ? 'selected' : ''}>Farmer</option>
                            <option value="wholesaler" ${user.user_type === 'wholesaler' ? 'selected' : ''}>Wholesaler</option>
                            <option value="admin" ${user.user_type === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                    
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                        <input type="text" value="${user.location || ''}" ${isEditing ? '' : 'readonly'} 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                    </div>
                    
                    ${user.user_type === 'farmer' ? `
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Farm Size (acres)</label>
                            <input type="number" value="${user.farm_size || ''}" ${isEditing ? '' : 'readonly'} 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Crops Grown</label>
                            <input type="text" value="${user.crops_grown ? user.crops_grown.join(', ') : ''}" ${isEditing ? '' : 'readonly'} 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-lg ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-green-500' : 'bg-gray-50'}">
                        </div>
                    ` : ''}
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Joined</label>
                        <input type="text" value="${user.created_at ? formatDate(user.created_at) : 'Unknown'}" readonly 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Last Seen</label>
                        <input type="text" value="${user.last_seen ? formatDate(user.last_seen) : 'Never'}" readonly 
                               class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    </div>
                </div>
                
                <div class="flex space-x-3 mt-6">
                    <button onclick="closeUserModal()" 
                            class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 px-4 rounded-lg transition-colors">
                        ${isEditing ? 'Cancel' : 'Close'}
                    </button>
                    ${isEditing ? 
                        `<button onclick="saveUser('${user.id}')" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                            <i class="fas fa-save mr-2"></i>Save Changes
                        </button>` : 
                        `<button onclick="editUser('${user.id}')" 
                                class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors">
                            <i class="fas fa-edit mr-2"></i>Edit User
                        </button>`
                    }
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showCreateUserModal() {
    showNotification('Create user functionality coming soon', 'info');
}

function toggleSelectAllUsers() {
    const selectAll = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

async function loadAnalytics() {
    const activityStats = document.getElementById('activityStats');
    
    if (activityStats) {
        activityStats.innerHTML = `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                <span class="font-medium">Total Queries</span>
                <span class="text-lg font-bold text-green-600">${Math.floor(Math.random() * 1000)}</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                <span class="font-medium">Active Sessions</span>
                <span class="text-lg font-bold text-blue-600">${Math.floor(Math.random() * 50)}</span>
            </div>
            <div class="flex items-center justify-between p-3 bg-white rounded-lg">
                <span class="font-medium">New Users Today</span>
                <span class="text-lg font-bold text-purple-600">${Math.floor(Math.random() * 10)}</span>
            </div>
        `;
    }
}

function isRecentlyActive(lastSeen) {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInHours = (now - lastSeenDate) / (1000 * 60 * 60);
    return diffInHours < 24; // Active if seen within 24 hours
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    
    const bgColor = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    }[type] || 'bg-blue-600';

    const icon = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-triangle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    }[type] || 'fas fa-info-circle';

    notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="${icon} mr-3"></i>
            <span>${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}