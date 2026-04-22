// ================= GLOBAL STATE =================
let token = "";
let role = "";
let currentId = null;
const BASE_URL = "https://menesah-api.onrender.com";
fetch(`${BASE_URL}/api/auth/login`)
fetch(`${BASE_URL}/api/applications`)

// ================= LOGIN =================
async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      email: document.getElementById("email").value,
      password: document.getElementById("password").value
    })
  });

  const data = await res.json();

if (!data.token) return alert("Login failed");
  token = data.token;
  role = data.role;

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.getElementById("userRole").innerText = role;

  // ROLE ROUTING
  if (role === "candidate") return loadCandidatePortal();
  if (role === "partner") return loadPartnerDashboard();

  showDashboard();
}

// ================= LOGOUT =================
function logout() {
  location.reload();
}

// ================= UI CONTROL =================
function hideAll() {
  ["dashboard","applicantList","candidates","profile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

// ================= DASHBOARD =================
async function showDashboard() {
  hideAll();

  const dashboard = document.getElementById("dashboard");
  dashboard.classList.remove("hidden");

  // RESET CONTENT (IMPORTANT)
  dashboard.innerHTML = `
    <div class="card">
      <h3>Total Applications</h3>
      <div id="stats"></div>
    </div>

    <div class="card">
      <h3>Monthly Applications</h3>
      <canvas id="chart"></canvas>
    </div>
  `;

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  document.getElementById("stats").innerHTML =
    `<h2>${data.length}</h2>`;

  renderChart(data);
}

// ================= CHART =================
function renderChart(data) {
  const months = {};

  data.forEach(a => {
    if (!a.updated_at) return;
    const m = new Date(a.updated_at).toLocaleString("default", { month: "short" });
    months[m] = (months[m] || 0) + 1;
  });

  const ctx = document.getElementById("chart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(months),
      datasets: [{
        label: "Applications",
        data: Object.values(months)
      }]
    }
  });
}

// ================= APPLICANT LIST =================
async function showApplicantList() {
  hideAll();
  document.getElementById("applicantList").classList.remove("hidden");

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  let rows = "";

  data.forEach(app => {

    let actionBtn = "";

    // ROLE-BASED PROCESS BUTTON
    if (role === "receptionist" && app.status === "Applied") {
      actionBtn = `<button onclick="processApp(${app.id})">Approve</button>`;
    }
    else if (role === "it" && app.status === "Approved") {
      actionBtn = `<button onclick="processApp(${app.id})">Send to Medical</button>`;
    }
    else if (role === "partner" && app.status === "Medical") {
      actionBtn = `<button onclick="processApp(${app.id})">Select</button>`;
    }
    else if (role === "owner" && app.status === "Selected") {
      actionBtn = `<button onclick="processApp(${app.id})">Complete</button>`;
    }

    rows += `
      <tr>
        <td>${app.id}</td>
        <td>${app.full_name}</td>
        <td>${app.passport_number || "-"}</td>
        <td>${app.age || "-"}</td>
        <td>${app.status}</td>
        <td>
          ${actionBtn}
          <button onclick="viewDetails(${app.id})">View</button>
        </td>
      </tr>
    `;
  });

  document.getElementById("tableBody").innerHTML = rows;
}

// ================= UNDER PROCESS =================
async function loadUnderProcess() {
  hideAll();
  document.getElementById("dashboard").classList.remove("hidden");

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  let filtered = [];

  if (role === "receptionist") {
    filtered = data.filter(a => a.status === "Applied");
  } else if (role === "it") {
    filtered = data.filter(a => a.status === "Approved");
  } else if (role === "partner") {
    filtered = data.filter(a => a.status === "Medical");
  }

  let html = "<h2>Under Process</h2>";

  filtered.forEach(a => {
    html += `
      <div class="card">
        ${a.full_name} (${a.status})
        <button onclick="processApp(${a.id})">Continue</button>
      </div>
    `;
  });

  document.getElementById("dashboard").innerHTML = html;
}

// ================= PROCESS =================
async function processApp(id) {
  let next = "";

  if (role === "receptionist") next = "Approved";
  else if (role === "it") next = "Medical";
  else if (role === "partner") next = "Selected";
  else if (role === "owner") next = "Completed";
  else return alert("Not allowed");

  await fetch(`${BASE_URL}/api/applications/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ status: next })
  });

  alert("Updated");

  // refresh correct view
  if (role === "partner") loadPartnerDashboard();
  else showApplicantList();
}

// ================= PROFILE =================
async function viewDetails(id) {
  currentId = id;

  hideAll();
  document.getElementById("profile").classList.remove("hidden");

  const res = await fetch(`${BASE_URL}/api/applications/${id}`, {
    headers: { Authorization: "Bearer " + token }
  });

  const app = await res.json();

  document.getElementById("profileName").innerText = app.full_name;
  document.getElementById("profileInfo").innerHTML = `
    Passport: ${app.passport_number || "-"}<br>
    Age: ${app.age || "-"}<br>
    Status: ${app.status}
  `;

  loadTimeline(id);
  loadFiles(id);
}

// ================= TIMELINE =================
async function loadTimeline(id) {
  const res = await fetch(
    `${BASE_URL}/api/applications/timeline/${id}`,
    { headers: { Authorization: "Bearer " + token } }
  );

  const data = await res.json();

  let html = "";

  data.forEach(t => {
    html += `
      <div style="border-left:3px solid #1abc9c;padding-left:10px;margin:5px;">
        ${t.action}<br>
        <small>${new Date(t.created_at).toLocaleString()}</small>
      </div>
    `;
  });

  document.getElementById("timeline").innerHTML = html;
}

// ================= FILE UPLOAD =================
async function uploadFile() {
  const file = document.getElementById("file").files[0];
  if (!file) return alert("Select file");

  const formData = new FormData();
  formData.append("file", file);

  await fetch(`${BASE_URL}/api/applications/upload/${currentId}`, {
    method: "POST",
    body: formData
  });

  loadFiles(currentId);
}

// ================= FILES =================
async function loadFiles(id) {
  const res = await fetch(
    `${BASE_URL}/api/applications/files/${id}`,
    { headers: { Authorization: "Bearer " + token } }
  );

  const data = await res.json();

  let html = "";

  data.forEach(f => {
    html += `
      <a href="${BASE_URL}/uploads/${f.filepath}" target="_blank">
        ${f.filename}
      </a><br>
    `;
  });

  document.getElementById("files").innerHTML = html;
}

// ================= CANDIDATES =================
function showCandidates() {
  hideAll();
  document.getElementById("candidates").classList.remove("hidden");

  const btn = document.getElementById("addCandidateBtn");

  if (role === "receptionist") {
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
}

function showCandidateForm() {
  document.getElementById("candidateForm").classList.toggle("hidden");
}

// ================= CREATE CANDIDATE =================
async function createCandidate() {
  const name = document.getElementById("c_name").value;
  const passport = document.getElementById("c_passport").value;

  const res = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      full_name: name,
      passport_number: passport,
      created_by: "receptionist"
    })
  });

  const data = await res.json();

  const id = data.id;

  const formData = new FormData();
  formData.append("file", document.getElementById("passport_file").files[0]);

  await fetch(`${BASE_URL}/api/applications/upload/${id}`, {
    method: "POST",
    body: formData
  });

  alert("Candidate created");
}

// ================= SELECTED =================
async function showSelected() {
  hideAll();
  document.getElementById("dashboard").classList.remove("hidden");

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  const selected = data.filter(a => a.status === "Selected");

  let html = "<h2>Selected Candidates</h2>";

  selected.forEach(a => {
    html += `<p>${a.full_name}</p>`;
  });

  document.getElementById("dashboard").innerHTML = html;
}

// ================= PARTNER =================
async function loadPartnerDashboard() {
  hideAll();
  document.getElementById("dashboard").classList.remove("hidden");

  const res = await fetch(`${BASE_URL}/api/applications`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  // ONLY SHOW READY FOR PARTNER
  const ready = data.filter(a => a.status === "Medical");

  let html = "<h2>Partner Dashboard</h2>";

  if (ready.length === 0) {
    html += "<p>No candidates ready yet</p>";
  }

  ready.forEach(a => {
    html += `
      <div class="card">
        <b>${a.full_name}</b><br>
        Status: ${a.status}<br>
        <button onclick="processApp(${a.id})">Select</button>
      </div>
    `;
  });

  document.getElementById("dashboard").innerHTML = html;
}

// ================= CANDIDATE PORTAL =================
function loadCandidatePortal() {
  document.getElementById("dashboard").innerHTML = `
    <h2>Candidate Portal</h2>
    <p>Your application is under review.</p>
  `;
}

// ================= SIDEBAR =================
function toggleMenu() {
  const sidebar = document.getElementById("sidebar");

  sidebar.style.width =
    sidebar.style.width === "60px" ? "200px" : "60px";
}
