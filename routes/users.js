const express = require('express');
const { 
    getUserById, 
    updateUserProfile,
    findUserByWhatsApp,
    linkWhatsAppAccount
} = require('../services/supabase');
const { 
    authenticateToken, 
    requireFarmerOrAdmin, 
    requireWholesalerOrAdmin 
} = require('../middleware/auth');

const router = express.Router();

/**
 * Get user profile by ID
 * GET /api/users/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only access their own profile unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own profile'
            });
        }
        
        const user = await getUserById(id);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The requested user does not exist'
            });
        }
        
        res.json({
            message: 'User profile retrieved successfully',
            user
        });
        
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({
            error: 'Profile retrieval failed',
            message: 'An error occurred while retrieving the profile'
        });
    }
});

/**
 * Update user profile
 * PUT /api/users/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only update their own profile unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only update your own profile'
            });
        }
        
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
        
        // Update user profile
        const updatedUser = await updateUserProfile(id, updates);
        
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({
            error: 'Profile update failed',
            message: 'An error occurred while updating the profile'
        });
    }
});

/**
 * Get farmer-specific profile data
 * GET /api/users/:id/farmer-profile
 */
router.get('/:id/farmer-profile', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only access their own profile unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own farmer profile'
            });
        }
        
        const user = await getUserById(id);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The requested user does not exist'
            });
        }
        
        if (user.user_type !== 'farmer') {
            return res.status(400).json({
                error: 'Invalid user type',
                message: 'This endpoint is only for farmers'
            });
        }
        
        // Return farmer-specific data
        const farmerProfile = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            location: user.location,
            farm_size: user.farm_size,
            crops_grown: user.crops_grown,
            whatsapp_linked: user.whatsapp_linked,
            whatsapp_phone: user.whatsapp_phone,
            created_at: user.created_at
        };
        
        res.json({
            message: 'Farmer profile retrieved successfully',
            farmer: farmerProfile
        });
        
    } catch (error) {
        console.error('Get farmer profile error:', error);
        res.status(500).json({
            error: 'Farmer profile retrieval failed',
            message: 'An error occurred while retrieving the farmer profile'
        });
    }
});

/**
 * Update farmer-specific profile data
 * PUT /api/users/:id/farmer-profile
 */
router.put('/:id/farmer-profile', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only update their own profile unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only update your own farmer profile'
            });
        }
        
        const user = await getUserById(id);
        
        if (!user || user.user_type !== 'farmer') {
            return res.status(400).json({
                error: 'Invalid user',
                message: 'User not found or not a farmer'
            });
        }
        
        const { 
            location, 
            farm_size, 
            crops_grown 
        } = req.body;
        
        // Prepare farmer-specific updates
        const updates = {};
        if (location !== undefined) updates.location = location.trim();
        if (farm_size !== undefined) updates.farm_size = parseFloat(farm_size) || null;
        if (crops_grown !== undefined) updates.crops_grown = Array.isArray(crops_grown) ? crops_grown : [];
        
        // Update farmer profile
        const updatedUser = await updateUserProfile(id, updates);
        
        res.json({
            message: 'Farmer profile updated successfully',
            farmer: {
                id: updatedUser.id,
                name: updatedUser.name,
                phone: updatedUser.phone,
                location: updatedUser.location,
                farm_size: updatedUser.farm_size,
                crops_grown: updatedUser.crops_grown,
                whatsapp_linked: updatedUser.whatsapp_linked,
                whatsapp_phone: updatedUser.whatsapp_phone
            }
        });
        
    } catch (error) {
        console.error('Update farmer profile error:', error);
        res.status(500).json({
            error: 'Farmer profile update failed',
            message: 'An error occurred while updating the farmer profile'
        });
    }
});

/**
 * Get wholesaler-specific profile data
 * GET /api/users/:id/wholesaler-profile
 */
router.get('/:id/wholesaler-profile', authenticateToken, requireWholesalerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only access their own profile unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only access your own wholesaler profile'
            });
        }
        
        const user = await getUserById(id);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'The requested user does not exist'
            });
        }
        
        if (user.user_type !== 'wholesaler') {
            return res.status(400).json({
                error: 'Invalid user type',
                message: 'This endpoint is only for wholesalers'
            });
        }
        
        // Return wholesaler-specific data
        const wholesalerProfile = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email,
            location: user.location,
            whatsapp_linked: user.whatsapp_linked,
            whatsapp_phone: user.whatsapp_phone,
            created_at: user.created_at
        };
        
        res.json({
            message: 'Wholesaler profile retrieved successfully',
            wholesaler: wholesalerProfile
        });
        
    } catch (error) {
        console.error('Get wholesaler profile error:', error);
        res.status(500).json({
            error: 'Wholesaler profile retrieval failed',
            message: 'An error occurred while retrieving the wholesaler profile'
        });
    }
});

/**
 * Link WhatsApp account to user profile
 * POST /api/users/:id/link-whatsapp
 */
router.post('/:id/link-whatsapp', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { whatsapp_phone } = req.body;
        
        // Users can only link their own WhatsApp unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only link your own WhatsApp account'
            });
        }
        
        if (!whatsapp_phone) {
            return res.status(400).json({
                error: 'Missing WhatsApp phone',
                message: 'WhatsApp phone number is required'
            });
        }
        
        // Check if WhatsApp number is already linked to another account
        const existingUser = await findUserByWhatsApp(whatsapp_phone);
        if (existingUser && existingUser.id !== id) {
            return res.status(409).json({
                error: 'WhatsApp already linked',
                message: 'This WhatsApp number is already linked to another account'
            });
        }
        
        // Link WhatsApp account
        const updatedUser = await linkWhatsAppAccount(id, whatsapp_phone);
        
        res.json({
            message: 'WhatsApp account linked successfully',
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Link WhatsApp error:', error);
        res.status(500).json({
            error: 'WhatsApp linking failed',
            message: 'An error occurred while linking WhatsApp account'
        });
    }
});

/**
 * Unlink WhatsApp account from user profile
 * DELETE /api/users/:id/link-whatsapp
 */
router.delete('/:id/link-whatsapp', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Users can only unlink their own WhatsApp unless they're admin
        if (req.user.id !== id && req.user.user_type !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You can only unlink your own WhatsApp account'
            });
        }
        
        // Unlink WhatsApp account
        const updatedUser = await updateUserProfile(id, {
            whatsapp_linked: false,
            whatsapp_phone: null
        });
        
        res.json({
            message: 'WhatsApp account unlinked successfully',
            user: updatedUser
        });
        
    } catch (error) {
        console.error('Unlink WhatsApp error:', error);
        res.status(500).json({
            error: 'WhatsApp unlinking failed',
            message: 'An error occurred while unlinking WhatsApp account'
        });
    }
});

module.exports = router;