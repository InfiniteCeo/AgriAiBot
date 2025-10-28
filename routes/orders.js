const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
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
} = require('../services/orders');

/**
 * Order Management Routes
 * Handles individual and bulk order processing, status tracking, and delivery coordination
 */

/**
 * POST /api/orders
 * Create a new order
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const orderData = req.body;
    const order = await createOrder(req.user.id, orderData);

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/orders
 * Get orders for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      payment_status: req.query.payment_status,
      order_type: req.query.order_type,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const orders = await getOrdersByUser(req.user.id, filters);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/my-orders
 * Get orders for the authenticated user
 */
router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      payment_status: req.query.payment_status,
      order_type: req.query.order_type,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    };

    const orders = await getOrdersByUser(req.user.id, filters);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      filters: filters
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/:id
 * Get a specific order by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await getOrderById(id, req.user.id);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/orders/:id/history
 * Get order status history
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const history = await getOrderHistory(id, req.user.id);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching order history:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/orders/:id/status
 * Update order status
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const order = await updateOrderStatus(id, status, req.user.id);

    res.json({
      success: true,
      data: order,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 
                      error.message.includes('Invalid') || error.message.includes('Cannot change') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/orders/:id/payment-status
 * Update payment status (internal use, typically called by payment service)
 */
router.put('/:id/payment-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!payment_status) {
      return res.status(400).json({
        success: false,
        message: 'Payment status is required'
      });
    }

    const order = await updatePaymentStatus(id, payment_status);

    res.json({
      success: true,
      data: order,
      message: `Payment status updated to ${payment_status}`
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Invalid') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/orders/:id/cancel
 * Cancel an order
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await cancelOrder(id, req.user.id, reason);

    res.json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 
                      error.message.includes('Cannot cancel') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/orders/:id/delivery
 * Get delivery information for an order
 */
router.get('/:id/delivery', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deliveryInfo = await getDeliveryInfo(id, req.user.id);

    res.json({
      success: true,
      data: deliveryInfo
    });
  } catch (error) {
    console.error('Error fetching delivery info:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * PUT /api/orders/:id/delivery-address
 * Update delivery address (buyers only, pending orders only)
 */
router.put('/:id/delivery-address', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_address } = req.body;

    if (!delivery_address || !delivery_address.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required'
      });
    }

    const order = await updateDeliveryAddress(id, req.user.id, delivery_address);

    res.json({
      success: true,
      data: order,
      message: 'Delivery address updated successfully'
    });
  } catch (error) {
    console.error('Error updating delivery address:', error);
    const statusCode = error.message === 'Order not found' ? 404 : 
                      error.message.includes('Only the buyer') || error.message.includes('Cannot update') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/orders/status/:status
 * Get orders by status (for admin/management purposes)
 */
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    // This endpoint could be restricted to admins or wholesalers
    const { status } = req.params;
    const options = {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const orders = await getOrdersByStatus(status, options);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      status: status
    });
  } catch (error) {
    console.error('Error fetching orders by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders by status',
      error: error.message
    });
  }
});

/**
 * GET /api/orders/buyer/:buyerId
 * Get orders for a specific buyer (admin use)
 */
router.get('/buyer/:buyerId', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin or the buyer themselves
    const { buyerId } = req.params;
    
    if (req.user.user_type !== 'admin' && req.user.id !== buyerId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const filters = {
      status: req.query.status,
      payment_status: req.query.payment_status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    const orders = await getOrdersByUser(buyerId, filters);

    res.json({
      success: true,
      data: orders,
      count: orders.length,
      buyer_id: buyerId
    });
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch buyer orders',
      error: error.message
    });
  }
});

module.exports = router;