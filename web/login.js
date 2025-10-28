document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in (only if not in SPA mode)
    if (!window.agriApp) {
        const token = localStorage.getItem('authToken');
        if (token) {
            // Verify token is still valid
            verifyToken().then(isValid => {
                if (isValid) {
                    window.location.href = 'dashboard.html';
                } else {
                    localStorage.removeItem('authToken');
                }
            });
        }
    }

    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Form submissions
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registrationForm').addEventListener('submit', handleRegistration);
    
    // Form switching
    document.getElementById('showRegisterForm').addEventListener('click', showRegisterForm);
    document.getElementById('showLoginForm').addEventListener('click', showLoginForm);
    
    // Password toggle
    document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);
    
    // User type change for registration
    document.getElementById('regUserType').addEventListener('change', handleUserTypeChange);
    
    // Forgot password
    document.getElementById('forgotPasswordLink').addEventListener('click', handleForgotPassword);
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        
        // Store token and user info
        localStorage.setItem('authToken', data.token);
        
        showSuccess('Login successful! Redirecting...');
        
        // Redirect based on user type
        setTimeout(() => {
            if (window.agriApp) {
                window.agriApp.currentUser = data.user;
                window.agriApp.isAuthenticated = true;
                window.agriApp.navigateTo('dashboard');
            } else {
                // Fallback for direct access
                if (data.user.user_type === 'wholesaler') {
                    window.location.href = 'wholesaler.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        }, 1000);
        
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

async function handleRegistration(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phone: document.getElementById('regPhone').value.trim(),
        user_type: document.getElementById('regUserType').value,
        location: document.getElementById('regLocation').value.trim(),
        password: document.getElementById('regPassword').value,
        confirmPassword: document.getElementById('regConfirmPassword').value
    };
    
    // Add farmer-specific fields if applicable
    if (formData.user_type === 'farmer') {
        const farmSize = document.getElementById('regFarmSize').value;
        const cropsGrown = document.getElementById('regCropsGrown').value.trim();
        
        if (farmSize) formData.farm_size = parseFloat(farmSize);
        if (cropsGrown) {
            formData.crops_grown = cropsGrown.split(',').map(crop => crop.trim()).filter(crop => crop);
        }
    }
    
    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.user_type || !formData.password) {
        showError('Please fill in all required fields');
        return;
    }
    
    if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    if (formData.password.length < 8) {
        showError('Password must be at least 8 characters long');
        return;
    }
    
    if (!document.getElementById('agreeTerms').checked) {
        showError('Please agree to the Terms of Service and Privacy Policy');
        return;
    }
    
    // Remove confirmPassword from data sent to server
    delete formData.confirmPassword;
    
    try {
        showLoading();
        
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }
        
        // Store token and user info
        localStorage.setItem('authToken', data.token);
        
        showSuccess('Registration successful! Welcome to AgriAI Bot!');
        
        // Redirect based on user type
        setTimeout(() => {
            if (window.agriApp) {
                window.agriApp.currentUser = data.user;
                window.agriApp.isAuthenticated = true;
                window.agriApp.navigateTo('dashboard');
            } else {
                // Fallback for direct access
                if (data.user.user_type === 'wholesaler') {
                    window.location.href = 'wholesaler.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
        }, 1500);
        
    } catch (error) {
        console.error('Registration error:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

function showRegisterForm() {
    document.getElementById('loginForm').parentElement.classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function showLoginForm() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').parentElement.classList.remove('hidden');
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleButton = document.getElementById('togglePassword');
    const icon = toggleButton.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function handleUserTypeChange() {
    const userType = document.getElementById('regUserType').value;
    const farmerFields = document.getElementById('farmerFields');
    
    if (userType === 'farmer') {
        farmerFields.classList.remove('hidden');
    } else {
        farmerFields.classList.add('hidden');
    }
}

function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = prompt('Please enter your email address:');
    if (!email) return;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    // Send password reset request
    fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    })
    .then(response => response.json())
    .then(data => {
        if (data.resetToken) {
            // In a real application, this would be sent via email
            const newPassword = prompt(`Password reset token: ${data.resetToken}\n\nEnter your new password:`);
            if (newPassword && newPassword.length >= 8) {
                return fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        token: data.resetToken, 
                        newPassword 
                    })
                });
            }
        }
        throw new Error('Password reset cancelled');
    })
    .then(response => {
        if (response) {
            return response.json();
        }
    })
    .then(data => {
        if (data) {
            showSuccess('Password reset successful! You can now login with your new password.');
        }
    })
    .catch(error => {
        console.error('Password reset error:', error);
        if (error.message !== 'Password reset cancelled') {
            showError('Password reset failed. Please try again.');
        }
    });
}

async function verifyToken() {
    try {
        const response = await fetch('/api/auth/validate', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function showLoading() {
    document.getElementById('loadingIndicator').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function showSuccess(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-3"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}