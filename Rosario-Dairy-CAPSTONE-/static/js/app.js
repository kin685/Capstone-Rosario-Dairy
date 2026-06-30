/* ─── Rosario Dairy — Main Application JS ──────────────────────────────────── */

"use strict";

// ─── State ──────────────────────────────────────────────────────────────────
let cart = [];
let allProducts = [];
let allCustomers = [];
let selectedPayment = "Cash";
let editingProductId = null;

// Chart instances
let chartRevenue = null;
let chartCategories = null;
let chartRevenueAnalytics = null;
let chartPredictions = null;
let chartCategoryAnalytics = null;
let chartTopProducts = null;

// ─── RBAC ────────────────────────────────────────────────────────────────────
const ROLE_DEFAULT_VIEW = { admin: "dashboard", staff: "pos" };
const VIEW_TITLES = {
  dashboard: "Dashboard", pos: "Point of Sale", inventory: "Inventory",
  analytics: "Analytics", customers: "Customers", reports: "Sales History",
};

function isAdmin() {
  return (window.CURRENT_USER && window.CURRENT_USER.role) === "admin";
}

function applyRoleVisibility() {
  const role = (window.CURRENT_USER && window.CURRENT_USER.role) || "staff";

  // Filter sidebar nav items and labels by data-roles
  document.querySelectorAll("[data-roles]").forEach(el => {
    const allowed = el.dataset.roles.split(",");
    el.classList.toggle("hidden-by-role", !allowed.includes(role));
  });

  // Hide admin-only action buttons in views
  document.querySelectorAll(".admin-only").forEach(el => {
    el.classList.toggle("hidden-by-role", role !== "admin");
  });

  // Sidebar user footer
  const initials = (window.CURRENT_USER?.name || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  const roleBadge = document.getElementById("userRoleBadge");
  if (nameEl) nameEl.textContent = window.CURRENT_USER?.name || "User";
  if (avatarEl) avatarEl.textContent = initials;
  if (roleBadge) {
    roleBadge.textContent = role === "admin" ? "Admin" : "Staff";
    roleBadge.className = "role-badge " + (role === "admin" ? "role-admin" : "role-staff");
  }
}

async function logout() {
  window.location.href = "/logout";
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  startClock();
  applyRoleVisibility();
  const role = (window.CURRENT_USER && window.CURRENT_USER.role) || "staff";
  const defaultView = ROLE_DEFAULT_VIEW[role] || "pos";
  switchView(defaultView);
  setupNavigation();
  document.getElementById("menuToggle").addEventListener("click", toggleSidebar);
  document.getElementById("todayDate").textContent = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
});

// ─── Clock ───────────────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const now = new Date();
    document.getElementById("clock").textContent = now.toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  };
  tick();
  setInterval(tick, 1000);
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const view = link.dataset.view;
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      link.classList.add("active");
      switchView(view);
      if (window.innerWidth <= 768) document.getElementById("sidebar").classList.remove("open");
    });
  });
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${viewName}`).classList.add("active");
  document.getElementById("pageTitle").textContent = VIEW_TITLES[viewName] || viewName;

  // Update nav highlight
  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.view === viewName);
  });

  // Load view data
  const loaders = {
    dashboard: loadDashboard,
    pos: loadPOS,
    inventory: loadInventory,
    analytics: loadAnalytics,
    customers: loadCustomers,
    reports: loadReports,
  };
  if (loaders[viewName]) loaders[viewName]();
}

// ─── API Helpers ─────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (res.status === 401) {
      window.location.href = "/login";
      return null;
    }
    if (res.status === 403) {
      showToast("You don't have permission to do that.", "error");
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    showToast("Network error. Is the server running?", "error");
    return null;
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  const [kpis, revenue, cats, topProducts, lowStock] = await Promise.all([
    api("/api/kpis"),
    api("/api/analytics/revenue?days=14"),
    api("/api/analytics/categories"),
    api("/api/analytics/top-products"),
    api("/api/analytics/low-stock"),
  ]);

  if (kpis) {
    document.getElementById("kpiTodayRev").textContent = fmt(kpis.today_revenue);
    document.getElementById("kpiMonthlyRev").textContent = fmt(kpis.monthly_revenue);
    document.getElementById("kpiTransactions").textContent = kpis.total_transactions.toLocaleString();
    document.getElementById("kpiLowStock").textContent = kpis.low_stock_count;

    const changeEl = document.getElementById("kpiRevChange");
    const ch = kpis.revenue_change;
    changeEl.textContent = `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch)}% vs yesterday`;
    changeEl.className = "kpi-change " + (ch >= 0 ? "positive" : "negative");

    document.getElementById("notifBadge").textContent = kpis.low_stock_count;
    if (kpis.low_stock_count > 0) {
      document.getElementById("kpiLowStockCard").style.background = "#FEF0E7";
    }
  }

  // Revenue mini chart
  if (revenue) {
    const labels = Object.keys(revenue).map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    });
    const data = Object.values(revenue);
    renderLineChart("chartRevenue", labels, data, "Revenue (₱)");
  }

  // Category donut
  if (cats && cats.length) {
    renderDoughnut("chartCategories", cats.map(c => c.category), cats.map(c => c.revenue));
  }

  // Top products
  if (topProducts) {
    const tbody = document.querySelector("#topProductsTable tbody");
    tbody.innerHTML = topProducts.map((p, i) => `
      <tr>
        <td><span style="color:var(--blue-500);font-weight:700">${i + 1}.</span> ${p.name}</td>
        <td>${p.qty.toLocaleString()} units</td>
        <td style="font-family:var(--font-mono)">${fmt(p.revenue)}</td>
      </tr>`).join("");
  }

  // Low stock
  if (lowStock) {
    const tbody = document.querySelector("#lowStockTable tbody");
    if (lowStock.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--green);padding:20px">✓ All stock levels OK</td></tr>`;
    } else {
      tbody.innerHTML = lowStock.map(p => `
        <tr>
          <td>${p.name}</td>
          <td><span class="badge ${p.stock === 0 ? "badge-out" : "badge-low"}">${p.stock} ${p.unit}</span></td>
          <td>${p.min_stock}</td>
        </tr>`).join("");
    }
  }
}

// ─── POS ─────────────────────────────────────────────────────────────────────
async function loadPOS() {
  const [products, customers] = await Promise.all([
    api("/api/products"),
    api("/api/customers"),
  ]);
  if (products) { allProducts = products; renderProductGrid(products); }
  if (customers) {
    allCustomers = customers;
    const sel = document.getElementById("cartCustomer");
    sel.innerHTML = customers.map(c =>
      `<option value="${c.id}">${c.name}${c.points ? ` (${c.points} pts)` : ""}</option>`
    ).join("");
  }
}

function renderProductGrid(products) {
  const grid = document.getElementById("posProductGrid");
  grid.innerHTML = products.map(p => {
    const stockClass = p.stock === 0 ? "out" : p.stock <= p.min_stock ? "low" : "";
    const oos = p.stock === 0;
    return `
      <div class="product-tile ${oos ? "out-of-stock" : ""}"
           onclick="${oos ? "" : `addToCart(${p.id})`}">
        <div class="product-tile-cat">${p.category}</div>
        <div class="product-tile-name">${p.name}</div>
        <div class="product-tile-price">${fmt(p.price)}</div>
        <div class="product-tile-stock ${stockClass}">
          ${p.stock === 0 ? "Out of Stock" : `Stock: ${p.stock} ${p.unit}`}
        </div>
      </div>`;
  }).join("");
}

function filterPosProducts() {
  const q = document.getElementById("posSearch").value.toLowerCase();
  const cat = document.getElementById("posCategoryFilter").value;
  const filtered = allProducts.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
    const matchCat = !cat || p.category === cat;
    return matchQ && matchCat;
  });
  renderProductGrid(filtered);
}

function addToCart(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product || product.stock === 0) return;
  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.qty >= product.stock) { showToast("Max available stock reached", "warning"); return; }
    existing.qty++;
    existing.subtotal = existing.qty * existing.price;
  } else {
    cart.push({ product_id: productId, name: product.name, price: product.price, qty: 1, subtotal: product.price, unit: product.unit });
  }
  renderCart();
  showToast(`${product.name} added`, "success");
}

function changeQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.product_id !== productId);
  } else {
    item.subtotal = item.qty * item.price;
  }
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(i => i.product_id !== productId);
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cartItems");
  if (cart.length === 0) {
    container.innerHTML = `<div class="cart-empty">No items yet — select a product</div>`;
    updateCartTotal();
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div style="flex:1">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${fmt(item.price)} / ${item.unit}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="changeQty(${item.product_id}, -1)">−</button>
        <span class="qty-display">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.product_id}, 1)">+</button>
      </div>
      <span class="cart-item-subtotal">${fmt(item.subtotal)}</span>
      <button class="remove-item" onclick="removeFromCart(${item.product_id})" title="Remove">×</button>
    </div>`).join("");
  updateCartTotal();
}

function updateCartTotal() {
  const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0);
  const discount = parseFloat(document.getElementById("cartDiscount").value) || 0;
  const total = subtotal * (1 - discount / 100);
  const tax = total * 0.12;
  const grand = total + tax;

  document.getElementById("cartSubtotal").textContent = fmt(subtotal);
  document.getElementById("cartTax").textContent = fmt(tax);
  document.getElementById("cartTotal").textContent = fmt(grand);
  calcChange();
}

function selectPayment(btn) {
  document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedPayment = btn.dataset.method;
  document.getElementById("cashInputRow").style.display =
    selectedPayment === "Cash" ? "block" : "none";
}

function calcChange() {
  const cashInput = parseFloat(document.getElementById("cashReceived").value) || 0;
  const totalText = document.getElementById("cartTotal").textContent.replace("₱", "").replace(",", "");
  const total = parseFloat(totalText) || 0;
  const changeDisplay = document.getElementById("changeDisplay");
  if (cashInput > 0) {
    const change = cashInput - total;
    changeDisplay.textContent = change >= 0
      ? `Change: ${fmt(change)}`
      : `⚠ Short by: ${fmt(Math.abs(change))}`;
    changeDisplay.style.color = change >= 0 ? "var(--green)" : "var(--red)";
  } else {
    changeDisplay.textContent = "";
  }
}

function clearCart() {
  cart = [];
  renderCart();
}

async function processCheckout() {
  if (cart.length === 0) { showToast("Cart is empty!", "warning"); return; }
  const customerId = parseInt(document.getElementById("cartCustomer").value);
  const discount = parseFloat(document.getElementById("cartDiscount").value) || 0;

  const result = await api("/api/transactions", {
    method: "POST",
    body: { items: cart, customer_id: customerId, payment: selectedPayment, discount }
  });

  if (result && result.success) {
    showToast(`✓ Sale completed! Total: ${fmt(result.transaction.grand_total)}`, "success");
    showReceipt(result.transaction);
    clearCart();
    // Refresh product list to show updated stock
    const products = await api("/api/products");
    if (products) { allProducts = products; renderProductGrid(products); }
  } else if (result) {
    showToast(result.error || "Transaction failed", "error");
  }
}

function showReceipt(tx) {
  const content = document.getElementById("receiptContent");
  content.innerHTML = `
    <div class="receipt">
      <div class="receipt-header">
        <div class="brand">🥛 Rosario Dairy</div>
        <div>Farm Fresh · Est. 1998</div>
        <div style="font-size:10px;margin-top:4px">${new Date(tx.date).toLocaleString("en-PH")}</div>
        <div style="font-size:10px">TXN# ${tx.id}</div>
      </div>
      <hr class="receipt-divider" />
      <div class="receipt-items">
        ${tx.items.map(item =>
          `<div class="receipt-item">
            <span>${item.name} x${item.qty}</span>
            <span>${fmt(item.subtotal)}</span>
          </div>`
        ).join("")}
      </div>
      <hr class="receipt-divider" />
      <div class="receipt-totals">
        <div>Subtotal: ${fmt(tx.subtotal)}</div>
        ${tx.discount > 0 ? `<div>Discount: -${tx.discount}%</div>` : ""}
        <div>VAT (12%): ${fmt(tx.tax)}</div>
        <div class="receipt-total">TOTAL: ${fmt(tx.grand_total)}</div>
        <div>Payment: ${tx.payment}</div>
      </div>
      <hr class="receipt-divider" />
      <div class="receipt-footer">
        <div>Customer: ${tx.customer_name}</div>
        <div>Points Earned: +${tx.points_earned}</div>
        <div style="margin-top:8px">Thank you for supporting Rosario Dairy!</div>
        <div>All products are farm fresh & quality assured.</div>
      </div>
    </div>`;
  openModal("receiptModal");
}

function printReceipt() {
  const content = document.getElementById("receiptContent").innerHTML;
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Receipt — Rosario Dairy</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 280px; margin: 0 auto; padding: 10px; }
      .receipt-item { display: flex; justify-content: space-between; }
      .receipt-divider { border: none; border-top: 1px dashed #ccc; margin: 8px 0; }
      .receipt-total { font-size: 15px; font-weight: bold; margin-top: 4px; }
    </style></head>
    <body>${content}</body></html>`);
  win.document.close();
  win.print();
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
async function loadInventory() {
  const q = document.getElementById("invSearch")?.value || "";
  const cat = document.getElementById("invCategory")?.value || "";
  let url = `/api/products?q=${encodeURIComponent(q)}`;
  if (cat) url += `&category=${encodeURIComponent(cat)}`;
  const products = await api(url);
  if (!products) return;

  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = products.map(p => {
    const pct = p.stock / (p.min_stock * 3) * 100;
    const statusClass = p.stock === 0 ? "badge-out" : p.stock <= p.min_stock ? "badge-low" : "badge-ok";
    const statusText = p.stock === 0 ? "Out of Stock" : p.stock <= p.min_stock ? "Low Stock" : "In Stock";
    const margin = (((p.price - p.cost) / p.price) * 100).toFixed(0);
    const actionsCell = isAdmin() ? `
        <td>
          <div class="action-btns">
            <button class="btn-edit" onclick="openProductModal(${p.id})">Edit</button>
            <button class="btn-restock" onclick="openRestockModal(${p.id}, '${p.name}')">+Stock</button>
            <button class="btn-danger" onclick="deleteProduct(${p.id})">Del</button>
          </div>
        </td>` : "";
    return `
      <tr>
        <td><code style="font-size:11px;color:var(--gray-500)">${p.barcode}</code></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-gold" style="font-size:10px">${p.category}</span></td>
        <td style="font-family:var(--font-mono)">${fmt(p.price)}</td>
        <td style="font-family:var(--font-mono);color:var(--gray-500)">${fmt(p.cost)} <small style="color:var(--green)">${margin}%</small></td>
        <td>
          <span class="badge ${statusClass}">${p.stock} ${p.unit}</span>
        </td>
        <td style="color:var(--gray-500)">${p.unit}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        ${actionsCell}
      </tr>`;
  }).join("");
}

function openProductModal(productId = null) {
  editingProductId = productId;
  document.getElementById("productModalTitle").textContent = productId ? "Edit Product" : "Add Product";
  document.getElementById("productId").value = productId || "";

  if (productId) {
    const p = allProducts.find(x => x.id === productId) ||
              { name: "", category: "Milk", unit: "", price: 0, cost: 0, stock: 0, min_stock: 10, barcode: "" };
    // Fetch fresh
    api("/api/products").then(prods => {
      const fp = (prods || []).find(x => x.id === productId);
      if (fp) {
        document.getElementById("productName").value = fp.name;
        document.getElementById("productCategory").value = fp.category;
        document.getElementById("productUnit").value = fp.unit;
        document.getElementById("productPrice").value = fp.price;
        document.getElementById("productCost").value = fp.cost;
        document.getElementById("productStock").value = fp.stock;
        document.getElementById("productMinStock").value = fp.min_stock;
        document.getElementById("productBarcode").value = fp.barcode;
      }
    });
  } else {
    ["productName","productUnit","productBarcode"].forEach(id => document.getElementById(id).value = "");
    ["productPrice","productCost","productStock"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("productMinStock").value = "10";
    document.getElementById("productCategory").value = "Milk";
  }
  openModal("productModal");
}

async function saveProduct() {
  const data = {
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("productCategory").value,
    unit: document.getElementById("productUnit").value.trim(),
    price: document.getElementById("productPrice").value,
    cost: document.getElementById("productCost").value,
    stock: document.getElementById("productStock").value,
    min_stock: document.getElementById("productMinStock").value,
    barcode: document.getElementById("productBarcode").value.trim(),
  };
  if (!data.name || !data.price) { showToast("Name and price are required", "warning"); return; }

  let result;
  if (editingProductId) {
    result = await api(`/api/products/${editingProductId}`, { method: "PUT", body: data });
  } else {
    result = await api("/api/products", { method: "POST", body: data });
  }

  if (result && result.success) {
    showToast(editingProductId ? "Product updated!" : "Product added!", "success");
    closeModal("productModal");
    loadInventory();
  }
}

async function deleteProduct(pid) {
  if (!confirm("Delete this product?")) return;
  const result = await api(`/api/products/${pid}`, { method: "DELETE" });
  if (result && result.success) {
    showToast("Product deleted", "info");
    loadInventory();
  }
}

function openRestockModal(pid, name) {
  document.getElementById("restockProductId").value = pid;
  document.getElementById("restockProductName").textContent = name;
  document.getElementById("restockQty").value = 10;
  openModal("restockModal");
}

async function confirmRestock() {
  const pid = parseInt(document.getElementById("restockProductId").value);
  const qty = parseInt(document.getElementById("restockQty").value);
  if (!qty || qty <= 0) { showToast("Enter a valid quantity", "warning"); return; }
  const result = await api(`/api/products/${pid}/restock`, { method: "POST", body: { qty } });
  if (result && result.success) {
    showToast(`Restocked! New stock: ${result.new_stock}`, "success");
    closeModal("restockModal");
    loadInventory();
  }
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  const days = document.getElementById("revenueDaysFilter")?.value || 30;
  const [revenue, predictions, cats, topProducts, logs] = await Promise.all([
    api(`/api/analytics/revenue?days=${days}`),
    api("/api/analytics/predictions"),
    api("/api/analytics/categories"),
    api("/api/analytics/top-products"),
    api("/api/analytics/inventory-logs"),
  ]);

  if (revenue) {
    const labels = Object.keys(revenue).map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    });
    const data = Object.values(revenue);

    if (chartRevenueAnalytics) chartRevenueAnalytics.destroy();
    const ctx = document.getElementById("chartRevenueAnalytics").getContext("2d");
    chartRevenueAnalytics = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Revenue (₱)",
          data,
          borderColor: "#3A7CA5",
          backgroundColor: "rgba(58,124,165,.1)",
          tension: .4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: "#3A7CA5",
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
          y: { grid: { color: "#F3F4F6" }, ticks: { callback: v => "₱" + v.toLocaleString() } }
        }
      }
    });
  }

  if (predictions && predictions.length) {
    if (chartPredictions) chartPredictions.destroy();
    const ctx = document.getElementById("chartPredictions").getContext("2d");
    chartPredictions = new Chart(ctx, {
      type: "bar",
      data: {
        labels: predictions.map(p => `${p.day} ${p.date.slice(5)}`),
        datasets: [{
          label: "Predicted Revenue (₱)",
          data: predictions.map(p => p.predicted),
          backgroundColor: predictions.map((_, i) =>
            `rgba(123,47,190,${0.5 + i * 0.07})`),
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Predicted: ₱${ctx.raw.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: { ticks: { callback: v => "₱" + v.toLocaleString() } }
        }
      }
    });
  }

  if (cats && cats.length) {
    if (chartCategoryAnalytics) chartCategoryAnalytics.destroy();
    const ctx = document.getElementById("chartCategoryAnalytics").getContext("2d");
    chartCategoryAnalytics = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: cats.map(c => c.category),
        datasets: [{
          data: cats.map(c => c.revenue),
          backgroundColor: ["#3A7CA5","#D4A843","#2E7D50","#C0392B","#7B2FBE","#E67E22"],
          borderWidth: 2,
          borderColor: "#fff",
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: ctx => ` ₱${ctx.raw.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
            }
          }
        }
      }
    });
  }

  if (topProducts && topProducts.length) {
    if (chartTopProducts) chartTopProducts.destroy();
    const ctx = document.getElementById("chartTopProducts").getContext("2d");
    chartTopProducts = new Chart(ctx, {
      type: "bar",
      data: {
        labels: topProducts.map(p => p.name.replace(" ", "\n")),
        datasets: [{
          label: "Units Sold",
          data: topProducts.map(p => p.qty),
          backgroundColor: "#3A7CA5",
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { color: "#F3F4F6" } }, y: { ticks: { font: { size: 11 } } } }
      }
    });
  }

  if (logs) {
    const tbody = document.querySelector("#inventoryLogTable tbody");
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--gray-500)">No activity yet</td></tr>`;
    } else {
      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-size:11px;color:var(--gray-500);font-family:var(--font-mono)">${new Date(l.date).toLocaleString("en-PH")}</td>
          <td>${l.product}</td>
          <td><span class="badge ${l.action === "Sale" ? "badge-low" : "badge-ok"}">${l.action}</span></td>
          <td style="font-family:var(--font-mono);color:${l.qty < 0 ? "var(--red)" : "var(--green)"}">${l.qty > 0 ? "+" : ""}${l.qty}</td>
          <td style="font-family:var(--font-mono)">${l.new_stock}</td>
        </tr>`).join("");
    }
  }
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
async function loadCustomers() {
  const customers = await api("/api/customers");
  if (!customers) return;
  const tbody = document.getElementById("customersTableBody");
  tbody.innerHTML = customers.map(c => {
    const tier = c.total_spent >= 5000 ? "Gold" : c.total_spent >= 2000 ? "Silver" : "Bronze";
    const tierClass = tier === "Gold" ? "badge-gold" : tier === "Silver" ? "badge-ok" : "badge-low";
    return `
      <tr>
        <td style="color:var(--gray-500);font-size:12px">#${c.id}</td>
        <td><strong>${c.name}</strong></td>
        <td style="font-family:var(--font-mono);font-size:12px">${c.phone || "—"}</td>
        <td style="font-size:12px;color:var(--gray-500)">${c.email || "—"}</td>
        <td><span class="badge badge-gold">${c.points.toLocaleString()} pts</span></td>
        <td style="font-family:var(--font-mono)">${fmt(c.total_spent)}</td>
        <td><span class="badge ${tierClass}">${tier}</span></td>
      </tr>`;
  }).join("");
}

function openCustomerModal() { openModal("customerModal"); }

async function saveCustomer() {
  const data = {
    name: document.getElementById("custName").value.trim(),
    phone: document.getElementById("custPhone").value.trim(),
    email: document.getElementById("custEmail").value.trim(),
  };
  if (!data.name) { showToast("Name is required", "warning"); return; }
  const result = await api("/api/customers", { method: "POST", body: data });
  if (result && result.success) {
    showToast("Customer added!", "success");
    closeModal("customerModal");
    loadCustomers();
    // Refresh POS customer list
    const customers = await api("/api/customers");
    if (customers) {
      allCustomers = customers;
      const sel = document.getElementById("cartCustomer");
      if (sel) sel.innerHTML = customers.map(c =>
        `<option value="${c.id}">${c.name}${c.points ? ` (${c.points} pts)` : ""}</option>`
      ).join("");
    }
  }
}

// ─── REPORTS ─────────────────────────────────────────────────────────────────
async function loadReports() {
  const transactions = await api("/api/transactions?limit=50");
  if (!transactions) return;
  const tbody = document.getElementById("reportsTableBody");
  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray-500)">No transactions yet. Complete a sale in the POS terminal.</td></tr>`;
    return;
  }
  tbody.innerHTML = transactions.map(tx => `
    <tr>
      <td style="font-family:var(--font-mono);font-weight:700;color:var(--blue-700)">#${tx.id}</td>
      <td style="font-size:11px;color:var(--gray-500)">${new Date(tx.date).toLocaleString("en-PH")}</td>
      <td>${tx.customer_name}</td>
      <td>${tx.items.length} item(s)</td>
      <td style="font-family:var(--font-mono)">${fmt(tx.subtotal)}</td>
      <td style="font-family:var(--font-mono);color:var(--gray-500)">${fmt(tx.tax)}</td>
      <td style="font-family:var(--font-mono);font-weight:700">${fmt(tx.grand_total)}</td>
      <td><span class="badge badge-ok">${tx.payment}</span></td>
    </tr>`).join("");
}

// ─── Charts Helpers ──────────────────────────────────────────────────────────
function renderLineChart(canvasId, labels, data, label) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: "#3A7CA5",
        backgroundColor: "rgba(58,124,165,.08)",
        tension: .35,
        fill: true,
        pointRadius: 3,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 45 } },
        y: { grid: { color: "#F3F4F6" }, ticks: { callback: v => "₱" + v.toLocaleString(), font: { size: 10 } } }
      }
    }
  });
}

function renderDoughnut(canvasId, labels, data) {
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();
  const ctx = document.getElementById(canvasId).getContext("2d");
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ["#3A7CA5","#D4A843","#2E7D50","#C0392B","#7B2FBE","#E67E22","#1ABC9C"],
        borderWidth: 2,
        borderColor: "#fff",
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ₱${ctx.raw.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
          }
        }
      }
    }
  });
}

// ─── Notifications ───────────────────────────────────────────────────────────
async function showNotifications() {
  const lowStock = await api("/api/analytics/low-stock");
  if (!lowStock || lowStock.length === 0) {
    showToast("All stock levels are healthy!", "success");
    return;
  }
  const msg = `⚠️ ${lowStock.length} item(s) need restocking: ${lowStock.slice(0, 3).map(p => p.name).join(", ")}${lowStock.length > 3 ? "…" : ""}`;
  showToast(msg, "warning");
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }

// Close on overlay click
document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ"}</span><span>${message}</span>`;
  document.getElementById("toastContainer").appendChild(toast);
  setTimeout(() => toast.style.opacity = "0", 3200);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Number Format ───────────────────────────────────────────────────────────
function fmt(n) {
  return "₱" + parseFloat(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
