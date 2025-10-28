const express = require('express');
const { 
    createUser, 
    authenticateUser, 
    getUserById, 
    updateUserProfile, 
    updateUserPassword 
} = require('../services/supabase');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { 
    generatePasswordResetToken, 
    verifyPasswordResetToken, 
    resetPassword 
} = require('../services/passwordReset');

const router = express.Router();

/**
 * User registration endpoint
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { 
            email, 
            password, 
            phone, 
            name, 
            user_type, 
            location, 
            farm_size, 
            crops_grown 
        } = req.body;
        
        // Validate required fields
        if (!email || !password || !phone || !name) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, phone, and name are required'
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Invalid email format',
                message: 'Please provide a valid email address'
            });
        }
        
        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'Password must be at least 8 characters long'
            });
        }
        
        // Validate user type
        const validUserTypes = ['farmer', 'wholesaler'];
        if (user_type && !validUserTypes.includes(user_type)) {
            return res.status(400).json({
                error: 'Invalid user type',
                message: 'User type must be either "farmer" or "wholesaler"'
            });
        }
        
        // Create user
        const userData = {
            email: email.toLowerCase().trim(),
            password,
            phone: phone.trim(),
            name: name.trim(),
            user_type: user_type || 'farmer',
            location: location?.trim(),
            farm_size: farm_size ? parseFloat(farm_size) : null,
            crops_grown: Array.isArray(crops_grown) ? crops_grown : []
        };
        
        const newUser = await createUser(userData);
        
        // Generate JWT token
        const token = generateToken(newUser);
        
        res.status(201).json({
            message: 'User registered successfully',
            user: newUser,
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                error: 'User already exists',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Registration failed',
            message: 'An error occurred during registration'
        });
    }
});

/**
 * User login endpoint
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }
        
        // Authenticate user
        const user = await authenticateUser(email.toLowerCase().trim(), password);
        
        // Generate JWT token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            user,
            token
        });
        
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.message.includes('Invalid email or password')) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid email or password'
            });
        }
        
        res.status(500).json({
            error: 'Login failed',
            message: 'An error occurred during login'
        });
    }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            message: 'Profile retrieved successfully',
            user: req.user
        });
    } catch (error) {
        console.error('Profile retrieval error:', error);
        res.status(500).json({
            error: 'Profile retrieval failed',
            message: 'An error occurred while retrieving profile'
        });
    }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { 
            name, 
            phone, 
            location, 
            farm_size, 
            crops_grown 
        } = req.body;
        
        // Prepare updates object
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (phone !== undefined) updates.phone = phone.trim();
        if (location !== undefined) updates.location = location.trim();
        if (farm_size !== undefined) updates.farm_size = parseFloat(farm_size) || null;
        if (crops_grown !== undefined) updates.crops_grown = Array.isArray(crops_grown) ? crops_grown : [];
        
        // Handle WhatsApp unlinking
        if (req.body.whatsapp_linked === false) {
            updates.whatsapp_linked = false;
            updates.whatsapp_phone = null;
        }
        
        // Update user profile
        const updatedUser = await updateUserProfile(req.user.id, updates);
        
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            error: 'Profile update failed',
            message: 'An error occurred while updating profile'
        });
    }
});

/**
 * Change password
 * PUT /api/auth/password
 */
router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Validate required fields
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Missing passwords',
                message: 'Current password and new password are required'
            });
        }
        
        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'New password must be at least 8 characters long'
            });
        }
        
        // Update password
        await updateUserPassword(req.user.id, currentPassword, newPassword);
        
        res.json({
            message: 'Password updated successfully'
        });
        
    } catch (error) {
        console.error('Password update error:', error);
        
        if (error.message.includes('Current password is incorrect')) {
            return res.status(400).json({
                error: 'Invalid current password',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Password update failed',
            message: 'An error occurred while updating password'
        });
    }
});

/**
 * Logout endpoint (client-side token removal)
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, (req, res) => {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token from storage
    res.json({
        message: 'Logout successful',
        note: 'Please remove the token from client storage'
    });
});

/**
 * Token validation endpoint
 * GET /api/auth/validate
 */
router.get('/validate', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                error: 'Missing email',
                message: 'Email is required'
            });
        }
        
        // Generate reset token
        const resetToken = await generatePasswordResetToken(email);
        
        // In a real application, you would send this token via email
        // For now, we'll return it in the response (NOT recommended for production)
        res.json({
            message: 'Password reset token generated',
            resetToken, // Remove this in production
            note: 'In production, this token would be sent via email'
        });
        
    } catch (error) {
        console.error('Password reset request error:', error);
        
        if (error.message.includes('User not found')) {
            // Don't reveal if user exists or not for security
            return res.json({
                message: 'If the email exists, a reset token has been sent'
            });
        }
        
        res.status(500).json({
            error: 'Password reset request failed',
            message: 'An error occurred while processing the request'
        });
    }
});

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Reset token and new password are required'
            });
        }
        
        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'Weak password',
                message: 'New password must be at least 8 characters long'
            });
        }
        
        // Reset password
        await resetPassword(token, newPassword);
        
        res.json({
            message: 'Password reset successful'
        });
        
    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.message.includes('Invalid or expired')) {
            return res.status(400).json({
                error: 'Invalid token',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Password reset failed',
            message: 'An error occurred while resetting password'
        });
    }
});

module.exports = router;