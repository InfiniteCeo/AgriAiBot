const { supabase } = require('./supabase');

/**
 * Bulk Order Management Service
 * Handles bulk order creation, member participation, and order coordination
 */

/**
 * Create a new bulk order for a SACCO group
 * @param {string} saccoId - SACCO group ID
 * @param {string} productId - Product ID
 * @param {Object} orderData - Bulk order data
 * @returns {Object} Created bulk order
 */
async function createBulkOrder(saccoId, productId, orderData) {
    try {
        const { total_quantity, deadline, created_by } = orderData;
        
        // Validate required fields
        if (!total_quantity || total_quantity <= 0) {
            throw new Error('Total quantity must be greater than 0');
        }
        
        // Verify SACCO exists and user is admin or member
        const { data: sacco } = await supabase
            .from('sacco_groups')
            .select('id, name, admin_id')
            .eq('id', saccoId)
            .single();
            
        if (!sacco) {
            throw new Error('SACCO group not found');
        }
        
        // Verify user is a member of the SACCO
        const { data: membership } = await supabase
            .from('sacco_memberships')
            .select('id')
            .eq('sacco_id', saccoId)
            .eq('user_id', created_by)
            .eq('status', 'active')
            .single();
            
        if (!membership) {
            throw new Error('Only SACCO members can create bulk orders');
        }
        
        // Get product information
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, unit_price, bulk_pricing, stock_quantity, wholesaler_id')
            .eq('id', productId)
            .eq('is_active', true)
            .single();
            
        if (productError || !product) {
            throw new Error('Product not found or not available');
        }
        
        // Check if there's enough stock
        if (product.stock_quantity < total_quantity) {
            throw new Error(`Insufficient stock. Available: ${product.stock_quantity}, Requested: ${total_quantity}`);
        }
        
        // Calculate bulk pricing
        const unitPrice = calculateBulkPrice(product, total_quantity);
        const totalAmount = unitPrice * total_quantity;
        
        // Set default deadline if not provided (7 days from now)
        const orderDeadline = deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        // Create bulk order
        const { data: bulkOrder, error } = await supabase
            .from('bulk_orders')
            .insert({
                sacco_id: saccoId,
                product_id: productId,
                total_quantity: total_quantity,
                unit_price: unitPrice,
                total_amount: totalAmount,
                status: 'collecting',
                deadline: orderDeadline.toISOString()
            })
            .select(`
                *,
                sacco:sacco_groups(id, name, region),
                product:products(id, name, unit_type, wholesaler_id, wholesaler:users(id, name, phone, location))
            `)
            .single();
            
        if (error) {
            console.error('Error creating bulk order:', error);
            throw new Error('Failed to create bulk order');
        }
        
        return bulkOrder;
        
    } catch (error) {
        console.error('Error in createBulkOrder:', error);
        throw error;
    }
}

/**
 * Calculate bulk pricing based on quantity
 * @param {Object} product - Product with bulk pricing tiers
 * @param {number} quantity - Order quantity
 * @returns {number} Unit price for the quantity
 */
function calculateBulkPrice(product, quantity) {
    if (!product.bulk_pricing || typeof product.bulk_pricing !== 'object') {
        return product.unit_price;
    }
    
    // Sort bulk pricing tiers by quantity (descending)
    const tiers = Object.entries(product.bulk_pricing)
        .map(([qty, price]) => ({ quantity: parseInt(qty), price: parseFloat(price) }))
        .sort((a, b) => b.quantity - a.quantity);
    
    // Find the applicable tier
    for (const tier of tiers) {
        if (quantity >= tier.quantity) {
            return tier.price;
        }
    }
    
    // If no bulk tier applies, use regular price
    return product.unit_price;
}

/**
 * Add member participation to a bulk order
 * @param {string} bulkOrderId - Bulk order ID
 * @param {string} userId - User ID
 * @param {number} quantity - Quantity the member wants
 * @returns {Object} Participation record
 */
async function addMemberToOrder(bulkOrderId, userId, quantity) {
    try {
        if (!quantity || quantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }
        
        // Get bulk order details
        const { data: bulkOrder, error: orderError } = await supabase
            .from('bulk_orders')
            .select(`
                *,
                sacco:sacco_groups(id, name),
                product:products(id, name, unit_type)
            `)
            .eq('id', bulkOrderId)
            .single();
            
        if (orderError || !bulkOrder) {
            throw new Error('Bulk order not found');
        }
        
        // Check if order is still collecting
        if (bulkOrder.status !== 'collecting') {
            throw new Error('This bulk order is no longer accepting participations');
        }
        
        // Check if deadline has passed
        if (new Date(bulkOrder.deadline) < new Date()) {
            throw new Error('The deadline for this bulk order has passed');
        }
        
        // Verify user is a member of the SACCO
        const { data: membership } = await supabase
            .from('sacco_memberships')
            .select('id')
            .eq('sacco_id', bulkOrder.sacco_id)
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();
            
        if (!membership) {
            throw new Error('Only SACCO members can participate in bulk orders');
        }
        
        // Check if user already participated
        const { data: existingParticipation } = await supabase
            .from('bulk_order_participations')
            .select('id, quantity')
            .eq('bulk_order_id', bulkOrderId)
            .eq('user_id', userId)
            .single();
            
        if (existingParticipation) {
            throw new Error('You have already participated in this bulk order');
        }
        
        // Calculate current total participation
        const { data: participations } = await supabase
            .from('bulk_order_participations')
            .select('quantity')
            .eq('bulk_order_id', bulkOrderId);
            
        const currentTotal = participations?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        
        // Check if adding this quantity would exceed the total
        if (currentTotal + quantity > bulkOrder.total_quantity) {
            const remaining = bulkOrder.total_quantity - currentTotal;
            throw new Error(`Only ${remaining} ${bulkOrder.product.unit_type} remaining for this bulk order`);
        }
        
        // Calculate amount for this participation
        const amount = bulkOrder.unit_price * quantity;
        
        // Add participation
        const { data: participation, error } = await supabase
            .from('bulk_order_participations')
            .insert({
                bulk_order_id: bulkOrderId,
                user_id: userId,
                quantity: quantity,
                amount: amount,
                payment_status: 'pending'
            })
            .select(`
                *,
                user:users(id, name, phone, location),
                bulk_order:bulk_orders(
                    id,
                    total_quantity,
                    unit_price,
                    deadline,
                    product:products(id, name, unit_type)
                )
            `)
            .single();
            
        if (error) {
            console.error('Error adding member to bulk order:', error);
            throw new Error('Failed to add participation to bulk order');
        }
        
        return participation;
        
    } catch (error) {
        console.error('Error in addMemberToOrder:', error);
        throw error;
    }
}

/**
 * Update member participation quantity
 * @param {string} participationId - Participation ID
 * @param {string} userId - User ID (for authorization)
 * @param {number} newQuantity - New quantity
 * @returns {Object} Updated participation
 */
async function updateMemberParticipation(participationId, userId, newQuantity) {
    try {
        if (!newQuantity || newQuantity <= 0) {
            throw new Error('Quantity must be greater than 0');
        }
        
        // Get participation details
        const { data: participation, error: participationError } = await supabase
            .from('bulk_order_participations')
            .select(`
                *,
                bulk_order:bulk_orders(id, total_quantity, unit_price, status, deadline, sacco_id)
            `)
            .eq('id', participationId)
            .single();
            
        if (participationError || !participation) {
            throw new Error('Participation not found');
        }
        
        // Verify user owns this participation
        if (participation.user_id !== userId) {
            throw new Error('You can only update your own participation');
        }
        
        // Check if bulk order is still collecting
        if (participation.bulk_order.status !== 'collecting') {
            throw new Error('This bulk order is no longer accepting changes');
        }
        
        // Check if deadline has passed
        if (new Date(participation.bulk_order.deadline) < new Date()) {
            throw new Error('The deadline for this bulk order has passed');
        }
        
        // Calculate current total participation (excluding this user's current participation)
        const { data: otherParticipations } = await supabase
            .from('bulk_order_participations')
            .select('quantity')
            .eq('bulk_order_id', participation.bulk_order_id)
            .neq('id', participationId);
            
        const otherTotal = otherParticipations?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        
        // Check if new quantity would exceed the total
        if (otherTotal + newQuantity > participation.bulk_order.total_quantity) {
            const maxAllowed = participation.bulk_order.total_quantity - otherTotal;
            throw new Error(`Maximum quantity you can order is ${maxAllowed}`);
        }
        
        // Calculate new amount
        const newAmount = participation.bulk_order.unit_price * newQuantity;
        
        // Update participation
        const { data: updatedParticipation, error } = await supabase
            .from('bulk_order_participations')
            .update({
                quantity: newQuantity,
                amount: newAmount
            })
            .eq('id', participationId)
            .select(`
                *,
                user:users(id, name, phone),
                bulk_order:bulk_orders(
                    id,
                    total_quantity,
                    unit_price,
                    product:products(id, name, unit_type)
                )
            `)
            .single();
            
        if (error) {
            console.error('Error updating participation:', error);
            throw new Error('Failed to update participation');
        }
        
        return updatedParticipation;
        
    } catch (error) {
        console.error('Error in updateMemberParticipation:', error);
        throw error;
    }
}

/**
 * Remove member participation from bulk order
 * @param {string} participationId - Participation ID
 * @param {string} userId - User ID (for authorization)
 * @returns {boolean} Success status
 */
async function removeMemberParticipation(participationId, userId) {
    try {
        // Get participation details
        const { data: participation, error: participationError } = await supabase
            .from('bulk_order_participations')
            .select(`
                *,
                bulk_order:bulk_orders(id, status, deadline)
            `)
            .eq('id', participationId)
            .single();
            
        if (participationError || !participation) {
            throw new Error('Participation not found');
        }
        
        // Verify user owns this participation
        if (participation.user_id !== userId) {
            throw new Error('You can only remove your own participation');
        }
        
        // Check if bulk order is still collecting
        if (participation.bulk_order.status !== 'collecting') {
            throw new Error('Cannot remove participation from finalized bulk order');
        }
        
        // Check if deadline has passed
        if (new Date(participation.bulk_order.deadline) < new Date()) {
            throw new Error('The deadline for this bulk order has passed');
        }
        
        // Remove participation
        const { error } = await supabase
            .from('bulk_order_participations')
            .delete()
            .eq('id', participationId);
            
        if (error) {
            console.error('Error removing participation:', error);
            throw new Error('Failed to remove participation');
        }
        
        return true;
        
    } catch (error) {
        console.error('Error in removeMemberParticipation:', error);
        throw error;
    }
}

/**
 * Get bulk orders for a SACCO group
 * @param {string} saccoId - SACCO group ID
 * @param {Object} filters - Filter options
 * @returns {Array} Array of bulk orders
 */
async function getSACCOBulkOrders(saccoId, filters = {}) {
    try {
        let query = supabase
            .from('bulk_orders')
            .select(`
                *,
                product:products(
                    id,
                    name,
                    unit_type,
                    category,
                    wholesaler:users(id, name, phone, location)
                ),
                participations:bulk_order_participations(
                    id,
                    quantity,
                    amount,
                    payment_status,
                    user:users(id, name, phone)
                )
            `)
            .eq('sacco_id', saccoId);
            
        // Apply status filter
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        
        // Order by creation date (newest first)
        query = query.order('created_at', { ascending: false });
        
        const { data: bulkOrders, error } = await query;
        
        if (error) {
            console.error('Error fetching SACCO bulk orders:', error);
            throw new Error('Failed to fetch bulk orders');
        }
        
        // Calculate participation statistics for each order
        const processedOrders = bulkOrders.map(order => {
            const totalParticipated = order.participations?.reduce((sum, p) => sum + p.quantity, 0) || 0;
            const totalMembers = order.participations?.length || 0;
            const totalAmount = order.participations?.reduce((sum, p) => sum + p.amount, 0) || 0;
            
            return {
                ...order,
                participation_stats: {
                    total_participated: totalParticipated,
                    remaining_quantity: order.total_quantity - totalParticipated,
                    member_count: totalMembers,
                    total_collected: totalAmount,
                    completion_percentage: ((totalParticipated / order.total_quantity) * 100).toFixed(1)
                }
            };
        });
        
        return processedOrders;
        
    } catch (error) {
        console.error('Error in getSACCOBulkOrders:', error);
        throw error;
    }
}

/**
 * Get bulk order details with participations
 * @param {string} bulkOrderId - Bulk order ID
 * @returns {Object} Bulk order with detailed participation info
 */
async function getBulkOrderById(bulkOrderId) {
    try {
        const { data: bulkOrder, error } = await supabase
            .from('bulk_orders')
            .select(`
                *,
                sacco:sacco_groups(id, name, region, admin_id),
                product:products(
                    id,
                    name,
                    description,
                    unit_type,
                    category,
                    bulk_pricing,
                    wholesaler:users(id, name, phone, location)
                ),
                participations:bulk_order_participations(
                    id,
                    quantity,
                    amount,
                    payment_status,
                    created_at,
                    user:users(id, name, phone, location, farm_size)
                )
            `)
            .eq('id', bulkOrderId)
            .single();
            
        if (error || !bulkOrder) {
            throw new Error('Bulk order not found');
        }
        
        // Calculate statistics
        const totalParticipated = bulkOrder.participations?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        const totalMembers = bulkOrder.participations?.length || 0;
        const totalAmount = bulkOrder.participations?.reduce((sum, p) => sum + p.amount, 0) || 0;
        
        return {
            ...bulkOrder,
            participation_stats: {
                total_participated: totalParticipated,
                remaining_quantity: bulkOrder.total_quantity - totalParticipated,
                member_count: totalMembers,
                total_collected: totalAmount,
                completion_percentage: ((totalParticipated / bulkOrder.total_quantity) * 100).toFixed(1),
                is_fully_subscribed: totalParticipated >= bulkOrder.total_quantity
            }
        };
        
    } catch (error) {
        console.error('Error in getBulkOrderById:', error);
        throw error;
    }
}

/**
 * Finalize a bulk order (move from collecting to finalized)
 * @param {string} bulkOrderId - Bulk order ID
 * @param {string} userId - User ID (must be SACCO admin)
 * @returns {Object} Updated bulk order
 */
async function finalizeBulkOrder(bulkOrderId, userId) {
    try {
        // Get bulk order with SACCO info
        const { data: bulkOrder, error: orderError } = await supabase
            .from('bulk_orders')
            .select(`
                *,
                sacco:sacco_groups(id, name, admin_id)
            `)
            .eq('id', bulkOrderId)
            .single();
            
        if (orderError || !bulkOrder) {
            throw new Error('Bulk order not found');
        }
        
        // Verify user is SACCO admin
        if (bulkOrder.sacco.admin_id !== userId) {
            throw new Error('Only SACCO admin can finalize bulk orders');
        }
        
        // Check if order is in collecting status
        if (bulkOrder.status !== 'collecting') {
            throw new Error('Only collecting orders can be finalized');
        }
        
        // Get total participation
        const { data: participations } = await supabase
            .from('bulk_order_participations')
            .select('quantity')
            .eq('bulk_order_id', bulkOrderId);
            
        const totalParticipated = participations?.reduce((sum, p) => sum + p.quantity, 0) || 0;
        
        if (totalParticipated === 0) {
            throw new Error('Cannot finalize bulk order with no participations');
        }
        
        // Update bulk order status
        const { data: updatedOrder, error } = await supabase
            .from('bulk_orders')
            .update({
                status: 'finalized',
                total_quantity: totalParticipated, // Update to actual participated quantity
                total_amount: bulkOrder.unit_price * totalParticipated
            })
            .eq('id', bulkOrderId)
            .select()
            .single();
            
        if (error) {
            console.error('Error finalizing bulk order:', error);
            throw new Error('Failed to finalize bulk order');
        }
        
        return updatedOrder;
        
    } catch (error) {
        console.error('Error in finalizeBulkOrder:', error);
        throw error;
    }
}

/**
 * Get user's bulk order participations
 * @param {string} userId - User ID
 * @returns {Array} Array of user's participations
 */
async function getUserBulkOrderParticipations(userId) {
    try {
        const { data: participations, error } = await supabase
            .from('bulk_order_participations')
            .select(`
                *,
                bulk_order:bulk_orders(
                    id,
                    total_quantity,
                    unit_price,
                    status,
                    deadline,
                    created_at,
                    sacco:sacco_groups(id, name, region),
                    product:products(id, name, unit_type, category)
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error('Error fetching user participations:', error);
            throw new Error('Failed to fetch user participations');
        }
        
        return participations;
        
    } catch (error) {
        console.error('Error in getUserBulkOrderParticipations:', error);
        throw error;
    }
}

module.exports = {
    createBulkOrder,
    calculateBulkPrice,
    addMemberToOrder,
    updateMemberParticipation,
    removeMemberParticipation,
    getSACCOBulkOrders,
    getBulkOrderById,
    finalizeBulkOrder,
    getUserBulkOrderParticipations
};