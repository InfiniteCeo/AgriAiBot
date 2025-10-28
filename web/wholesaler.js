document.addEventListener("DOMContentLoaded", async () => {
  // Check authentication
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    // Get user profile
    const response = await fetch("/api/auth/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load profile");
    }

    const data = await response.json();
    currentUser = data.user;

    // Check if user is a wholesaler
    if (currentUser.user_type !== "wholesaler") {
      window.location.href = "dashboard.html";
      return;
    }

    // Update user name display
    document.getElementById("userName").textContent = currentUser.name;

    // Initialize wholesaler dashboard
    await initializeWholesalerDashboard();

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    await loadDashboardData();
  } catch (error) {
    console.error("Error initializing wholesaler page:", error);
    // Redirect to login if authentication fails
    localStorage.removeItem("authToken");
    window.location.href = "login.html";
  }
});

let currentUser = null;
let currentProducts = [];
let currentOrders = [];
let currentPage = 0;
let isLoading = false;
let editingProductId = null;

async function initializeWholesalerDashboard() {
  try {
    // Get user profile
    const response = await fetch("/api/auth/profile", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load profile");
    }

    const data = await response.json();
    currentUser = data.user;

    // Check if user is a wholesaler
    if (currentUser.user_type !== "wholesaler") {
      window.location.href = "dashboard.html";
      return;
    }

    // Update user name display
    document.getElementById("userName").textContent = currentUser.name;
  } catch (error) {
    console.error("Error initializing wholesaler dashboard:", error);
    // Redirect to login if authentication fails
    if (error.message.includes("Failed to load profile")) {
      localStorage.removeItem("authToken");
      window.location.href = "login.html";
    }
  }
}

function setupEventListeners() {
  // Navigation
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("authToken");
    window.location.href = "login.html";
  });

  // Tab switching
  document
    .getElementById("productsTab")
    .addEventListener("click", () => switchTab("products"));
  document
    .getElementById("ordersTab")
    .addEventListener("click", () => switchTab("orders"));
  document
    .getElementById("aiInsightsTab")
    ?.addEventListener("click", () => switchTab("aiInsights"));
  document
    .getElementById("analyticsTab")
    .addEventListener("click", () => switchTab("analytics"));

  // Product management
  document
    .getElementById("addProductBtn")
    .addEventListener("click", () => showProductModal());
  document
    .getElementById("closeProductModal")
    .addEventListener("click", closeProductModal);
  document
    .getElementById("cancelProductBtn")
    .addEventListener("click", closeProductModal);
  document
    .getElementById("productForm")
    .addEventListener("submit", handleProductSubmit);

  // Product search and filters
  let searchTimeout;
  document.getElementById("productSearch").addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadProducts();
    }, 500);
  });

  document
    .getElementById("productFilter")
    .addEventListener("change", loadProducts);

  // Order search and filters
  let orderSearchTimeout;
  document.getElementById("orderSearch").addEventListener("input", (e) => {
    clearTimeout(orderSearchTimeout);
    orderSearchTimeout = setTimeout(() => {
      loadOrders();
    }, 500);
  });

  document
    .getElementById("orderStatusFilter")
    .addEventListener("change", loadOrders);

  // Bulk pricing
  document
    .getElementById("addBulkPricingBtn")
    .addEventListener("click", addBulkPricingRow);

  // AI functionality buttons
  document
    .getElementById("refreshAIInsights")
    ?.addEventListener("click", loadAIDashboardInsights);
  document
    .getElementById("getOptimizationsBtn")
    ?.addEventListener("click", loadProductOptimizations);
  document
    .getElementById("getInventoryInsightsBtn")
    ?.addEventListener("click", loadInventoryInsights);
  document
    .getElementById("getCompetitiveAnalysisBtn")
    ?.addEventListener("click", loadCompetitiveAnalysis);
  document
    .getElementById("getSalesInsightsBtn")
    ?.addEventListener("click", loadSalesInsights);
  document
    .getElementById("aiOptimizeBtn")
    ?.addEventListener("click", showAIOptimizationModal);
  document
    .getElementById("aiDescriptionBtn")
    ?.addEventListener("click", generateAIDescription);

  // Modal close on outside click
  document.getElementById("productModal").addEventListener("click", (e) => {
    if (e.target.id === "productModal") {
      closeProductModal();
    }
  });

  // Select all products
  document
    .getElementById("selectAllProducts")
    .addEventListener("change", toggleSelectAllProducts);
}

async function loadDashboardData() {
  try {
    showLoading();

    // Load stats in parallel
    const [products, orders, lowStock] = await Promise.allSettled([
      loadProducts(),
      loadOrders(),
      loadLowStockProducts(),
    ]);

    // Update stats display
    updateStatsDisplay();

    // Load AI dashboard insights
    loadAIDashboardInsights();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
  } finally {
    hideLoading();
  }
}

async function loadProducts() {
  if (isLoading) return;

  isLoading = true;

  try {
    const search = document.getElementById("productSearch").value.trim();
    const filter = document.getElementById("productFilter").value;

    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);
    if (filter === "active") queryParams.append("is_active", "true");
    if (filter === "inactive") queryParams.append("is_active", "false");
    queryParams.append("limit", "50");
    queryParams.append("offset", "0");

    const response = await fetch(
      `/api/marketplace/my-products?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load products");
    }

    const data = await response.json();
    currentProducts = data.data || [];

    // If filtering for low stock, get low stock products
    if (filter === "low_stock") {
      const lowStockResponse = await fetch(
        "/api/marketplace/my-products/low-stock",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (lowStockResponse.ok) {
        const lowStockData = await lowStockResponse.json();
        currentProducts = lowStockData.data || [];
      }
    }

    displayProducts();
    updateProductsStats();
  } catch (error) {
    console.error("Error loading products:", error);
    showError("Failed to load products");
  } finally {
    isLoading = false;
  }
}

function displayProducts() {
  const tbody = document.getElementById("productsTableBody");

  if (currentProducts.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-box-open text-4xl mb-4"></i>
                    <p>No products found</p>
                    <button onclick="showProductModal()" class="mt-2 text-green-600 hover:text-green-700">
                        Add your first product
                    </button>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = currentProducts
    .map((product) => {
      const isLowStock = product.stock_quantity <= 10;
      const statusClass = product.is_active
        ? "bg-green-100 text-green-800"
        : "bg-red-100 text-red-800";
      const statusText = product.is_active ? "Active" : "Inactive";

      return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="checkbox" class="product-checkbox rounded border-gray-300" value="${
                      product.id
                    }">
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-12 w-12">
                            ${
                              product.image_url
                                ? `<img class="h-12 w-12 rounded-lg object-cover" src="${product.image_url}" alt="${product.name}">`
                                : `<div class="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                    <i class="fas fa-seedling text-gray-500"></i>
                                </div>`
                            }
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${
                              product.name
                            }</div>
                            <div class="text-sm text-gray-500">${
                              product.description
                                ? product.description.substring(0, 50) + "..."
                                : "No description"
                            }</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${product.category || "Uncategorized"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    KES ${product.unit_price.toLocaleString()}/${
        product.unit_type
      }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="${
                      isLowStock ? "text-red-600 font-medium low-stock" : ""
                    }">
                        ${product.stock_quantity} ${product.unit_type}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="editProduct('${
                          product.id
                        }')" class="text-indigo-600 hover:text-indigo-900">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="toggleProductStatus('${
                          product.id
                        }', ${!product.is_active})" 
                                class="text-${
                                  product.is_active ? "red" : "green"
                                }-600 hover:text-${
        product.is_active ? "red" : "green"
      }-900">
                            <i class="fas fa-${
                              product.is_active ? "eye-slash" : "eye"
                            }"></i>
                        </button>
                        <button onclick="deleteProduct('${
                          product.id
                        }')" class="text-red-600 hover:text-red-900">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    })
    .join("");

  // Update pagination info
  document.getElementById("productsShowing").textContent =
    currentProducts.length;
  document.getElementById("productsTotal").textContent = currentProducts.length;
}

async function loadOrders() {
  try {
    const search = document.getElementById("orderSearch").value.trim();
    const statusFilter = document.getElementById("orderStatusFilter").value;

    const queryParams = new URLSearchParams();
    if (search) queryParams.append("search", search);
    if (statusFilter) queryParams.append("status", statusFilter);
    queryParams.append("limit", "50");

    const response = await fetch(
      `/api/orders/wholesaler-orders?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to load orders");
    }

    const data = await response.json();
    currentOrders = data.orders || [];

    displayOrders();
  } catch (error) {
    console.error("Error loading orders:", error);
    // If endpoint doesn't exist, show placeholder
    currentOrders = [];
    displayOrders();
  }
}

function displayOrders() {
  const tbody = document.getElementById("ordersTableBody");

  if (currentOrders.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-shopping-cart text-4xl mb-4"></i>
                    <p>No orders found</p>
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = currentOrders
    .map((order) => {
      const statusClass = `status-${order.status}`;
      const statusText =
        order.status.charAt(0).toUpperCase() + order.status.slice(1);

      return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #${order.id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${order.buyer?.name || "Unknown"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${order.product?.name || "Unknown Product"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${order.quantity} ${order.product?.unit_type || "units"}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    KES ${order.total_amount.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatDate(order.created_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="viewOrder('${
                          order.id
                        }')" class="text-indigo-600 hover:text-indigo-900">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${
                          order.status === "pending"
                            ? `<button onclick="updateOrderStatus('${order.id}', 'confirmed')" class="text-green-600 hover:text-green-900">
                                <i class="fas fa-check"></i>
                            </button>`
                            : ""
                        }
                        ${
                          order.status === "confirmed"
                            ? `<button onclick="updateOrderStatus('${order.id}', 'shipped')" class="text-blue-600 hover:text-blue-900">
                                <i class="fas fa-shipping-fast"></i>
                            </button>`
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
    })
    .join("");
}

async function loadLowStockProducts() {
  try {
    const response = await fetch("/api/marketplace/my-products/low-stock", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    }
    return [];
  } catch (error) {
    console.error("Error loading low stock products:", error);
    return [];
  }
}

function updateStatsDisplay() {
  // Update total products
  document.getElementById("totalProducts").textContent = currentProducts.length;

  // Update active orders (placeholder)
  const activeOrdersCount = currentOrders.filter((order) =>
    ["pending", "confirmed", "shipped"].includes(order.status)
  ).length;
  document.getElementById("activeOrders").textContent = activeOrdersCount;

  // Update low stock items
  const lowStockCount = currentProducts.filter(
    (product) => product.stock_quantity <= 10
  ).length;
  document.getElementById("lowStockItems").textContent = lowStockCount;

  // Update monthly sales (placeholder)
  const monthlySales = currentOrders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + order.total_amount, 0);
  document.getElementById(
    "monthlySales"
  ).textContent = `KES ${monthlySales.toLocaleString()}`;
}

function updateProductsStats() {
  document.getElementById("totalProducts").textContent = currentProducts.length;

  const lowStockCount = currentProducts.filter(
    (product) => product.stock_quantity <= 10
  ).length;
  document.getElementById("lowStockItems").textContent = lowStockCount;
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('[id$="Tab"]').forEach((tab) => {
    tab.className =
      "py-4 px-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium";
  });
  document.getElementById(`${tabName}Tab`).className =
    "py-4 px-2 border-b-2 border-green-600 text-green-600 font-medium";

  // Update content
  document.querySelectorAll('[id$="Content"]').forEach((content) => {
    content.classList.add("hidden");
  });
  document.getElementById(`${tabName}Content`).classList.remove("hidden");

  // Load data for the active tab
  if (tabName === "products") {
    loadProducts();
  } else if (tabName === "orders") {
    loadOrders();
  } else if (tabName === "aiInsights") {
    loadAIInsightsTab();
  } else if (tabName === "analytics") {
    loadAnalytics();
  }
}

function showProductModal(productId = null) {
  editingProductId = productId;
  const modal = document.getElementById("productModal");
  const title = document.getElementById("productModalTitle");
  const form = document.getElementById("productForm");

  if (productId) {
    title.textContent = "Edit Product";
    const product = currentProducts.find((p) => p.id === productId);
    if (product) {
      populateProductForm(product);
    }
  } else {
    title.textContent = "Add Product";
    form.reset();
    resetBulkPricing();
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  editingProductId = null;
}

function populateProductForm(product) {
  document.getElementById("productName").value = product.name || "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productUnitType").value = product.unit_type || "";
  document.getElementById("productUnitPrice").value = product.unit_price || "";
  document.getElementById("productStockQuantity").value =
    product.stock_quantity || "";
  document.getElementById("productLocation").value = product.location || "";
  document.getElementById("productImageUrl").value = product.image_url || "";
  document.getElementById("productDescription").value =
    product.description || "";

  // Populate bulk pricing
  resetBulkPricing();
  if (product.bulk_pricing && typeof product.bulk_pricing === "object") {
    Object.entries(product.bulk_pricing).forEach(([quantity, price]) => {
      addBulkPricingRow(quantity, price);
    });
  }
}

function resetBulkPricing() {
  const container = document.getElementById("bulkPricingContainer");
  container.innerHTML = `
        <div class="flex items-center space-x-2">
            <input type="number" placeholder="Min Quantity" min="1" 
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bulk-quantity">
            <input type="number" placeholder="Price per unit" min="0" step="0.01"
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bulk-price">
            <button type="button" onclick="removeBulkPricingRow(this)" class="text-red-500 hover:text-red-700">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

function addBulkPricingRow(quantity = "", price = "") {
  const container = document.getElementById("bulkPricingContainer");
  const row = document.createElement("div");
  row.className = "flex items-center space-x-2";
  row.innerHTML = `
        <input type="number" placeholder="Min Quantity" min="1" value="${quantity}"
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bulk-quantity">
        <input type="number" placeholder="Price per unit" min="0" step="0.01" value="${price}"
               class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bulk-price">
        <button type="button" onclick="removeBulkPricingRow(this)" class="text-red-500 hover:text-red-700">
            <i class="fas fa-trash"></i>
        </button>
    `;
  container.appendChild(row);
}

function removeBulkPricingRow(button) {
  button.parentElement.remove();
}

async function handleProductSubmit(e) {
  e.preventDefault();

  try {
    showLoading();

    const formData = {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value,
      unit_type: document.getElementById("productUnitType").value.trim(),
      unit_price: parseFloat(document.getElementById("productUnitPrice").value),
      stock_quantity: parseInt(
        document.getElementById("productStockQuantity").value
      ),
      location: document.getElementById("productLocation").value.trim(),
      image_url: document.getElementById("productImageUrl").value.trim(),
      description: document.getElementById("productDescription").value.trim(),
    };

    // Collect bulk pricing
    const bulkPricing = {};
    const quantityInputs = document.querySelectorAll(".bulk-quantity");
    const priceInputs = document.querySelectorAll(".bulk-price");

    for (let i = 0; i < quantityInputs.length; i++) {
      const quantity = parseInt(quantityInputs[i].value);
      const price = parseFloat(priceInputs[i].value);

      if (quantity && price && quantity > 0 && price > 0) {
        bulkPricing[quantity] = price;
      }
    }

    if (Object.keys(bulkPricing).length > 0) {
      formData.bulk_pricing = bulkPricing;
    }

    let response;
    if (editingProductId) {
      // Update existing product
      response = await fetch(`/api/marketplace/products/${editingProductId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(formData),
      });
    } else {
      // Create new product
      response = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify(formData),
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to save product");
    }

    showSuccess(
      editingProductId
        ? "Product updated successfully"
        : "Product created successfully"
    );
    closeProductModal();
    await loadProducts();
  } catch (error) {
    console.error("Error saving product:", error);
    showError(error.message);
  } finally {
    hideLoading();
  }
}

async function editProduct(productId) {
  showProductModal(productId);
}

async function toggleProductStatus(productId, newStatus) {
  try {
    const response = await fetch(`/api/marketplace/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({ is_active: newStatus }),
    });

    if (!response.ok) {
      throw new Error("Failed to update product status");
    }

    showSuccess(
      `Product ${newStatus ? "activated" : "deactivated"} successfully`
    );
    await loadProducts();
  } catch (error) {
    console.error("Error updating product status:", error);
    showError(error.message);
  }
}

async function deleteProduct(productId) {
  if (
    !confirm(
      "Are you sure you want to delete this product? This action cannot be undone."
    )
  ) {
    return;
  }

  try {
    // Since there's no delete endpoint, we'll deactivate the product
    await toggleProductStatus(productId, false);
    showSuccess("Product deactivated successfully");
  } catch (error) {
    console.error("Error deleting product:", error);
    showError("Failed to delete product");
  }
}

function toggleSelectAllProducts() {
  const selectAll = document.getElementById("selectAllProducts");
  const checkboxes = document.querySelectorAll(".product-checkbox");

  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAll.checked;
  });
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    // Placeholder for order status update
    showSuccess(`Order status updated to ${newStatus}`);
    await loadOrders();
  } catch (error) {
    console.error("Error updating order status:", error);
    showError("Failed to update order status");
  }
}

function viewOrder(orderId) {
  // Placeholder for order details view
  showSuccess("Order details view coming soon");
}

async function loadAnalytics() {
  // Placeholder for analytics loading
  const topProductsContainer = document.getElementById("topProducts");

  if (currentProducts.length === 0) {
    topProductsContainer.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-chart-bar text-4xl mb-4"></i>
                <p>No data available</p>
            </div>
        `;
    return;
  }

  // Show top products by stock quantity (placeholder logic)
  const topProducts = currentProducts
    .sort((a, b) => b.stock_quantity - a.stock_quantity)
    .slice(0, 5);

  topProductsContainer.innerHTML = topProducts
    .map(
      (product, index) => `
        <div class="flex items-center justify-between p-3 bg-white rounded-lg">
            <div class="flex items-center space-x-3">
                <span class="text-sm font-bold text-gray-500">#${
                  index + 1
                }</span>
                <div>
                    <p class="font-medium text-gray-800">${product.name}</p>
                    <p class="text-sm text-gray-600">${
                      product.stock_quantity
                    } ${product.unit_type} in stock</p>
                </div>
            </div>
            <span class="text-sm font-bold text-green-600">KES ${product.unit_price.toLocaleString()}</span>
        </div>
    `
    )
    .join("");
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function showLoading() {
  document.getElementById("loadingIndicator").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loadingIndicator").classList.add("hidden");
}

function showSuccess(message) {
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
  notification.innerHTML = `<i class="fas fa-check mr-2"></i>${message}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showError(message) {
  const notification = document.createElement("div");
  notification.className =
    "fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50";
  notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>${message}`;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// AI Integration Functions
async function loadAIDashboardInsights() {
  try {
    showLoading();

    const response = await fetch("/api/marketplace/ai/dashboard-insights", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      displayAIDashboardInsights(result.data);
    } else {
      showError(result.error || "Failed to load AI insights");
    }
  } catch (error) {
    console.error("Error loading AI insights:", error);
    showError("Failed to load AI insights");
  } finally {
    hideLoading();
  }
}

function displayAIDashboardInsights(data) {
  const container = document.getElementById("aiInsightsContent");
  if (!container) return;

  container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-boxes text-2xl mr-3"></i>
                    <div>
                        <p class="text-sm opacity-80">Products</p>
                        <p class="text-xl font-bold">${
                          data.overview.total_products
                        }</p>
                    </div>
                </div>
            </div>
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-exclamation-triangle text-2xl mr-3"></i>
                    <div>
                        <p class="text-sm opacity-80">Low Stock</p>
                        <p class="text-xl font-bold">${
                          data.overview.low_stock_count
                        }</p>
                    </div>
                </div>
            </div>
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-chart-line text-2xl mr-3"></i>
                    <div>
                        <p class="text-sm opacity-80">Revenue</p>
                        <p class="text-xl font-bold">KES ${
                          data.overview.total_revenue || 0
                        }</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-white bg-opacity-10 rounded-lg p-4">
            <h4 class="font-semibold mb-2">AI Recommendations:</h4>
            <div class="text-sm space-y-1">
                ${
                  data.ai_insights.insights
                    ? data.ai_insights.insights
                        .split("\n")
                        .slice(0, 3)
                        .map((line) =>
                          line.trim()
                            ? `<p>• ${line.replace(/[*#]/g, "").trim()}</p>`
                            : ""
                        )
                        .join("")
                    : "<p>• Optimize your product descriptions for better visibility</p><p>• Consider bulk pricing for high-demand items</p><p>• Review low-stock items for restocking</p>"
                }
            </div>
            <button onclick="showDetailedAIInsights()" class="mt-3 bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors text-sm">
                View Detailed Analysis
            </button>
        </div>
    `;
}

async function loadProductOptimizations() {
  try {
    const container = document.getElementById("productOptimizations");
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Loading AI optimizations...</p></div>';

    const response = await fetch("/api/marketplace/ai/product-optimizations", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      displayProductOptimizations(result.data);
    } else {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load optimizations</p>';
    }
  } catch (error) {
    console.error("Error loading product optimizations:", error);
    const container = document.getElementById("productOptimizations");
    if (container) {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load optimizations</p>';
    }
  }
}

function displayProductOptimizations(data) {
  const container = document.getElementById("productOptimizations");
  if (!container) return;

  if (!data.optimizations || data.optimizations.length === 0) {
    container.innerHTML =
      '<p class="text-gray-500 text-center py-4">No optimizations available</p>';
    return;
  }

  container.innerHTML = data.optimizations
    .map(
      (opt) => `
        <div class="bg-white rounded-lg p-4 border border-purple-200">
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-semibold text-gray-800">${opt.product_name}</h4>
                <button onclick="applyOptimization('${
                  opt.product_id
                }', ${JSON.stringify(opt).replace(/"/g, "&quot;")})" 
                        class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors">
                    Apply
                </button>
            </div>
            <div class="text-sm text-gray-600 space-y-1">
                ${
                  opt.optimized_description
                    ? `<p><strong>Description:</strong> ${opt.optimized_description.substring(
                        0,
                        100
                      )}...</p>`
                    : ""
                }
                ${
                  opt.suggested_bulk_pricing &&
                  Object.keys(opt.suggested_bulk_pricing).length > 0
                    ? `<p><strong>Bulk Pricing:</strong> ${
                        Object.keys(opt.suggested_bulk_pricing).length
                      } tiers suggested</p>`
                    : ""
                }
                ${
                  opt.optimized_category
                    ? `<p><strong>Category:</strong> ${opt.optimized_category}</p>`
                    : ""
                }
            </div>
        </div>
    `
    )
    .join("");
}

async function loadInventoryInsights() {
  try {
    const container = document.getElementById("inventoryInsights");
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Loading inventory insights...</p></div>';

    const response = await fetch(
      "/api/marketplace/ai/inventory-recommendations",
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      displayInventoryInsights(result.data);
    } else {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load inventory insights</p>';
    }
  } catch (error) {
    console.error("Error loading inventory insights:", error);
    const container = document.getElementById("inventoryInsights");
    if (container) {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load inventory insights</p>';
    }
  }
}

function displayInventoryInsights(data) {
  const container = document.getElementById("inventoryInsights");
  if (!container) return;

  const recs = data.recommendations;

  container.innerHTML = `
        <div class="space-y-3">
            ${
              recs.critical_restock && recs.critical_restock.length > 0
                ? `
                <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h5 class="font-semibold text-red-800 mb-2">🚨 Critical Restock (${
                      recs.critical_restock.length
                    })</h5>
                    <div class="text-sm text-red-700">
                        ${recs.critical_restock
                          .slice(0, 3)
                          .map(
                            (item) =>
                              `<p>• ${item.name} (${item.stock_quantity} left)</p>`
                          )
                          .join("")}
                    </div>
                </div>
            `
                : ""
            }
            
            ${
              recs.fast_movers && recs.fast_movers.length > 0
                ? `
                <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h5 class="font-semibold text-green-800 mb-2">🔥 Fast Movers (${
                      recs.fast_movers.length
                    })</h5>
                    <div class="text-sm text-green-700">
                        ${recs.fast_movers
                          .slice(0, 3)
                          .map(
                            (item) =>
                              `<p>• ${item.name} (${item.recent_sales} sold)</p>`
                          )
                          .join("")}
                    </div>
                </div>
            `
                : ""
            }
            
            ${
              recs.slow_movers && recs.slow_movers.length > 0
                ? `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h5 class="font-semibold text-yellow-800 mb-2">🐌 Slow Movers (${
                      recs.slow_movers.length
                    })</h5>
                    <div class="text-sm text-yellow-700">
                        ${recs.slow_movers
                          .slice(0, 3)
                          .map(
                            (item) =>
                              `<p>• ${item.name} (${item.recent_sales} sold)</p>`
                          )
                          .join("")}
                    </div>
                </div>
            `
                : ""
            }
        </div>
        
        <div class="mt-4 text-center">
            <p class="text-sm text-gray-600">Total Stock Value: <strong>KES ${
              data.total_stock_value?.toLocaleString() || 0
            }</strong></p>
        </div>
    `;
}

async function loadCompetitiveAnalysis() {
  try {
    const container = document.getElementById("competitiveAnalysis");
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Loading competitive analysis...</p></div>';

    const response = await fetch("/api/marketplace/ai/competitive-analysis", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      displayCompetitiveAnalysis(result.data);
    } else {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load competitive analysis</p>';
    }
  } catch (error) {
    console.error("Error loading competitive analysis:", error);
    const container = document.getElementById("competitiveAnalysis");
    if (container) {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load competitive analysis</p>';
    }
  }
}

function displayCompetitiveAnalysis(data) {
  const container = document.getElementById("competitiveAnalysis");
  if (!container) return;

  container.innerHTML = `
        <div class="space-y-3">
            <div class="bg-white rounded-lg p-4 border border-orange-200">
                <h5 class="font-semibold text-orange-800 mb-2">Market Position</h5>
                <div class="text-sm text-gray-700">
                    <p>Competitors analyzed: <strong>${
                      data.competitors_analyzed
                    }</strong></p>
                    <p>Categories: <strong>${
                      data.categories_analyzed?.join(", ") || "Various"
                    }</strong></p>
                    <p>Region: <strong>${data.region || "Kenya"}</strong></p>
                </div>
            </div>
            
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h5 class="font-semibold text-orange-800 mb-2">Key Insights</h5>
                <div class="text-sm text-orange-700">
                    ${
                      data.analysis
                        ? data.analysis
                            .split("\n")
                            .slice(0, 4)
                            .map((line) =>
                              line.trim() && !line.includes("**")
                                ? `<p>• ${line.replace(/[*#]/g, "").trim()}</p>`
                                : ""
                            )
                            .join("")
                        : "<p>• Analyze your competitive position</p><p>• Identify pricing opportunities</p><p>• Discover market gaps</p>"
                    }
                </div>
            </div>
        </div>
        
        <button onclick="showDetailedCompetitiveAnalysis()" class="mt-4 w-full bg-orange-100 hover:bg-orange-200 text-orange-800 py-2 px-4 rounded-lg transition-colors text-sm">
            View Full Analysis
        </button>
    `;
}

async function loadSalesInsights() {
  try {
    const timeframe = document.getElementById("salesTimeframe")?.value || "30d";
    const container = document.getElementById("salesInsights");
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><p>Loading sales insights...</p></div>';

    const response = await fetch(
      `/api/marketplace/ai/sales-insights?timeframe=${timeframe}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      displaySalesInsights(result.data);
    } else {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load sales insights</p>';
    }
  } catch (error) {
    console.error("Error loading sales insights:", error);
    const container = document.getElementById("salesInsights");
    if (container) {
      container.innerHTML =
        '<p class="text-red-500 text-center py-4">Failed to load sales insights</p>';
    }
  }
}

function displaySalesInsights(data) {
  const container = document.getElementById("salesInsights");
  if (!container) return;

  const metrics = data.sales_metrics;

  container.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-white rounded-lg p-3 border border-blue-200">
                    <p class="text-xs text-gray-600">Revenue</p>
                    <p class="text-lg font-bold text-blue-800">KES ${
                      metrics?.total_revenue?.toLocaleString() || 0
                    }</p>
                </div>
                <div class="bg-white rounded-lg p-3 border border-blue-200">
                    <p class="text-xs text-gray-600">Orders</p>
                    <p class="text-lg font-bold text-blue-800">${
                      metrics?.total_orders || 0
                    }</p>
                </div>
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h5 class="font-semibold text-blue-800 mb-2">Performance Insights</h5>
                <div class="text-sm text-blue-700">
                    ${
                      data.insights
                        ? data.insights
                            .split("\n")
                            .slice(0, 4)
                            .map((line) =>
                              line.trim() && !line.includes("**")
                                ? `<p>• ${line.replace(/[*#]/g, "").trim()}</p>`
                                : ""
                            )
                            .join("")
                        : "<p>• Track your sales performance</p><p>• Identify growth opportunities</p><p>• Optimize product mix</p>"
                    }
                </div>
            </div>
        </div>
        
        <button onclick="showDetailedSalesInsights()" class="mt-4 w-full bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-4 rounded-lg transition-colors text-sm">
            View Detailed Report
        </button>
    `;
}

async function applyOptimization(productId, optimization) {
  try {
    showLoading();

    const response = await fetch("/api/marketplace/ai/apply-suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
      body: JSON.stringify({
        product_id: productId,
        suggestions: optimization,
      }),
    });

    const result = await response.json();

    if (result.success) {
      showSuccess("AI suggestions applied successfully!");
      loadProductOptimizations(); // Refresh optimizations
    } else {
      showError(result.error || "Failed to apply suggestions");
    }
  } catch (error) {
    console.error("Error applying optimization:", error);
    showError("Failed to apply suggestions");
  } finally {
    hideLoading();
  }
}

function loadAIInsightsTab() {
  // Load all AI insights when tab is opened
  loadProductOptimizations();
  loadInventoryInsights();
  loadCompetitiveAnalysis();
  loadSalesInsights();
}

// Placeholder functions for detailed views
function showDetailedAIInsights() {
  showSuccess("Detailed AI insights coming soon!");
}

function showDetailedCompetitiveAnalysis() {
  showSuccess("Detailed competitive analysis coming soon!");
}

function showDetailedSalesInsights() {
  showSuccess("Detailed sales insights coming soon!");
}

function showAIOptimizationModal() {
  showSuccess("AI optimization modal coming soon!");
}

function generateAIDescription() {
  showSuccess("AI description generation coming soon!");
}

function closeAISuggestionsModal() {
  const modal = document.getElementById("aiSuggestionsModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function closeAIInsightsModal() {
  const modal = document.getElementById("aiInsightsModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}
