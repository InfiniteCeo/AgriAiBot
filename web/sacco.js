// SACCO Management JavaScript


let userSACCOs = [];
let availableSACCOs = [];

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    loadUserSACCOs();
    loadAvailableSACCOs();
    
    // Set up form submission
    document.getElementById('createSACCOForm').addEventListener('submit', handleCreateSACCO);
});

// Check if user is authenticated
async function checkAuthentication() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showAuthenticationRequired();
        return Promise.reject('No token');
    }
    
    // Verify token and get user info
    try {
        const response = await fetch('/api/auth/validate', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        const data = await response.json();
        window.agriApp.currentUser = data.user;
        document.getElementById('userInfo').textContent = `Welcome, ${window.agriApp.currentUser.name}`;

        // Check if user is a farmer
        if (window.agriApp.currentUser.user_type !== 'farmer' && window.agriApp.currentUser.user_type !== 'admin') {
            showError('Only farmers can access SACCO groups');
            setTimeout(() => {
                window.location.href = '/profile.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Authentication error:', error);
        localStorage.removeItem('authToken');
        window.location.href = '/profile.html';
        throw error;
    }
}

// Load user's SACCO groups
async function loadUserSACCOs() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/sacco/user/my-saccos', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Failed to fetch user's SACCOs");
        }
        userSACCOs = data.saccos;
        displayUserSACCOs();
    } catch (error) {
        console.error('Error loading user SACCOs:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Load available SACCO groups
async function loadAvailableSACCOs() {
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/sacco', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch available SACCOs');
        }
        availableSACCOs = data.saccos;
        displayAvailableSACCOs();
    } catch (error) {
        console.error('Error loading available SACCOs:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// Display user's SACCO groups
function displayUserSACCOs() {
    const container = document.getElementById('mySACCOs');
    
    if (!window.agriApp.currentUser) {
        // If currentUser is not yet loaded, wait for it.
        setTimeout(displayUserSACCOs, 100);
        return;
    }

    if (userSACCOs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-500">
                <i class="fas fa-users text-4xl mb-4"></i>
                <p>You haven't joined any SACCO groups yet.</p>
                <p class="text-sm">Create a new SACCO or join an existing one below.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = userSACCOs.map(sacco => `
        <div class="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${sacco.name}</h3>
                ${sacco.admin && sacco.admin.id === window.agriApp.currentUser.id ? 
                    '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Admin</span>' : 
                    '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Member</span>'
                }
            </div>
            <p class="text-gray-600 text-sm mb-3">${sacco.description || 'No description available'}</p>
            <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span><i class="fas fa-map-marker-alt mr-1"></i>${sacco.region}</span>
                <span><i class="fas fa-calendar mr-1"></i>Joined ${new Date(sacco.joined_at).toLocaleDateString()}</span>
            </div>
            <div class="flex space-x-2">
                <button onclick="viewSACCODetails('${sacco.id}')" 
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm">
                    <i class="fas fa-eye mr-1"></i>View Details
                </button>
                <button onclick="viewBulkOrders('${sacco.id}')" 
                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm">
                    <i class="fas fa-shopping-cart mr-1"></i>Bulk Orders
                </button>
            </div>
        </div>
    `).join('');
}

// Display available SACCO groups
function displayAvailableSACCOs() {
    const container = document.getElementById('availableSACCOs');
    
    // Filter out SACCOs user is already a member of
    const userSACCOIds = userSACCOs.map(sacco => sacco.id);
    const filteredSACCOs = availableSACCOs.filter(sacco => !userSACCOIds.includes(sacco.id));
    
    if (filteredSACCOs.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-500">
                <i class="fas fa-search text-4xl mb-4"></i>
                <p>No available SACCO groups found.</p>
                <p class="text-sm">Try adjusting your search criteria or create a new SACCO group.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredSACCOs.map(sacco => `
        <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex justify-between items-start mb-3">
                <h3 class="text-lg font-semibold text-gray-800">${sacco.name}</h3>
                <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                    ${sacco.member_count}/${sacco.member_limit} members
                </span>
            </div>
            <p class="text-gray-600 text-sm mb-3">${sacco.description || 'No description available'}</p>
            <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span><i class="fas fa-map-marker-alt mr-1"></i>${sacco.region}</span>
                <span><i class="fas fa-user mr-1"></i>Admin: ${sacco.admin ? sacco.admin.name : 'Unknown'}</span>
            </div>
            <div class="flex space-x-2">
                <button onclick="viewSACCODetails('${sacco.id}')" 
                        class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded text-sm">
                    <i class="fas fa-info-circle mr-1"></i>Details
                </button>
                <button onclick="joinSACCO('${sacco.id}')" 
                        class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-3 rounded text-sm"
                        ${sacco.member_count >= sacco.member_limit ? 'disabled' : ''}>
                    <i class="fas fa-plus mr-1"></i>Join
                </button>
            </div>
        </div>
    `).join('');
}

function searchSACCOs() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const region = document.getElementById('regionFilter').value;
    
    let url = '/api/sacco?';
    const params = new URLSearchParams();
    
    if (searchTerm) params.append('search', searchTerm);
    if (region) params.append('region', region);
    
    const token = localStorage.getItem('authToken');
    
    fetch(`/api/sacco?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        availableSACCOs = data.saccos;
        displayAvailableSACCOs();
    })
    .catch(error => {
        console.error('Error searching SACCOs:', error);
        showError('Failed to search SACCO groups');
    });
}

// Show create SACCO modal
function showCreateSACCOModal() {
    console.log('Create SACCO button clicked!');
    const modal = document.getElementById('createSACCOModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        console.log('Modal should be visible now');
    } else {
        console.error('Modal not found!');
        // Fallback: create SACCO directly
        createSACCODirectly();
    }
}

// Hide create SACCO modal
function hideCreateSACCOModal() {
    document.getElementById('createSACCOModal').classList.add('hidden');
    document.getElementById('createSACCOModal').classList.remove('flex');
    document.getElementById('createSACCOForm').reset();
}

// Handle create SACCO form submission
async function handleCreateSACCO(event) {
    console.log('handleCreateSACCO function called');
    event.preventDefault();
    showLoading(true);

    const formData = {
        name: document.getElementById('saccoName').value.trim(),
        region: document.getElementById('saccoRegion').value,
        description: document.getElementById('saccoDescription').value.trim(),
        member_limit: parseInt(document.getElementById('saccoMemberLimit').value)
    };

    if (!formData.name || !formData.region) {
        showError('Please fill in all required fields');
        showLoading(false);
        return;
    }

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/sacco', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Error creating SACCO:', data);
            throw new Error(data.message || 'Failed to create SACCO');
        }

        showSuccess(`SACCO "${formData.name}" created successfully!`);
        hideCreateSACCOModal();
        await loadUserSACCOs();
        await loadAvailableSACCOs();

    } catch (error) {
        console.error('Error creating SACCO:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}



// Join a SACCO group
async function joinSACCO(saccoId) {
    if (!confirm('Are you sure you want to join this SACCO group?')) {
        return;
    }
    
    try {
        showLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`/api/sacco/${saccoId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to join SACCO group');
        }
        
        showSuccess('Successfully joined SACCO group!');
        
        // Reload SACCO groups
        await loadUserSACCOs();
        await loadAvailableSACCOs();
        
    } catch (error) {
        console.error('Error joining SACCO:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// View SACCO details
function viewSACCODetails(saccoId) {
    // For now, redirect to a details page (to be implemented)
    window.location.href = `/sacco-details.html?id=${saccoId}`;
}

// View bulk orders for a SACCO
function viewBulkOrders(saccoId) {
    // For now, redirect to bulk orders page (to be implemented)
    window.location.href = `/bulk-orders.html?sacco=${saccoId}`;
}

// Utility functions
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.remove('hidden');
        spinner.classList.add('flex');
    } else {
        spinner.classList.add('hidden');
        spinner.classList.remove('flex');
    }
}

function showError(message) {
    // Create and show error toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-circle mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function showSuccess(message) {
    // Create and show success toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/profile.html';
}

// Show authentication required message
function showAuthenticationRequired() {
    document.getElementById('userInfo').innerHTML = `
        <span class="text-red-200">Not logged in</span>
        <button onclick="window.location.href='/login.html'" class="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm ml-2">
            Login
        </button>
    `;
    
    // Show authentication message in main content
    const container = document.querySelector('.container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-16">
                <div class="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
                    <i class="fas fa-lock text-4xl text-gray-400 mb-4"></i>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Authentication Required</h2>
                    <p class="text-gray-600 mb-6">You need to be logged in to access SACCO groups.</p>
                    <div class="space-y-3">
                        <button onclick="window.location.href='/login.html'" 
                                class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg">
                            <i class="fas fa-sign-in-alt mr-2"></i>Login
                        </button>
                        <button onclick="window.location.href='/profile.html'" 
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg">
                            <i class="fas fa-user-plus mr-2"></i>Register
                        </button>

                    </div>
                </div>
            </div>
        `;
    }
}





// Add search on Enter key
document.getElementById('searchInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchSACCOs();
    }
});

// Add region filter change event
document.getElementById('regionFilter').addEventListener('change', searchSACCOs);