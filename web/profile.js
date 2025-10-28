// Profile page JavaScript
let currentUser = null;
let statusRefreshInterval = null;

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    loadUserProfile();
    setupEventListeners();
});

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('unlinkBtn').addEventListener('click', unlinkWhatsApp);
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// Load user profile data
async function loadUserProfile() {
    try {
        showLoading(true);
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Populate form fields
        document.getElementById('userName').textContent = currentUser.name || 'User';
        document.getElementById('userType').textContent = currentUser.user_type || 'farmer';
        document.getElementById('name').value = currentUser.name || '';
        document.getElementById('email').value = currentUser.email || '';
        document.getElementById('phone').value = currentUser.phone || '';
        document.getElementById('location').value = currentUser.location || '';
        document.getElementById('farmSize').value = currentUser.farm_size || '';
        document.getElementById('cropsGrown').value = currentUser.crops_grown ? currentUser.crops_grown.join(', ') : '';
        
        // Show/hide farmer-specific fields
        if (currentUser.user_type !== 'farmer') {
            document.getElementById('farmerFields').style.display = 'none';
        }
        
        // Load WhatsApp status
        await loadWhatsAppStatus();
        
        // Start periodic status refresh to check for auto-linking
        startStatusRefreshInterval();
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Failed to load profile data', 'error');
    } finally {
        showLoading(false);
    }
}

// Load WhatsApp linking status
async function loadWhatsAppStatus() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load WhatsApp status');
        }
        
        const data = await response.json();
        updateWhatsAppUI(data.user);
        
    } catch (error) {
        console.error('Error loading WhatsApp status:', error);
        showNotification('Failed to load WhatsApp status', 'error');
    }
}

// Update WhatsApp UI based on status
function updateWhatsAppUI(user) {
    const whatsappStatus = document.getElementById('whatsappStatus');
    const linkedSection = document.getElementById('linkedSection');
    
    if (user.whatsapp_linked) {
        // WhatsApp is linked
        whatsappStatus.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-check-circle text-green-600 mr-3"></i>
                    <div>
                        <p class="font-medium text-green-800">WhatsApp Connected</p>
                        <p class="text-sm text-green-600">${user.whatsapp_phone || 'Connected'}</p>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('linkedPhone').textContent = user.whatsapp_phone || 'Connected';
        linkedSection.classList.remove('hidden');
        
        // Stop status refresh since we're connected
        clearInterval(statusRefreshInterval);
        
    } else {
        // WhatsApp is not linked
        const userPhone = user.phone || 'your registered phone number';
        whatsappStatus.innerHTML = `
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
                    <p><strong>Step 1:</strong> Make sure you're using WhatsApp on: <span class="font-mono bg-white px-2 py-1 rounded">${userPhone}</span></p>
                    <p><strong>Step 2:</strong> Send any message to our WhatsApp bot</p>
                    <p><strong>Step 3:</strong> Your account will be automatically linked!</p>
                </div>
            </div>
        `;
        
        linkedSection.classList.add('hidden');
    }
}

// Start status refresh interval to check for auto-linking
function startStatusRefreshInterval() {
    clearInterval(statusRefreshInterval);
    statusRefreshInterval = setInterval(async () => {
        await refreshWhatsAppStatus();
    }, 10000); // Check every 10 seconds
}

// Refresh WhatsApp status to check for auto-linking
async function refreshWhatsAppStatus() {
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            return; // Silently fail for background refresh
        }
        
        const data = await response.json();
        
        // If WhatsApp got linked, update UI and show notification
        if (data.user.whatsapp_linked && !currentUser.whatsapp_linked) {
            currentUser = data.user;
            updateWhatsAppUI(data.user);
            showNotification('WhatsApp linked successfully!', 'success');
        }
        
    } catch (error) {
        console.error('Error refreshing WhatsApp status:', error);
    }
}

// Unlink WhatsApp account
async function unlinkWhatsApp() {
    if (!confirm('Are you sure you want to unlink your WhatsApp account?')) {
        return;
    }
    
    try {
        showLoading(true);
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                whatsapp_linked: false,
                whatsapp_phone: null
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to unlink WhatsApp');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        showNotification('WhatsApp account unlinked successfully', 'success');
        await loadWhatsAppStatus();
        
        // Restart status refresh interval
        startStatusRefreshInterval();
        
    } catch (error) {
        console.error('Error unlinking WhatsApp:', error);
        showNotification('Failed to unlink WhatsApp account', 'error');
    } finally {
        showLoading(false);
    }
}

// Update user profile
async function updateProfile(event) {
    event.preventDefault();
    
    try {
        showLoading(true);
        
        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            location: document.getElementById('location').value,
            farm_size: document.getElementById('farmSize').value || null,
            crops_grown: document.getElementById('cropsGrown').value.split(',').map(crop => crop.trim()).filter(crop => crop)
        };
        
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to update profile');
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Update display name
        document.getElementById('userName').textContent = currentUser.name || 'User';
        
        showNotification('Profile updated successfully', 'success');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Failed to update profile', 'error');
    } finally {
        showLoading(false);
    }
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

// Show loading indicator
function showLoading(show) {
    const indicator = document.getElementById('loadingIndicator');
    if (show) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                'fa-info-circle'
            } mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Cleanup intervals when page unloads
window.addEventListener('beforeunload', () => {
    clearInterval(statusRefreshInterval);
});