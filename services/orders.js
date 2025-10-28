const { supabase } = require('./supabase');
const { getProductById, reduceStock } = require('./marketplace');

/**
 * Order Management Service
 * Handles individual and bulk order processing, status tracking, and delivery coordination
 */

/**
 * Create a new individual order
 * @param {string} buyerId - ID of the buyer
 * @param {Object} orderData - Order information
 * @returns {Object} Created order with details
 */
async function createOrder(buyerId, orderData) {
  const {
    product_id,
    quantity,
    delivery_address,
    sacco_id = null
  } = orderData;

  // Validate required fields
  if (!product_id || !quantity || !delivery_address) {
    throw new Error('Missing required fields: product_id, quantity, and delivery_address are required');
  }

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  try {
    // Get product details and validate availability
    const product = await getProductById(product_id);
    
    if (!product.is_active) {
      throw new Error('Product is not available for purchase');
    }

    if (product.stock_quantity < quantity) {
      throw new Error(`Insufficient stock. Only ${product.stock_quantity} ${product.unit_type} available`);
    }

    // Calculate pricing (check for bulk pricing)
    let unitPrice = product.unit_price;
    if (product.bulk_pricing && typeof product.bulk_pricing === 'object') {
      const tiers = Object.entries(product.bulk_pricing)
        .map(([qty, price]) => ({ quantity: parseInt(qty), price: parseFloat(price) }))
        .sort((a, b) => b.quantity - a.quantity);

      for (const tier of tiers) {
        if (quantity >= tier.quantity) {
          unitPrice = tier.price;
          break;
        }
      }
    }

    const totalAmount = unitPrice * quantity;

    // Create the order
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        buyer_id: buyerId,
        product_id: product_id,
        quantity: parseInt(quantity),
        unit_price: unitPrice,
        total_amount: totalAmount,
        order_type: sacco_id ? 'bulk' : 'individual',
        sacco_id: sacco_id,
        status: 'pending',
        payment_status: 'pending',
        delivery_address: delivery_address.trim()
      }])
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type, wholesaler_id),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email),
        sacco:sacco_groups!orders_sacco_id_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating order:', error);
      throw new Error('Failed to create order');
    }

    return data;
  } catch (error) {
    console.error('Error in createOrder:', error);
    throw error;
  }
}

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} newStatus - New status
 * @param {string} userId - User ID for authorization (buyer or wholesaler)
 * @returns {Object} Updated order
 */
async function updateOrderStatus(orderId, newStatus, userId) {
  const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid order status');
  }

  try {
    // Get current order to validate authorization
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        product:products!orders_product_id_fkey(wholesaler_id)
      `)
      .eq('id', orderId)
      .single();

    if (fetchError || !currentOrder) {
      throw new Error('Order not found');
    }

    // Check authorization - buyer or wholesaler can update
    const isAuthorized = currentOrder.buyer_id === userId || 
                        currentOrder.product.wholesaler_id === userId;
    
    if (!isAuthorized) {
      throw new Error('Unauthorized: You can only update your own orders');
    }

    // Validate status transitions
    const currentStatus = currentOrder.status;
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [],
      'cancelled': []
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Cannot change status from ${currentStatus} to ${newStatus}`);
    }

    // If confirming order, reduce stock
    if (newStatus === 'confirmed' && currentStatus === 'pending') {
      await reduceStock(currentOrder.product_id, currentOrder.quantity);
    }

    // Update the order
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        ...(newStatus === 'delivered' && { delivered_at: new Date().toISOString() })
      })
      .eq('id', orderId)
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type, wholesaler_id),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email),
        sacco:sacco_groups!orders_sacco_id_fkey(id, name)
      `)
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      throw new Error('Failed to update order status');
    }

    return data;
  } catch (error) {
    console.error('Error in updateOrderStatus:', error);
    throw error;
  }
}

/**
 * Update payment status
 * @param {string} orderId - Order ID
 * @param {string} paymentStatus - New payment status
 * @returns {Object} Updated order
 */
async function updatePaymentStatus(orderId, paymentStatus) {
  const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
  
  if (!validPaymentStatuses.includes(paymentStatus)) {
    throw new Error('Invalid payment status');
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        payment_status: paymentStatus,
        ...(paymentStatus === 'paid' && { paid_at: new Date().toISOString() })
      })
      .eq('id', orderId)
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email)
      `)
      .single();

    if (error) {
      console.error('Error updating payment status:', error);
      throw new Error('Failed to update payment status');
    }

    return data;
  } catch (error) {
    console.error('Error in updatePaymentStatus:', error);
    throw error;
  }
}

/**
 * Get orders for a user (buyer or wholesaler)
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Array} User's orders
 */
async function getOrdersByUser(userId, filters = {}) {
  const {
    status,
    payment_status,
    order_type,
    limit = 50,
    offset = 0,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = filters;

  try {
    const { getUserById } = require('./supabase');
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type, wholesaler_id, location),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email),
        sacco:sacco_groups!orders_sacco_id_fkey(id, name)
      `);

    // Fetch user type to determine how to filter orders
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Users can see orders where they are either the buyer or the wholesaler of the product
    query = query.or(`buyer_id.eq.${userId},product.wholesaler_id.eq.${userId}`);

    // Apply additional filters
    if (status) {
      query = query.eq('status', status);
    }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (order_type) {
      query = query.eq('order_type', order_type);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'total_amount', 'status'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? true : false;
    
    query = query.order(sortField, { ascending: sortDirection });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user orders:', error);
      throw new Error('Failed to fetch orders');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOrdersByUser:', error);
    throw error;
  }
}

/**
 * Get order by ID with full details
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for authorization
 * @returns {Object} Order details
 */
async function getOrderById(orderId, userId) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        product:products!orders_product_id_fkey(
          id, name, description, unit_type, location, image_url,
          wholesaler:users!products_wholesaler_id_fkey(id, name, phone, email, location)
        ),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email, location),
        sacco:sacco_groups!orders_sacco_id_fkey(id, name, description)
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Order not found');
      }
      console.error('Error fetching order:', error);
      throw new Error('Failed to fetch order');
    }

    // Check authorization
    const isAuthorized = data.buyer_id === userId || 
                        data.product.wholesaler.id === userId;
    
    if (!isAuthorized) {
      throw new Error('Unauthorized: You can only view your own orders');
    }

    return data;
  } catch (error) {
    console.error('Error in getOrderById:', error);
    throw error;
  }
}

/**
 * Get order history for tracking
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for authorization
 * @returns {Array} Order status history
 */
async function getOrderHistory(orderId, userId) {
  // First verify user has access to this order
  await getOrderById(orderId, userId);

  // For now, return basic order info
  // In a full implementation, you might have an order_history table
  const order = await getOrderById(orderId, userId);
  
  const history = [
    {
      status: 'pending',
      timestamp: order.created_at,
      description: 'Order placed'
    }
  ];

  if (order.status !== 'pending') {
    history.push({
      status: order.status,
      timestamp: order.updated_at || order.created_at,
      description: getStatusDescription(order.status)
    });
  }

  if (order.payment_status === 'paid' && order.paid_at) {
    history.push({
      status: 'paid',
      timestamp: order.paid_at,
      description: 'Payment confirmed'
    });
  }

  if (order.status === 'delivered' && order.delivered_at) {
    history.push({
      status: 'delivered',
      timestamp: order.delivered_at,
      description: 'Order delivered'
    });
  }

  return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Get status description for order history
 * @param {string} status - Order status
 * @returns {string} Human-readable description
 */
function getStatusDescription(status) {
  const descriptions = {
    'pending': 'Order placed and awaiting confirmation',
    'confirmed': 'Order confirmed by seller',
    'shipped': 'Order shipped and in transit',
    'delivered': 'Order delivered successfully',
    'cancelled': 'Order cancelled'
  };
  
  return descriptions[status] || 'Status updated';
}

/**
 * Cancel an order
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for authorization
 * @param {string} reason - Cancellation reason
 * @returns {Object} Updated order
 */
async function cancelOrder(orderId, userId, reason = '') {
  try {
    const order = await getOrderById(orderId, userId);
    
    if (order.status === 'delivered') {
      throw new Error('Cannot cancel a delivered order');
    }
    
    if (order.status === 'cancelled') {
      throw new Error('Order is already cancelled');
    }

    // If order was confirmed, restore stock
    if (order.status === 'confirmed' || order.status === 'shipped') {
      // Restore stock by adding back the quantity
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: supabase.raw('stock_quantity + ?', [order.quantity])
        })
        .eq('id', order.product_id);

      if (stockError) {
        console.error('Error restoring stock:', stockError);
        // Continue with cancellation even if stock restore fails
      }
    }

    return await updateOrderStatus(orderId, 'cancelled', userId);
  } catch (error) {
    console.error('Error in cancelOrder:', error);
    throw error;
  }
}

/**
 * Get orders by status
 * @param {string} status - Order status
 * @param {Object} options - Additional options
 * @returns {Array} Orders with the specified status
 */
async function getOrdersByStatus(status, options = {}) {
  const { limit = 50, offset = 0 } = options;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type),
        buyer:users!orders_buyer_id_fkey(id, name, phone)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching user orders:', error);
      throw new Error('Failed to fetch orders');
    }

    return data || [];
  } catch (error) {
    console.error('Error in getOrdersByUser:', error);
    throw error;
  }
}

/**
 * Get delivery address management for an order
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID for authorization
 * @returns {Object} Delivery information
 */
async function getDeliveryInfo(orderId, userId) {
  const order = await getOrderById(orderId, userId);
  
  return {
    order_id: orderId,
    delivery_address: order.delivery_address,
    buyer_location: order.buyer.location,
    product_location: order.product.location,
    estimated_distance: calculateDistance(order.buyer.location, order.product.location),
    delivery_status: order.status,
    tracking_info: await getOrderHistory(orderId, userId)
  };
}

/**
 * Update delivery address (only for pending orders)
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID (must be buyer)
 * @param {string} newAddress - New delivery address
 * @returns {Object} Updated order
 */
async function updateDeliveryAddress(orderId, userId, newAddress) {
  try {
    const order = await getOrderById(orderId, userId);
    
    if (order.buyer_id !== userId) {
      throw new Error('Only the buyer can update delivery address');
    }
    
    if (order.status !== 'pending') {
      throw new Error('Cannot update delivery address for confirmed orders');
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ delivery_address: newAddress.trim() })
      .eq('id', orderId)
      .select(`
        *,
        product:products!orders_product_id_fkey(id, name, unit_type),
        buyer:users!orders_buyer_id_fkey(id, name, phone, email)
      `)
      .single();

    if (error) {
      console.error('Error updating delivery address:', error);
      throw new Error('Failed to update delivery address');
    }

    return data;
  } catch (error) {
    console.error('Error in updateDeliveryAddress:', error);
    throw error;
  }
}

/**
 * Simple distance calculation placeholder
 * @param {string} location1 - First location
 * @param {string} location2 - Second location
 * @returns {string} Distance estimate
 */
function calculateDistance(location1, location2) {
  // This is a placeholder - in a real implementation you'd use a mapping service
  if (!location1 || !location2) return 'Unknown';
  if (location1.toLowerCase() === location2.toLowerCase()) return 'Same city';
  return 'Distance calculation not available';
}

module.exports = {
  createOrder,
  updateOrderStatus,
  updatePaymentStatus,
  getOrdersByUser,
  getOrderById,
  getOrderHistory,
  cancelOrder,
  getOrdersByStatus,
  getDeliveryInfo,
  updateDeliveryAddress
};