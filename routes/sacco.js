const express = require('express');
const { 
    createSACCO,
    getSACCOGroups,
    getSACCOsByRegion,
    getSACCOById,
    joinSACCO,
    leaveSACCO,
    getUserSACCOs,
    getSACCOMembers,
    getSACCOStats,
    transferSACCOAdmin
} = require('../services/sacco');
const { 
    createBulkOrder,
    addMemberToOrder,
    updateMemberParticipation,
    removeMemberParticipation,
    getSACCOBulkOrders,
    getBulkOrderById,
    finalizeBulkOrder,
    getUserBulkOrderParticipations
} = require('../services/bulkOrders');
const { 
    authenticateToken, 
    requireFarmerOrAdmin 
} = require('../middleware/auth');

const router = express.Router();

/**
 * Create a new SACCO group
 * POST /api/sacco
 */
router.post('/', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { name, description, region, member_limit } = req.body;
        
        // Validate required fields
        if (!name || !region) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'SACCO name and region are required'
            });
        }
        
        // Validate member limit
        if (member_limit && (member_limit < 5 || member_limit > 200)) {
            return res.status(400).json({
                error: 'Invalid member limit',
                message: 'Member limit must be between 5 and 200'
            });
        }
        
        const saccoData = {
            name: name.trim(),
            description: description?.trim(),
            region: region.trim(),
            member_limit: member_limit || 50
        };
        
        const newSACCO = await createSACCO(req.user.id, saccoData);
        
        res.status(201).json({
            message: 'SACCO group created successfully',
            sacco: newSACCO
        });
        
    } catch (error) {
        console.error('Create SACCO error:', error);
        
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                error: 'SACCO already exists',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'SACCO creation failed',
            message: 'An error occurred while creating the SACCO group'
        });
    }
});

/**
 * Get SACCO groups with optional filtering
 * GET /api/sacco
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { region, search } = req.query;
        
        const filters = {};
        if (region) filters.region = region;
        if (search) filters.search = search;
        
        const saccoGroups = await getSACCOGroups(filters);
        
        res.json({
            message: 'SACCO groups retrieved successfully',
            saccos: saccoGroups,
            count: saccoGroups.length
        });
        
    } catch (error) {
        console.error('Get SACCO groups error:', error);
        res.status(500).json({
            error: 'Failed to fetch SACCO groups',
            message: 'An error occurred while retrieving SACCO groups'
        });
    }
});

/**
 * Get SACCO group by ID
 * GET /api/sacco/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const sacco = await getSACCOById(id);
        
        res.json({
            message: 'SACCO group retrieved successfully',
            sacco
        });
        
    } catch (error) {
        console.error('Get SACCO by ID error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'SACCO not found',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to fetch SACCO group',
            message: 'An error occurred while retrieving the SACCO group'
        });
    }
});

/**
 * Join a SACCO group
 * POST /api/sacco/:id/join
 */
router.post('/:id/join', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const membership = await joinSACCO(req.user.id, id);
        
        res.status(201).json({
            message: 'Successfully joined SACCO group',
            membership
        });
        
    } catch (error) {
        console.error('Join SACCO error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'SACCO not found',
                message: error.message
            });
        }
        
        if (error.message.includes('already a member') || error.message.includes('pending')) {
            return res.status(409).json({
                error: 'Membership conflict',
                message: error.message
            });
        }
        
        if (error.message.includes('member limit')) {
            return res.status(400).json({
                error: 'SACCO full',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to join SACCO',
            message: 'An error occurred while joining the SACCO group'
        });
    }
});

/**
 * Leave a SACCO group
 * POST /api/sacco/:id/leave
 */
router.post('/:id/leave', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        await leaveSACCO(req.user.id, id);
        
        res.json({
            message: 'Successfully left SACCO group'
        });
        
    } catch (error) {
        console.error('Leave SACCO error:', error);
        
        if (error.message.includes('not a member')) {
            return res.status(400).json({
                error: 'Not a member',
                message: error.message
            });
        }
        
        if (error.message.includes('admin cannot leave')) {
            return res.status(400).json({
                error: 'Admin restriction',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to leave SACCO',
            message: 'An error occurred while leaving the SACCO group'
        });
    }
});

/**
 * Get user's SACCO groups
 * GET /api/sacco/user/my-saccos
 */
router.get('/user/my-saccos', authenticateToken, async (req, res) => {
    try {
        const userSACCOs = await getUserSACCOs(req.user.id);
        
        res.json({
            message: 'User SACCO groups retrieved successfully',
            saccos: userSACCOs,
            count: userSACCOs.length
        });
        
    } catch (error) {
        console.error('Get user SACCOs error:', error);
        res.status(500).json({
            error: 'Failed to fetch user SACCO groups',
            message: 'An error occurred while retrieving your SACCO groups'
        });
    }
});

/**
 * Get SACCO group members
 * GET /api/sacco/:id/members
 */
router.get('/:id/members', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verify user is a member of this SACCO or admin
        if (req.user.user_type !== 'admin') {
            const userSACCOs = await getUserSACCOs(req.user.id);
            const isMember = userSACCOs.some(sacco => sacco.id === id);
            
            if (!isMember) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Only SACCO members can view member list'
                });
            }
        }
        
        const members = await getSACCOMembers(id);
        
        res.json({
            message: 'SACCO members retrieved successfully',
            members,
            count: members.length
        });
        
    } catch (error) {
        console.error('Get SACCO members error:', error);
        res.status(500).json({
            error: 'Failed to fetch SACCO members',
            message: 'An error occurred while retrieving SACCO members'
        });
    }
});

/**
 * Get SACCO group statistics
 * GET /api/sacco/:id/stats
 */
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const stats = await getSACCOStats(id);
        
        res.json({
            message: 'SACCO statistics retrieved successfully',
            stats
        });
        
    } catch (error) {
        console.error('Get SACCO stats error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'SACCO not found',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to fetch SACCO statistics',
            message: 'An error occurred while retrieving SACCO statistics'
        });
    }
});

/**
 * Transfer SACCO admin rights
 * POST /api/sacco/:id/transfer-admin
 */
router.post('/:id/transfer-admin', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_admin_id } = req.body;
        
        if (!new_admin_id) {
            return res.status(400).json({
                error: 'Missing new admin ID',
                message: 'New admin user ID is required'
            });
        }
        
        const updatedSACCO = await transferSACCOAdmin(req.user.id, new_admin_id, id);
        
        res.json({
            message: 'Admin rights transferred successfully',
            sacco: updatedSACCO
        });
        
    } catch (error) {
        console.error('Transfer SACCO admin error:', error);
        
        if (error.message.includes('Only the current admin')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('must be an active member')) {
            return res.status(400).json({
                error: 'Invalid new admin',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to transfer admin rights',
            message: 'An error occurred while transferring admin rights'
        });
    }
});

// ===== BULK ORDER ENDPOINTS =====

/**
 * Create a bulk order for a SACCO group
 * POST /api/sacco/:id/bulk-orders
 */
router.post('/:id/bulk-orders', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { id: saccoId } = req.params;
        const { product_id, total_quantity, deadline } = req.body;
        
        // Validate required fields
        if (!product_id || !total_quantity) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Product ID and total quantity are required'
            });
        }
        
        if (total_quantity <= 0) {
            return res.status(400).json({
                error: 'Invalid quantity',
                message: 'Total quantity must be greater than 0'
            });
        }
        
        const orderData = {
            total_quantity: parseInt(total_quantity),
            deadline: deadline ? new Date(deadline) : null,
            created_by: req.user.id
        };
        
        const bulkOrder = await createBulkOrder(saccoId, product_id, orderData);
        
        res.status(201).json({
            message: 'Bulk order created successfully',
            bulk_order: bulkOrder
        });
        
    } catch (error) {
        console.error('Create bulk order error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Resource not found',
                message: error.message
            });
        }
        
        if (error.message.includes('Only SACCO members')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('Insufficient stock')) {
            return res.status(400).json({
                error: 'Insufficient stock',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to create bulk order',
            message: 'An error occurred while creating the bulk order'
        });
    }
});

/**
 * Get bulk orders for a SACCO group
 * GET /api/sacco/:id/bulk-orders
 */
router.get('/:id/bulk-orders', authenticateToken, async (req, res) => {
    try {
        const { id: saccoId } = req.params;
        const { status } = req.query;
        
        // Verify user is a member of this SACCO or admin
        if (req.user.user_type !== 'admin') {
            const userSACCOs = await getUserSACCOs(req.user.id);
            const isMember = userSACCOs.some(sacco => sacco.id === saccoId);
            
            if (!isMember) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Only SACCO members can view bulk orders'
                });
            }
        }
        
        const filters = {};
        if (status) filters.status = status;
        
        const bulkOrders = await getSACCOBulkOrders(saccoId, filters);
        
        res.json({
            message: 'Bulk orders retrieved successfully',
            bulk_orders: bulkOrders,
            count: bulkOrders.length
        });
        
    } catch (error) {
        console.error('Get bulk orders error:', error);
        res.status(500).json({
            error: 'Failed to fetch bulk orders',
            message: 'An error occurred while retrieving bulk orders'
        });
    }
});/*
*
 * Get bulk order details
 * GET /api/sacco/bulk-orders/:bulkOrderId
 */
router.get('/bulk-orders/:bulkOrderId', authenticateToken, async (req, res) => {
    try {
        const { bulkOrderId } = req.params;
        
        const bulkOrder = await getBulkOrderById(bulkOrderId);
        
        // Verify user is a member of the SACCO or admin
        if (req.user.user_type !== 'admin') {
            const userSACCOs = await getUserSACCOs(req.user.id);
            const isMember = userSACCOs.some(sacco => sacco.id === bulkOrder.sacco_id);
            
            if (!isMember) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Only SACCO members can view this bulk order'
                });
            }
        }
        
        res.json({
            message: 'Bulk order retrieved successfully',
            bulk_order: bulkOrder
        });
        
    } catch (error) {
        console.error('Get bulk order error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Bulk order not found',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to fetch bulk order',
            message: 'An error occurred while retrieving the bulk order'
        });
    }
});

/**
 * Join a bulk order (add participation)
 * POST /api/sacco/bulk-orders/:bulkOrderId/participate
 */
router.post('/bulk-orders/:bulkOrderId/participate', authenticateToken, requireFarmerOrAdmin, async (req, res) => {
    try {
        const { bulkOrderId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                error: 'Invalid quantity',
                message: 'Quantity must be greater than 0'
            });
        }
        
        const participation = await addMemberToOrder(bulkOrderId, req.user.id, parseInt(quantity));
        
        res.status(201).json({
            message: 'Successfully joined bulk order',
            participation
        });
        
    } catch (error) {
        console.error('Join bulk order error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Bulk order not found',
                message: error.message
            });
        }
        
        if (error.message.includes('no longer accepting') || error.message.includes('deadline has passed')) {
            return res.status(400).json({
                error: 'Order closed',
                message: error.message
            });
        }
        
        if (error.message.includes('already participated')) {
            return res.status(409).json({
                error: 'Already participating',
                message: error.message
            });
        }
        
        if (error.message.includes('Only SACCO members')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('remaining')) {
            return res.status(400).json({
                error: 'Insufficient quantity available',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to join bulk order',
            message: 'An error occurred while joining the bulk order'
        });
    }
});/**
 
* Update bulk order participation
 * PUT /api/sacco/bulk-orders/participations/:participationId
 */
router.put('/bulk-orders/participations/:participationId', authenticateToken, async (req, res) => {
    try {
        const { participationId } = req.params;
        const { quantity } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(400).json({
                error: 'Invalid quantity',
                message: 'Quantity must be greater than 0'
            });
        }
        
        const updatedParticipation = await updateMemberParticipation(participationId, req.user.id, parseInt(quantity));
        
        res.json({
            message: 'Participation updated successfully',
            participation: updatedParticipation
        });
        
    } catch (error) {
        console.error('Update participation error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Participation not found',
                message: error.message
            });
        }
        
        if (error.message.includes('only update your own')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('no longer accepting') || error.message.includes('deadline has passed')) {
            return res.status(400).json({
                error: 'Order closed',
                message: error.message
            });
        }
        
        if (error.message.includes('Maximum quantity')) {
            return res.status(400).json({
                error: 'Quantity limit exceeded',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to update participation',
            message: 'An error occurred while updating your participation'
        });
    }
});

/**
 * Remove bulk order participation
 * DELETE /api/sacco/bulk-orders/participations/:participationId
 */
router.delete('/bulk-orders/participations/:participationId', authenticateToken, async (req, res) => {
    try {
        const { participationId } = req.params;
        
        await removeMemberParticipation(participationId, req.user.id);
        
        res.json({
            message: 'Participation removed successfully'
        });
        
    } catch (error) {
        console.error('Remove participation error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Participation not found',
                message: error.message
            });
        }
        
        if (error.message.includes('only remove your own')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('Cannot remove participation')) {
            return res.status(400).json({
                error: 'Cannot remove participation',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to remove participation',
            message: 'An error occurred while removing your participation'
        });
    }
});

/**
 * Finalize a bulk order (SACCO admin only)
 * POST /api/sacco/bulk-orders/:bulkOrderId/finalize
 */
router.post('/bulk-orders/:bulkOrderId/finalize', authenticateToken, async (req, res) => {
    try {
        const { bulkOrderId } = req.params;
        
        const finalizedOrder = await finalizeBulkOrder(bulkOrderId, req.user.id);
        
        res.json({
            message: 'Bulk order finalized successfully',
            bulk_order: finalizedOrder
        });
        
    } catch (error) {
        console.error('Finalize bulk order error:', error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Bulk order not found',
                message: error.message
            });
        }
        
        if (error.message.includes('Only SACCO admin')) {
            return res.status(403).json({
                error: 'Access denied',
                message: error.message
            });
        }
        
        if (error.message.includes('Only collecting orders')) {
            return res.status(400).json({
                error: 'Invalid order status',
                message: error.message
            });
        }
        
        if (error.message.includes('no participations')) {
            return res.status(400).json({
                error: 'No participations',
                message: error.message
            });
        }
        
        res.status(500).json({
            error: 'Failed to finalize bulk order',
            message: 'An error occurred while finalizing the bulk order'
        });
    }
});

/**
 * Get user's bulk order participations
 * GET /api/sacco/user/participations
 */
router.get('/user/participations', authenticateToken, async (req, res) => {
    try {
        const participations = await getUserBulkOrderParticipations(req.user.id);
        
        res.json({
            message: 'User participations retrieved successfully',
            participations,
            count: participations.length
        });
        
    } catch (error) {
        console.error('Get user participations error:', error);
        res.status(500).json({
            error: 'Failed to fetch participations',
            message: 'An error occurred while retrieving your participations'
        });
    }
});

module.exports = router;