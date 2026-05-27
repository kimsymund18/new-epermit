/* =========================================
   SUPER ADMIN DASHBOARD JS (FIXED VERSION)
========================================= */

let allApplications = [];
let allUsers = [];
let selectedApplicationId = null;

/* =========================================
   INIT
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();
    loadAdminInfo();

    // TEMPORARILY DISABLED
    // loadApplications();

    // TEMPORARILY DISABLED
    // setInterval(() => {
    //     loadApplications();
    // }, 10000);

    const savedSection =
        sessionStorage.getItem("superadminSection") || "users";

    setSection(savedSection);

    document.getElementById("userSearchInput")?.addEventListener("input", filterUsers);
    document.getElementById("userRoleFilter")?.addEventListener("change", filterUsers);
    document.getElementById("userStatusFilter")?.addEventListener("change", filterUsers);
});

/* =========================================
   ADMIN INFO
========================================= */

function loadAdminInfo() {

    const savedUser = localStorage.getItem("user");
    if (!savedUser) return;

    const user = JSON.parse(savedUser);

    document.getElementById("userName").textContent =
        `${user.first_name || ""} ${user.last_name || ""}`;

    document.getElementById("userRole").textContent =
        user.role || "Super Admin";
}

/* =========================================
   SIDEBAR
========================================= */

function setupSidebar() {

    document.getElementById("btnDashboard")?.addEventListener("click", () => {
        setSection("dashboard");
    });

    document.getElementById("btnUsers")?.addEventListener("click", () => {
        setSection("users");
    });

    document.getElementById("btnFiles")?.addEventListener("click", () => {
        setSection("files");
    });

    document.getElementById("btnLogs")?.addEventListener("click", () => {
        setSection("logs");
    });
}

/* =========================================
   SECTION SWITCH
========================================= */

function setSection(section) {

    sessionStorage.setItem("superadminSection", section);

    const sections = {
        dashboard: document.getElementById("dashboardSection"),
        users: document.getElementById("usersSection"),
        files: document.getElementById("filesSection"),
        logs: document.getElementById("logsSection")
    };

    const buttons = {
        dashboard: document.getElementById("btnDashboard"),
        users: document.getElementById("btnUsers"),
        files: document.getElementById("btnFiles"),
        logs: document.getElementById("btnLogs")
    };

    Object.values(sections).forEach(sec => sec && (sec.style.display = "none"));
    Object.values(buttons).forEach(btn => btn && btn.classList.remove("active"));

    if (sections[section]) {
        sections[section].style.display = "block";
    }

    if (buttons[section]) {
        buttons[section].classList.add("active");
    }

    // 👇 IMPORTANT: load users when users tab opens
    if (section === "users") {
        loadUsers();
    }
}

/* =========================================
   DROPDOWN
========================================= */

function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById("dropdownMenu")?.classList.toggle("show");
}

document.addEventListener("click", (event) => {
    const dropdown = document.getElementById("dropdownMenu");
    const btn = document.querySelector(".role-btn");

    if (dropdown && !dropdown.contains(event.target) && !btn.contains(event.target)) {
        dropdown.classList.remove("show");
    }
});

/* =========================================
   LOGOUT
========================================= */

function logout() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "index.html";
}

/* =========================================
   APPLICATIONS (DASHBOARD)
========================================= */

async function loadApplications() {

    try {

        const response = await fetch(
            "http://localhost:5000/api/permits/all-permits",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        allApplications = result.applications || [];

        updateDashboardStats(allApplications);
        renderRecentActivity(allApplications);

    } catch (err) {
        console.error("Load applications error:", err);
    }
}

/* =========================================
   DASHBOARD STATS
========================================= */

function updateDashboardStats(applications) {

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set("totalApplications", applications.length);

    set("pendingApplications",
        applications.filter(a => a.status === "Pending").length
    );

    set("approvedApplications",
        applications.filter(a => a.status === "Approved").length
    );

    set("rejectedApplications",
        applications.filter(a => a.status === "Rejected").length
    );
}

/* =========================================
   RECENT ACTIVITY
========================================= */

function renderRecentActivity(applications) {

    const container = document.getElementById("activityLog");
    if (!container) return;

    container.innerHTML = "";

    const latest = [...applications]
        .sort((a, b) =>
            new Date(b.submitted_at) - new Date(a.submitted_at)
        )
        .slice(0, 5);

    latest.forEach(app => {

        const div = document.createElement("div");
        div.className = "activity-item";

        div.innerHTML = `
            <div class="activity-icon">📄</div>
            <div class="activity-content">
                <h4>${app.owner_name}</h4>
                <p>${app.permit_type}</p>
                <span class="activity-time">
                    ${new Date(app.submitted_at).toLocaleString()}
                </span>
            </div>
        `;

        container.appendChild(div);
    });
}

/* =========================================
   CREATE STAFF
========================================= */

document.addEventListener("submit", async (e) => {

    if (e.target.id !== "createStaffForm") return;

    e.preventDefault();

    const payload = {
        first_name: document.getElementById("first_name").value,
        middle_name: document.getElementById("middle_name").value,
        last_name: document.getElementById("last_name").value,
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
        role: document.getElementById("role").value,
        contact_number: document.getElementById("contact_number").value,
        department: document.getElementById("department").value
    };

    try {

        const res = await fetch(
            "http://localhost:5000/api/users/create-staff",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify(payload)
            }
        );

        const data = await res.json();

        if (data.success) {
            alert("Staff created successfully");
            e.target.reset();
            loadUsers();
        } else {
            alert(data.message || "Failed to create staff");
        }

    } catch (err) {
        console.error(err);
        alert("Server error");
    }
});

/* =========================================
   LOAD USERS
========================================= */

async function loadUsers() {

    try {

        const res = await fetch(
            "http://localhost:5000/api/users/all-users",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
        }

        const result = await res.json();

        if (!result.success) return;

        allUsers = result.users || [];

        renderUsersTable(allUsers);

        const count = document.getElementById("usersCount");
        if (count) count.textContent = `${allUsers.length} Users`;

    } catch (err) {
        console.error("Load users error:", err);
    }
}

function filterUsers() {

    let filtered = [...allUsers];

    const search = document.getElementById("userSearchInput")?.value.toLowerCase() || "";
    const role = document.getElementById("userRoleFilter")?.value || "";
    const status = document.getElementById("userStatusFilter")?.value || "";

    // SEARCH
    if (search) {
        filtered = filtered.filter(u => {
            const fullName = `${u.first_name || ""} ${u.middle_name || ""} ${u.last_name || ""}`.toLowerCase();
            return (
                fullName.includes(search) ||
                (u.email || "").toLowerCase().includes(search)
            );
        });
    }

    // ROLE FILTER
    if (role) {
        filtered = filtered.filter(u => u.role === role);
    }

    // STATUS FILTER
    if (status) {
        filtered = filtered.filter(u => (u.status || "Active") === status);
    }

    renderUsersTable(filtered);
}

/* =========================================
   RENDER USERS TABLE
========================================= */

function renderUsersTable(users) {

    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    tbody.innerHTML = "";

    users.forEach(user => {

        const fullName = [
            user.first_name,
            user.middle_name,
            user.last_name
        ].filter(Boolean).join(" ");

        const row = document.createElement("tr");

        const status = user.status || "Active";

        row.innerHTML = `
            <td>${fullName || "No Profile"}</td>
            <td>${user.email}</td>
            <td>${user.department || "N/A"}</td>
            <td>${user.role}</td>
            <td>
                <span class="status-badge ${status.toLowerCase()}">
                    ${status}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleString()}</td>
            <td>
                <button
                    class="secondary-btn"
                    onclick="openUserModal(${user.user_id})"
                >
                    View
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

/* =========================================
   USER MODAL
========================================= */

function openUserModal(userId) {

    const user = allUsers.find(u => u.user_id === userId);

    if (!user) {
        console.error("User not found:", userId);
        return;
    }

    const fullName = [user.first_name, user.middle_name, user.last_name]
        .filter(Boolean)
        .join(" ");

    const fullNameEl = document.getElementById("modalFullName");
    const emailEl = document.getElementById("modalEmail");
    const roleEl = document.getElementById("modalRole");
    const statusEl = document.getElementById("modalStatus");

    if (!fullNameEl || !emailEl || !roleEl || !statusEl) {
        console.error("Modal elements not found in DOM");
        return;
    }

    fullNameEl.textContent = fullName || "N/A";
    emailEl.textContent = user.email;
    roleEl.textContent = user.role;

    const isActive = (user.status || "Active") === "Active";

    statusEl.textContent = isActive ? "Active" : "Inactive";
    statusEl.className = isActive
        ? "user-status active"
        : "user-status inactive";

    const toggleBtn = document.getElementById("toggleUserBtn");
    if (toggleBtn) {
        toggleBtn.textContent = isActive
            ? "Deactivate User"
            : "Activate User";
    }

    document.getElementById("userModal")?.classList.add("show");
}

function closeUserModal() {

    document
        .getElementById("userModal")
        .classList.remove("show");
}

function closeUserModal() {

    document.getElementById(
        "userModal"
    ).style.display = "none";
}

/* =========================================
   UPDATE USER STATUS
========================================= */

async function updateUserStatus(userId, status) {

    const confirmAction =
        confirm(
            `Are you sure you want to ${status === "Active"
                ? "activate"
                : "deactivate"} this user?`
        );

    if (!confirmAction) return;

    try {

        const res = await fetch(
            `http://localhost:5000/api/users/update-status/${userId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ status })
            }
        );

        const data = await res.json();

        if (data.success) {

            alert(data.message);

            closeUserModal();

            loadUsers();

        } else {

            alert(
                data.message ||
                "Failed to update status"
            );
        }

    } catch (err) {

        console.error(err);

        alert("Server error");
    }
}