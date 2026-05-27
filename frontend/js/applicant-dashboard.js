let existingDocuments = {};
let pendingDocuments = {};
let rejectedDocuments = {};
const uploadedFormDocuments = {};
let currentPermitId = null;
let allPermits = [];
let allHistory = [];
let uploadedPaymentProofFile = null;
let uploadedPaymentProofURL = null;

function makeKey(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
}

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();

    loadUserInfo();

    loadMyPermits();

    loadApplicationHistory();

    loadApplicantActivities();

    // AUTO REFRESH PERMITS
    setInterval(() => {
        loadMyPermits();
    }, 10000);

    const savedSection =
        sessionStorage.getItem("activeSection") || "dashboard";

    setSection(savedSection);

    // SEARCH INPUT
    document.addEventListener("input", (e) => {

        if (e.target.id === "searchInput") {
            applyFiltersAndSort();
        }
    });

    // FILTERS + SORT
    document.addEventListener("change", (e) => {

        if (
            e.target.id === "statusFilter" ||
            e.target.id === "permitFilter" ||
            e.target.id === "sortBy"
        ) {
            applyFiltersAndSort();
        }
    });

    document.getElementById("historySearch")
        .addEventListener("input", applyHistoryFilters);
    document.getElementById("historyResultFilter")
        .addEventListener("change", applyHistoryFilters);
    document.getElementById("historyPermitFilter")
        .addEventListener("change", applyHistoryFilters);

});

// LOAD USER INFO
function loadUserInfo() {

    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
        console.log("No user found");
        return;
    }

    const user = JSON.parse(savedUser);

    console.log(user);

    // FULL NAME
    document.getElementById("userName").textContent =
        `${user.first_name} ${user.middle_name || ""} ${user.last_name}`
            .replace(/\s+/g, " ")
            .trim();

    // ROLE
    document.getElementById("userRole").textContent =
        user.role;
}

// SIDEBAR NAVIGATION
function setupSidebar() {

    document.getElementById("btnDashboard")
        .addEventListener("click", () => {
            setSection("dashboard");
        });

    document.getElementById("btnPermits")
        .addEventListener("click", () => {
            setSection("applications");
        });

    document.getElementById("btnApply")
        .addEventListener("click", () => {
            setSection("requirements");
        });

    document.getElementById("btnHistory")
        .addEventListener("click", () => {
            setSection("history");
        });
}

// SECTION SWITCHING
function setSection(section) {

    sessionStorage.setItem("activeSection", section);

    const sections = {
        dashboard: document.getElementById("dashboardSection"),
        applications: document.getElementById("myApplicationsSection"),
        requirements: document.getElementById("requirementsSection"),
        history: document.getElementById("historySection")
    };

    const buttons = {
        dashboard: document.getElementById("btnDashboard"),
        applications: document.getElementById("btnPermits"),
        requirements: document.getElementById("btnApply"),
        history: document.getElementById("btnHistory")
    };

    Object.values(sections).forEach(sec => {
        sec.style.display = "none";
    });

    Object.values(buttons).forEach(btn => {
        btn.classList.remove("active");
    });

    sections[section].style.display = "block";

    buttons[section].classList.add("active");
}

// DROPDOWN MENU
function toggleDropdown(event) {

    event.stopPropagation();

    const dropdown =
        document.getElementById("dropdownMenu");

    dropdown.classList.toggle("show");
}

// CLOSE WHEN CLICKING OUTSIDE
document.addEventListener("click", (event) => {

    const dropdown =
        document.getElementById("dropdownMenu");

    const roleBtn =
        document.querySelector(".role-btn");

    // Ignore clicks inside dropdown/button
    if (
        !dropdown.contains(event.target) &&
        !roleBtn.contains(event.target)
    ) {
        dropdown.classList.remove("show");
    }
});

// LOGOUT
function logout() {

    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user");

    sessionStorage.clear();

    window.location.href = "index.html";
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

// RENDER REQUIREMENTS
function renderRequirements() {

    const permitType = document.getElementById("permit_type").value;

    const list =
        document.getElementById("requirementsList");

    const placeholder =
        document.getElementById("reqPlaceholder");

    list.innerHTML = "";

    if (!permitType || !permitRequirements[permitType]) {
        placeholder.style.display = "block";
        return;
    }

    placeholder.style.display = "none";

    let requirements = [];

    // BUILDING PERMIT
    if (permitType === "Building Permit") {

        requirements = [
            ...permitRequirements["Building Permit"].regular,
            "IF NHA:",
            ...permitRequirements["Building Permit"].nha
        ];

    } else {

        requirements = permitRequirements[permitType];
    }

    requirements.forEach(req => {

        const li = document.createElement("li");

        if (req === "IF NHA:") {

            li.innerHTML =
                `<strong style="color:#c2410c;">${req}</strong>`;

        } else {

            li.innerHTML = `📌 ${req}`;
        }

        list.appendChild(li);
    });
}

async function loadApplicationHistory() {
    try {
        const response = await fetch(
            "http://localhost:5000/api/permits/my-permits/history",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();
        if (!result.success) return;

        allHistory = result.permits || [];

        document.getElementById("historyTotal").textContent = allHistory.length;
        document.getElementById("historyApproved").textContent =
            allHistory.filter(p => p.status === "Approved").length;
        document.getElementById("historyRejected").textContent =
            allHistory.filter(p => p.status === "Rejected").length;

        applyHistoryFilters();

    } catch (error) {
        console.error("Load history error:", error);
    }
}

function applyHistoryFilters() {
    let permits = [...allHistory];

    const search = document.getElementById("historySearch")?.value.toLowerCase() || "";
    const result = document.getElementById("historyResultFilter")?.value || "";
    const permitType = document.getElementById("historyPermitFilter")?.value || "";

    if (search) {
        permits = permits.filter(p =>
            (p.control_number || "").toLowerCase().includes(search) ||
            (p.project_title || "").toLowerCase().includes(search)
        );
    }
    if (result) {
        permits = permits.filter(p => p.status === result);
    }
    if (permitType) {
        permits = permits.filter(p => p.permit_type === permitType);
    }

    document.getElementById("historyCount").textContent =
        `${permits.length} Record${permits.length !== 1 ? "s" : ""}`;

    renderHistoryTable(permits);
}

function renderHistoryTable(permits) {
    const tbody = document.getElementById("historyTable");
    const empty = document.getElementById("historyEmpty");

    tbody.innerHTML = "";

    if (!permits.length) {
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";

    permits.forEach(permit => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.onclick = () => openPermitModal(permit.permit_id);

        const statusClass = permit.status.toLowerCase().replace(/\s+/g, "-");

        row.innerHTML = `
            <td>${permit.control_number}</td>
            <td>${permit.permit_type}</td>
            <td>${permit.project_title}</td>
            <td>${new Date(permit.submitted_at).toLocaleString("en-PH", {
                year: "numeric", month: "short", day: "numeric"
            })}</td>
            <td>${new Date(permit.last_updated).toLocaleString("en-PH", {
                year: "numeric", month: "short", day: "numeric"
            })}</td>
            <td>${permit.reviewed_by}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${permit.status}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// SERVICE MODAL
let selectedPermit = "";
let selectedApplicantRole = "Owner";

// OPEN MODAL
function openServiceModal(serviceName) {

    selectedPermit = serviceName;

    const modal = document.getElementById("serviceModal");
    const title = document.getElementById("modalTitle");
    const description = document.getElementById("modalDescription");
    const body = document.getElementById("modalBody");

    title.textContent = serviceName;
    description.textContent = `Apply for ${serviceName}`;

    body.innerHTML = buildPermitForm(serviceName);

    setTimeout(() => {

        const fields = [
            "fullName",
            "contactNumber",
            "fullAddress",
            "projectName",
            "projectLocation",
            "estimatedCost",
            "ownerName",
            "ownerContactNumber"
        ];

        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.dataset.bound) {
                el.addEventListener("input", validateApplicationForm);
                el.dataset.bound = "true";
            }
        });

        validateApplicationForm(); // initial check

    }, 0);

    modal.classList.add("show"); // ✅ FIX
}

function buildPermitForm(type) {

    // define what you want to upload in this form
    const locationRequirements = [
        "Project Location Map"
    ];

    const documentRequirements = [
        "Application Form"
    ];

    return `
    <div class="review-form">

        <!-- APPLICANT -->
        <div class="modal-section">
            <h3>Applicant Information</h3>

            <div class="form-group">
                <label class="form-label">
                    Please select your role:
                </label><br>

                <div class="radio-row">

                    <label>
                        <input type="radio" name="isOwner" value="Owner"
                            required onchange="toggleOwnerFields(true)">
                        Property Owner
                    </label>

                    <label>
                        <input type="radio" name="isOwner" value="Representative"
                            required onchange="toggleOwnerFields(false)">
                        Authorized Representative / Agent
                    </label>

                </div>
            </div>

            <div class="radio-row">

                <div class="field">
                    <label>Applicant Name</label>
                    <input type="text" id="fullName" placeholder="Enter name" readonly>
                </div>

                <div class="field">
                    <label>Applicant Contact Number</label>
                    <input type="text" id="contactNumber" placeholder="Enter contact number" readonly>
                </div>

            </div>

            <!-- ADDRESS -->
            <div class="radio-row">

                <div class="field">
                    <label>Address</label>

                    <input
                        type="text"
                        id="fullAddress"
                        placeholder="Enter address"
                        readonly
                    >
                </div>

            </div>

            <!-- OWNER INFO -->
            <div
                class="radio-row"
                id="ownerFieldsRow"
                style="display:none;"
            >

                <div class="field">
                    <label>Owner Name</label>

                    <input
                        type="text"
                        id="ownerName"
                        placeholder="Enter property owner name"
                    >
                </div>

                <div class="field">
                    <label>Owner Contact Number</label>

                    <input
                        type="text"
                        id="ownerContactNumber"
                        placeholder="Enter owner contact number"
                    >
                </div>

            </div>

            <div class="upload-documents">
                <div class="field">
                    <label>Applicant Form</label>
                </div>
                ${documentRequirements.map(req => {

                    const key = makeKey(req);

                    return `
                    <div class="document-card" id="card-${key}">

                        <div class="document-header">

                            <div class="document-info">
                                <h4>${req}</h4>
                            </div>

                            <div class="document-actions" id="actions-${key}">

                                <label class="upload-btn">
                                    Upload
                                    <input type="file" hidden
                                        onchange="handleFormDocumentUpload(event, '${key}')">
                                </label>

                            </div>

                        </div>

                        <div class="document-body">

                            <div class="document-file" id="file-${key}">
                                No file uploaded
                            </div>
                            
                        </div>

                    </div>
                    `;
                }).join("")}

            </div>
        </div>

        <!-- PROJECT -->
        <div class="modal-section">
            <h3>Project Information</h3>

            <div class="radio-row">

                <div class="field">
                    <label>Project Name</label>
                    <input type="text" id="projectName" placeholder="Enter project name" >
                </div>

                <div class="field">
                    <label>Estimated Cost</label>
                    <input type="text" id="estimatedCost" placeholder="Enter estimated cost" 
                        inputmode="decimal"
                        oninput="this.value = this.value.replace(/[^0-9.,]/g, '')">
                </div>

                <div class="field">
                    <label>Project Location</label>
                    <input type="text" id="projectLocation" placeholder="Enter project location " >
                </div>
            </div>

            <div class="field">
                <label>Locational Map</label>
            </div><br>
            <div class="upload-documents">

                ${locationRequirements.map(req => {

                    const key = makeKey(req);

                    return `
                    <div class="document-card" id="card-${key}">

                        <div class="document-header">

                            <div class="document-info">
                                <h4>${req}</h4>

                            </div>

                            <div class="document-actions" id="actions-${key}">

                                <label class="upload-btn">
                                    Upload
                                    <input type="file" hidden
                                        onchange="handleFormDocumentUpload(event, '${key}')">
                                </label>

                            </div>

                        </div>

                        <div class="document-body">

                            <div class="document-file" id="file-${key}">
                                No file uploaded
                            </div>

                        </div>

                    </div>
                    `;
                }).join("")}

            </div>
        </div>

        <!-- ACTIONS -->
        <div class="modal-actions" style="justify-content:center;">
            <button class="primary-btn"
                id="submitBtn"
                onclick="submitApplication('${type}')"
                disabled>
                Submit Application
            </button>
        </div>

    </div>
    `;
}

function toggleOwnerFields(isOwner) {

    selectedApplicantRole =
        isOwner ? "Owner" : "Representative";

    console.log("ROLE:", selectedApplicantRole);

    const fullName =
        document.getElementById("fullName");

    const contact =
        document.getElementById("contactNumber");

    const address =
        document.getElementById("fullAddress");

    const ownerFieldsRow =
        document.getElementById("ownerFieldsRow");

    const user =
        JSON.parse(localStorage.getItem("user")) || {};

    // Populate logged in user
    fullName.value = `
        ${user.first_name || ""}
        ${user.middle_name || ""}
        ${user.last_name || ""}
    `
    .replace(/\s+/g, " ")
    .trim();

    contact.value = user.contact_number || "";

    address.value = `
        ${user.street_address || ""},
        ${user.barangay || ""},
        ${user.city || ""}
        ${user.zip_code || ""}
    `
    .replace(/\s+/g, " ")
    .trim();

    // Toggle owner field
    if (isOwner) {

        ownerFieldsRow.style.display = "none";

    } else {

        ownerFieldsRow.style.display = "flex";
    }

    validateApplicationForm();
}

function handleFormDocumentUpload(event, key) {

    const file = event.target.files[0];
    if (!file) return;

    uploadedFormDocuments[key] = file;

    renderFormDocumentCard(key);

    validateApplicationForm();
}

function renderFormDocumentCard(key) {

    const file = uploadedFormDocuments[key];

    const card = document.getElementById(`card-${key}`);
    if (!card) return;

    const fileContainer =
        document.getElementById(`file-${key}`);

    const actions =
        card.querySelector(".document-actions");

    // EMPTY STATE
    if (!file) {

        fileContainer.innerHTML = "No file uploaded";

        actions.innerHTML = `
            <label class="upload-btn">
                Upload
                <input
                    type="file"
                    hidden
                    onchange="handleFormDocumentUpload(event, '${key}')"
                >
            </label>
        `;

        return;
    }

    // UPLOADED STATE
    fileContainer.innerHTML = `
        📄 ${file.name}
        <span class="file-size">
            (${(file.size / 1024).toFixed(1)} KB)
        </span>
    `;

    actions.innerHTML = `
        <button class="view-btn"
            onclick="viewFormDocument('${key}')">
            View
        </button>

        <button class="remove-btn"
            onclick="removeFormDocument('${key}')">
            Remove
        </button>
    `;
}

function validateApplicationForm() {

    const requiredFields = [
        "fullName",
        "contactNumber",
        "fullAddress",
        "projectName",
        "projectLocation",
        "estimatedCost"
    ];

    let isValid = true;

    // CHECK REQUIRED FIELDS
    requiredFields.forEach(id => {

        const el = document.getElementById(id);

        if (!el || el.value.trim() === "") {
            isValid = false;
        }
    });

    // REPRESENTATIVE CHECK
    if (selectedApplicantRole === "Representative") {

        const ownerName =
            document.getElementById("ownerName");

        const ownerContact =
            document.getElementById("ownerContactNumber");

        if (
            !ownerName ||
            ownerName.value.trim() === "" ||
            !ownerContact ||
            ownerContact.value.trim() === ""
        ) {
            isValid = false;
        }
    }

    // FILE CHECK (FIXED)
    const requiredDocs = [
        "Application Form",
        "Project Location Map"
    ];

    for (let i = 0; i < requiredDocs.length; i++) {
        const req = requiredDocs[i];
        const key = makeKey(req);

        if (!uploadedFormDocuments[key]) {
            isValid = false;
            break;
        }
    }

    // ENABLE BUTTON
    const submitBtn =
        document.getElementById("submitBtn");

    if (submitBtn) {

        submitBtn.disabled = !isValid;

        // OPTIONAL VISUAL
        submitBtn.style.opacity =
            isValid ? "1" : "0.5";

        submitBtn.style.cursor =
            isValid ? "pointer" : "not-allowed";
    }
}

function viewFormDocument(key) {

    const file = uploadedFormDocuments[key];
    if (!file) return;

    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
}

function removeFormDocument(key) {

    delete uploadedFormDocuments[key];

    const input = document.querySelector(`#card-${key} input[type="file"]`);
    if (input) input.value = "";

    renderFormDocumentCard(key);

    validateApplicationForm();
}

// CLOSE MODAL
function closeServiceModal() {

    Object.keys(uploadedFormDocuments).forEach(key => {
        delete uploadedFormDocuments[key];
    });

    document.getElementById("serviceModal")
        .classList.remove("show");
}

// PROCEED TO APPLICATION
function proceedApplication() {

    closeServiceModal();

    // switch section
    setSection("requirements");

    const permitSelect =
        document.getElementById("permit_type");

    // auto-select permit based on clicked card
    if (selectedPermit === "Building & Structural Permits") {

        permitSelect.value = "Zoning Clearance";

    } else if (selectedPermit === "MEP Permits") {

        permitSelect.value = "Fire Safety Evaluation Clearance";

    } else if (selectedPermit === "Compliance & Safety Permits") {

        permitSelect.value = "Building Permit";
    }

    // render requirements
    renderRequirements();

    // scroll to top
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

async function submitApplication(type) {

    // VALIDATE REQUIRED FIELDS
    const requiredFields = [
        "fullName",
        "contactNumber",
        "fullAddress",
        "projectName",
        "projectLocation",
        "estimatedCost"
    ];

    let missingFields = false;

    requiredFields.forEach(id => {

        const el = document.getElementById(id);

        if (!el || el.value.trim() === "") {
            missingFields = true;
        }
    });

    // REPRESENTATIVE VALIDATION
    if (selectedApplicantRole === "Representative") {

        const ownerName =
            document.getElementById("ownerName");

        const ownerContact =
            document.getElementById("ownerContactNumber");

        if (
            !ownerName ||
            ownerName.value.trim() === "" ||
            !ownerContact ||
            ownerContact.value.trim() === ""
        ) {
            missingFields = true;
        }
    }

    // CHECK REQUIRED DOCUMENTS
    const requiredDocs = [
        "Application Form",
        "Project Location Map"
    ];

    for (const req of requiredDocs) {

        const key = makeKey(req);

        if (!uploadedFormDocuments[key]) {
            missingFields = true;
            break;
        }
    }

    // SHOW ALERT
    if (missingFields) {

        alert(
            "Please complete all required fields and upload the required document before submitting."
        );

        return;
    }

    // CONFIRM SUBMISSION
    const confirmSubmit = confirm(
        "Are you sure you want to submit this application?\nPlease double-check your information and uploaded documents."
    );

    if (!confirmSubmit) {
        return;
    }

    // CREATE FORM DATA
    const formData = new FormData();

    formData.append('permit_type', type);

    formData.append(
        'project_title',
        document.getElementById('projectName')?.value || ''
    );

    formData.append(
        'project_location',
        document.getElementById('projectLocation')?.value || ''
    );

    formData.append(
        'estimated_cost',
        document.getElementById('estimatedCost')?.value || ''
    );

    const user =
        JSON.parse(localStorage.getItem("user")) || {};

    const selectedRole =
        selectedApplicantRole;

    formData.append(
        "applicant_type",
        selectedRole
    );

    // APPLICANT NAME
    const applicantName =
        `${user.first_name || ""}
        ${user.middle_name || ""}
        ${user.last_name || ""}`
        .replace(/\s+/g, " ")
        .trim();

    let ownerName = "";
    let contactNumber = "";

    // PROPERTY OWNER
    if (selectedRole === "Owner") {

        ownerName = applicantName;

        // Owner number
        contactNumber =
            document.getElementById("contactNumber")?.value || "";

    } else {

        // REPRESENTATIVE
        ownerName =
            document.getElementById("ownerName")?.value.trim() || "";

        // SAVE OWNER CONTACT NUMBER
        contactNumber =
            document.getElementById("ownerContactNumber")?.value || "";
    }

    formData.append(
        "applicant_name",
        applicantName
    );

    formData.append(
        "owner_name",
        ownerName
    );

    formData.append(
        "contact_number",
        contactNumber
    );

    formData.append(
        'full_address',
        document.getElementById('fullAddress')?.value || ''
    );

    // FILES
    Object.entries(uploadedFormDocuments).forEach(([key, file]) => {

        formData.append(key, file);

    });

    // SUBMIT
    try {

        const response = await fetch(
            "http://localhost:5000/api/permits/submit",
            {
                method: "POST",
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },
                body: formData
            }
        );

        const result =
            await response.json();

        if (result.success) {

            closeServiceModal();

            alert(
                `Application submitted!\nControl Number: ${result.control_number}`
            );

            loadMyPermits();

            setSection('applications');

        } else {

            alert(`Error: ${result.message}`);
        }

    } catch (error) {

        console.error('Submit error:', error);

        alert('Something went wrong. Please try again.');
    }
}

async function loadMyPermits() {

    try {

        const response = await fetch(
            "http://localhost:5000/api/permits/my-permits",
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) {
            return;
        }

        const permits = (result.permits || []).filter(
            p => !["Rejected", "For Clearance", "Approved"].includes(p.status)
        );

        // =========================
        // TOTAL COUNTS
        // =========================

        document.getElementById("totalApplications").textContent =
            permits.length;

        // =========================
        // PERMIT TYPE COUNTS
        // =========================

        const buildingCount = permits.filter(
            p => p.permit_type === "Building Permit"
        ).length;

        const zoningCount = permits.filter(
            p => p.permit_type === "Zoning Clearance"
        ).length;

        const fsecCount = permits.filter(
            p => p.permit_type === "Fire Safety Evaluation Clearance"
        ).length;

        document.getElementById("totalBuildingPermit").textContent =
            buildingCount;

        document.getElementById("totalZoningClearance").textContent =
            zoningCount;

        document.getElementById("totalFSEC").textContent =
            fsecCount;

        // =========================
        // STATUS COUNTS
        // =========================

        const pendingCount = permits.filter(
            p => p.status === "Pending"
        ).length;

        const underReviewCount = permits.filter(
            p => p.status === "Under Review"
        ).length;

        const inspectionCount = permits.filter(
            p => p.status === "For Inspection"
        ).length;

        const paymentCount = permits.filter(
            p => p.status === "For Payment"
        ).length;

        const approvedCount = permits.filter(
            p => p.status === "Approved"
        ).length;

        const rejectedCount = permits.filter(
            p => p.status === "Rejected"
        ).length;

        document.getElementById("pendingApplications").textContent =
            pendingCount;

        document.getElementById("underReviewApplications").textContent =
            underReviewCount;

        document.getElementById("inspectionsApplications").textContent =
            inspectionCount;

        document.getElementById("paymentApplications").textContent =
            paymentCount;

        document.getElementById("approvedApplications").textContent =
            approvedCount;

        document.getElementById("rejectedApplications").textContent =
            rejectedCount;

        // =========================
        // RENDER TABLE
        // =========================

        permits.sort(
            (a, b) =>
                new Date(b.submitted_at) -
                new Date(a.submitted_at)
        );

        allPermits = permits;
        applyFiltersAndSort();

    } catch (error) {

        console.error("Load permits error:", error);
    }
}

function renderPermitTable(permits) {

    const table = document.getElementById("permitTable");
    const emptyState = document.getElementById("emptyState");

    table.innerHTML = "";

    if (!permits || permits.length === 0) {
        emptyState.style.display = "block";
        return;
    }

    emptyState.style.display = "none";

    permits.forEach(permit => {

        const row = document.createElement("tr");

        // ✅ FIX 1: normalize status ONCE (important)
        const status = permit.application_status || permit.status || "Unknown";

        row.style.cursor = "pointer";

        row.onclick = () => {

            const currentStatus =
                permit.status ||
                permit.application_status ||
                "Unknown";

            // =========================
            // PAYMENT STATUS
            // =========================
            if (
                currentStatus === "For Payment" ||
                currentStatus === "For Payment Verification"
            ) {

                openApplicantPaymentModal(
                    permit.permit_id
                );

                return;
            }

            // =========================
            // INSPECTION STATUS
            // =========================
            const inspectionStatuses = [
                "For Inspection",
                "For Visitation",
                "For Reinspection",
                "Rejected"
            ];

            if (inspectionStatuses.includes(currentStatus)) {

                openInspectionStatusModal(
                    permit.permit_id
                );

                return;
            }

            // =========================
            // REVIEW STATUS
            // =========================
            const reviewStatuses = [
                "Under Review",
                "For Revision",
                "For Assessment",
                "Approved"
            ];

            if (reviewStatuses.includes(currentStatus)) {

                openUnderReviewModal(
                    permit.permit_id
                );

                return;
            }

            // DEFAULT
            openPermitModal(
                permit.permit_id
            );
        };

        // ✅ FIX 3: safe class generation
        const statusClass = status.toLowerCase().replace(/\s+/g, '-');

        row.innerHTML = `
            <td>${permit.control_number}</td>

            <td>${permit.permit_type}</td>

            <td>${permit.project_title}</td>

            <td>
                ${new Date(permit.submitted_at).toLocaleString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                })}
            </td>

            <td>${permit.reviewed_by}</td>

            <td>
                <span class="status-badge ${statusClass}">
                    ${formatStatusText(status)}
                </span>
            </td>
        `;

        table.appendChild(row);
    });

    updatePermitStats(permits);
}

function formatStatusText(status) {
    const map = {
        "For Payment Verification": "Payment Verification"
    };

    return map[status] || status;
}

function applyFiltersAndSort() {

    let permits = [...allPermits];

    // GET VALUES
    const search =
        document.getElementById("searchInput")?.value
        .toLowerCase() || "";

    const statusFilter =
        document.getElementById("statusFilter")?.value || "";

    const permitFilter =
        document.getElementById("permitFilter")?.value || "";

    const sortBy =
        document.getElementById("sortBy")?.value || "latest";

    // SEARCH
    if (search) {

        permits = permits.filter(p =>
            (p.control_number || "")
                .toLowerCase()
                .includes(search)

            ||

            (p.project_title || "")
                .toLowerCase()
                .includes(search)
        );
    }

    // STATUS FILTER
    if (statusFilter) {

        permits = permits.filter(
            p => (p.status || p.application_status) === statusFilter
        );
    }

    // PERMIT FILTER
    if (permitFilter) {

        permits = permits.filter(
            p => p.permit_type === permitFilter
        );
    }

    // SORTING
    switch (sortBy) {

        case "latest":

            permits.sort((a, b) =>
                new Date(b.submitted_at) -
                new Date(a.submitted_at)
            );

            break;

        case "oldest":

            permits.sort((a, b) =>
                new Date(a.submitted_at) -
                new Date(b.submitted_at)
            );

            break;

        case "status":

            permits.sort((a, b) =>
                (a.status || "").localeCompare(b.status || "")
            );

            break;

        case "permit":

            permits.sort((a, b) =>
                (a.permit_type || "")
                    .localeCompare(b.permit_type || "")
            );

            break;
    }

    document.getElementById("resultsCount").textContent =
        `${permits.length} Application${permits.length !== 1 ? "s" : ""}`;

    renderPermitTable(permits);
}

function getNextStep(status) {

    switch(status) {

        case "Pending":
            return "Complete document upload";

        case "Under Review":
            return "Waiting for evaluation";

        case "For Revision":
            return "Resubmit documents";

        // =========================
        // INSPECTION
        // =========================
        case "For Inspection":
            return "View inspection schedule";

        case "For Visitation":
            return "View visitation details";

        case "For Reinspection":
            return "View reinspection schedule";

        // =========================
        // PAYMENT
        // =========================
        case "For Assessment":
            return "Waiting for assessment";

        case "For Payment":
            return "Proceed to payment";

        case "Approved":
            return "Permit approved";

        case "Rejected":
            return "Application rejected";

        default:
            return "Pending action";
    }
}

function updatePermitStats(permits) {

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const pendingCount = permits.filter(p => p.status === "Pending").length;
    const underReviewCount = permits.filter(p => p.status === "Under Review").length;
    const inspectionCount = permits.filter(p => p.status === "For Inspection").length;
    const paymentCount = permits.filter(p => p.status === "For Payment").length;
    const approvedCount = permits.filter(p => p.status === "Approved").length;
    const rejectedCount = permits.filter(p => p.status === "Rejected").length;

    setText("pendingApplications", pendingCount);
    setText("underReviewApplications", underReviewCount);
    setText("inspectionsApplications", inspectionCount);
    setText("paymentApplications", paymentCount);
    setText("approvedApplications", approvedCount);
    setText("rejectedApplications", rejectedCount);
}

function renderActivityLog(activities) {

    const container =
        document.getElementById("activityLog");

    if (!container) return;

    container.innerHTML = "";

    if (!activities.length) {

        container.innerHTML = `
            <div class="activity-item">
                <div class="activity-content">
                    <h4>No recent activity</h4>
                    <p>Your permit updates will appear here.</p>
                </div>
            </div>
        `;

        return;
    }

    // ✅ PRIORITY SORTING (IMPORTANT PART)
    const sorted = [...activities].sort((a, b) => {

        const dateDiff =
            new Date(b.created_at) -
            new Date(a.created_at);

        // IF SAME TIMESTAMP
        if (dateDiff === 0) {

            return b.activity_id - a.activity_id;
        }

        return dateDiff;
    });

    sorted.slice(0, 10).forEach(activity => {

        let icon = "📄";
        let className = "pending";
        let message = "";

        // =========================
        // INSPECTION EVENTS
        // =========================
        if (activity.activity_type === "inspection") {

            switch (activity.event_type) {

                case "inspection_scheduled":
                    icon = "📅";
                    className = "inspection";
                    message = activity.message;
                    break;

                case "inspection_started":
                    icon = "🚧";
                    className = "review";
                    message = activity.message;
                    break;

                case "inspection_completed":
                    icon = "📝";
                    className = "review";
                    message = activity.message;
                    break;

                case "inspection_passed":
                    icon = "✅";
                    className = "approved";
                    message = activity.message;
                    break;

                case "inspection_failed":
                    icon = "❌";
                    className = "rejected";
                    message = activity.message;
                    break;

                case "reinspection_required":
                    icon = "🔄";
                    className = "inspection";
                    message = activity.message;
                    break;

                default:
                    icon = "📋";
                    className = "review";
                    message = activity.message || "Inspection activity updated.";
            }
        }

        // =========================
        // DOCUMENT REVIEW EVENTS
        // =========================
        else if (activity.activity_type === "document_review") {

            if (activity.new_status === "Approved") {

                icon = "✅";
                className = "approved";

            } else if (
                activity.new_status === "Rejected"
            ) {

                icon = "❌";
                className = "rejected";

            } else if (
                activity.new_status === "Resubmission"
            ) {

                icon = "🔄";
                className = "review";

            } else {

                icon = "🔎";
                className = "review";
            }

            message =
                activity.message ||
                "Document review updated.";
        }

        // =========================
        // PERMIT STATUS EVENTS
        // =========================
        else if (activity.activity_type === "permit_status") {

            icon = "📄";
            className = "pending";

            // USE DATABASE MESSAGE FIRST
            if (activity.message) {

                message = activity.message;

            } else {

                message = `
                    Permit updated to <strong>${activity.new_status}</strong>
                `;
            }
        }

        // =========================
        // PAYMENT EVENTS
        // =========================
        else if (activity.activity_type === "payment") {

            icon = "💳";
            className = "review";

            if (
                activity.new_status === "For Payment"
            ) {

                icon = "🧾";
                className = "inspection";

            } else if (
                activity.new_status ===
                "For Payment Verification"
            ) {

                icon = "💳";
                className = "review";

            } else if (
                activity.new_status ===
                "Approved"
            ) {

                icon = "✅";
                className = "approved";

            } else if (
                activity.new_status ===
                "Rejected"
            ) {

                icon = "❌";
                className = "rejected";
            }

            message =
                activity.message ||
                "Payment activity updated.";

            if (activity.remarks) {
                message += `
                    <br><span class="activity-remarks">
                        Remarks: ${escapeHtml(activity.remarks)}
                    </span>
                `;
            }
        }

        const item = document.createElement("div");

        item.className = "activity-item";

        item.innerHTML = `
            <div class="activity-icon ${className}">
                ${icon}
            </div>

            <div class="activity-content">

                <h4>${activity.project_title}</h4>

                <p class="activity-subtitle">
                    ${activity.permit_type}
                </p>

                <p>${message}</p>

                <div class="activity-time">
                    ${new Date(activity.created_at).toLocaleString("en-PH")}
                </div>

            </div>
        `;

        container.appendChild(item);
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadApplicantActivities() {

    try {

        const response = await fetch(
            "http://localhost:5000/api/inspections/applicant",
            {
                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const result = await response.json();

        console.log("ACTIVITIES:");
        console.log(result.activities);

        renderActivityLog(
            result.activities || []
        );

    } catch (error) {

        console.error(
            "Failed to load activities:",
            error
        );
    }
}

function openPermitModal(permitId) {

    existingDocuments = {};
    pendingDocuments = {};

    fetch(`http://localhost:5000/api/permits/${permitId}`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(result => {

        if (!result.success) return;

        const permit = result.permit;
        const documents = result.documents || [];

        const applicationDocs =
            documents.filter(doc => doc.category === "Application");

        const locationDocs =
            documents.filter(doc => doc.category === "Location");

        const requirementDocs =
            documents.filter(doc =>
                doc.category === "Requirement"
            );

        const hasSubmittedRequirements =
            requirementDocs.length > 0;

        window.currentRequirementDocs = requirementDocs;

        currentPermitId = permit.permit_id;

        document.getElementById("permitDetailsModal")
            .dataset
            .permitType = permit.permit_type;

        // GET REQUIREMENTS
        const permitData =
            permitRequirements[permit.permit_type];

        const hasNHADocuments =
            requirementDocs.some(doc =>
                permitData?.nha?.some(nhaReq =>
                    makeKey(nhaReq) === makeKey(doc.document_name)
                )
            );
        
        let requirements = [];

        if (Array.isArray(permitData)) {

            requirements = permitData;

        } else {

            // ONLY REGULAR REQUIREMENTS
            requirements = permitData?.regular || [];
        }

        const allRequirementsUploaded =
            requirements.every(req => {

                const reqKey = makeKey(req);

                return requirementDocs.some(doc =>
                    makeKey(doc.document_name) === reqKey
                );
            });

        // BUILD MODAL
        document.getElementById("permitDetailsBody").innerHTML = `

            <!-- PROGRESS -->
            <div class="modal-section">

                <h3>Progress Tracker</h3>

                ${buildProgressTracker(permit.status)}

            </div>

            <!-- APPLICATION INFO -->
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
                    
                    <div class="upload-documents uploaded-documents-section">
                        <div class="field">
                        <label>Application Form</label>
                        </div>
                        ${
                            applicationDocs.length > 0
                                ? applicationDocs.map(doc => `

                                <div class="document-card">

                                    <div class="document-header">

                                        <div class="document-info">

                                            <h4>${doc.document_name}</h4>

                                            <span class="document-status ${
                                                doc.status.toLowerCase().replace(/\s+/g, "-")
                                            }">
                                                ${doc.status}
                                            </span>

                                        </div>

                                        <div class="document-actions">

                                            <a
                                                href="http://localhost:5000/${doc.file_path}"
                                                target="_blank"
                                                class="view-btn"
                                            >
                                                View File
                                            </a>

                                        </div>

                                    </div>

                                    <div class="document-body">

                                        <div class="document-file">
                                            ${doc.file_name}
                                        </div>

                                        <div class="review-section">

                                            ${
                                                doc.remarks
                                                ? `
                                                    <small class="review-message">
                                                        ${doc.remarks}
                                                    </small>
                                                `
                                                : `
                                                    <small class="review-message">
                                                        No remarks
                                                    </small>
                                                `
                                            }

                                        </div>

                                    </div>

                                </div>

                            `).join("")
                            : `
                                <div class="document-body">

                                    <div class="document-file">
                                        No file uploaded
                                    </div>

                                    <div class="review-section">
                                        <small class="review-message">
                                            No remarks
                                        </small>
                                    </div>

                                </div>
                            `
                        }

                    </div>
                </div>
            </div>

            <div class="modal-section">    
                <div class="application-info">

                    <h3>Project Details</h3>
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
                                ${permit.estimated_cost}
                            </div>
                        </div>

                    </div>

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

                    <div class="form-row one">
                        <div class="field">
                            <label>Project Location</label>

                            <div class="static-value">
                                ${permit.project_location} <!-- to update -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="field">
                        <label>Locational Map</label>
                    </div>
                        ${
                            locationDocs.length > 0
                                ? locationDocs.map(doc => `

                                <div class="document-card">

                                    <div class="document-header">

                                        <div class="document-info">

                                            <h4>${doc.document_name}</h4>

                                            <span class="document-status ${
                                                doc.status.toLowerCase().replace(/\s+/g, "-")
                                            }">
                                                ${doc.status}
                                            </span>

                                        </div>

                                        <div class="document-actions">

                                            <a
                                                href="http://localhost:5000/${doc.file_path}"
                                                target="_blank"
                                                class="view-btn"
                                            >
                                                View File
                                            </a>

                                        </div>

                                    </div>

                                    <div class="document-body">

                                        <div class="document-file">
                                            ${doc.file_name}
                                        </div>

                                        <div class="review-section">

                                            ${
                                                doc.remarks
                                                ? `
                                                    <small class="review-message">
                                                        ${doc.remarks}
                                                    </small>
                                                `
                                                : `
                                                    <small class="review-message">
                                                        No remarks
                                                    </small>
                                                `
                                            }

                                        </div>

                                    </div>

                                </div>

                            `).join("")
                            : `
                                <div class="document-body">

                                    <div class="document-file">
                                        No file uploaded
                                    </div>

                                    <div class="review-section">
                                        <small class="review-message">
                                            No remarks
                                        </small>
                                    </div>

                                </div>
                            `
                        }
                    <br>
                    
                </div>  
            </div>

            <!-- REQUIRED DOCUMENTS -->
            <div class="modal-section">

                <h3>Required Documents</h3>

                <div class="upload-documents">

                    ${requirements.map(req => {

                        const key = makeKey(req);

                        // CHECK IF UPLOADED
                        const reqKey = makeKey(req);

                        const existingDoc = requirementDocs.find(doc => {
                            return makeKey(doc.document_name) === reqKey;
                        });

                        // store already uploaded docs in local state
                        if (existingDoc) {

                            existingDocuments[key] = {
                                existing: true,
                                fileName: existingDoc.file_name,
                                filePath: existingDoc.file_path,
                                documentName: existingDoc.document_name
                            };
                        }

                        return `
                        <div class="document-card" id="card-${key}">

                            <div class="document-header">

                                <div class="document-info">
                                    <h4>${req}</h4>

                                    ${
                                        existingDoc
                                        ? `
                                            <span class="document-status ${
                                                existingDoc.status.toLowerCase().replace(/\s+/g, "-")
                                            }">
                                                ${existingDoc.status}
                                            </span>
                                        `
                                        : ""
                                    }
                                </div>

                                <div class="document-actions" id="actions-${key}">

                                    ${
                                        existingDoc
                                        ? `
                                            <a
                                                href="http://localhost:5000/${existingDoc.file_path}"
                                                target="_blank"
                                                class="view-btn"
                                            >
                                                View File
                                            </a>
                                        `
                                        : `
                                            <label class="upload-btn">

                                                Upload

                                                <input
                                                    type="file"
                                                    hidden
                                                    id="${key}"
                                                    onchange="handleDocumentUpload(event, '${key}', ${permit.permit_id}, '${req}')"
                                                >

                                            </label>
                                        `
                                    }

                                </div>

                            </div>

                            <div class="document-body">

                                ${
                                    existingDoc
                                    ? `
                                        <div class="document-file">
                                            ${existingDoc.file_name}
                                        </div>

                                        <div class="review-section">
                                            <small class="review-message">
                                                ${existingDoc.remarks || "No remarks"}
                                            </small>
                                        </div>
                                    `
                                    : `
                                        <div class="document-file" id="file-${key}">
                                            No file uploaded
                                        </div>

                                        <div class="review-section" id="review-${key}">
                                            <small class="review-message">
                                                No remarks
                                            </small>
                                        </div>
                                    `
                                }

                            </div>

                        </div>
                        `;
                    }).join("")}

                    ${
                        !hasSubmittedRequirements &&
                        permit.permit_type === "Building Permit"
                        ? `
                            <div class="form-group">

                                <label class="form-label">
                                    Is this property under National Housing Authority?
                                </label><br>

                                <div class="radio-row">

                                    <label>
                                        <input
                                            type="radio"
                                            name="isNHA"
                                            value="yes"
                                            onchange="toggleNHARequirements(true, '${permit.permit_type}')"
                                        >
                                        Yes
                                    </label>

                                    <label>
                                        <input
                                            type="radio"
                                            name="isNHA"
                                            value="no"
                                            checked
                                            onchange="toggleNHARequirements(false, '${permit.permit_type}')"
                                        >
                                        No
                                    </label>

                                </div>

                            </div>
                        `
                        : ""
                    }

                    <!-- NHA REQUIREMENTS HERE -->
                    <div id="nhaRequirementsContainer"></div>

                    ${
                        !allRequirementsUploaded
                        ? `
                            <button
                                class="primary-btn"
                                id="uploadDocsBtn"
                                onclick="uploadDynamicDocuments(${permit.permit_id}, '${permit.permit_type}')"
                                disabled
                                style="opacity:0.5; cursor:not-allowed;"
                            >
                                Upload Documents
                            </button>
                        `
                        : ""
                    }
                </div>

            </div>
        `;

        // SHOW MODAL
        const modal =
            document.getElementById("permitDetailsModal");

        if (
            permit.permit_type === "Building Permit" &&
            hasNHADocuments
        ) {
            toggleNHARequirements(true, permit.permit_type);
        }

        modal.classList.add("show");

        // RENDER REGULAR DOCS
        setTimeout(() => {

            requirements.forEach(req => {

                const key = req
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "_");

                renderPermitDocumentCard(key, req);
            });

            validatePermitDocuments();
        }, 0);

    })
    .catch(error => {

        console.error("Fetch permit error:", error);

    });
}

function openUnderReviewModal(permitId) {

    fetch(`http://localhost:5000/api/permits/${permitId}`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }
    })
    .then(res => res.json())
    .then(result => {

        if (!result.success) return;

        const permit = result.permit;
        const documents = result.documents || [];

        const applicationDocs =
            documents.filter(doc => doc.category === "Application");

        const locationDocs =
            documents.filter(doc => doc.category === "Location");

        const requirementDocs =
            documents.filter(doc => doc.category === "Requirement");

        const permitType = permit.permit_type;

        const permitData =
            permitRequirements[permitType];

        let requirementsTemplate = [];

        // ZONING / FSEC
        if (Array.isArray(permitData)) {

            requirementsTemplate = permitData;

        } else {

            // REGULAR REQUIREMENTS
            requirementsTemplate =
                [...(permitData?.regular || [])];

            // CHECK IF USER HAS NHA DOCUMENTS
            const hasNHADocuments =
                requirementDocs.some(doc =>
                    permitData?.nha?.some(nhaReq =>
                        makeKey(nhaReq) ===
                        makeKey(doc.document_name)
                    )
                );

            // APPEND NHA REQUIREMENTS
            if (hasNHADocuments) {

                requirementsTemplate.push(
                    ...(permitData?.nha || [])
                );
            }
        }

        let orderedRequirementDocs = [];
        let orderedNHADocs = [];

        if (Array.isArray(permitData)) {

            orderedRequirementDocs = requirementsTemplate
                .map(req =>
                    requirementDocs.find(doc =>
                        makeKey(doc.document_name) === makeKey(req)
                    )
                )
                .filter(doc => doc);

        } else {

            // REGULAR DOCS
            orderedRequirementDocs =
                (permitData?.regular || [])
                    .map(req =>
                        requirementDocs.find(doc =>
                            makeKey(doc.document_name) === makeKey(req)
                        )
                    )
                    .filter(doc => doc);

            // NHA DOCS
            orderedNHADocs =
                (permitData?.nha || [])
                    .map(req =>
                        requirementDocs.find(doc =>
                            makeKey(doc.document_name) === makeKey(req)
                        )
                    )
                    .filter(doc => doc);
        }

        const hasRejectedDocuments =
            [...applicationDocs, ...locationDocs, ...requirementDocs]
                .some(doc => doc.status === "Rejected");

        document.getElementById("permitDetailsBody").innerHTML = `

            <!-- PROGRESS -->
            <div class="modal-section">

                <h3>Progress Tracker</h3>

                ${buildProgressTracker(permit.status)}

            </div>

            <!-- APPLICATION INFO -->
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

                    <div class="upload-documents uploaded-documents-section">

                        <div class="field">
                            <label>Application Form</label>
                        </div>

                        ${buildReviewDocuments(applicationDocs, true)}

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

                            <div class="static-value">
                                ${permit.project_title}
                            </div>
                        </div>

                        <div class="field">
                            <label>Estimated Cost</label>

                            <div class="static-value">
                                ${permit.estimated_cost}
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


                    <div class="form-row one">

                        <div class="field">
                            <label>Project Location</label>

                            <div class="static-value">
                                ${permit.project_location}
                            </div>
                        </div>

                    </div>

                    <div class="field">
                        <label>Locational Map</label>
                    </div>

                    <div class="upload-documents">

                        ${buildReviewDocuments(locationDocs, true)}

                    </div>

                </div>

            </div>

            <!-- REQUIRED DOCUMENTS -->
            <div class="modal-section">

                <h3>Required Documents</h3>

                <div class="upload-documents">

                    ${buildReviewDocuments(orderedRequirementDocs, true)}

                    ${
                        orderedNHADocs.length > 0
                        ? `
                            <div class="requirement-separator">
                                <h3>
                                    National Housing Authority Requirements
                                </h3>
                            </div>

                            ${buildReviewDocuments(orderedNHADocs, true)}
                        `
                        : ""
                    }

                    ${
                        hasRejectedDocuments
                        ? `
                            <button
                                class="primary-btn"
                                id="reuploadDocsBtn"
                                onclick="submitReuploadedDocuments(${permit.permit_id})"
                                disabled
                                style="opacity:0.5; cursor:not-allowed;"
                            >
                                Resubmit Documents
                            </button>
                        `
                        : ""
                    }

                </div>

            </div>
        `;

        document
            .getElementById("permitDetailsModal")
            .classList.add("show");

    })
    .catch(error => {
        console.error(error);
    });
}

function buildReviewDocuments(documents, allowResubmit = false) {

    documents = [...documents];

    if (!documents.length) {
        return `
            <div class="document-body">
                <div class="document-file">
                    No file uploaded
                </div>

                <div class="review-section">
                    <small class="review-message">
                        No remarks
                    </small>
                </div>
            </div>
        `;
    }

    return documents.map(doc => {

        const isRejected =
            doc.status === "Rejected";

        return `

            <div class="document-card review-document-card ${
                isRejected ? "rejected-card" : ""
            }">
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
                            href="http://localhost:5000/${doc.file_path}"
                            target="_blank"
                            class="view-btn"
                        >
                            View File
                        </a>

                        ${
                            allowResubmit && isRejected
                            ? `
                                <label class="reupload-btn">

                                    Re-upload

                                    <input
                                        type="file"
                                        hidden
                                        onchange="resubmitRejectedDocument(
                                            event,
                                            ${doc.document_id},
                                            '${doc.document_key}',
                                            ${doc.permit_id},
                                            '${doc.document_name}'
                                        )"
                                    >

                                </label>
                            `
                            : ""
                        }

                    </div>

                </div>

                <div class="document-body">

                    <div class="document-file">
                        📄 ${doc.file_name}
                    </div>
                    
                    ${
                        doc.remarks
                        ? `
                            <div class="review-section">

                                <small class="review-message">
                                    Remarks:
                                </small>

                                <div class="remarks-display">
                                    ${doc.remarks}
                                </div>

                            </div>
                        `
                        : ""
                    }

                </div>

            </div>
        `;

    }).join("");
}

function validateReuploadedDocuments() {

    const rejectedCards =
        document.querySelectorAll(".rejected-card");

    let allReady = true;

    rejectedCards.forEach(card => {

        const reuploadInput =
            card.querySelector(
                'input[type="file"]'
            );

        // GET DOCUMENT KEY
        const onchangeAttr =
            reuploadInput?.getAttribute("onchange") || "";

        const match =
            onchangeAttr.match(
                /'([^']+)'/
            );

        const documentKey =
            match ? match[1] : null;

        // CHECK IF FILE EXISTS
        if (
            documentKey &&
            !rejectedDocuments[documentKey]
        ) {
            allReady = false;
        }
    });

    const btn =
        document.getElementById("reuploadDocsBtn");

    if (btn) {

        btn.disabled = !allReady;

        btn.style.opacity =
            allReady ? "1" : "0.5";

        btn.style.cursor =
            allReady ? "pointer" : "not-allowed";
    }
}

function resubmitRejectedDocument(
    event,
    documentId,
    documentKey,
    permitId,
    documentName
) {

    const file = event.target.files[0];

    if (!file) return;

    const confirmed = confirm(
        `Are you sure you want to replace the existing ${documentName}?`
    );

    if (!confirmed) {

        event.target.value = "";

        return;
    }

    rejectedDocuments[documentKey] = {
        file,
        permitId,
        documentName
    };

    const card =
        event.target.closest(".review-document-card");

    if (card) {

        // UPDATE FILE DISPLAY
        const fileContainer =
            card.querySelector(".document-file");

        if (fileContainer) {

            fileContainer.innerHTML = `
                📄 ${file.name}
                <span class="file-size">
                    (${(file.size / 1024).toFixed(1)} KB)
                </span>
            `;
        }

        // UPDATE STATUS
        const status =
            card.querySelector(".document-status");

        if (status) {

            status.textContent = "Resubmission";

            status.className =
                "document-status resubmission";
        }

        // REPLACE VIEW BUTTON
        const actions =
            card.querySelector(".document-actions");

        if (actions) {

            const localFileURL =
                URL.createObjectURL(file);

            actions.innerHTML = `

                <a
                    href="${localFileURL}"
                    target="_blank"
                    class="view-btn"
                >
                    View File
                </a>

                <label class="reupload-btn">

                    Re-upload

                    <input
                        type="file"
                        hidden
                        onchange="resubmitRejectedDocument(
                            event,
                            ${documentId},
                            '${documentKey}',
                            ${permitId},
                            '${documentName}'
                        )"
                    >

                </label>
            `;
        }
    }

    validateReuploadedDocuments();
}

async function submitReuploadedDocuments(permitId) {

    const keys = Object.keys(rejectedDocuments);

    if (keys.length === 0) {

        alert("Please select rejected documents first.");

        return;
    }

    const confirmUpload = confirm(
        "Upload all re-submitted documents?"
    );

    if (!confirmUpload) return;

    try {

        for (const [key, data] of Object.entries(rejectedDocuments)) {

            const formData = new FormData();

            formData.append("file", data.file);

            formData.append(
                "document_key",
                key
            );

            formData.append(
                "document_name",
                data.documentName
            );

            const response = await fetch(
                `http://localhost:5000/api/permits/upload-document/${permitId}`,
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${localStorage.getItem("token")}`
                    },
                    body: formData
                }
            );

            const result = await response.json();

            if (!result.success) {

                alert(
                    `Failed to upload ${data.documentName}`
                );

                return;
            }
        }

        alert("Documents re-uploaded successfully");

        rejectedDocuments = {};

        openUnderReviewModal(permitId);

    } catch (error) {

        console.error(error);

        alert("Upload failed");
    }
}

function formatDateDisplay(dateString) {

    if (!dateString) return "—";

    return new Date(dateString).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

function formatTime(timeString) {

    if (!timeString) return "—";

    // Handles HH:mm:ss format
    const [hours, minutes] = timeString.split(":");

    const date = new Date();

    date.setHours(hours);
    date.setMinutes(minutes);

    return date.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function openInspectionStatusModal(permitId) {

    fetch(
        `http://localhost:5000/api/permits/${permitId}/inspection`,
        {
            headers: {
                Authorization:
                    `Bearer ${localStorage.getItem("token")}`
            }
        }
    )
    .then(res => res.json())
    .then(result => {

        if (!result.success) return;

        const permit =
            result.permit;

        const inspection =
            result.inspection;

        let inspectionType =
            inspection?.inspection_type || "Initial";

        let findings =
            inspection?.findings || "No findings yet";

        let recommendations =
            inspection?.recommendations || "No recommendations yet";

        let remarks =
            inspection?.remarks || "No remarks";

        const inspectionProgressIndex = {
            "Assigned": 0,
            "Scheduled": 1,
            "In Progress": 2,
            "Inspected": 3,
            "Rescheduled": 4,
            "For Reinspection": 4,
            "Deferred": 5,
            "Completed": 6
        };

        const currentInspectionStep =
            inspectionProgressIndex[inspection?.status] ?? 0;

        // SHOW ONLY FROM INSPECTED AND ABOVE
        const showInspectionSchedule =
            currentInspectionStep >= 3;

        const showInspectionResults =
            currentInspectionStep >= 3;

        document.getElementById(
            "inspectionStatusBody"
        ).innerHTML = `

            <!-- PROGRESS -->
            <div class="modal-section">

                <h3>Progress Tracker</h3>

                ${buildProgressTracker(permit.status)}

            </div>

            <!-- APPLICATION -->
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

                    <div class="form-row one">

                        <div class="field">
                            <label>Project Title</label>

                            <div class="static-value">
                                ${permit.project_title}
                            </div>
                        </div>

                    </div>

                    <div class="form-row one">
                        <div class="field">
                            <label>Project Location</label>

                            <div class="static-value">
                                ${permit.project_location} <!-- to update -->
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            <!-- INSPECTION PROGRESS TRACKER -->
            <div class="modal-section">
                <h3>Inspection Progress</h3>

                ${buildInspectionProgressTracker(
                    inspection?.status
                )}
            </div>

            <!-- INSPECTION DETAILS -->
            <div class="modal-section">

                <h3>Inspection Details</h3>

                <div class="application-info">

                    <div class="form-row two">

                        <div class="field">
                            <label>Inspection Date</label>

                            <div class="static-value">
                                ${
                                    inspection?.schedule_date
                                    ? formatDateDisplay(
                                        inspection.schedule_date
                                    )
                                    : "—"
                                }
                            </div>
                        </div>

                        <div class="field">
                            <label>Inspection Time</label>

                            <div class="static-value">
                                ${
                                    inspection?.schedule_time
                                    ? formatTime(
                                        inspection.schedule_time
                                    )
                                    : "—"
                                }
                            </div>
                        </div>

                    </div>

                    ${
                        showInspectionSchedule
                        ? `
                            <div class="form-row two">

                                <div class="field">
                                    <label>Inspection Type</label>

                                    <div class="static-value">
                                        ${inspectionType}
                                    </div>
                                </div>

                                <div class="field">
                                    <label>Inspection Status</label>

                                    <div class="static-value">
                                        ${inspection?.status || "—"}
                                    </div>
                                </div>

                            </div>
                        `
                        : ""
                    }

                </div>

            </div>

            ${
                showInspectionResults
                ? `
                    <div class="modal-section inspection-results">

                        <!-- FINDINGS -->
                        <h3>Inspection Findings</h3>
                        <textarea class="remarks-textarea" readonly>${findings}</textarea>

                        <!-- RECOMMENDATIONS -->
                        <br><br><h3>Recommendations</h3>
                        <textarea class="remarks-textarea" readonly>${recommendations}</textarea>

                        <!-- REMARKS -->
                        <br><br><h3>Remarks</h3>
                        <textarea class="remarks-textarea" readonly>${remarks}</textarea>

                    </div>
                `
                : ""
            }

            ${
                inspection?.reinspection_date
                ? `
                    <!-- REINSPECTION -->
                    <div class="modal-section">

                        <h3>Reinspection Schedule</h3>

                        <div class="form-row two">

                            <div class="field">
                                <label>Date</label>

                                <div class="static-value">
                                    ${formatDateDisplay(
                                        inspection.reinspection_date
                                    )}
                                </div>
                            </div>

                            <div class="field">
                                <label>Time</label>

                                <div class="static-value">
                                    ${formatTime(
                                        inspection.reinspection_time
                                    )}
                                </div>
                            </div>

                        </div>

                    </div>
                `
                : ""
            }
        `;

        document.getElementById(
            "inspectionStatusModal"
        ).classList.add("show");

    })
    .catch(error => {
        console.error(error);
    });
}

function closeInspectionStatusModal() {

    document
        .getElementById("inspectionStatusModal")
        .classList.remove("show");

    document
        .getElementById("inspectionStatusBody")
        .innerHTML = "";
}

function buildProgressTracker(status) {

    // STEP LABELS
    const steps = [
        "Application",
        "Uploading Documents",
        "Under Review",
        "Inspection",
        "Payment",
        "Clearance",
    ];

    // DATABASE STATUS -> STEP INDEX
    const STATUS_INDEX = {

        // STEP 1
        "Application": 0,

        // STEP 2
        "Pending": 1,
        "Uploaded": 1,

        // STEP 3
        "Under Review": 2,
        "For Revision": 2,
        "Resubmission": 2,

        // STEP 4
        "For Inspection": 3,
        "For Visitation": 3,
        "For Reinspection": 3,

        // STEP 5
        "For Assessment": 4,
        "For Payment": 4,
        "For Payment Verification": 4,

        // STEP 6
        "For Clearance": 5,

        // OPTIONAL
        "Rejected": 3
    };

    // CURRENT ACTIVE STEP
    const activeIndex = STATUS_INDEX[status] ?? 0;

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

                    ${i < steps.length - 1
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

function buildInspectionProgressTracker(status, inspectionType) {

    const cleanStatus = (status || "")
        .trim()
        .replace(/\s+/g, " ");

    const steps = [
        "Assigned",
        "Scheduled",
        "In Progress",
        "Inspected"
    ];

    // SHOW STEP 5 ONLY FOR REINSPECTION FLOW
    const showReinspectionStep =
        inspectionType === "Reinspection" ||
        cleanStatus === "Rescheduled" ||
        cleanStatus === "For Reinspection" ||
        cleanStatus === "Deferred" ||
        cleanStatus === "Completed";

    if (showReinspectionStep) {
        steps.push("Reinspection");
    }

    // SHOW STEP 6 ONLY FOR FINAL FLOW
    const showFinalStep =
        inspectionType === "Final" ||
        cleanStatus === "Deferred" ||
        cleanStatus === "Completed";

    if (showFinalStep) {
        steps.push("Final Reinspection");
    }

    // =========================
    // STATUS -> ACTIVE STEP
    // =========================
    let activeIndex = 0;

    switch (cleanStatus) {

        case "Assigned":
            activeIndex = 0;
            break;

        case "Scheduled":
            activeIndex = 1;
            break;

        case "In Progress":
            activeIndex = 2;
            break;

        case "Inspected":
            activeIndex = 3;
            break;

        // Step 5 orange
        case "Rescheduled":
        case "For Reinspection":
            activeIndex = 4;
            break;

        // Step 6 orange
        case "Deferred":
            activeIndex = 5;
            break;

        // ALL completed
        case "Completed":
            activeIndex = 6;
            break;

        default:
            activeIndex = 0;
    }

    return `
        <div class="inspection-tracker">
            ${steps.map((step, i) => {

                const isCompleted = i < activeIndex;
                const isActive = i === activeIndex;

                return `
                    <div class="inspection-step ${
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
                                <div class="inspection-line ${
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

function renderPermitDocumentCard(key, label) {

    const data =
        pendingDocuments[key] ||
        existingDocuments[key];

    const card = document.getElementById(`card-${key}`);
    if (!card) return;

    const fileContainer =
        card.querySelector(".document-file");

    const review =
        card.querySelector(".review-section");

    const actions =
        document.getElementById(`actions-${key}`);

    // EMPTY STATE
    if (!data) {

        fileContainer.innerHTML = "No file uploaded";

        if (review) {
            review.innerHTML = `
                <small class="review-message">
                    No remarks
                </small>
            `;
        }

        actions.innerHTML = `
            <label class="upload-btn">
                Upload
                <input
                    type="file"
                    hidden
                    id="${key}"
                    onchange="handleDocumentUpload(event, '${key}', currentPermitId, '${label}')"
                >
            </label>
        `;

        return;
    }

    // EXISTING DOCUMENT FROM DB
    if (data.existing) {

        fileContainer.innerHTML = `
            📄 ${data.fileName}
        `;

        if (review) {
            review.innerHTML = `
                <small class="review-message">
                    Waiting for approval
                </small>
            `;
        }

        actions.innerHTML = `
            <a
                href="http://localhost:5000/${data.filePath}"
                target="_blank"
                class="view-btn"
            >
                View File
            </a>
        `;

        return;
    }

    // NEWLY UPLOADED LOCAL FILE
    const file = data.file;

    fileContainer.innerHTML = `
        📄 ${file.name}
        <span class="file-size">
            (${(file.size / 1024).toFixed(1)} KB)
        </span>
    `;

    if (review) {
        review.innerHTML = `
            <small class="review-message">
                Ready for submission
            </small>
        `;
    }

    actions.innerHTML = `
        <button class="view-btn"
            onclick="viewDocument('${key}')">
            View
        </button>

        <button class="remove-btn"
            onclick="removeDocument('${key}')">
            Remove
        </button>
    `;
}

function toggleNHARequirements(show, permitType) {

    const container =
        document.getElementById("nhaRequirementsContainer");

    if (!container) return;

    container.innerHTML = "";

    const nhaRequirements =
        permitRequirements[permitType]?.nha || [];

    if (!show) {
        nhaRequirements.forEach(req => {

            const key = makeKey(req);

            delete pendingDocuments[key];
        });
        setTimeout(validatePermitDocuments, 0);
        return;
    }

    container.innerHTML = `

        <div class="requirement-separator">
            <h3>
                National Housing Authority Requirements
            </h3>
        </div>

        ${nhaRequirements.map(req => {

            const key = makeKey(req);

            return `
                <div class="document-card nha-document-card" id="card-${key}">

                    <div class="document-header">

                        <div class="document-info">
                            <h4>${req}</h4>

                        </div>

                        <div
                            class="document-actions"
                            id="actions-${key}"
                        >

                            <label class="upload-btn">

                                Upload

                                <input
                                    type="file"
                                    hidden
                                    onchange="handleDocumentUpload(event, '${key}', currentPermitId, '${req}')"
                                >

                            </label>

                        </div>

                    </div>

                    <div class="document-body">

                        <div class="document-file" id="file-${key}">
                            No file uploaded
                        </div>

                        <div class="review-section" id="review-${key}">
                            <small class="review-message">
                                No remarks
                            </small>
                        </div>

                    </div>

                </div>
            `;

        }).join("")}
    `;

    // render uploaded state if already uploaded
    nhaRequirements.forEach(req => {

        const key = makeKey(req);

        // CHECK EXISTING DOCUMENT FROM DB
        const existingDoc =
            window.currentRequirementDocs?.find(doc =>
                makeKey(doc.document_name) === key
            );

        // STORE EXISTING DOC
        if (existingDoc) {

            existingDocuments[key] = {
                existing: true,
                fileName: existingDoc.file_name,
                filePath: existingDoc.file_path,
                documentName: existingDoc.document_name
            };
        }

        renderPermitDocumentCard(key, req);

    });

    validatePermitDocuments();

    setTimeout(() => {
        validatePermitDocuments();
    }, 0);
}

function buildPaymentProgressTracker(status) {

    const steps = [
        "Assessment",
        "Payment Submission",
        "Verification"
    ];

    const STATUS_INDEX = {

        // assessment created
        "Pending": 1,

        // applicant submitted payment
        "For Verification": 2,
        "Rejected": 1,

        // admin verified payment
        "Verified": 2
    };

    const activeIndex =
        STATUS_INDEX[status] ?? 0;

    return `
        <div class="progress-tracker">

            ${steps.map((step, i) => {

                const isCompleted =
                    i < activeIndex;

                const isActive =
                    i === activeIndex;

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

function buildApplicantPaymentModal(payment) {

    payment = payment || {
        permit_id: null,
        control_number: "-",
        permit_type: "-",
        status: "For Payment",
        payment_status: "Pending",
        application_fee: 0,
        inspection_fee: 0,
        other_fee: 0,
        total_amount: 0
    };

    const paymentStatus = payment.payment_status || "Pending";

    const hasAssessment =
    Number(payment.total_amount || 0) > 0;

    const alreadySubmitted = [
        "For Verification",
        "Verified",
        "Rejected"
    ].includes(paymentStatus)
    || payment.status === "For Payment Verification";

    const isResubmission = paymentStatus === "Resubmission";

    return `
        <div class="modal-header">
            <h2>Permit Payment</h2>
            <p id="permitModalSubtitle">Payment Tracking & Assessment Details</p>
            <span class="close" onclick="closeApplicantPaymentModal()">&times;</span>
        </div>

        <div class="review-form">

            <div class="modal-section">
                <h3>Progress Tracker</h3>
                ${buildProgressTracker(payment.status)}
            </div>

            <div class="modal-section">
                <h3>Application Details</h3>
                <div class="application-info">
                    <div class="form-row two">
                        <div class="field">
                            <label>Control Number</label>
                            <div class="static-value">${payment.control_number || "-"}</div>
                        </div>
                        <div class="field">
                            <label>Permit Type</label>
                            <div class="static-value">${payment.permit_type || "-"}</div>
                        </div>
                    </div>
                </div>
            </div>

            ${hasAssessment ? `
                <div class="modal-section">
                    <h3>Payment Progress</h3>
                    ${buildPaymentProgressTracker(paymentStatus)}
                </div>
            ` : ""}

            ${hasAssessment ? `
                <!-- SECTION: FEE BREAKDOWN -->
                <div class="modal-section">
                    <h3>Fee Breakdown</h3>
                    <div class="fee-breakdown-grid">

                        <div class="fee-row">
                            <span class="fee-label">Application Fee</span>
                            <span class="fee-amount">₱${Number(payment.application_fee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div class="fee-row">
                            <span class="fee-label">Inspection Fee</span>
                            <span class="fee-amount">₱${Number(payment.inspection_fee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div class="fee-row">
                            <span class="fee-label">Other Fee</span>
                            <span class="fee-amount">₱${Number(payment.other_fee || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div class="fee-row">
                            <span class="fee-label">Total Amount</span>
                            <span class="fee-amount">₱${Number(payment.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>

                    </div>
                </div>
            ` : ""}

            ${hasAssessment ? (
                (alreadySubmitted || payment.status === "For Payment Verification") ? `
                <div class="modal-section payment-section">

                    <h3>Submitted Payment</h3>

                    <div class="payment-field">
                        <label>Payment Method</label>

                        <div class="static-value">
                            ${payment.payment_method || "-"}
                        </div>
                    </div>

                    <div class="payment-field">

                        <label>Receipt</label>

                        <div class="document-card">

                            <div class="document-header">

                                <div class="document-info">
                                    <h4>Proof of Payment</h4>
                                </div>

                                <div class="document-actions">

                                    ${payment.receipt_path ? `
                                        <a
                                            href="http://localhost:5000${payment.receipt_path}"
                                            target="_blank"
                                            class="view-btn"
                                        >
                                            View
                                        </a>
                                    ` : `
                                        <span class="no-file">
                                            No File
                                        </span>
                                    `}
                                </div>

                            </div>

                            <div class="document-body">

                                <div class="document-file">

                                    ${payment.receipt_path
                                        ? payment.receipt_path.split("/").pop()
                                        : "No file uploaded"
                                    }

                                </div>

                            </div>

                        </div>

                    </div>

                    <div class="payment-field">

                        <label>Reference Number</label>

                        <div class="static-value">
                            ${payment.reference_number || "-"}
                        </div>

                    </div>

                    ${payment.remarks ? `
                        <div class="payment-field">

                            <label>Remarks</label>

                            <div class="static-value">
                                ${payment.remarks}
                            </div>

                        </div>
                    ` : ""}

                </div>
            ` : `
                <div class="modal-section payment-section">
                    <h3>${isResubmission ? "Resubmit Payment" : "Submit Payment"}</h3>

                    ${isResubmission ? `
                        <div class="review-section">
                            <small class="review-message">
                                Remarks:
                            </small>
                            <div class="remarks-display">
                                ${payment.remarks || "No remarks provided."}
                            </div>
                        </div>
                    ` : ""}

                    <div class="payment-field">
                        <label>Payment Method</label>
                        <select 
                            id="paymentMethod" 
                            onchange="
                                toggleReferenceNumberField();
                                validatePaymentSubmission();
                            "
                        >
                            <option value="">Select Payment Method</option>
                            <option value="Gcash">GCash</option>
                            <option value="PayMaya">PayMaya</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                    </div>

                    <div class="payment-field">
                        <label>Receipt</label>
                        <div class="document-card" id="card-paymentProof">

                            <div class="document-header">
                                <div class="document-info">
                                    <h4>Proof of Payment</h4>
                                </div>
                                <div class="document-actions" id="actions-paymentProof">
                                    <label class="upload-btn">
                                        Upload
                                        <input
                                            type="file"
                                            hidden
                                            id="paymentProof"
                                            accept="image/*,.pdf"
                                            onchange="handlePaymentProofUpload(event)"
                                        >
                                    </label>
                                </div>
                            </div>

                            <div class="document-body">
                                <div class="document-file" id="file-paymentProof">
                                    No file uploaded
                                </div>
                            </div>

                        </div>
                    </div>
                    
                    <div 
                        class="payment-field" 
                        id="referenceNumberField"
                        style="display: none;"
                    >
                        <label>Reference Number</label><br><br>
                        <input 
                            type="text" 
                            id="referenceNumber" 
                            placeholder="Enter reference number"
                            oninput="validatePaymentSubmission()"
                        />
                    </div>

                </div>

                <button 
                    id="submitPaymentBtn"
                    class="submit-payment-btn"
                    disabled
                    onclick="submitApplicantPayment(${payment.permit_id})"
                >
                    Submit Payment
                </button>
            `
            ) : `
                <div class="modal-section">
                    <div class="empty-state">
                        Waiting for assessment and fee breakdown.
                    </div>
                </div>
            `}

        </div>
    `;
}

async function submitApplicantPayment(permitId) {

    const payment_method =
        document.getElementById(
            "paymentMethod"
        ).value;

    const reference_number =
        document.getElementById(
            "referenceNumber"
        ).value.trim();

    const proof = uploadedPaymentProofFile;

    if (!payment_method) {

        alert("Select payment method");
        return;
    }

    if (!reference_number) {

        alert("Enter reference number");
        return;
    }

    if (!proof) {

        alert("Upload proof of payment");
        return;
    }

    const confirmed = confirm(
        "Submit payment now?"
    );

    if (!confirmed) return;

    try {

        const formData = new FormData();

        formData.append(
            "payment_method",
            payment_method
        );

        formData.append(
            "reference_number",
            reference_number
        );

        formData.append(
            "proof",
            proof
        );

        const response = await fetch(
            `http://localhost:5000/api/payments/submit/${permitId}`,
            {
                method: "POST",

                headers: {
                    Authorization:
                        `Bearer ${localStorage.getItem("token")}`
                },

                body: formData
            }
        );

        const result =
            await response.json();

        if (!result.success) {

            alert(result.message);
            return;
        }

        alert(
            "Payment submitted successfully"
        );

        closePaymentModal();

        loadMyPermits();

    } catch (error) {

        console.error(error);

        alert("Failed to submit payment");
    }
}

async function openApplicantPaymentModal(permitId) {
    try {
        const response = await fetch(
            `http://localhost:5000/api/payments/${permitId}`,
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            }
        );

        const result = await response.json();

        if (!result.success) {
            alert(result.message || "Payment not found");
            return;
        }

        // Merge permit + payment, with payment_status fallback
        const payment = {
            ...result.permit,
            ...(result.payment || {}),
            permit_id: result.permit.permit_id,
            control_number: result.permit.control_number,
            permit_type: result.permit.permit_type,
            status: result.permit.status,
            payment_status: result.payment?.payment_status || "Pending"
        };

        document.getElementById("paymentModalBody").innerHTML =
            buildApplicantPaymentModal(payment);

        document.getElementById("paymentModal").classList.add("show");

    } catch (error) {
        console.error(error);
        alert("Failed to load payment");
    }
}

function closeApplicantPaymentModal() {
    document.getElementById("paymentModal").classList.remove("show");
    document.getElementById("paymentModalBody").innerHTML = "";
}

function closePaymentModal() {

    document
        .getElementById("paymentModal")
        .classList.remove("show");

    document
        .getElementById("paymentModalBody")
        .innerHTML = "";
}

function handlePaymentProofUpload(event) {

    const file = event.target.files[0];

    if (!file) return;

    // STORE FILE GLOBALLY
    uploadedPaymentProofFile = file;

    uploadedPaymentProofURL =
        URL.createObjectURL(file);

    const fileContainer =
        document.getElementById("file-paymentProof");

    const actions =
        document.getElementById("actions-paymentProof");

    // UPDATE FILE DISPLAY
    fileContainer.innerHTML = `
        📄 ${file.name}
        <span class="file-size">
            (${(file.size / 1024).toFixed(1)} KB)
        </span>
    `;

    // REPLACE BUTTONS
    actions.innerHTML = `
        <button
            type="button"
            class="view-btn"
            onclick="viewPaymentProof()"
        >
            View
        </button>

        <button
            type="button"
            class="remove-btn"
            onclick="removePaymentProof()"
        >
            Remove
        </button>
    `;

    validatePaymentSubmission();
}
function toggleReferenceNumberField() {

    const paymentMethod =
        document.getElementById("paymentMethod").value;

    const referenceField =
        document.getElementById("referenceNumberField");

    if (paymentMethod) {

        referenceField.style.display = "block";

    } else {

        referenceField.style.display = "none";

        document.getElementById("referenceNumber").value = "";
    }
}

function validatePaymentSubmission() {

    const paymentMethod =
        document.getElementById("paymentMethod")?.value || "";

    const referenceNumber =
        document.getElementById("referenceNumber")?.value.trim() || "";

    const submitBtn =
        document.getElementById("submitPaymentBtn");

    const hasProof =
        !!uploadedPaymentProofFile;

    const isValid =
        paymentMethod &&
        referenceNumber &&
        hasProof;

    if (submitBtn) {

        submitBtn.disabled = !isValid;
    }
}

function viewPaymentProof() {

    if (!uploadedPaymentProofURL) {

        alert("No file uploaded");
        return;
    }

    window.open(
        uploadedPaymentProofURL,
        "_blank"
    );
}

function removePaymentProof() {

    uploadedPaymentProofFile = null;
    uploadedPaymentProofURL = null;

    document.getElementById(
        "file-paymentProof"
    ).innerHTML = "No file uploaded";

    document.getElementById(
        "actions-paymentProof"
    ).innerHTML = `
        <label class="upload-btn">
            Upload
            <input
                type="file"
                hidden
                id="paymentProof"
                accept="image/*,.pdf"
                onchange="handlePaymentProofUpload(event)"
            >
        </label>
    `;

    validatePaymentSubmission();
}

function handleDocumentUpload(event, key, permitId, documentName) {

    const file = event.target.files[0];

    if (!file) return;

    // STORE ONLY LOCALLY
    pendingDocuments[key] = {
        file,
        permitId,
        documentName
    };

    // UPDATE UI
    renderPermitDocumentCard(key, documentName);

    validatePermitDocuments();
}

async function uploadDynamicDocuments(permitId, permitType) {

    // CONFIRM
    const confirmUpload = confirm(
        "Are you sure you want to upload all documents?"
    );

    if (!confirmUpload) return;

    try {

        // LOOP ALL FILES
        for (const [key, data] of Object.entries(pendingDocuments)) {

            const formData = new FormData();

            formData.append("file", data.file);

            formData.append("document_key", key);

            formData.append("document_name", data.documentName);

            const response = await fetch(
                `http://localhost:5000/api/permits/upload-document/${permitId}`,
                {
                    method: "POST",
                    headers: {
                        Authorization:
                            `Bearer ${localStorage.getItem("token")}`
                    },
                    body: formData
                }
            );

            const result = await response.json();

            if (!result.success) {

                alert(`Failed to upload: ${data.documentName}`);

                return;
            }
        }

        alert("All documents uploaded successfully!");

        // OPTIONAL:
        // clear local cache after successful upload
        Object.keys(pendingDocuments).forEach(key => {
            delete pendingDocuments[key];
        });

        // reload permit modal
        openPermitModal(permitId);

    } catch (error) {

        console.error(error);

        alert("Upload failed");
    }
}

function validatePermitDocuments() {

    const permitType =
        document.getElementById("permitDetailsModal")
            ?.dataset
            ?.permitType;

    if (!permitType) return;

    let isValid = true;

    // GET PERMIT DATA
    const permitData =
        permitRequirements[permitType];

    let regularRequirements = [];
    let nhaRequirements = [];

    // ARRAY TYPE
    // Zoning / Fire Safety
    if (Array.isArray(permitData)) {

        regularRequirements = permitData;

    } else {

        // OBJECT TYPE
        // Building Permit
        regularRequirements =
            permitData?.regular || [];

        nhaRequirements =
            permitData?.nha || [];
    }

    // VALIDATE REGULAR DOCS
    for (const req of regularRequirements) {

        const key = makeKey(req);

        if (
            !existingDocuments[key] &&
            !pendingDocuments[key]
        ) {

            console.log("Missing:", key);

            isValid = false;
            break;
        }
    }
    // CHECK IF NHA = YES
    const nhaYesSelected =
        document.querySelector(
            'input[name="isNHA"][value="yes"]'
        )?.checked;

    // VALIDATE NHA DOCS
    if (nhaYesSelected) {

        nhaRequirements.forEach(req => {

            const key = makeKey(req);

            if (
                !existingDocuments[key] &&
                !pendingDocuments[key]
            ) {
                isValid = false;
            }
        });
    }

    // BUTTON STATE
    const btn =
        document.getElementById("uploadDocsBtn");

    if (btn) {

        btn.disabled = !isValid;

        btn.style.opacity =
            isValid ? "1" : "0.5";

        btn.style.cursor =
            isValid ? "pointer" : "not-allowed";
    }
}

function viewDocument(key) {

    const data =
        pendingDocuments[key] ||
        existingDocuments[key];

    // EXISTING DB FILE
    if (data?.existing) {

        window.open(
            `http://localhost:5000/${data.filePath}`,
            "_blank"
        );

        return;
    }

    // LOCAL FILE
    const file = data?.file;

    if (!file) return;

    const fileURL = URL.createObjectURL(file);

    window.open(fileURL, "_blank");
}

function removeDocument(key) {

    delete pendingDocuments[key];

    const input = document.getElementById(key);
    if (input) input.value = "";

    const data =
    pendingDocuments[key] ||
    existingDocuments[key];

    renderPermitDocumentCard(
        key,
        data?.documentName || key
    );

    validatePermitDocuments();
}

function closePermitModal() {
    const modal = document.getElementById("permitDetailsModal");
    modal.classList.remove("show");

    resetPermitModal();
}

function resetPermitModal() {
    document.getElementById("permitDetailsBody").innerHTML = "";
}

window.addEventListener("click", function (e) {
    const permitModal = 
        document.getElementById("permitDetailsModal");
    const serviceModal = 
        document.getElementById("serviceModal");

    const inspectionModal =
    document.getElementById("inspectionStatusModal");

    if (e.target === permitModal) {
        closePermitModal();
    }

    if (e.target === serviceModal) {
        closeServiceModal();
    }

    if (e.target === inspectionModal) {
        closeInspectionStatusModal();
    }
});

/*
finish the recent activity of applicant dashboard for the inspections
create history table for all the approved and rejected, so the main table don't fetched that

in admin dashboard, stop fetching the inspection related 
create payment modal for both admin and applicant
after payment, instead of approved in the tracker it should be clearance releasing

then create clearan modal for both applicant and admin
*/