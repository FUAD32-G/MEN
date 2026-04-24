const BASE_URL = "https://menesah-api.onrender.com";

let token = "";
let role = "";
let currentPage = "dashboard";

/* ================= LOGIN ================= */
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.token) {
    token = data.token;
    role = data.role;
    showDashboard();
  } else {
    alert("Login failed");
  }
}

/* ================= DASHBOARD ================= */
function showDashboard() {
  currentPage = "dashboard";

  if (role === "owner") return ownerDashboard();
  if (role === "receptionist") return receptionistDashboard();
  if (role === "partner") return partnerDashboard();
}

/* OWNER */
async function ownerDashboard() {
  const res = await fetch(`${BASE_URL}/api/applications/stats`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  document.getElementById("content").innerHTML = `
    <div class="card">
      <h2>Dashboard</h2>
      <canvas id="chart"></canvas>
      <button onclick="downloadReport()">Download Report</button>
    </div>
    <div id="notifications"></div>
  `;

  new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels: ["Applied","Approved","Medical","Selected"],
      datasets: [{
        label: "Applicants",
        data: [
          data.applied,
          data.approved,
          data.medical,
          data.selected
        ]
      }]
    }
  });

  loadNotifications();
}

/* RECEPTION */
function receptionistDashboard() {
  document.getElementById("content").innerHTML = `
    <h2>Reception Dashboard</h2>
    <button onclick="loadCandidates()">Candidates</button>
    <button onclick="loadApplications()">Applicants</button>
  `;
}

/* PARTNER */
function partnerDashboard() {
  document.getElementById("content").innerHTML = `
    <h2>Partner Dashboard</h2>
    <button onclick="loadApplications()">View Applicants</button>
  `;
}

/* ================= CANDIDATES ================= */
async function loadCandidates() {
  currentPage = "candidates";

  const res = await fetch(`${BASE_URL}/api/candidates`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  let html = `<div class="card"><h2>Candidates</h2>`;

  if (role === "receptionist") {
    html += `<button onclick="showCreateCandidate()">+ Add Candidate</button>`;
  }

  data.forEach(c => {
    html += `
      <p>
        ${c.full_name} - ${c.passport_number || ""}
        ${
          role === "receptionist"
            ? `<button onclick="approveCandidate(${c.id})">Approve</button>`
            : ""
        }
      </p>
    `;
  });

  html += `</div>`;

  document.getElementById("content").innerHTML = html;
}

function showCreateCandidate() {
  document.getElementById("content").innerHTML = `
    <h3>Create Candidate</h3>
    <input id="name" placeholder="Full Name"><br>
    <input id="passport" placeholder="Passport"><br>
    <input id="age" placeholder="Age"><br>
    <button onclick="createCandidate()">Create</button>
  `;
}

async function createCandidate() {
  await fetch(`${BASE_URL}/api/candidates`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      full_name: document.getElementById("name").value,
      passport_number: document.getElementById("passport").value,
      age: document.getElementById("age").value
    })
  });

  loadCandidates();
}

async function approveCandidate(id) {
  await fetch(`${BASE_URL}/api/candidates/approve/${id}`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });

  loadCandidates();
}

/* ================= APPLICATIONS ================= */
async function loadApplications() {
  currentPage = "applications";

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  let data = await res.json();

  let html = `
    <input id="search" placeholder="Search..." onkeyup="loadApplications()">
    <select id="statusFilter" onchange="loadApplications()">
      <option value="">All</option>
      <option>Applied</option>
      <option>Approved</option>
      <option>Medical</option>
      <option>Selected</option>
      <option>TicketReady</option>
    </select>
  `;

  const search = document.getElementById("search")?.value?.toLowerCase() || "";
  const status = document.getElementById("statusFilter")?.value || "";

  data = data.filter(a =>
    a.full_name.toLowerCase().includes(search) &&
    (status === "" || a.status === status)
  );

  html += `<div class="card"><h2>Applicants</h2>`;

  data.forEach(a => {
    html += `
      <div>
        <b>${a.full_name}</b> - ${a.status}
        <button onclick="markTicket(${a.id})">Ticket Ready</button>
      </div>
    `;
  });

  html += `</div>`;

  document.getElementById("content").innerHTML = html;
}

/* ================= TICKET READY ================= */
async function markTicket(id) {
  await fetch(`${BASE_URL}/api/applications/ticket/${id}`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + token }
  });

  loadApplications();
}

/* ================= NOTIFICATIONS ================= */
async function loadNotifications() {
  const res = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  let html = "<div class='card'><h3>Notifications</h3>";

  data.forEach(n => {
    html += `<p>${n.message}</p>`;
  });

  html += "</div>";

  document.getElementById("notifications").innerHTML = html;
}

/* ================= REPORT ================= */
function downloadReport() {
  window.open(`${BASE_URL}/api/reports/applications`);
}

/* ================= AUTO REFRESH ================= */
setInterval(() => {
  if (currentPage === "dashboard") showDashboard();
  if (currentPage === "applications") loadApplications();
  if (currentPage === "candidates") loadCandidates();
}, 5000);