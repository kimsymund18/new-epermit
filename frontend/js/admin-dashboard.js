let allPermits = [];
let allAdminHistory = [];

let currentPermitId = null;

let currentPermitData = null;
let currentDocuments = [];

let pendingDocumentChanges = {};

let pendingPaymentChange = null;

let currentPaymentData = null;

function makeKey(text) {

    return text
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();

    setSection("dashboard");

    setupFilters();

    loadApplications();

    loadRecentResubmissions();

    renderRequirementsSection();

    loadAdminProfile();

    loadAdminApplicationHistory();

    document.addEventListener("click", () => {

        document
            .getElementById("dropdownMenu")
            .classList.remove("show");

    });

    document.getElementById("adminHistorySearch")
        .addEventListener("input", applyAdminHistoryFilters);
    document.getElementById("adminHistoryResultFilter")
        .addEventListener("change", applyAdminHistoryFilters);
    document.getElementById("adminHistoryPermitFilter")
        .addEventListener("change", applyAdminHistoryFilters);
});

// SIDEBAR
function setupSidebar() {

    document.getElementById("btnDashboard")
        .addEventListener("click", () => {
            setSection("dashboard");
        });

    document.getElementById("btnApplications")
        .addEventListener("click", () => {
            setSection("applications");
        });

    document.getElementById("btnRequirements")
        .addEventListener("click", () => {
            setSection("requirements");
        });

    document.getElementById("btnHistory")
        .addEventListener("click", () => {
            setSection("history");
            loadAdminApplicationHistory();
        });

}

// SECTION SWITCH
function setSection(section) {

    const sections = {
        dashboard: document.getElementById("dashboardSection"),
        applications: document.getElementById("applicationsSection"),
        requirements: document.getElementById("requirementsSection"),
        history: document.getElementById("historySection")
    };

    const buttons = {
        dashboard: document.getElementById("btnDashboard"),
        applications: document.getElementById("btnApplications"),
        requirements: document.getElementById("btnRequirements"),
        history: document.getElementById("btnHistory")
    };

    // HIDE
    Object.values(sections).forEach(sec => {
        sec.style.display = "none";
    });

    // REMOVE ACTIVE
    Object.values(buttons).forEach(btn => {
        btn.classList.remove("active");
    });

    // SHOW TARGET
    sections[section].style.display = "block";

    // ACTIVE BUTTON
    buttons[section].classList.add("active");
}

// DROPDOWN
function toggleDropdown(event) {

    event.stopPropagation();

    document
        .getElementById("dropdownMenu")
        .classList.toggle("show");
}

// LOGOUT
function logout() {

    localStorage.clear();

    window.location.href = "index.html";
}

async function loadAdminProfile() {

    try {

        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/users/me",
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        const user = result.user;

        // BUILD FULL NAME
        const fullName = `
            ${user.first_name || ""}
            ${user.middle_name || ""}
            ${user.last_name || ""}
        `.replace(/\s+/g, " ").trim();

        // DISPLAY NAME
        document.getElementById(
            "adminName"
        ).textContent =
            fullName || user.email;

        // DISPLAY ROLE + DEPARTMENT
        const departmentLabels = {

            OBO: "OBO Department",

            FIRE_SAFETY: "Fire Safety Department",

            ZONING: "Zoning Department"

        };

        document.getElementById(
            "adminDepartment"
        ).textContent =

            departmentLabels[user.department]

            || user.department

            || "No Department";

        document.getElementById(
            "adminRole"
        ).textContent =
            user.role || "Admin";

    } catch (error) {

        console.error(error);
    }
}

async function loadApplications() {

    try {

        document.getElementById("applicationsTable").innerHTML = `
            <tr>
                <td colspan="7">
                    Loading applications...
                </td>
            </tr>
        `;

        const token = localStorage.getItem("token");

        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/permits/all-permits",
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        console.log(result);

        if (!response.ok) {
            alert(result.message);
            return;
        }

        allPermits = result.permits;

        // TABLE
        renderApplications(allPermits);

        // STATS
        updateDashboardStats(allPermits);

        loadRecentActivities();
        loadRecentResubmissions();
        
    } catch (error) {

        console.error(error);

    }
}

async function loadRecentActivities() {
    try {

        const token = localStorage.getItem("token");

        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/permits/activities/recent",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        renderRecentActivities(result.activities);

    } catch (error) {
        console.error(error);
    }
}

function renderApplications(permits) {

    const hiddenStatuses = [
        "For Inspection",
        "For Visitation",
        "For Reinspection"
    ];

    permits = permits.filter(
        p => !hiddenStatuses.includes(p.status)
    );

    const table =
        document.getElementById("applicationsTable");

    const resultsCount =
        document.getElementById("resultsCount");

    table.innerHTML = "";

    resultsCount.textContent =
        `${permits.length} Applications`;

    if (permits.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        📂 No applications found
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    permits.forEach(permit => {

        const tr = document.createElement("tr");

        tr.style.cursor = "pointer";

        tr.onclick = () => {
            if (
                permit.status === "For Inspection" ||
                permit.status === "For Visitation"
            ) {
                openInspectionModal(permit.permit_id);

            } else if (
                permit.status === "For Payment" ||
                permit.status === "For Payment Verification"
            ) {
                openPaymentModal(permit.permit_id);

            } else {
                openAdminPermitModal(permit.permit_id);
            }
        };

        tr.innerHTML = `
            <td>${permit.control_number}</td>
            <td>${permit.owner_name || permit.email}</td>
            <td>${permit.permit_type}</td>
            <td>${permit.project_title}</td>
            <td>${formatDate(permit.submitted_at)}</td>
            <td>
                <span class="status ${formatStatusClass(permit.status)}">
                    ${formatStatusText(permit.status)}
                </span>
            </td>
        `;

        table.appendChild(tr);
    });
}

function renderRecentActivities(activities) {

    const container = document.getElementById("recentApplications");
    if (!container) return;

    container.innerHTML = "";

    const excludedInspectionEvents = [
        "inspection_scheduled",
        "inspection_started",
        "inspection_completed",
        "reinspection_required"
    ];

    const filtered = activities.filter(a => {
        if (a.activity_type === "inspection") {
            return !excludedInspectionEvents.includes(a.event_type);
        }
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        const diff = new Date(b.created_at) - new Date(a.created_at);
        if (diff === 0) return (b.activity_id || 0) - (a.activity_id || 0);
        return diff;
    });

    sorted.slice(0, 10).forEach(a => {

        let icon = "🔄";
        let className = "review";

        // PAYMENT
        if (a.activity_type === "payment") {

            if (a.new_status === "Verified") {
                icon = "✅";
                className = "approved";
            } 
            else if (a.new_status === "Resubmission") {
                icon = "🔁";
                className = "inspection";
            }
            else if (a.new_status === "For Payment Verification") {
                icon = "💳";
                className = "review";
            }
        }

        // PERMIT STATUS
        else if (a.activity_type === "permit_status") {
            icon = "📄";
            className = "pending";
        }

        // DOCUMENT
        else if (a.activity_type === "document_review") {
            icon = "📁";
            className = "review";
        }

        const div = document.createElement("div");
        div.className = "activity-item";

        div.innerHTML = `
            <div class="activity-icon ${className}">
                ${icon}
            </div>

            <div class="activity-content">
                <h4>${a.title || "Activity"}</h4>
                <p>${a.message || ""}</p>
                <small>${new Date(a.created_at).toLocaleString("en-PH")}</small>
            </div>
        `;

        container.appendChild(div);
    });
}

function formatStatusText(status) {
    const map = {
        "For Payment Verification": "Payment Verification"
    };

    return map[status] || status;
}

function formatDate(dateString) {

    const date = new Date(dateString);

    return date.toLocaleDateString("en-PH", {

        year: "numeric",
        month: "short",
        day: "numeric"

    });
}

function formatStatusClass(status) {

    return status.replace(/\s/g, "");
}

function buildProgressTracker(currentStatus) {

    const steps = [
        "Pending",
        "Under Review",
        "For Inspection",
        "For Payment",
        "Approved"
    ];

    const currentIndex = steps.indexOf(currentStatus);

    return `
        <div class="tracker-wrapper">

            ${steps.map((step, index) => {

                const completed = index < currentIndex;
                const active = index === currentIndex;

                return `
                    <div class="tracker-item">

                        <div class="
                            tracker-circle
                            ${completed ? "completed" : ""}
                            ${active ? "active" : ""}
                        ">
                            ${completed ? "✓" : index + 1}
                        </div>

                        <div class="tracker-label">
                            ${step}
                        </div>

                    </div>

                    ${index < steps.length - 1
                        ? `<div class="tracker-line ${
                            index < currentIndex
                                ? "line-complete"
                                : ""
                        }"></div>`
                        : ""
                    }
                `;

            }).join("")}

        </div>
    `;
}

function updateDashboardStats(permits) {

    document.getElementById(
        "totalApplications"
    ).textContent = permits.length;

    document.getElementById(
        "pendingApplications"
    ).textContent =
        permits.filter(p => p.status === "Pending").length;

    document.getElementById(
        "underReviewApplications"
    ).textContent =
        permits.filter(p => p.status === "Under Review").length;

    document.getElementById(
        "approvedApplications"
    ).textContent =
        permits.filter(p => p.status === "Approved").length;

    document.getElementById(
        "rejectedApplications"
    ).textContent =
        permits.filter(p => p.status === "Rejected").length;
}

// REQUIREMENTS DATA
const permitRequirements = {

    "Zoning Clearance": [
        "Lot plan with vicinity map certified by Geodetic Engineer",
        "Certified true copy of TCT (land title)",
        "Photocopy of Tax Declaration (land/building)",
        "Photocopy of Real Property Tax Receipts",
        "Barangay Construction Permit/Clearance",
        "Architectural Plan / Site Development Plan (1 set)"
    ],

    "Fire Safety Evaluation Clearance": [
        "Architectural Plan (3 sets)",
        "Structural Plan (3 sets)",
        "Plumbing Plan (3 sets)",
        "Electrical Plan (3 sets)",
        "Mechanical Plan (if applicable)",
        "Electronic Plan (if applicable)",
        "Fire Protection Plan (if applicable)",
        "Detailed Bill of Materials with Labor Cost signed and sealed",
        "PTR/PRC Originally signed and sealed"
    ],

    "Building Permit": {

        regular: [
            "Locational Clearance (Zoning Admin Office)",
            "Fire Safety Evaluation Clearance (BFP)",
            "Certified True Copy of Transfer Certificate of Title (TCT)",
            "Tax Declaration & Tax Receipt (Current Year) - Land & Building",
            "Location Plan (signed & sealed by Geodetic Engineer)",
            "4 Sets Building Plans (Blue Print)",
            "Contract of Lease (if applicant is not the registered owner)",
            "Barangay Clearance",
            "Construction Safety Health Program (DOLE)",
            "Soil Test Result (3-storey building & higher)"
        ],

        nha: [
            "Notice of Award",
            "Technical Description of Lot",
            "Pahintulot sa Pagpapatayo"
        ]
    }
};

function renderRequirementsSection() {

    const container =
        document.getElementById("requirementsContainer");

    if (!container) return;

    container.innerHTML = "";

    Object.entries(permitRequirements).forEach(([permitType, requirements]) => {

        const section = document.createElement("div");

        section.className = "requirements-group";

        let requirementsHTML = "";

        // BUILDING PERMIT
        if (permitType === "Building Permit") {

            requirementsHTML += `
                <ul class="requirements-list">
                    ${requirements.regular.map(req => `
                        <li>📌 ${req}</li>
                    `).join("")}
                </ul>

                <div class="nha-section">
                    <h4>IF NHA:</h4>

                    <ul class="requirements-list">
                        ${requirements.nha.map(req => `
                            <li>📌 ${req}</li>
                        `).join("")}
                    </ul>
                </div>
            `;

        } else {

            requirementsHTML = `
                <ul class="requirements-list">
                    ${requirements.map(req => `
                        <li>📌 ${req}</li>
                    `).join("")}
                </ul>
            `;
        }

        section.innerHTML = `
            <div class="requirements-card">

                <h3>${permitType}</h3>

                ${requirementsHTML}

            </div>
        `;

        container.appendChild(section);
    });
}

async function loadAdminApplicationHistory() {
    try {
        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/permits/history",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();
        if (!result.success) return;

        allAdminHistory = result.permits || [];

        document.getElementById("adminHistoryTotal").textContent = allAdminHistory.length;
        document.getElementById("adminHistoryApproved").textContent =
            allAdminHistory.filter(p => p.status === "Approved").length;
        document.getElementById("adminHistoryRejected").textContent =
            allAdminHistory.filter(p => p.status === "Rejected").length;

        applyAdminHistoryFilters();

    } catch (error) {
        console.error("Load admin history error:", error);
    }
}

function applyAdminHistoryFilters() {
    let permits = [...allAdminHistory];

    const search = document.getElementById("adminHistorySearch")?.value.toLowerCase() || "";
    const result = document.getElementById("adminHistoryResultFilter")?.value || "";
    const permitType = document.getElementById("adminHistoryPermitFilter")?.value || "";

    if (search) {
        permits = permits.filter(p =>
            (p.control_number || "").toLowerCase().includes(search) ||
            (p.project_title || "").toLowerCase().includes(search) ||
            (p.owner_name || "").toLowerCase().includes(search)
        );
    }
    if (result) {
        permits = permits.filter(p => p.status === result);
    }
    if (permitType) {
        permits = permits.filter(p => p.permit_type === permitType);
    }

    document.getElementById("adminHistoryCount").textContent =
        `${permits.length} Record${permits.length !== 1 ? "s" : ""}`;

    renderAdminHistoryTable(permits);
}

function renderAdminHistoryTable(permits) {
    const tbody = document.getElementById("adminHistoryTable");
    const empty = document.getElementById("adminHistoryEmpty");

    tbody.innerHTML = "";

    if (!permits.length) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";

    permits.forEach(permit => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.onclick = () => openAdminPermitModal(permit.permit_id);

        const statusClass = permit.status.toLowerCase().replace(/\s+/g, "-");

        tr.innerHTML = `
            <td>${permit.control_number}</td>
            <td>${permit.owner_name || permit.email}</td>
            <td>${permit.permit_type}</td>
            <td>${permit.project_title}</td>
            <td>${formatDate(permit.submitted_at)}</td>
            <td>
                <span class="status ${formatStatusClass(permit.status)}">
                    ${permit.status}
                </span>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

async function openAdminPermitModal(permitId) {

try {

    currentPermitId = permitId;

    const response = await fetch(
        `https://new-epermit-backend.onrender.com/api/permits/${permitId}`,
        {
            headers: {
                Authorization:
                    `Bearer ${localStorage.getItem("token")}`
            }
        }
    );

    const result = await response.json();

    if (!result.success) return;

    const permit = result.permit;
    const documents = result.documents || [];

    currentPermitData = permit;
    currentDocuments = documents;

    // GROUP DOCUMENTS
    const applicationDocs =
        documents.filter(doc =>
            doc.category === "Application"
        );

    const locationDocs =
        documents.filter(doc =>
            doc.category === "Location"
        );

    const requirementDocs =
        documents.filter(doc =>
            doc.category === "Requirement"
        );

    const permitType = permit.permit_type;

    const permitData =
        permitRequirements[permitType];

    let regularRequirements = [];
    let nhaRequirements = [];

    // ZONING / FSEC
    if (Array.isArray(permitData)) {

        regularRequirements = permitData;

    } else {

        // BUILDING PERMIT
        regularRequirements =
            permitData?.regular || [];

        nhaRequirements =
            permitData?.nha || [];
    }

    const orderedRequirementDocs =
        regularRequirements
            .map(req =>
                requirementDocs.find(doc =>
                    makeKey(doc.document_name) === makeKey(req)
                )
            )
            .filter(doc => doc);

    const uploadedNHADocs =
        requirementDocs.filter(doc =>
            nhaRequirements.some(req =>
                makeKey(req) === makeKey(doc.document_name)
            )
        );

    document.getElementById("adminPermitModalBody").innerHTML = `

        <!-- HEADER (gradient, matches applicant) -->
        <div class="modal-header">
            <h2>Application Details</h2>
            <p id="permitModalSubtitle">Application Tracking & Information</p>
            <span class="close" onclick="closeAdminPermitModal()">&times;</span>
        </div>

        <!-- BODY wrapped in review-form -->
        <div class="review-form">

            <!-- PROGRESS -->
            <div class="modal-section">
                <h3>Progress Tracker</h3>
                ${buildApplicantStyleTracker(permit.status)}
            </div>

            <!-- APPLICATION INFO -->
            <div class="modal-section">
                <h3>Application Information</h3>
                <div class="application-info">
                    <div class="form-row two">
                        <div class="field">
                            <label>Control Number</label>
                            <div class="static-value">${permit.control_number}</div>
                        </div>
                        <div class="field">
                            <label>Permit Type</label>
                            <div class="static-value">${permit.permit_type}</div>
                        </div>
                    </div>

                    <div class="form-row two">

                        <div class="field">
                            <label>Applicant Name</label>

                            <div class="static-value">
                                ${permit.owner_name}
                            </div>
                        </div>

                        <div class="field">
                            <label>Contact Number</label>

                            <div class="static-value">
                                ${permit.contact_number}
                            </div>
                        </div>

                    </div>

                    <div class="upload-documents uploaded-documents-section">
                        <div class="field">
                            <label>Application Form</label>
                        </div>
                        ${buildAdminReviewDocuments(applicationDocs)}
                    </div>
                </div>
            </div>

            <!-- PROJECT DETAILS -->
            <div class="modal-section">
                <div class="application-info">
                    <h3>Project Details</h3>
                    <div class="form-row two">
                        <div class="field">
                            <label>Project Title</label>
                            <div class="static-value">${permit.project_title}</div>
                        </div>
                        <div class="field">
                            <label>Estimated Cost</label>
                            <div class="static-value">${permit.estimated_cost}</div>
                        </div>
                    </div>

                    ${
                        permit.applicant_type === "Representative"
                        ? `
                            <div class="form-row two">

                                <div class="field">
                                    <label>Applicant Name</label>

                                    <div class="static-value">
                                        ${permit.first_name} ${permit.middle_name || ""} ${permit.last_name}
                                    </div>
                                </div>

                                <div class="field">
                                    <label>Contact Number</label>

                                    <div class="static-value">
                                        ${permit.applicant_contact_number}
                                    </div>
                                </div>

                            </div>
                        `
                        : `
                            <!-- ROW 4 -->
                            <div class="form-row two">

                                <div class="field">
                                    <label>Owner Name</label>

                                    <div class="static-value">
                                        ${permit.owner_name}
                                    </div>
                                </div>

                                <div class="field">
                                    <label>Contact Number</label>

                                    <div class="static-value">
                                        ${permit.contact_number}
                                    </div>
                                </div>

                            </div>
                        `
                    }

                    <div class="form-row one">
                        <div class="field">
                            <label>Project Location</label>
                            <div class="static-value">${permit.project_location}</div>
                        </div>
                    </div>

                    <div class="field">
                        <label>Locational Map</label>
                    </div>
                    <div class="upload-documents">
                        ${buildAdminReviewDocuments(locationDocs)}
                    </div>
                </div>
            </div>

            <!-- REQUIRED DOCUMENTS -->
            <div class="modal-section">

                <h3>Required Documents</h3>

                <div class="upload-documents">

                    ${buildAdminReviewDocuments(orderedRequirementDocs)}

                </div>

                ${
                    uploadedNHADocs.length
                    ? `
                        <div class="requirement-separator">
                            <br><h3>
                                National Housing Authority Requirements
                            </h3>
                        </div>

                        <div class="upload-documents">

                            ${buildAdminReviewDocuments(uploadedNHADocs)}

                        </div>
                    `
                    : ""
                }

            </div>

            <div id="permitActionContainer">
                ${buildPermitActionButton(permit, documents)}
            </div>

        </div><!-- end .review-form -->
    `;

    setTimeout(() => {

        const select =
            document.getElementById(
                "permitStatusSelect"
            );

        if (select) {
            select.value = permit.status;
        }

    }, 0);

    document
        .getElementById("adminPermitModal")
        .classList.add("show");

} catch (error) {

    console.error(error);

}

}

async function openInspectionModal(permitId) {
    try {
        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/${permitId}`,
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        const permit = result.permit;

        currentPermitData = permit;

        const documents = result.documents || [];

        document.getElementById("inspectionModalBody").innerHTML =
            buildInspectionModal(permit, documents);

        document.getElementById("inspectionModal").classList.add("show");

    } catch (error) {
        console.error(error);
    }
}

function buildInspectionModal(permit, documents) {

    return `

        <!-- HEADER -->
        <div class="modal-header">

            <h2>Application Details</h2>

            <p id="permitModalSubtitle">
                Application Tracking & Information
            </p>

            <span
                class="close"
                onclick="closeInspectionModal()"
            >
                &times;
            </span>

        </div>

        <!-- BODY -->
        <div class="review-form">

            <!-- PROGRESS TRACKER -->
            <div class="modal-section">

                <h3>Progress Tracker</h3>

                ${buildApplicantStyleTracker(permit.status)}

            </div>

            <!-- APPLICATION INFORMATION -->
            <div class="modal-section">

                <h3>Application Information</h3>

                <div class="application-info">

                    <div class="form-row two">

                        <div class="field">

                            <label>Control Number</label>

                            <div class="static-value">
                                ${permit.control_number}
                            </div>

                        </div>

                        <div class="field">

                            <label>Permit Type</label>

                            <div class="static-value">
                                ${permit.permit_type}
                            </div>

                        </div>

                    </div>

                    <div class="form-row two">

                        <div class="field">

                            <label>Applicant Name</label>

                            <div class="static-value">
                                ${permit.owner_name}
                            </div>

                        </div>

                        <div class="field">

                            <label>Contact Number</label>

                            <div class="static-value">
                                ${permit.contact_number}
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            <!-- PROJECT DETAILS -->
            <div class="modal-section">

                <h3>Project Details</h3>

                <div class="application-info">

                    <div class="form-row two">

                        <div class="field">

                            <label>Project Title</label>

                            <div class="static-value">
                                ${permit.project_title}
                            </div>

                        </div>

                        <div class="field">

                            <label>Estimated Cost</label>

                            <div class="static-value">
                                ${permit.estimated_cost || "-"}
                            </div>

                        </div>

                    </div>

                    <div class="form-row two">

                        <div class="field">

                            <label>Owner Name</label>

                            <div class="static-value">
                                ${permit.owner_name}
                            </div>

                        </div>

                        <div class="field">

                            <label>Contact Number</label>

                            <div class="static-value">
                                ${permit.contact_number}
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            <!-- INSPECTION DETAILS -->
            <div class="modal-section">

                <h3>Inspection Details</h3>

                <div class="application-info">

                    <div class="form-row two">

                        <div class="field">

                            <label>Assigned Inspector</label>

                            <div class="static-value">
                                ${permit.inspector_name || "-"}
                            </div>

                        </div>

                        <div class="field">

                            <label>Department</label>

                            <div class="static-value">
                                ${permit.inspector_department || "-"}
                            </div>

                        </div>

                    </div>

                    <div class="form-row two">

                        <div class="field">

                            <label>Scheduled Date</label>

                            <div class="static-value">
                                ${permit.inspection_date || "-"}
                            </div>

                        </div>

                        <div class="field">

                            <label>Scheduled Time</label>

                            <div class="static-value">
                                ${permit.inspection_time || "-"}
                            </div>

                        </div>

                    </div>

                    ${
                        permit.status === "For Visitation"
                        ? `

                            <div class="form-row two">

                                <div class="field">

                                    <label>Inspection Status</label>

                                    <div class="static-value">
                                        ${permit.inspection_status || "-"}
                                    </div>

                                </div>

                                <div class="field">

                                    <label>Inspection Type</label>

                                    <div class="static-value">
                                        ${permit.inspection_type || "-"}
                                    </div>

                                </div>

                            </div>

                            <div class="form-row one">

                                <div class="field">

                                    <label>Findings</label>

                                    <div class="static-value">
                                        ${permit.findings || "-"}
                                    </div>

                                </div>

                            </div>

                            <div class="form-row one">

                                <div class="field">

                                    <label>Remarks</label>

                                    <div class="static-value">
                                        ${permit.inspection_remarks || "-"}
                                    </div>

                                </div>

                            </div>

                        `
                        : ""
                    }

                </div>

            </div>

        </div>
    `;
}

async function openPaymentModal(permitId) {

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/payments/${permitId}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        const permit = result.permit;

        currentPermitData = permit;

        // ADD THIS
        const payment = result.payment;

        // STORE GLOBALLY
        currentPaymentData = payment;

        // RESET TEMP STATE
        pendingPaymentChange = null;

        console.log("📌 Modal Opened");

        if (permit.status === "For Payment Verification") {

            console.log("⚠️ PAYMENT VERIFICATION MODE DETECTED");

            console.log("📄 PERMIT DATA:", permit);
            console.log("💳 PAYMENT DATA:", payment);

            console.log("🧪 KEY FIELDS CHECK:", {

                permit_id: permit.permit_id,
                status: permit.status,

                payment_status:
                    payment?.payment_status,

                application_fee:
                    payment?.application_fee,

                inspection_fee:
                    payment?.inspection_fee,

                other_fee:
                    payment?.other_fee,

                total_amount:
                    payment?.total_amount,

                payment_method:
                    payment?.payment_method,

                reference_number:
                    payment?.reference_number,

                receipt_path:
                    payment?.receipt_path
            });
        }

        document.getElementById(
            "paymentModalBody"
        ).innerHTML =
            buildPaymentModal(
                permit,
                payment
            );

        document
            .getElementById("paymentModal")
            .classList.add("show");

    } catch (error) {

        console.error(error);
    }
}

function buildPaymentProgressTracker(status) {

    const steps = [
        "Assessment",
        "Payment Submission",
        "Verification"
    ];

    const STATUS_INDEX = {

        "Pending": 1,

        "For Verification": 2,
        "Rejected": 2,

        "Verified": 2
    };

    const activeIndex =
        STATUS_INDEX[status] ?? 0;

    return `

        <div class="progress-tracker">

            ${steps.map((step, i) => {

                const isCompleted = i < activeIndex;

                const isActive = i === activeIndex;

                return `

                    <div class="progress-step ${
                        isCompleted
                            ? "completed"
                            : isActive
                            ? "active"
                            : ""
                    }">

                        <div class="circle">

                            ${
                                isCompleted
                                    ? "✓"
                                    : i + 1
                            }

                        </div>

                        <p>${step}</p>

                    </div>

                    ${
                        i < steps.length - 1
                        ? `
                            <div class="line ${
                                i < activeIndex
                                    ? "completed"
                                    : ""
                            }"></div>
                        `
                        : ""
                    }

                `;

            }).join("")}

        </div>

    `;
}

function buildPaymentActionButton(
    permit,
    payment
) {

    if (
        permit.status !==
        "For Payment Verification"
    ) {
        return "";
    }

    const effectiveStatus =
        pendingPaymentChange?.status ||
        payment?.payment_status;

    // APPROVED
    if (effectiveStatus === "Verified") {

        return `

            <div class="upload-documents">

                <button
                    class="primary-btn"
                    onclick="
                        confirmPaymentApproval(
                            ${permit.permit_id}
                        )
                    "
                >
                    Confirm Payment
                </button>

            </div>

        `;
    }

    // REJECTED
if (effectiveStatus === "Resubmission") {

    return `
        <div class="upload-documents">

            <button
                class="primary-btn"
                onclick="confirmPaymentRejection(${permit.permit_id})"
            >
                Request Resubmission
            </button>

        </div>
    `;
}

    return "";
}

function refreshPaymentActions() {

    const modalBody =
        document.getElementById(
            "paymentModalBody"
        );

    if (!modalBody) return;

    modalBody.innerHTML =
        buildPaymentModal(
            currentPermitData,
            currentPaymentData
        );
}

function isPaymentSubmitted(payment, permit) {
    return (
        payment?.payment_status === "For Verification" ||
        payment?.payment_status === "Verified" ||
        permit?.status === "For Payment Verification"
    );
}

function buildPaymentModal(permit, payment) {

    const hasAssessment = !!payment;
        
    return `

        <!-- HEADER -->
        <div class="modal-header">

            <h2>Payment Assessment</h2>

            <p id="permitModalSubtitle">
                Application Tracking & Information
            </p>

            <span
                class="close"
                onclick="closePaymentModal()"
            >
                &times;
            </span>

        </div>

        <!-- BODY -->
        <div class="review-form">

            <!-- PROGRESS TRACKER -->
            <div class="modal-section">

                <h3>Progress Tracker</h3>

                ${buildApplicantStyleTracker(permit.status)}
                
            </div>

            <!-- APPLICATION DETAILS -->
            <div class="modal-section">

                <h3>Application Details</h3>

                <div class="application-info">

                    <div class="form-row two">

                        <div class="field">

                            <label>Control Number</label>

                            <div class="static-value">
                                ${permit.control_number}
                            </div>

                        </div>

                        <div class="field">

                            <label>Permit Type</label>

                            <div class="static-value">
                                ${permit.permit_type}
                            </div>

                        </div>

                    </div>

                    <div class="form-row two">

                        <div class="field">

                            <label>Applicant Name</label>

                            <div class="static-value">
                                ${permit.owner_name}
                            </div>

                        </div>

                        <div class="field">

                            <label>Contact Number</label>

                            <div class="static-value">
                                ${permit.contact_number || "-"}
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            <!-- PAYMENT PROGRESS -->
            <div class="modal-section">

                <h3>Payment Progress</h3>

                ${buildPaymentProgressTracker(payment?.payment_status || permit.payment_status)}

            </div>

            <!-- FEE BREAKDOWN -->
            <div class="modal-section">

                <h3>Fee Breakdown</h3>

                <div class="application-info">

                    <!-- APPLICATION FEE -->
                    <div class="form-row two">

                        <div class="field">

                            <label>Application Fee</label>

                        </div>

                        <div class="field">

                            <div
                                class="fee-input-wrapper"
                            >

                                <span class="peso-sign">
                                    ₱
                                </span>

                                <input
                                    type="text"
                                    id="applicationFee"
                                    ${hasAssessment ? "readonly" : ""}
                                    value="${payment?.application_fee
                                        ? Number(payment?.application_fee).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })
                                        : ''}"
                                    oninput="
                                        sanitizeCurrencyInput(this);
                                        calculateTotalAssessment();
                                    "
                                    onblur="formatCurrencyInput(this)"
                                    placeholder="0.00"
                                >

                            </div>

                        </div>

                    </div>

                    <!-- INSPECTION FEE -->
                    <div class="form-row two">

                        <div class="field">

                            <label>Inspection Fee</label>

                        </div>

                        <div class="field">

                            <div
                                class="fee-input-wrapper"
                            >

                                <span class="peso-sign">
                                    ₱
                                </span>

                                <input
                                    type="text"
                                    id="inspectionFee"
                                    ${hasAssessment ? "readonly" : ""}
                                    value="${payment?.inspection_fee
                                        ? Number(payment?.inspection_fee).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })
                                        : ''}"
                                    oninput="
                                        sanitizeCurrencyInput(this);
                                        calculateTotalAssessment();
                                    "
                                    onblur="formatCurrencyInput(this)"
                                    placeholder="0.00"
                                />

                            </div>

                        </div>

                    </div>

                    <!-- OTHER FEE -->
                    <div class="form-row two">

                        <div class="field">

                            <label>Other Fee</label>

                        </div>

                        <div class="field">

                            <div
                                class="fee-input-wrapper"
                            >

                                <span class="peso-sign">
                                    ₱
                                </span>

                                <input
                                    type="text"
                                    id="otherFee"
                                    ${hasAssessment ? "readonly" : ""}
                                    value="${payment?.other_fee
                                        ? Number(payment?.other_fee).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })
                                        : ''}"
                                    oninput="
                                        sanitizeCurrencyInput(this);
                                        calculateTotalAssessment();
                                    "
                                    onblur="formatCurrencyInput(this)"
                                    placeholder="0.00"
                                />

                            </div>

                        </div>

                    </div>

                    <!-- TOTAL ASSESSMENT -->
                    <div class="form-row two total-row">

                        <div class="field">

                            <label class="total-label">
                                Total Assessment
                            </label>

                        </div>

                        <div class="field">

                            <div class="fee-input-wrapper total-input">

                                <span class="peso-sign">
                                    ₱
                                </span>

                                <input
                                    type="text"
                                    id="totalAssessmentAmount"
                                    value="${payment?.total_amount
                                        ? Number(payment?.total_amount).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })
                                        : ''}"
                                    placeholder="0.00"
                                    readonly
                                >

                            </div>

                        </div>

                    </div>

                </div>

            </div>

            ${isPaymentSubmitted(payment, permit) ? `
                
                <!-- PAYMENT INFORMATION -->
                <div class="modal-section">

                    <h3>Payment Information</h3>

                    <div class="application-info">

                        <!-- PAYMENT METHOD -->
                        <div class="form-row two">

                            <div class="field">
                                <label>Payment Method</label>
                            </div>

                            <div class="field">
                                <div class="static-value">
                                    ${payment?.payment_method || "-"}
                                </div>
                            </div>

                        </div>

                        <!-- REFERENCE NUMBER -->
                        <div class="form-row two">

                            <div class="field">
                                <label>Reference Number</label>
                            </div>

                            <div class="field">
                                <div class="static-value">
                                    ${payment?.reference_number || "-"}
                                </div>
                            </div>

                        </div>

                        <!-- RECEIPT / PROOF -->
                        <div class="form-row">

                            <div class="field full">

                                <label>Receipt</label>

                                ${
                                    payment?.receipt_path
                                    ? `

                                        <div class="document-card review-document-card">

                                            <div class="document-header">

                                                <div class="document-info">

                                                    <h4>
                                                        Proof of Payment
                                                    </h4>

                                                    <span class="document-status ${
                                                        (
                                                            pendingPaymentChange?.status ||
                                                            payment?.payment_status ||
                                                            "Pending"
                                                        )
                                                        .toLowerCase()
                                                        .replace(/\s+/g, "-")
                                                    }">

                                                        ${
                                                            pendingPaymentChange?.status ||
                                                            payment?.payment_status ||
                                                            "Pending"
                                                        }

                                                    </span>

                                                </div>

                                                <div class="document-actions">

                                                    <a
                                                        href="https://new-epermit-backend.onrender.com${payment.receipt_path}"
                                                        target="_blank"
                                                        class="view-btn"
                                                    >
                                                        View File
                                                    </a>

                                                </div>

                                            </div>

                                            <div class="document-body">

                                                <div class="document-file">
                                                    📄 ${
                                                        payment?.receipt_path
                                                            ? payment.receipt_path.split('/').pop()
                                                            : "Uploaded receipt file"
                                                    }
                                                </div>

                                                ${
                                                    payment?.payment_status === "Resubmission"
                                                    &&
                                                    payment?.remarks
                                                    ? `

                                                        <div class="review-section">

                                                            <small class="review-message">
                                                                Remarks:
                                                            </small>

                                                            <div class="remarks-display">

                                                                ${payment?.remarks}

                                                            </div>

                                                        </div>

                                                    `
                                                    : ""
                                                }

                                                <br>

                                                ${
                                                    permit.status === "For Payment Verification"
                                                    &&
                                                    (
                                                        !pendingPaymentChange ||
                                                        pendingPaymentChange.status === "For Verification"
                                                    )
                                                    ? `

                                                        <div class="review-actions">

                                                            <button
                                                                class="approve-btn"
                                                                onclick="markPaymentApproved()"
                                                            >
                                                                Approve
                                                            </button>

                                                            <button
                                                                class="reject-btn"
                                                                onclick="markPaymentRejected()"
                                                            >
                                                                Reject
                                                            </button>

                                                        </div>

                                                    `
                                                    : ""
                                                }

                                                <!-- APPROVAL ACTION -->
                                                <div
                                                    id="paymentApproveBox"
                                                    style="
                                                        display: ${
                                                            pendingPaymentChange?.status === "Verified"
                                                                ? "block"
                                                                : "none"
                                                        };
                                                        margin-top: 16px;
                                                    "
                                                >

                                                    <div class="review-actions">

                                                        <button
                                                            class="reject-btn"
                                                            onclick="cancelPaymentDecision()"
                                                        >
                                                            Cancel Approval
                                                        </button>

                                                    </div>

                                                </div>

                                                <div
                                                    id="paymentRejectBox"
                                                    class="reject-box"
                                                    style="
                                                        display: ${
                                                            pendingPaymentChange?.status === "Resubmission"
                                                                ? "block"
                                                                : "none"
                                                        };
                                                    "
                                                >

                                                    <textarea
                                                        id="paymentRemarks"
                                                        class="remarks-box"
                                                        placeholder="Enter rejection remarks..."
                                                        oninput="updatePaymentRemarks()"
                                                    >${
                                                        pendingPaymentChange?.remarks || ""
                                                    }</textarea>

                                                    <br><br>

                                                    <div class="review-actions">

                                                        <button
                                                            class="reject-btn"
                                                            onclick="cancelPaymentDecision()"
                                                        >
                                                            Cancel Rejection
                                                        </button>

                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    `
                                    : `

                                        <div class="static-value">
                                            No uploaded receipt
                                        </div>

                                    `
                                }

                            </div>

                        </div>

                    </div>

                </div>

            ` : ""}

            <!-- ACTION -->
            ${
                !payment
                ? `

                <div class="upload-documents">

                    <button
                        class="primary-btn"
                        id="generateBillBtn"
                        onclick="submitAssessment(${permit.permit_id})"
                        disabled
                    >
                        Save Assessment
                    </button>

                </div>

            ` : ""}

            <!-- PAYMENT REVIEW ACTIONS -->
            <div id="paymentActionContainer">

                ${buildPaymentActionButton(
                    permit,
                    payment
                )}

            </div>

            </div>
            `;

    // INITIAL CHECK
    setTimeout(() => {

        calculateTotalAssessment();

    }, 100);
}

async function submitAssessment(
    permitId
) {

    const confirmed = confirm(
        "Save assessment for this permit?"
    );

    if (!confirmed) return;

    try {

        const application_fee =
            parseCurrency(
                document.getElementById(
                    "applicationFee"
                ).value
            );

        const inspection_fee =
            parseCurrency(
                document.getElementById(
                    "inspectionFee"
                ).value
            );

        const other_fee =
            parseCurrency(
                document.getElementById(
                    "otherFee"
                ).value
            );

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/payments/assessment/${permitId}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    application_fee,
                    inspection_fee,
                    other_fee
                })
            }
        );

        const result =
            await response.json();

        if (!result.success) {

            alert(result.message);
            return;
        }

        alert(
            "Assessment saved successfully"
        );

        closePaymentModal();

        if (typeof loadApplications === "function") {

            await loadApplications();

        } else {

            console.warn(
                "loadApplications() not found"
            );
        }

    } catch (error) {

        console.error(error);

        alert(
            "Failed to save assessment"
        );
    }
}

function sanitizeCurrencyInput(input) {

    let value = input.value;

    // ALLOW ONLY NUMBERS, COMMA, DOT
    value = value.replace(/[^0-9.,]/g, "");

    // REMOVE ALL COMMAS FIRST
    value = value.replace(/,/g, "");

    // PREVENT MULTIPLE DOTS
    const parts = value.split(".");

    if (parts.length > 2) {

        value =
            parts[0] + "." +
            parts.slice(1).join("");
    }

    // LIMIT DECIMALS TO 2
    let [integer, decimal] = value.split(".");

    if (decimal !== undefined) {
        decimal = decimal.slice(0, 2);
        value = `${integer}.${decimal}`;
    } else {
        value = integer;
    }

    input.value = value;
}

function formatCurrencyInput(input) {

    let value = input.value;

    // REMOVE INVALID CHARACTERS
    value = value.replace(/[^0-9.]/g, "");

    // EMPTY ALLOWED
    if (value === "") {
        input.value = "";
        return;
    }

    // PARSE NUMBER
    const number = parseFloat(value);

    // INVALID NUMBER
    if (isNaN(number)) {
        input.value = "";
        return;
    }

    // FORMAT TO CURRENCY
    input.value = number.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function parseCurrency(value) {

    if (!value) return 0;

    return Number(
        value.replace(/,/g, "")
    ) || 0;
}

function calculateTotalAssessment() {

    const applicationFee =
        parseCurrency(
            document.getElementById(
                "applicationFee"
            ).value
        );

    const inspectionFee =
        parseCurrency(
            document.getElementById(
                "inspectionFee"
            ).value
        );

    const otherFee =
        parseCurrency(
            document.getElementById(
                "otherFee"
            ).value
        );

    const total =
        applicationFee +
        inspectionFee +
        otherFee;

    // UPDATE TOTAL
    document.getElementById(
        "totalAssessmentAmount"
    ).value =
        total > 0
            ? total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })
            : "";

    // ENABLE/DISABLE BUTTON
    const generateBtn =
        document.getElementById(
            "generateBillBtn"
        );

    const isComplete =
        applicationFee > 0 &&
        inspectionFee > 0;

    if (generateBtn) {

        generateBtn.disabled =
            !isComplete;
    }
}

function markPaymentApproved() {

    pendingPaymentChange = {
        status: "Verified",
        remarks: ""
    };

    refreshPaymentActions();
}

function markPaymentRejected() {

    pendingPaymentChange = {
        status: "Resubmission",
        remarks: ""
    };

    refreshPaymentActions();
}

function cancelPaymentDecision() {

    pendingPaymentChange = null;

    refreshPaymentActions();
}

function updatePaymentRemarks() {

    if (!pendingPaymentChange) return;

    pendingPaymentChange.remarks =
        document.getElementById(
            "paymentRemarks"
        ).value;
}

async function confirmPaymentApproval(
    permitId
) {

    const confirmed = confirm(
        "Approve this payment?"
    );

    if (!confirmed) return;

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/payments/verify/${permitId}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    payment_status: "Verified",
                    remarks: ""
                })
            }
        );

        const result =
            await response.json();

        if (!result.success) {

            alert(result.message);
            return;
        }

        alert("Payment approved");

        closePaymentModal();

        // RELOAD TABLE
        if (typeof loadApplications === "function") {

            await loadApplications();

        } else {

            console.warn(
                "loadApplications() not found"
            );
        }

    } catch (error) {

        console.error(error);

        alert("Failed to approve payment");
    }
}

async function confirmPaymentRejection(
    permitId
) {

    const confirmed = confirm(
        "Request payment resubmission?"
    );

    if (!confirmed) return;

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/payments/verify/${permitId}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    payment_status: "Resubmission",
                    remarks:
                        pendingPaymentChange?.remarks || ""
                })
            }
        );

        const result =
            await response.json();

        if (!result.success) {

            alert(result.message);
            return;
        }

        alert(
            "Payment marked for resubmission"
        );

        closePaymentModal();

        await loadApplications();

    } catch (error) {

        console.error(error);

        alert("Failed to reject payment");
    }
}

function closePaymentModal() {

    document
        .getElementById("paymentModal")
        .classList.remove("show");

    document
        .getElementById("paymentModalBody")
        .innerHTML = "";
}

async function updatePermitOnlyStatus(
    permitId,
    status
) {

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/update-status/${permitId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    status
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            alert("Permit updated successfully");

            closePaymentModal();

            await loadApplications();

        } else {

            alert(result.message);
        }

    } catch (error) {

        console.error(error);
    }
}

async function loadInspectionInspectors() {
    try {
        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/permits/inspectors",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();
        if (!result.success) return;

        const select = document.getElementById("inspectionInspectorSelect");
        if (!select) return;

        select.innerHTML = `<option value="">-- Choose Inspector --</option>`;

        result.inspectors.forEach(inspector => {
            const option = document.createElement("option");
            option.value = inspector.user_id;
            option.textContent =
                `${inspector.first_name} ${inspector.last_name} (${inspector.department})`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error(error);
    }
}

function toggleInspectionAssignBtn() {
    const select = document.getElementById("inspectionInspectorSelect");
    const btn = document.getElementById("inspectionAssignBtn");

    if (!select || !btn) return;

    btn.disabled = !select.value;
}

async function confirmInspectionAssignment(permitId) {

    const confirmed = confirm("Assign this inspector for inspection?");
    if (!confirmed) return;

    const inspectorId = document.getElementById("inspectionInspectorSelect").value;

    if (!inspectorId) {
        alert("Select an inspector first.");
        return;
    }

    try {
        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/assign-inspector/${permitId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ inspector_id: inspectorId })
            }
        );

        const result = await response.json();

        if (result.success) {
            alert("Inspector assigned for inspection.");
            closeInspectionModal();
            await loadApplications();
        } else {
            alert(result.message);
        }

    } catch (error) {
        console.error(error);
    }
}

function markForInspectionSchedule(permitId) {

    const confirmed = confirm(
        "Mark this permit for inspection scheduling?"
    );

    if (!confirmed) return;

    updatePermitStatusDirect(permitId, "For Inspection");
}

function closeInspectionModal() {
    document.getElementById("inspectionModal").classList.remove("show");
    document.getElementById("inspectionModalBody").innerHTML = "";
}

async function refreshPermitActionButton(
    permit,
    documents
) {

    document.getElementById(
        "permitActionContainer"
    ).innerHTML =
        buildPermitActionButton(
            permit,
            documents
        );

    const select =
        document.getElementById(
            "inlineInspectorSelect"
        );

    if (select) {

        await loadInlineInspectors(
            permit.permit_id
        );
    }
}

function buildAdminReviewDocuments(documents) {

if (!documents.length) {

    return `
        <div class="document-body">

            <div class="document-file">
                No file uploaded yet
            </div>

            <div class="review-section">

                <small class="review-message">
                    No remarks
                </small>

            </div>

        </div>
    `;
}

return documents.map(doc => `

    <div class="document-card review-document-card">

        <div class="document-header">

            <div class="document-info">

                <h4>${doc.document_name}</h4>

                <span class="document-status ${
                    doc.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                }">
                    ${doc.status}
                </span>

            </div>

            <div class="document-actions">

                <a
                    href="https://new-epermit-backend.onrender.com/${doc.file_path}"
                    target="_blank"
                    class="view-btn"
                >
                    View File
                </a>

            </div>

        </div>

        <div class="document-body">

            <div class="document-file">
                📄 ${doc.file_name}
            </div>

            ${
                (
                    (
                        pendingDocumentChanges[doc.document_id]?.status
                        || doc.status
                    ) === "Rejected"
                    ||
                    (
                        pendingDocumentChanges[doc.document_id]?.status
                        || doc.status
                    ) === "Resubmission"
                )
                &&
                (
                    pendingDocumentChanges[doc.document_id]?.remarks
                    || doc.remarks
                )
                ? `
                    <div class="review-section">

                        <small class="review-message">
                            Remarks:
                        </small>

                        <div class="remarks-display">${pendingDocumentChanges[doc.document_id]?.remarks || doc.remarks}</div>

                    </div>
                `
                : ""
            }

            <br>

            ${
                (() => {

                    const effectiveStatus =
                        pendingDocumentChanges[doc.document_id]?.status
                        || doc.status;

                    return (
                        (
                            currentPermitData.status === "Under Review" ||
                            currentPermitData.status === "For Revision"
                        )
                        &&
                        (
                            effectiveStatus === "Pending" ||
                            effectiveStatus === "Resubmission"
                        )
                    );

                })()
                ? `

                <div class="review-actions" id="actions-${doc.document_id}">

                    <button
                        class="approve-btn"
                        onclick="markDocumentApproved(${doc.document_id})"
                    >
                        Approve
                    </button>

                    <button
                        class="reject-btn"
                        onclick="markDocumentRejected(${doc.document_id})"
                    >
                        Reject
                    </button>

                </div>

            `
                : ""
            }

            ${(currentPermitData.status === "Under Review" || currentPermitData.status === "For Revision") ? `

            <div
                id="reject-box-${doc.document_id}"
                class="reject-box"
                style="display:none;"
            >

                <textarea
                    id="remarks-${doc.document_id}"
                    class="remarks-box"
                    placeholder="Enter rejection remarks..."
                    oninput="updateRejectedRemarks(${doc.document_id})"
                ></textarea><br><br>

                <div class="review-actions">

                    <button
                        class="reject-btn"
                        onclick="cancelRejectedDocument(${doc.document_id})"
                    >
                        Cancel Rejection
                    </button>

                </div>

            </div>

            ` : ""}
        </div>

    </div>

`).join("");

}

function buildPermitActionButton(permit, documents) {

    const permitStatus = permit.status;

    if (documents.length === 0) return "";

    const documentStatuses = getEffectiveDocumentStatuses(documents);

    // ONLY counts temporary (pending) rejections — not already saved ones
    const hasTempRejected = Object.values(pendingDocumentChanges).some(
        change => change.status === "Rejected"
    );

    const hasPending = documentStatuses.some(
        status => status === "Pending" || status === "Resubmission"
    );

    const allPending = documentStatuses.every(
        status => status === "Pending" || status === "Resubmission"
    );

    const allReviewed = documentStatuses.every(
        status => status === "Approved"
    );

    if (permitStatus === "Pending") {
        return `
            <div class="upload-documents">
                <button class="primary-btn" onclick="confirmReviewApplication(${permit.permit_id})">
                    Review Application
                </button>
            </div>
        `;
    }

    if (permitStatus === "Under Review" || permitStatus === "For Revision") {

        if (allPending) return "";

        // ONLY show if there's a temporary (unsaved) rejection
        if (hasTempRejected) {
            return `
                <div class="upload-documents">
                    <button
                        class="primary-btn"
                        onclick="confirmResubmission(${permit.permit_id})"
                        ${hasPending ? "disabled" : ""}
                    >
                        Request Resubmission
                    </button>
                </div>
            `;
        }

        if (allReviewed) {
            return `
                <div class="modal-section">
                    <h3>Assign Inspector</h3>
                    <div class="application-info">
                        <div class="form-row one">
                            <div class="field inline-assign-field">
                                <label>Select Inspector</label>
                                <select
                                    id="inlineInspectorSelect"
                                    class="inline-inspector-select"
                                    onchange="toggleAssignInspectorButton()"
                                >
                                    <option value="">-- Choose Inspector --</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="upload-documents">
                    <button
                        id="assignInspectorBtn"
                        class="primary-btn assign-btn"
                        onclick="confirmAssignInspector(${permit.permit_id})"
                        disabled
                    >
                        Assign Inspector
                    </button>
                </div>
            `;
        }

        return "";
    }

    return "";
}

function toggleAssignInspectorButton() {

    const select =
        document.getElementById(
            "inlineInspectorSelect"
        );

    const button =
        document.getElementById(
            "assignInspectorBtn"
        );

    if (!select || !button) return;

    button.disabled = !select.value;
}

function confirmReviewApplication(permitId) {

    const confirmed = confirm(
        "Are you sure you want to move this application to Under Review?"
    );

    if (!confirmed) return;

    updatePermitStatusDirect(
        permitId,
        "Under Review"
    );
}

function confirmResubmission(permitId) {
    const confirmed = confirm(
        "Are you sure you want to request resubmission for this application?"
    );
    if (!confirmed) return;

    updatePermitStatusDirect(permitId, "For Revision");  // changed from "Under Review"
}

function confirmAssignInspector(permitId) {

    const confirmed = confirm(
        "Are you sure you want to assign this inspector?"
    );

    if (!confirmed) return;

    submitInlineInspectorAssignment(permitId);
}

async function submitInlineInspectorAssignment(
    permitId
) {

    const inspectorId =
        document.getElementById(
            "inlineInspectorSelect"
        ).value;

    if (!inspectorId) {

        alert("Please select an inspector");

        return;
    }

    try {

        // ===================================
        // STEP 1:
        // SAVE DOCUMENT APPROVALS FIRST
        // ===================================

        const documentChanges =
            Object.entries(pendingDocumentChanges)
            .map(([documentId, change]) => {

                const doc = currentDocuments.find(
                    d => String(d.document_id) === String(documentId)
                );

                return {
                    document_id: Number(documentId),
                    document_name: doc?.document_name || null,
                    status: change.status,
                    remarks: change.remarks || ""
                };
            });

        // SAVE APPROVALS
        if (documentChanges.length > 0) {

            const reviewResponse = await fetch(
                `https://new-epermit-backend.onrender.com/api/permits/review-documents/${permitId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json",

                        Authorization:
                            `Bearer ${localStorage.getItem("token")}`
                    },

                    body: JSON.stringify({
                        permitStatus: "For Inspection",
                        documentChanges
                    })
                }
            );

            const reviewResult =
                await reviewResponse.json();

            if (!reviewResult.success) {

                alert(reviewResult.message);

                return;
            }
        }

        // ===================================
        // STEP 2:
        // ASSIGN INSPECTOR
        // ===================================

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/assign-inspector/${permitId}`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    inspector_id: inspectorId
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            pendingDocumentChanges = {};

            alert(
                "Inspector assigned successfully"
            );

            await loadApplications();

            await openAdminPermitModal(
                permitId
            );

        } else {

            alert(result.message);
        }

    } catch (error) {

        console.error(error);
    }
}

async function loadInlineInspectors(
    permitId
) {

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/inspectors/${permitId}`,
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        const select =
            document.getElementById(
                "inlineInspectorSelect"
            );

        if (!select) return;

        select.innerHTML = `
            <option value="">
                -- Choose Inspector --
            </option>
        `;

        result.inspectors.forEach(inspector => {

            const option =
                document.createElement("option");

            option.value = inspector.user_id;

            option.textContent =
                `${inspector.first_name} ${inspector.last_name} (${inspector.department})`;

            select.appendChild(option);
        });

    } catch (error) {

        console.error(error);
    }
}

function getEffectiveDocumentStatuses(documents) {

    return documents.map(doc => {

        // IF TEMP CHANGE EXISTS
        if (pendingDocumentChanges[doc.document_id]) {

            return pendingDocumentChanges[
                doc.document_id
            ].status;
        }

        // OTHERWISE DATABASE STATUS
        return doc.status;
    });
}

function markDocumentRejected(documentId) {

    pendingDocumentChanges[documentId] = {
        status: "Rejected",
        remarks: ""
    };

    // DO NOT mutate currentDocuments here

    const card = document
        .querySelector(`#actions-${documentId}`)
        .closest(".review-document-card");

    const statusSpan = card.querySelector(".document-status");

    statusSpan.textContent = "Rejected";
    statusSpan.className = "document-status rejected";

    document.getElementById(`actions-${documentId}`).style.display = "none";

    const rejectBox = document.getElementById(`reject-box-${documentId}`);
    rejectBox.style.display = "block";

    setTimeout(() => {
        rejectBox.classList.add("show");
    }, 10);

    refreshPermitActionButton(currentPermitData, currentDocuments);
}

function markDocumentApproved(documentId) {

    pendingDocumentChanges[documentId] = {
        status: "Approved",
        remarks: ""
    };

    // DO NOT mutate currentDocuments here

    const card = document
        .querySelector(`#actions-${documentId}`)
        .closest(".review-document-card");

    const statusSpan = card.querySelector(".document-status");

    statusSpan.textContent = "Approved";
    statusSpan.className = "document-status approved";

    document.getElementById(`actions-${documentId}`).innerHTML = `
        <button
            class="reject-btn"
            onclick="cancelApproval(${documentId})"
        >
            Cancel Approval
        </button>
    `;

    refreshPermitActionButton(currentPermitData, currentDocuments);
}

function cancelApproval(documentId) {

    delete pendingDocumentChanges[documentId];

    const card = document
        .querySelector(`#actions-${documentId}`)
        .closest(".review-document-card");

    const statusSpan = card.querySelector(".document-status");

    // READ FROM currentDocuments WHICH IS NEVER MUTATED
    const originalDocument = currentDocuments.find(
        d => d.document_id === documentId
    );

    const originalStatus = originalDocument?.status || "Pending";

    statusSpan.textContent = originalStatus;
    statusSpan.className = `document-status ${originalStatus.toLowerCase().replace(/\s+/g, "-")}`;

    // RESTORE APPROVE/REJECT BUTTONS
    document.getElementById(`actions-${documentId}`).innerHTML = `
        <button
            class="approve-btn"
            onclick="markDocumentApproved(${documentId})"
        >
            Approve
        </button>
        <button
            class="reject-btn"
            onclick="markDocumentRejected(${documentId})"
        >
            Reject
        </button>
    `;

    refreshPermitActionButton(currentPermitData, currentDocuments);
}

async function updatePermitStatusDirect(permitId, permitStatus = null) {

    try {

        const documentChanges =
            Object.entries(pendingDocumentChanges)
            .map(([documentId, change]) => {

                const doc = currentDocuments.find(
                    d => String(d.document_id) === String(documentId)
                );

                return {
                    document_id: Number(documentId),
                    document_name: doc?.document_name || null,
                    status: change.status,
                    remarks: change.remarks || ""
                };
            });

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/review-documents/${permitId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    permitStatus,
                    documentChanges,
                    forceStatusUpdate: true  // ADD THIS
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            pendingDocumentChanges = {};

            let successMessage = "Action completed successfully";

            if (permitStatus === "Under Review") {

                successMessage =
                    "Resubmission request sent successfully";

            } else if (permitStatus === "For Inspection") {

                successMessage =
                    "Inspector assigned successfully";

            } else if (
                Object.values(documentChanges)
                    .some(doc => doc.status === "Rejected")
            ) {

                successMessage =
                    "Resubmission request sent successfully";

            }

            alert(successMessage);

            await loadApplications();

            await openAdminPermitModal(
                currentPermitId
            );

        } else {

            alert(result.message);
        }

    } catch (error) {

        console.error(error);

    }
}

function showRejectBox(documentId) {

    const box =
        document.getElementById(
            `reject-box-${documentId}`
        );

    const actions =
        document.getElementById(
            `actions-${documentId}`
        );

    box.style.display = "block";

    setTimeout(() => {
        box.classList.add("show");
    }, 10);

    actions.style.display = "none";
}

function hideRejectBox(documentId) {

    const box =
        document.getElementById(
            `reject-box-${documentId}`
        );

    const actions =
        document.getElementById(
            `actions-${documentId}`
        );

    box.classList.remove("show");

    setTimeout(() => {
        box.style.display = "none";
    }, 250);

    actions.style.display = "flex";
}

function updateRejectedRemarks(documentId) {

    const remarks =
        document.getElementById(
            `remarks-${documentId}`
        ).value;

    if (!pendingDocumentChanges[documentId]) {
        return;
    }

    pendingDocumentChanges[documentId].remarks =
        remarks;
}

function cancelRejectedDocument(documentId) {

    // REMOVE TEMP CHANGE
    delete pendingDocumentChanges[documentId];

    const card = document
        .querySelector(`#actions-${documentId}`)
        .closest(".review-document-card");

    const statusSpan =
        card.querySelector(".document-status");

    // RESET STATUS
    const originalDocument =
        currentDocuments.find(
            d => d.document_id === documentId
        );

    const originalStatus =
        originalDocument?.status || "Pending";

    statusSpan.textContent =
        originalStatus;

    statusSpan.className =
        `document-status ${
            originalStatus
                .toLowerCase()
                .replace(/\s+/g, "-")
        }`;

    // CLEAR TEXTAREA
    const remarksBox =
        document.getElementById(
            `remarks-${documentId}`
        );

    if (remarksBox) {
        remarksBox.value = "";
    }

    // HIDE REJECT BOX
    const rejectBox =
        document.getElementById(
            `reject-box-${documentId}`
        );

    rejectBox.classList.remove("show");

    setTimeout(() => {
        rejectBox.style.display = "none";
    }, 250);

    // SHOW ACTION BUTTONS AGAIN
    const actions =
        document.getElementById(
            `actions-${documentId}`
        );

    actions.style.display = "flex";

    refreshPermitActionButton(
        currentPermitData,
        currentDocuments
    );
}

function buildApplicantStyleTracker(status) {

const steps = [
    "Application",
    "Uploading Documents",
    "Under Review",
    "Inspection",
    "Payment",
    "Clearance",
];

const STATUS_INDEX = {

    "Application": 0,

    "Pending": 1,
    "Uploaded": 1,

    "Under Review": 2,
    "For Revision": 2,
    "Resubmission": 2,

    "For Inspection": 3,

    "For Assessment": 4,
    "For Payment": 4,
    "For Payment Verification": 4,

    "For Clearance": 5,

    "Rejected": 3
};

const activeIndex =
    STATUS_INDEX[status] ?? 0;

return `

    <div class="progress-tracker">

        ${steps.map((step, i) => {

            const isCompleted = i < activeIndex;
            const isActive = i === activeIndex;

            return `

                <div class="progress-step ${
                    isCompleted
                        ? "completed"
                        : isActive
                        ? "active"
                        : ""
                }">

                    <div class="circle">
                        ${isCompleted ? "✓" : i + 1}
                    </div>

                    <p>${step}</p>

                </div>

                ${
                    i < steps.length - 1
                    ? `
                        <div class="line ${
                            i < activeIndex
                                ? "completed"
                                : ""
                        }"></div>
                    `
                    : ""
                }

            `;

        }).join("")}

    </div>
`;

}

async function updateDocumentStatus(documentId, status) {

    const remarks =
        document.getElementById(
            `remarks-${documentId}`
        ).value;

    // DISABLE BUTTONS
    const buttons = document.querySelectorAll("button");

    buttons.forEach(btn => {
        btn.disabled = true;
    });

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/document-status/${documentId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    status,
                    remarks
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            alert("Document updated");

            await loadApplications();

            await openAdminPermitModal(currentPermitId);

        } else {

            alert(result.message);
        }

    } catch (error) {

        console.error(error);

    } finally {

        // ENABLE BUTTONS AGAIN
        const buttons = document.querySelectorAll("button");

        buttons.forEach(btn => {
            btn.disabled = false;
        });
    }
}

async function updatePermitStatus(permitId) {

    const status =
        document.getElementById(
            "permitStatusSelect"
        ).value;

    // DISABLE BUTTONS
    const buttons = document.querySelectorAll("button");

    buttons.forEach(btn => {
        btn.disabled = true;
    });

    try {

        const response = await fetch(
            `https://new-epermit-backend.onrender.com/api/permits/update-status/${permitId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",

                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: JSON.stringify({
                    status
                })
            }
        );

        const result = await response.json();

        if (result.success) {

            alert("Permit status updated");

            await loadApplications();

            await openAdminPermitModal(currentPermitId);

        } else {

            alert(result.message);
        }

    } catch (error) {

        console.error(error);

    } finally {

        // ENABLE BUTTONS AGAIN
        const buttons = document.querySelectorAll("button");

        buttons.forEach(btn => {
            btn.disabled = false;
        });
    }
}

function closeAdminPermitModal() {

    currentPermitId = null;

    document
        .getElementById("adminPermitModal")
        .classList.remove("show");

    document
        .getElementById("adminPermitModalBody")
        .innerHTML = "";
}

function renderRecentApplications(permits) {

    const container =
        document.getElementById("recentApplications");

    container.innerHTML = "";

    const latest = permits.slice(0, 5);

    latest.forEach(permit => {

        const item = document.createElement("div");

        item.className = "activity-item";

        item.innerHTML = `
            <div class="activity-icon">
                📄
            </div>

            <div class="activity-content">
                <h4>${permit.project_title}</h4>

                <p>
                    ${permit.owner_name || permit.email}
                    submitted a
                    ${permit.permit_type}
                    Application
                </p>
            </div>
        `;

        container.appendChild(item);
    });
}

async function loadRecentResubmissions() {

    try {

        const response = await fetch(
            "https://new-epermit-backend.onrender.com/api/permits/recent-resubmissions",
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) return;

        renderRecentResubmissions(
            result.activities
        );

    } catch (error) {

        console.error(error);

    }
}

function renderRecentResubmissions(
    activities
) {

    const container =
        document.getElementById(
            "recentResubmissions"
        );

    container.innerHTML = "";

    if (!activities.length) {

        container.innerHTML = `
            <div class="empty-state">
                No recent resubmissions
            </div>
        `;

        return;
    }

    activities.forEach(activity => {

        const item =
            document.createElement("div");

        item.className = "activity-item";

        item.innerHTML = `
            <div class="activity-icon">
                🔄
            </div>

            <div class="activity-content">

                <h4>
                    ${activity.document_name}
                </h4>

                <p>
                    ${activity.owner_name}
                    resubmitted a document
                </p>

                <small>
                    ${formatDate(
                        activity.created_at
                    )}
                </small>

            </div>
        `;

        container.appendChild(item);
    });
}

function setupFilters() {

    document.getElementById("searchInput")
        .addEventListener("input", applyFilters);

    document.getElementById("statusFilter")
        .addEventListener("change", applyFilters);

    document.getElementById("permitFilter")
        .addEventListener("change", applyFilters);
}

function applyFilters() {

    const search =
        document.getElementById("searchInput")
        .value
        .toLowerCase();

    const status =
        document.getElementById("statusFilter").value;

    const permitType =
        document.getElementById("permitFilter").value;

    const filtered = allPermits.filter(permit => {

        const matchesSearch =

            (permit.control_number || "")
                .toLowerCase()
                .includes(search)

            ||

            (permit.project_title || "")
                .toLowerCase()
                .includes(search)

            ||

            (permit.owner_name || permit.email || "")
                .toLowerCase()
                .includes(search);

        const matchesStatus =
            !status || permit.status === status;

        const matchesPermit =
            !permitType ||
            permit.permit_type === permitType;

        return (
            matchesSearch &&
            matchesStatus &&
            matchesPermit
        );
    });

    renderApplications(filtered);
}

window.addEventListener("click", (event) => {

    const modal =
        document.getElementById("adminPermitModal");

    if (event.target === modal) {

        closeAdminPermitModal();
    }
});

/* 
    assign inspector modal and logic for both admin and applicant dashboard
    inspector-dashboard
    approved, revisitation logic
    payment method
    releasing of clearance
*/
