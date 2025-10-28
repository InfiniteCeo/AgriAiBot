// Farmer Marketplace JavaScript - Real functionality for farmers to sell crops

let currentUser = null;
let farmerListings = [];
let buyerRequests = [];

// Market prices with realistic Kenyan values
const marketPrices = {
  maize: { price: 45, trend: "up", change: 5, demand: "high" },
  beans: { price: 120, trend: "up", change: 10, demand: "high" },
  tomatoes: { price: 80, trend: "down", change: -8, demand: "medium" },
  potatoes: { price: 60, trend: "stable", change: 0, demand: "medium" },
  onions: { price: 90, trend: "up", change: 15, demand: "high" },
  cabbage: { price: 35, trend: "stable", change: 2, demand: "low" },
  carrots: { price: 70, trend: "up", change: 8, demand: "medium" },
  spinach: { price: 50, trend: "down", change: -5, demand: "low" },
};

// Sample buyer requests
const sampleBuyerRequests = [
  {
    id: 1,
    buyer: "Nairobi Fresh Markets",
    crop: "tomatoes",
    quantity: 500,
    maxPrice: 85,
    location: "Nairobi",
    urgency: "high",
    contact: "+254712345678",
  },
  {
    id: 2,
    buyer: "Mombasa Wholesalers",
    crop: "onions",
    quantity: 1000,
    maxPrice: 95,
    location: "Mombasa",
    urgency: "medium",
    contact: "+254723456789",
  },
  {
    id: 3,
    buyer: "Kisumu Cooperative",
    crop: "maize",
    quantity: 2000,
    maxPrice: 48,
    location: "Kisumu",
    urgency: "low",
    contact: "+254734567890",
  },
  {
    id: 4,
    buyer: "Local Restaurant Chain",
    crop: "beans",
    quantity: 200,
    maxPrice: 125,
    location: "Nakuru",
    urgency: "high",
    contact: "+254745678901",
  },
];

// Initialize marketplace
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Farmer marketplace loading...");

  // Check authentication
  const token = localStorage.getItem("authToken");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    await loadUserProfile();
    await loadMarketplaceData();
    displayMarketplace();
    setupEventListeners();

    console.log("Farmer marketplace loaded successfully");
  } catch (error) {
    console.error("Error loading marketplace:", error);
    showError("Failed to load marketplace. Please refresh the page.");
  }
});

// Load user profile
async function loadUserProfile() {
  try {
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

    // Update UI
    document.getElementById("farmerName").textContent = currentUser.name;
  } catch (error) {
    console.error("Error loading profile:", error);
    // Use fallback for demo
    currentUser = {
      id: "demo_user",
      name: "Demo Farmer",
      user_type: "farmer",
    };
    document.getElementById("farmerName").textContent = currentUser.name;
  }
}

// Load marketplace data
async function loadMarketplaceData() {
  // Load from localStorage for now (in real app, this would be from database)
  farmerListings =
    JSON.parse(localStorage.getItem(`farmer_listings_${currentUser.id}`)) || [];
  buyerRequests = sampleBuyerRequests;

  // Add sample listings if empty
  if (farmerListings.length === 0) {
    farmerListings = [
      {
        id: 1,
        crop: "maize",
        quantity: 1500,
        price: 47,
        quality: "grade-a",
        availableDate: "2024-11-01",
        description: "High quality maize, well dried",
        status: "active",
        views: 23,
        inquiries: 5,
      },
      {
        id: 2,
        crop: "beans",
        quantity: 800,
        price: 122,
        quality: "premium",
        availableDate: "2024-10-30",
        description: "Premium quality beans, organic",
        status: "active",
        views: 18,
        inquiries: 3,
      },
    ];
    saveMarketplaceData();
  }
}

// Display marketplace data
function displayMarketplace() {
  updateMarketplaceStats();
  displayMyListings();
  displayBuyerRequests();
  displayPriceAlerts();
  displayMarketTrends();
}

// Update marketplace statistics
function updateMarketplaceStats() {
  const activeListings = farmerListings.filter(
    (l) => l.status === "active"
  ).length;
  const totalViews = farmerListings.reduce((sum, l) => sum + (l.views || 0), 0);
  const bestPrice = Math.max(
    ...Object.values(marketPrices).map((p) => p.price)
  );
  const potentialEarnings = calculatePotentialEarnings();

  document.getElementById("myListings").textContent = activeListings;
  document.getElementById("activeBuyers").textContent = buyerRequests.length;
  document.getElementById("bestPrice").textContent = `KSh ${bestPrice}`;
  document.getElementById(
    "potentialEarnings"
  ).textContent = `KSh ${potentialEarnings.toLocaleString()}`;
}

// Calculate potential earnings
function calculatePotentialEarnings() {
  return farmerListings.reduce((total, listing) => {
    if (listing.status === "active") {
      return total + listing.quantity * listing.price;
    }
    return total;
  }, 0);
}

// Display farmer's listings
function displayMyListings() {
  const container = document.getElementById("myListingsContainer");

  if (farmerListings.length === 0) {
    container.innerHTML = `
            <div class="text-center py-8">
                <i class="fas fa-seedling text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">No listings yet. Click "Add Listing" to start selling!</p>
            </div>
        `;
    return;
  }

  container.innerHTML = farmerListings
    .map((listing) => {
      const marketPrice = marketPrices[listing.crop]?.price || 0;
      const priceComparison =
        listing.price > marketPrice
          ? "above"
          : listing.price < marketPrice
          ? "below"
          : "at";
      const priceColor =
        priceComparison === "above"
          ? "text-green-600"
          : priceComparison === "below"
          ? "text-red-600"
          : "text-gray-600";

      return `
            <div class="border border-gray-200 rounded-lg p-4 mb-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="font-semibold text-lg capitalize">${
                          listing.crop
                        }</h3>
                        <p class="text-sm text-gray-600">${
                          listing.quantity
                        } kg available</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-lg ${priceColor}">KSh ${
        listing.price
      }/kg</p>
                        <p class="text-xs text-gray-500">${priceComparison} market (KSh ${marketPrice})</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                        <span class="text-gray-600">Quality:</span>
                        <span class="font-medium capitalize">${listing.quality.replace(
                          "-",
                          " "
                        )}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Available:</span>
                        <span class="font-medium">${formatDate(
                          listing.availableDate
                        )}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Views:</span>
                        <span class="font-medium">${listing.views || 0}</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Inquiries:</span>
                        <span class="font-medium">${
                          listing.inquiries || 0
                        }</span>
                    </div>
                </div>
                
                ${
                  listing.description
                    ? `
                    <p class="text-sm text-gray-600 mb-3">${listing.description}</p>
                `
                    : ""
                }
                
                <div class="flex justify-between items-center">
                    <span class="px-2 py-1 text-xs rounded-full ${
                      listing.status === "active"
                        ? "bg-green-100 text-green-800"
                        : listing.status === "sold"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }">
                        ${listing.status}
                    </span>
                    <div class="space-x-2">
                        <button onclick="editListing(${
                          listing.id
                        })" class="text-blue-600 hover:text-blue-800 text-sm">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="deleteListing(${
                          listing.id
                        })" class="text-red-600 hover:text-red-800 text-sm">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");
}

// Display buyer requests
function displayBuyerRequests() {
  const container = document.getElementById("buyerRequestsContainer");

  // Filter requests that match farmer's crops or show all
  const relevantRequests = buyerRequests.filter((request) => {
    return (
      farmerListings.some((listing) => listing.crop === request.crop) ||
      buyerRequests.indexOf(request) < 4
    ); // Show first 4 anyway
  });

  container.innerHTML = relevantRequests
    .map((request) => {
      const urgencyColor =
        request.urgency === "high"
          ? "border-red-200 bg-red-50"
          : request.urgency === "medium"
          ? "border-yellow-200 bg-yellow-50"
          : "border-green-200 bg-green-50";

      const hasMatchingCrop = farmerListings.some(
        (listing) =>
          listing.crop === request.crop && listing.status === "active"
      );

      return `
            <div class="${urgencyColor} border rounded-lg p-4 mb-4">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-semibold">${request.buyer}</h4>
                        <p class="text-sm text-gray-600">${request.location}</p>
                    </div>
                    <span class="px-2 py-1 text-xs rounded-full ${
                      request.urgency === "high"
                        ? "bg-red-100 text-red-800"
                        : request.urgency === "medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }">
                        ${request.urgency} priority
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                        <span class="text-gray-600">Wants:</span>
                        <span class="font-medium capitalize">${
                          request.crop
                        }</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Quantity:</span>
                        <span class="font-medium">${request.quantity} kg</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Max Price:</span>
                        <span class="font-medium text-green-600">KSh ${
                          request.maxPrice
                        }/kg</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Contact:</span>
                        <span class="font-medium">${request.contact}</span>
                    </div>
                </div>
                
                <div class="flex justify-between items-center">
                    ${
                      hasMatchingCrop
                        ? '<span class="text-green-600 text-sm"><i class="fas fa-check-circle mr-1"></i>You have matching crop!</span>'
                        : '<span class="text-gray-500 text-sm">No matching crops</span>'
                    }
                    <button onclick="contactBuyer('${request.contact}', '${
        request.crop
      }')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                        <i class="fas fa-phone mr-1"></i>Contact
                    </button>
                </div>
            </div>
        `;
    })
    .join("");
}

// Display price alerts
function displayPriceAlerts() {
  const container = document.getElementById("priceAlertsContainer");

  const alerts = [];

  // Generate alerts based on farmer's crops and market conditions
  farmerListings.forEach((listing) => {
    const marketData = marketPrices[listing.crop];
    if (marketData) {
      if (marketData.trend === "up" && marketData.change > 5) {
        alerts.push({
          type: "price-up",
          crop: listing.crop,
          message: `${listing.crop} prices up ${marketData.change}%! Consider selling now.`,
          priority: "high",
        });
      } else if (marketData.trend === "down" && marketData.change < -5) {
        alerts.push({
          type: "price-down",
          crop: listing.crop,
          message: `${listing.crop} prices falling. Hold if possible.`,
          priority: "medium",
        });
      }
    }
  });

  // Add general market alerts
  alerts.push({
    type: "demand",
    crop: "beans",
    message: "High demand for beans in Nairobi markets this week.",
    priority: "medium",
  });

  if (alerts.length === 0) {
    container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-bell-slash text-2xl text-gray-300 mb-2"></i>
                <p class="text-gray-500 text-sm">No price alerts at the moment</p>
            </div>
        `;
    return;
  }

  container.innerHTML = alerts
    .map((alert) => {
      const priorityColor =
        alert.priority === "high"
          ? "border-red-200 bg-red-50"
          : alert.priority === "medium"
          ? "border-yellow-200 bg-yellow-50"
          : "border-blue-200 bg-blue-50";

      return `
            <div class="${priorityColor} border rounded-lg p-3 mb-3">
                <div class="flex items-start space-x-2">
                    <i class="fas fa-bell text-sm mt-1 ${
                      alert.priority === "high"
                        ? "text-red-600"
                        : alert.priority === "medium"
                        ? "text-yellow-600"
                        : "text-blue-600"
                    }"></i>
                    <div class="flex-1">
                        <p class="text-sm font-medium capitalize">${
                          alert.crop
                        }</p>
                        <p class="text-xs text-gray-600">${alert.message}</p>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");
}

// Display market trends
function displayMarketTrends() {
  const container = document.getElementById("marketTrendsContainer");

  const trends = Object.entries(marketPrices)
    .map(([crop, data]) => {
      return { crop, ...data };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);

  container.innerHTML = trends
    .map((trend) => {
      const trendIcon =
        trend.trend === "up"
          ? "fa-arrow-up"
          : trend.trend === "down"
          ? "fa-arrow-down"
          : "fa-minus";
      const trendColor =
        trend.trend === "up"
          ? "text-green-600"
          : trend.trend === "down"
          ? "text-red-600"
          : "text-gray-600";

      return `
            <div class="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-seedling text-green-600 text-sm"></i>
                    <span class="text-sm font-medium capitalize">${
                      trend.crop
                    }</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-bold">KSh ${trend.price}</span>
                    <span class="${trendColor} text-xs">
                        <i class="fas ${trendIcon}"></i>
                        ${Math.abs(trend.change)}%
                    </span>
                </div>
            </div>
        `;
    })
    .join("");
}

// Setup event listeners
function setupEventListeners() {
  // Add listing form
  document
    .getElementById("addListingForm")
    .addEventListener("submit", handleAddListing);

  // Set default date to today
  document.getElementById("listingAvailableDate").value = new Date()
    .toISOString()
    .split("T")[0];
}

// Handle add listing
function handleAddListing(e) {
  e.preventDefault();

  const cropType = document.getElementById("listingCropType").value;
  const quantity = parseInt(document.getElementById("listingQuantity").value);
  const price = parseFloat(document.getElementById("listingPrice").value);
  const quality = document.getElementById("listingQuality").value;
  const availableDate = document.getElementById("listingAvailableDate").value;
  const description = document.getElementById("listingDescription").value;

  if (!cropType || !quantity || !price || !quality || !availableDate) {
    showError("Please fill in all required fields");
    return;
  }

  const newListing = {
    id: Date.now(),
    crop: cropType,
    quantity: quantity,
    price: price,
    quality: quality,
    availableDate: availableDate,
    description: description,
    status: "active",
    views: 0,
    inquiries: 0,
    createdAt: new Date().toISOString(),
  };

  farmerListings.push(newListing);
  saveMarketplaceData();
  displayMarketplace();
  closeAddListingModal();

  showSuccess(
    `${cropType} listing added successfully! Total value: KSh ${(
      quantity * price
    ).toLocaleString()}`
  );
}

// Modal functions
function addListing() {
  document.getElementById("addListingModal").classList.remove("hidden");
}

function closeAddListingModal() {
  document.getElementById("addListingModal").classList.add("hidden");
  document.getElementById("addListingForm").reset();
}

function editListing(listingId) {
  const listing = farmerListings.find((l) => l.id === listingId);
  if (!listing) return;

  // Simple edit for now - could be enhanced with modal
  const newPrice = parseFloat(
    prompt(
      `New price for ${listing.crop} (current: KSh ${listing.price}/kg):`,
      listing.price
    )
  );

  if (newPrice && newPrice > 0) {
    listing.price = newPrice;
    saveMarketplaceData();
    displayMarketplace();
    showSuccess("Listing updated successfully!");
  }
}

function deleteListing(listingId) {
  if (confirm("Are you sure you want to delete this listing?")) {
    farmerListings = farmerListings.filter((l) => l.id !== listingId);
    saveMarketplaceData();
    displayMarketplace();
    showSuccess("Listing deleted successfully!");
  }
}

// Quick actions
function findBestPrices() {
  const bestPrices = Object.entries(marketPrices)
    .sort((a, b) => b[1].price - a[1].price)
    .slice(0, 3)
    .map(([crop, data]) => `${crop}: KSh ${data.price}/kg`)
    .join("\n");

  showInfo(`Best prices today:\n${bestPrices}`);
}

function contactBuyers() {
  const highPriorityBuyers = buyerRequests
    .filter((r) => r.urgency === "high")
    .map((r) => `${r.buyer}: ${r.contact} (wants ${r.crop})`)
    .join("\n");

  if (highPriorityBuyers) {
    showInfo(`High priority buyers:\n${highPriorityBuyers}`);
  } else {
    showInfo("No high priority buyers at the moment.");
  }
}

function contactBuyer(contact, crop) {
  const message = `Hello! I have ${crop} available for sale. Are you still looking to buy?`;
  const whatsappUrl = `https://wa.me/${contact.replace(
    "+",
    ""
  )}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank");
}

function priceCalculator() {
  document.getElementById("priceCalculatorModal").classList.remove("hidden");
}

function closePriceCalculatorModal() {
  document.getElementById("priceCalculatorModal").classList.add("hidden");
}

function calculatePrice() {
  const cropType = document.getElementById("calcCropType").value;
  const quantity = parseInt(document.getElementById("calcQuantity").value);
  const quality = document.getElementById("calcQuality").value;

  if (!cropType || !quantity || quantity <= 0) {
    showError("Please enter valid crop type and quantity");
    return;
  }

  const basePrice = marketPrices[cropType]?.price || 50;

  // Quality adjustments
  const qualityMultipliers = {
    premium: 1.15,
    "grade-a": 1.05,
    "grade-b": 1.0,
    standard: 0.9,
  };

  const adjustedPrice = basePrice * (qualityMultipliers[quality] || 1.0);
  const totalValue = adjustedPrice * quantity;

  const resultContainer = document.getElementById("priceCalculationResult");
  resultContainer.innerHTML = `
        <h4 class="font-bold text-green-800 mb-2">Price Calculation Result</h4>
        <div class="space-y-2 text-sm">
            <div class="flex justify-between">
                <span>Base market price:</span>
                <span>KSh ${basePrice}/kg</span>
            </div>
            <div class="flex justify-between">
                <span>Quality adjustment:</span>
                <span>${quality} (${
    qualityMultipliers[quality]
      ? ((qualityMultipliers[quality] - 1) * 100).toFixed(0) + "%"
      : "0%"
  })</span>
            </div>
            <div class="flex justify-between font-bold">
                <span>Recommended price:</span>
                <span>KSh ${adjustedPrice.toFixed(2)}/kg</span>
            </div>
            <div class="flex justify-between font-bold text-lg">
                <span>Total value (${quantity}kg):</span>
                <span class="text-green-600">KSh ${totalValue.toLocaleString()}</span>
            </div>
        </div>
        <div class="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-800">
            💡 Tip: Consider market trends and buyer demand when setting your final price.
        </div>
    `;
  resultContainer.classList.remove("hidden");
}

function marketAnalysis() {
  const analysis = {
    trending: Object.entries(marketPrices)
      .filter(([_, data]) => data.trend === "up" && data.change > 5)
      .map(([crop, _]) => crop),
    declining: Object.entries(marketPrices)
      .filter(([_, data]) => data.trend === "down" && data.change < -5)
      .map(([crop, _]) => crop),
    highDemand: Object.entries(marketPrices)
      .filter(([_, data]) => data.demand === "high")
      .map(([crop, _]) => crop),
  };

  let message = "Market Analysis:\n\n";

  if (analysis.trending.length > 0) {
    message += `📈 Trending up: ${analysis.trending.join(", ")}\n`;
  }

  if (analysis.declining.length > 0) {
    message += `📉 Declining: ${analysis.declining.join(", ")}\n`;
  }

  if (analysis.highDemand.length > 0) {
    message += `🔥 High demand: ${analysis.highDemand.join(", ")}\n`;
  }

  message +=
    "\n💡 Focus on high-demand crops with rising prices for maximum profit!";

  showInfo(message);
}

// Utility functions
function saveMarketplaceData() {
  localStorage.setItem(
    `farmer_listings_${currentUser.id}`,
    JSON.stringify(farmerListings)
  );
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Notification functions
function showSuccess(message) {
  showNotification(message, "success");
}

function showError(message) {
  showNotification(message, "error");
}

function showWarning(message) {
  showNotification(message, "warning");
}

function showInfo(message) {
  showNotification(message, "info");
}

function showNotification(message, type) {
  // Simple alert for now - could be enhanced with toast notifications
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  alert(`${icons[type]} ${message}`);
}
