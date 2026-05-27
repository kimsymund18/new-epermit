let allAssigned = [];
let allHistory = [];
let currentInspection = null;
let optionalVisible = false;

const API_URL =
    "https://new-epermit-backend.onrender.com/api";

const token =
    localStorage.getItem("token");

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();

    loadInspectorProfile();

    fetchAssignedInspections();
    fetchInspectionHistory();

    fetchInspectorActivities();

    setSection("dashboard");

    document.getElementById("searchAssigned")
        .addEventListener("input", applyAssignedFilters);

    document.getElementById("statusFilterAssigned")
        .addEventListener("change", applyAssignedFilters);

    document.getElementById("searchHistory")
        .addEventListener("input", applyHistoryFilters);

    document.getElementById("resultFilterHistory")
        .addEventListener("change", applyHistoryFilters);

    document.addEventListener("click", () => {

        document.getElementById("dropdownMenu")
            .classList.remove("show");
    });
});

async function fetchAssignedInspections() {

    try {

        const response = await fetch(
            `${API_URL}/inspections/assigned`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            // STORE ALL INSPECTIONS
            const inspections = data.inspections;

            // ASSIGNED = EVERYTHING EXCEPT COMPLETED
            allAssigned = inspections.filter(
                i => i.status !== "Completed"
            );

            loadDashboardData();

            renderAssignedTable(allAssigned);

            renderHistoryTable(allHistory);
        }

    } catch (error) {

        console.error(error);
    }
}

async function fetchInspectionHistory() {

    try {

        const response = await fetch(
            `${API_URL}/inspections/history`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            allHistory = data.inspections;

            loadDashboardData();

            renderHistoryTable(allHistory);
        }

    } catch (error) {

        console.error(error);
    }
}

async function loadInspectorProfile() {
    try {
        const response = await fetch(`${API_URL}/users/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!result.success) return;

        const user = result.user;

        // FULL NAME
        const fullName = [
            user.first_name,
            user.middle_name,
            user.last_name
        ].filter(Boolean).join(" ");

        document.getElementById("inspectorName").textContent =
            fullName || user.email;

        document.getElementById("inspectorDepartment").textContent =
            user.department || "OBO Department";

        document.getElementById("inspectorRole").textContent =
            user.role || "Inspector";

        // OPTIONAL: cache it for faster reloads
        localStorage.setItem("user", JSON.stringify(user));

    } catch (error) {
        console.error("Failed to load inspector profile:", error);
    }
}

function loadDashboardData() {

    // ASSIGNED STATS
    document.getElementById("statTotal").textContent =
        allAssigned.length;

    document.getElementById("statScheduled").textContent =
        allAssigned.filter(i =>
            i.status === "Scheduled"
        ).length;

    document.getElementById("statCompleted").textContent =
        allHistory.length;

    document.getElementById("statReinspection").textContent =
        allAssigned.filter(i =>
            i.result === "For Resubmission"
        ).length;

    // HISTORY STATS
    document.getElementById("historyTotal").textContent =
        allHistory.length;

    document.getElementById("historyPassed").textContent =
        allHistory.filter(i =>
            i.result === "Passed"
        ).length;

    document.getElementById("historyFailed").textContent =
        allHistory.filter(i =>
            i.result === "Failed"
        ).length;

    // TODAY'S INSPECTIONS
    const today = new Date().toLocaleDateString(
        "en-CA",
        {
            timeZone: "Asia/Manila"
        }
    );

    const todayList = allAssigned.filter(i => {

        if (!i.schedule_date) return false;

        const inspectionDate = new Date(i.schedule_date)
            .toLocaleDateString(
                "en-CA",
                {
                    timeZone: "Asia/Manila"
                }
            );

        console.log("inspectionDate:", inspectionDate);
        console.log("today:", today);

        return (
            inspectionDate === today &&
            (
                i.status === "Scheduled" ||
                i.result === "For Resubmission"
            )
        );
    });

    renderTodayInspections(todayList);


}

async function fetchInspectorActivities() {
    try {
        const res = await fetch(
            `${API_URL}/inspections/activities`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await res.json();

        if (data.success) {
            renderRecentActivity(data.activities);
        }

    } catch (err) {
        console.error(err);
    }
}

function renderTodayInspections(list) {
    const container = document.getElementById("todayInspections");
    if (!list.length) {
        container.innerHTML = `<div class="empty-state"><h3>📂 No inspections today</h3><p>Check your assigned list for upcoming schedules.</p></div>`;
        return;
    }
    container.innerHTML = list.map(i => `
        <div class="activity-item" style="cursor:pointer;" onclick="openInspectionModal(${i.inspection_id})">
            <div class="activity-icon scheduled">📅</div>
            <div class="activity-content">
                <h4>${i.project_title}</h4>
                <p>${i.permit_type} • ${i.owner_name}</p>
                <div class="activity-time">⏰ ${formatTime(i.schedule_time)} &nbsp;📍 ${i.project_location}</div>
            </div>
        </div>
    `).join("");
}

function updateMinTime(dateInputId, timeInputId) {

    const dateInput = document.getElementById(dateInputId);
    const timeInput = document.getElementById(timeInputId);

    if (!dateInput || !timeInput) return;

    const now = new Date();

    const today =
        `${now.getFullYear()}-${
            String(now.getMonth() + 1).padStart(2, "0")
        }-${
            String(now.getDate()).padStart(2, "0")
        }`;

    if (dateInput.value === today) {

        const hours =
            String(now.getHours()).padStart(2, "0");

        const minutes =
            String(now.getMinutes()).padStart(2, "0");

        const currentTime = `${hours}:${minutes}`;

        timeInput.min = currentTime;

        // FORCE INVALID TIME RESET
        if (
            timeInput.value &&
            timeInput.value < currentTime
        ) {
            timeInput.value = currentTime;
        }

    } else {

        timeInput.min = "";
    }
}

function renderRecentActivity(list) {

    const container =
        document.getElementById("recentActivity");

    if (!list.length) {

        container.innerHTML = `
            <div class="empty-state">
                <h3>No recent activity</h3>
            </div>
        `;

        return;
    }

    container.innerHTML = list.map(i => {

        let icon = "📄";
        let cls = "pending";

        // =========================
        // ACTIVITY STATUS
        // =========================
        if (i.event_type === "inspector_assigned") {

            icon = "👨‍🔧";
            cls = "assigned";

        } else {

            switch(i.new_status){

                case "Scheduled":

                    icon = "📅";
                    cls = "scheduled";
                    break;

                case "In Progress":

                    icon = "🚧";
                    cls = "progress";
                    break;

                case "Inspected":

                    icon = "📝";
                    cls = "review";
                    break;

                case "Completed":

                    icon = "✅";
                    cls = "completed";
                    break;

                case "Rescheduled":

                    icon = "🔄";
                    cls = "resubmission";
                    break;

                case "Rejected":

                    icon = "❌";
                    cls = "failed";
                    break;

                case "For Inspection":

                    icon = "👷";
                    cls = "inspection";
                    break;

                case "Under Review":

                    icon = "📋";
                    cls = "review";
                    break;

                default:

                    icon = "📄";
                    cls = "pending";
            }
        }

        return `
            <div class="activity-item">

                <div class="activity-icon ${cls}">
                    ${icon}
                </div>

                <div class="activity-content">

                    <h4>${i.project_title}</h4>

                    <p>
                        ${i.message || i.new_status || "Inspection Updated"}
                    </p>

                    <div class="activity-time">

                        ${
                            i.schedule_date
                            ? `${formatDateDisplay(i.schedule_date)} • ${formatTime(i.schedule_time)}`
                            : new Date(i.created_at).toLocaleString("en-PH")
                        }

                    </div>

                </div>

            </div>
        `;
    }).join("");
}

// ========================
// SIDEBAR
// ========================
function setupSidebar() {
    document.getElementById("btnDashboard").addEventListener("click", () => setSection("dashboard"));
    document.getElementById("btnAssigned").addEventListener("click", () => {
        setSection("assigned");
        renderAssignedTable(allAssigned);
    });
    document.getElementById("btnHistory").addEventListener("click", () => {
        setSection("history");
        renderHistoryTable(allHistory);
    });
}

function setSection(section) {
    sessionStorage.setItem("activeSection", section);
    const sections = {
        dashboard: document.getElementById("dashboardSection"),
        assigned: document.getElementById("assignedSection"),
        history: document.getElementById("historySection")
    };
    const buttons = {
        dashboard: document.getElementById("btnDashboard"),
        assigned: document.getElementById("btnAssigned"),
        history: document.getElementById("btnHistory")
    };
    Object.values(sections).forEach(s => s.style.display = "none");
    Object.values(buttons).forEach(b => b.classList.remove("active"));
    sections[section].style.display = "block";
    buttons[section].classList.add("active");
}

// ========================
// ASSIGNED TABLE
// ========================
function renderAssignedTable(list) {
    const tbody = document.getElementById("assignedTable");
    const empty = document.getElementById("assignedEmpty");
    document.getElementById("assignedCount").textContent = `${list.length} Inspection${list.length !== 1 ? "s" : ""}`;

    if (!list.length) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";
    tbody.innerHTML = list.map(i => {
        const sc = statusClass(i.status);
        return `
            <tr style="cursor:pointer;" onclick="openInspectionModal(${i.inspection_id})">
                <td>${i.control_number}</td>
                <td>${i.permit_type}</td>
                <td>${i.project_title}</td>
                <td>${i.owner_name}</td>
                <td>${i.schedule_date ? formatDateDisplay(i.schedule_date) + " " + formatTime(i.schedule_time) : "—"}</td>
                <td><span class="status-badge ${sc}">${i.status}</span></td>
            </tr>
        `;
    }).join("");
}

// ========================
// ASSIGNED FILTERS
// ========================
function applyAssignedFilters() {

    const search =
        document.getElementById("searchAssigned")
        .value.toLowerCase();

    const status =
        document.getElementById("statusFilterAssigned")
        .value;

    let filtered = allAssigned.filter(i =>

        (
            !search ||

            i.control_number
                .toLowerCase()
                .includes(search) ||

            i.project_title
                .toLowerCase()
                .includes(search)
        ) &&

        (
            !status ||
            i.status === status
        )
    );

    renderAssignedTable(filtered);
}

// ========================
// HISTORY TABLE
// ========================
function renderHistoryTable(list) {
    const tbody = document.getElementById("historyTable");
    const empty = document.getElementById("historyEmpty");
    document.getElementById("historyCount").textContent = `${list.length} Record${list.length !== 1 ? "s" : ""}`;

    if (!list.length) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
        empty.style.display = "none";
        tbody.innerHTML = list.map(i => {

            const rc = resultClass(i.result);

            return `
                <tr style="cursor:pointer;" onclick="openInspectionModal(${i.inspection_id})">

                    <td>${i.control_number}</td>

                    <td>${i.permit_type}</td>

                    <td>${i.project_title}</td>

                    <td>
                        ${i.schedule_date
                            ? formatDateDisplay(i.schedule_date)
                            : "—"}
                    </td>

                    <td>${i.inspection_type}</td>

                    <td>
                        <span class="result-badge ${rc}">
                            ${i.result || "—"}
                        </span>
                    </td>

                    <!-- NEW COLUMN -->
                    <td>
                        <span class="status-badge ${statusClass(i.permit_status)}">
                            ${i.permit_status || "—"}
                        </span>
                    </td>

                </tr>
            `;

        }).join("");
}

function applyHistoryFilters() {
    const search = document.getElementById("searchHistory").value.toLowerCase();
    const result = document.getElementById("resultFilterHistory").value;
    let filtered = allHistory.filter(i =>
        (!search || i.control_number.toLowerCase().includes(search) || i.project_title.toLowerCase().includes(search)) &&
        (!result || i.result === result)
    );
    renderHistoryTable(filtered);
}

// ========================
// INSPECTION DETAIL MODAL
// ========================
function openInspectionModal(inspectionId) {

    const inspection =
        [...allAssigned, ...allHistory]
            .find(i => i.inspection_id === inspectionId);

    if (!inspection) return;

    // DIRECTLY OPEN REPORT MODAL
    if (
        inspection.status === "Inspected" ||
        inspection.status === "Deferred" ||
        inspection.status === "Rescheduled"
    ) {
        openReportModal(inspectionId);
        return;
    }

    const now = new Date();

    const today =
        `${now.getFullYear()}-${
            String(now.getMonth() + 1).padStart(2, "0")
        }-${
            String(now.getDate()).padStart(2, "0")
        }`;

    currentInspection = inspection;

    const editableStatuses = [
        "Assigned",
        "Rescheduled",
        "Deferred"
    ];

    const isLockedSchedule =
        !editableStatuses.includes(inspection.status);

    document.getElementById("inspectionModalBody").innerHTML = `
        <!-- PROGRESS TRACKER -->
        <div class="modal-section">
            <h3>Progress Tracker</h3>
            ${buildInspectionTracker(inspection.status, inspection.result)}
        </div>

        <!-- PERMIT INFO -->
        <div class="modal-section">
            <h3>Application Information</h3>
            <div class="application-info">
                <div class="form-row two">
                    <div class="field"><label>Control Number</label><div class="static-value">${inspection.control_number}</div></div>
                    <div class="field"><label>Permit Type</label><div class="static-value">${inspection.permit_type}</div></div>
                </div>
                <div class="form-row two">
                    <div class="field">
                        <label>Applicant Name</label>
                        <div class="static-value">
                            ${inspection.applicant_name || inspection.applicant_account_name}
                        </div>
                    </div>

                    <div class="field">
                        <label>Applicant Contact</label>
                        <div class="static-value">
                            ${inspection.applicant_contact_number || "—"}
                        </div>
                    </div>
                </div>
            </div>
        </div>        
        <div class="modal-section">
            <h3>Project Details</h3>
            <div class="permit-info">
                <div class="form-row two">
                    <div class="field"><label>Project Title</label><div class="static-value">${inspection.project_title}</div></div>
                    <div class="field"><label>Estimated Cost</label><div class="static-value">₱ ${inspection.estimated_cost}</div></div>
                </div>
                <div class="form-row two">
                    <div class="field">
                        <label>Owner Name</label>
                        <div class="static-value">
                            ${inspection.owner_name || "—"}
                        </div>
                    </div>
                    <div class="field">
                        <label>Contact Number</label>
                        <div class="static-value">
                            ${inspection.owner_contact_number || "—"}
                        </div>
                    </div>
                </div>
                <div class="form-row one">
                    <div class="field"><label>Project Location</label><div class="static-value">${inspection.project_location}</div></div>
                </div>
            </div>
        </div>

        <!-- SCHEDULE INFO -->
        <div class="modal-section">
            <h3>Inspection Details</h3>
            <div class="form-row two">
                <div class="field">
                    <label>Inspection Date</label>
                    <input
                        type="date"
                        id="scheduleDate"
                        ${isLockedSchedule ? "readonly disabled" : ""} min="${today}" 
                        value="${inspection.schedule_date ? inspection.schedule_date.split("T")[0] : ""}"
                    >
                </div>
                <div class="field">
                    <label>Inspection Time</label>
                    <input
                        type="time"
                        id="scheduleTime"
                        ${isLockedSchedule ? "readonly disabled" : ""}
                        value="${inspection.schedule_time
                            ? inspection.schedule_time.slice(0,5)
                            : "08:00"}"
                    >
                </div>
            </div>
        </div>

        ${inspection.status === "Completed" ? `
        <!-- INSPECTION REPORT -->
        <div class="modal-section">
            <h3>Inspection Report</h3>

            <div class="application-info">

                <div class="form-row two">
                    <div class="field">
                        <label>Inspection Type</label>
                        <div class="static-value">
                            ${inspection.inspection_type}
                        </div>
                    </div>

                    <div class="field">
                        <label>Result</label>
                        <div class="static-value">
                            ${inspection.result}
                        </div>
                    </div>
                </div>

                <!-- FINDINGS -->
                <div class="form-row one">
                    <div class="field">
                        <label>Findings</label>

                        ${
                            inspection.findings
                            ? `
                                <div class="review-section">
                                    <div class="remarks-display">${inspection.findings}</div>
                                </div>
                            `
                            : `
                                <div class="static-value">—</div>
                            `
                        }
                    </div>
                </div>

                <!-- RECOMMENDATIONS -->
                <div class="form-row one">
                    <div class="field">
                        <label>Recommendations</label>

                        ${
                            inspection.recommendations
                            ? `
                                <div class="review-section">
                                    <div class="remarks-display">${inspection.recommendations}</div>
                                </div>
                            `
                            : `
                                <div class="static-value">—</div>
                            `
                        }
                    </div>
                </div>

                <!-- REMARKS -->
                <div class="form-row one">
                    <div class="field">
                        <label>Remarks</label>

                        ${
                            inspection.remarks
                            ? `
                                <div class="review-section">
                                    <div class="remarks-display">${inspection.remarks}</div>
                                </div>
                            `
                            : `
                                <div class="static-value">—</div>
                            `
                        }
                    </div>
                </div>

            </div>
        </div>
        ` : ""}

        <!-- ACTIONS -->
        <div class="modal-actions">

            ${
                inspection.status === "Scheduled"
                ? `
                    <button
                        id="inspectionScheduleBtn"
                        class="primary-btn"
                        onclick="confirmConductInspection(${inspection.inspection_id})"
                    >
                        Start Inspection
                    </button>
                `

                : inspection.status === "In Progress"
                ? `
                    <button
                        class="primary-btn"
                        onclick="finishInspection(${inspection.inspection_id})"
                    >
                        Finish Site Inspection
                    </button>
                `

                : inspection.status === "Completed"
                ? ``

                : `
                    <button
                        id="inspectionScheduleBtn"
                        class="primary-btn"
                        onclick="saveSchedule(${inspection.inspection_id})"
                        disabled
                    >
                        Save Schedule
                    </button>
                `
            }

        </div>
    `;

    const inspectionDate =
        document.getElementById("scheduleDate");

    const inspectionTime =
        document.getElementById("scheduleTime");

    const inspectionBtn =
        document.getElementById("inspectionScheduleBtn");

    function validateInspectionSchedule() {
        if (!inspectionBtn) return;

        if (inspection.schedule_date) {
            inspectionBtn.disabled = false;
            return;
        }

        inspectionBtn.disabled = !(inspectionDate.value && inspectionTime.value);
    }

    validateInspectionSchedule();

    updateMinTime("scheduleDate", "scheduleTime");

    inspectionDate.addEventListener(
        "input",
        () => {
            validateInspectionSchedule();
            updateMinTime("scheduleDate", "scheduleTime");
        }
    );

    inspectionTime.addEventListener(
        "input",
        validateInspectionSchedule
    );

    document.getElementById("inspectionModal").classList.add("show");
}

async function confirmConductInspection(inspectionId) {

    const inspection = getInspectionById(inspectionId);

    if (!inspection) return;

    const confirmed = confirm(
        `Start inspection for:\n\n` +
        `${inspection.project_title}\n` +
        `${inspection.project_location}\n\n` +
        `This will mark the inspection as "In Progress".\n\n` +
        `Do you want to proceed?`
    );

    if (!confirmed) return;

    try {

        const response = await fetch(
            `${API_URL}/inspections/start-inspection/${inspectionId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            alert("Inspection is now in progress.");

            closeInspectionModal();

            fetchAssignedInspections();
        }

    } catch (error) {

        console.error(error);

        alert("Failed to start inspection.");
    }
}

async function finishInspection(inspectionId) {

    const inspection = getInspectionById(inspectionId);

    if (!inspection) return;

    const confirmed = confirm(
        `Finish inspection for:\n\n` +
        `${inspection.project_title}\n\n` +
        `This will mark the inspection as "Inspected".`
    );

    if (!confirmed) return;

    try {

        const response = await fetch(
            `${API_URL}/inspections/finish-inspection/${inspectionId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            alert("Inspection marked as inspected.");

            closeInspectionModal();

            fetchAssignedInspections();
        }

    } catch (error) {

        console.error(error);

        alert("Failed to finish inspection.");
    }
}

async function markAsInspected(inspectionId) {

    const inspection = getInspectionById(inspectionId);

    if (!inspection) return;

    const confirmed = confirm(
        `Finish on-site inspection for:\n\n` +
        `${inspection.project_title}\n\n` +
        `This will mark the inspection as "Inspected".`
    );

    if (!confirmed) return;

    try {

        const response = await fetch(
            `${API_URL}/inspections/mark-inspected/${inspectionId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (data.success) {

            alert("Inspection marked as inspected.");

            closeInspectionModal();

            fetchAssignedInspections();
        }

    } catch (error) {

        console.error(error);

        alert("Failed to update inspection status.");
    }
}

function closeInspectionModal() {
    document.getElementById("inspectionModal").classList.remove("show");
}

// ========================
// SUBMIT REPORT MODAL
// ========================
function openReportModal(inspectionId) {

    const inspection = getInspectionById(inspectionId);

    if (!inspection) return;

    document.getElementById("reportModalBody").innerHTML = `
        <div class="modal-section">
            <h3>Inspection Reference</h3>
            <div class="form-row two">
                <div class="field">
                    <label>Control Number</label>

                    <div class="static-value">
                        ${inspection.control_number}
                    </div>
                </div>

                <div class="field">
                    <label>Project Title</label>

                    <div class="static-value">
                        ${inspection.project_title}
                    </div>
                </div>
            </div><br>

            <div class="form-row two">
                <div class="field">
                    <label>Inspection Date</label>

                    <div class="static-value">
                        ${inspection.schedule_date
                            ? formatDateDisplay(inspection.schedule_date)
                            : "—"}
                    </div>
                </div>

                <div class="field">
                    <label>Inspection Time</label>

                    <div class="static-value">
                        ${inspection.schedule_time
                            ? formatTime(inspection.schedule_time)
                            : "—"}
                    </div>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h3>Report Details</h3>

            <div class="application-info">

                <div class="form-row two">

                    <div class="field">
                        <label>Inspection Type</label>

                        ${(() => {

                            let autoType = "Initial";

                            if (inspection.status === "Rescheduled") {
                                autoType = "Reinspection";
                            }

                            else if (inspection.status === "Deferred") {
                                autoType = "Final";
                            }

                            else if (inspection.status === "Inspected") {
                                autoType = "Initial";
                            }

                        return `
                            <div class="static-value" id="reportType">
                                ${autoType}
                            </div>
                        `;

                        })()}
                    </div>

                    <div class="field">
                        <label>Result</label>

                        ${(() => {

                            let autoType = "Initial";

                            if (inspection.status === "Rescheduled") {
                                autoType = "Reinspection";
                            }

                            else if (inspection.status === "Deferred") {
                                autoType = "Final";
                            }

                            else if (inspection.status === "Inspected") {
                                autoType = "Initial";
                            }

                            let options = "";

                            // INITIAL + REINSPECTION
                            if (
                                autoType === "Initial" ||
                                autoType === "Reinspection"
                            ) {

                                options = `
                                    <option value="Passed">
                                        Passed
                                    </option>

                                    <option value="For Resubmission">
                                        For Resubmission
                                    </option>
                                `;
                            }

                            // FINAL
                            else if (autoType === "Final") {

                                options = `
                                    <option value="Passed">
                                        Passed
                                    </option>

                                    <option value="Failed">
                                        Failed
                                    </option>
                                `;
                            }

                            return `
                                <select id="reportResult">
                                    <option value="">
                                        -- Select Result --
                                    </option>

                                    ${options}
                                </select>
                            `;

                        })()}
                    </div>

                </div>

                <!-- FINDINGS -->
                <div class="form-row one" id="findingsRow">

                    <div class="field">

                        <label>
                            Findings
                            <span id="findingsRequired"></span>
                        </label>

                        ${
                            inspection.findings
                            ? `
                                <div class="review-section">

                                    <div class="review-message">
                                        Previous Findings:
                                    </div>

                                    <div class="remarks-display">${inspection.findings}</div>

                                </div>
                            `
                            : ""
                        }

                        <div class="review-section">

                            <div class="review-message">
                                New Findings
                            </div>

                            <textarea
                                class="remarks-textarea"
                                id="reportFindings"
                                placeholder="Enter new findings..."
                            ></textarea>

                        </div>

                    </div>

                </div>

                <!-- RECOMMENDATIONS -->
                <div class="form-row one" id="recommendationsRow">

                    <div class="field">

                        <label>
                            Recommendations
                            <span id="recommendationsRequired"></span>
                        </label>

                        ${
                            inspection.recommendations
                            ? `
                                <div class="review-section">

                                    <div class="review-message">
                                        Previous Recommendations:
                                    </div>

                                    <div class="remarks-display">${inspection.recommendations}</div>

                                </div>
                            `
                            : ""
                        }

                        <div class="review-section">

                            <div class="review-message">
                                New Recommendations
                            </div>

                            <textarea
                                class="remarks-textarea"
                                id="reportRecommendations"
                                placeholder="Enter new recommendations..."
                            ></textarea>

                        </div>

                    </div>

                </div>

                <!-- REMARKS -->
                <div class="form-row one" id="remarksRow">

                    <div class="field">

                        <label>
                            Remarks
                            <span id="remarksRequired"></span>
                        </label>

                        ${
                            inspection.remarks
                            ? `
                                <div class="review-section">

                                    <small class="review-message">
                                        Previous Remarks:
                                    </small>

                                    <div class="remarks-display">${inspection.remarks}</div>

                                </div>
                            `
                            : ""
                        }

                        <div class="review-section">

                            <div class="review-message">
                                New Remarks
                            </div>

                            <textarea
                                class="remarks-textarea"
                                id="reportRemarks"
                                placeholder="Enter new remarks..."
                            ></textarea>

                        </div>

                    </div>

                </div>
            </div>
        </div>

        <!-- REINSPECTION SCHEDULE -->
        <div
            class="modal-section"
            id="reinspectionScheduleSection"
            style="display:none;"
        >
            <h3>Inspection Details</h3>

            <div class="form-row two">
                <div class="field">
                    <label>Inspection Date</label>

                    <input
                        type="date"
                        id="reinspectionDate"
                    >
                </div>

                <div class="field">
                    <label>Inspection Time</label>

                    <input
                        type="time"
                        id="reinspectionTime"
                    >
                </div>
            </div>
        </div>

        <div class="modal-actions">
            <button
                class="primary-btn"
                onclick="submitReport(${inspectionId})"
            >
                Submit Report
            </button>
        </div>
    `;

    document.getElementById("reportModal")
        .classList.add("show");

    setTimeout(() => {

        const resultSelect =
            document.getElementById("reportResult");

        const findingsRow =
            document.getElementById("findingsRow");

        const recommendationsRow =
            document.getElementById("recommendationsRow");

        const remarksRow =
            document.getElementById("remarksRow");

        const findingsRequired =
            document.getElementById("findingsRequired");

        const recommendationsRequired =
            document.getElementById("recommendationsRequired");

        const remarksRequired =
            document.getElementById("remarksRequired");

        const findings =
            document.getElementById("reportFindings");

        const recommendations =
            document.getElementById("reportRecommendations");

        const remarks =
            document.getElementById("reportRemarks");

        const reinspectionSection =
            document.getElementById("reinspectionScheduleSection");

        const reinspectionDate =
            document.getElementById("reinspectionDate");

        const reinspectionTime =
            document.getElementById("reinspectionTime");

        const now = new Date();

        const today =
            `${now.getFullYear()}-${
                String(now.getMonth() + 1).padStart(2, "0")
            }-${
                String(now.getDate()).padStart(2, "0")
            }`;

        reinspectionDate.min = today;

        updateMinTime(
            "reinspectionDate",
            "reinspectionTime"
        );

        reinspectionDate.addEventListener(
            "input",
            () => updateMinTime(
                "reinspectionDate",
                "reinspectionTime"
            )
        );

        reinspectionTime.addEventListener(
            "input",
            () => updateMinTime(
                "reinspectionDate",
                "reinspectionTime"
            )
        );

        // INITIAL STATE
        findingsRow.style.display = "none";
        recommendationsRow.style.display = "none";
        remarksRow.style.display = "none";

        function setRequired(el, state) {

            el.innerHTML = state
                ? `<span style="color:red;">*</span>`
                : "";
        }

        function updateFieldsUI() {

            const result = resultSelect.value;

            // HIDE ALL FIRST
            findingsRow.style.display = "none";
            recommendationsRow.style.display = "none";
            remarksRow.style.display = "none";

            // HIDE REINSPECTION SECTION
            reinspectionSection.style.display = "none";

            // RESET REQUIRED LABELS
            setRequired(findingsRequired, false);
            setRequired(recommendationsRequired, false);
            setRequired(remarksRequired, false);

            if (!result) return;

            // ALWAYS SHOW ALL FIELDS
            findingsRow.style.display = "block";
            recommendationsRow.style.display = "block";
            remarksRow.style.display = "block";

            // ====================
            // PASSED
            // ====================
            if (result === "Passed") {

                setRequired(findingsRequired, true);

                findings.placeholder =
                    "Enter inspection findings...";

                recommendations.placeholder =
                    "Optional recommendations...";

                remarks.placeholder =
                    "Optional remarks...";
            }

            // ====================
            // FAILED
            // ====================
            else if (result === "Failed") {

                setRequired(findingsRequired, true);
                setRequired(recommendationsRequired, true);
                setRequired(remarksRequired, true);

                findings.placeholder =
                    "Major violations found...";

                recommendations.placeholder =
                    "Required corrective actions...";

                remarks.placeholder =
                    "Failure explanation...";
            }

            // ====================
            // FOR RESUBMISSION
            // ====================
            else if (result === "For Resubmission") {

                // SHOW REINSPECTION SCHEDULE
                reinspectionSection.style.display = "block";

                setRequired(findingsRequired, true);
                setRequired(recommendationsRequired, true);

                findings.placeholder =
                    "List deficiencies found...";

                recommendations.placeholder =
                    "Required corrections...";

                remarks.placeholder =
                    "Optional resubmission notes...";
            }
        }

        resultSelect.addEventListener(
            "change",
            updateFieldsUI
        );

    }, 0);
}

function closeReportModal() {
    document.getElementById("reportModal").classList.remove("show");
}

async function submitReport(inspectionId) {

    const result =
        document.getElementById("reportResult").value;

    const findings =
        document.getElementById("reportFindings").value;

    const recommendations =
        document.getElementById("reportRecommendations").value;

    const remarks =
        document.getElementById("reportRemarks").value;

    const currentType =
        document.getElementById("reportType")
        .textContent
        .trim();

    let nextType = currentType;

    // advance inspection type only for resubmission
    if (result === "For Resubmission") {
        if (currentType === "Initial") {
            nextType = "Reinspection";
        } else if (currentType === "Reinspection") {
            nextType = "Final";
        } else {
            nextType = "Final";
        }
    }

    const reinspectionDate =
        document.getElementById("reinspectionDate")?.value;

    const reinspectionTime =
        document.getElementById("reinspectionTime")?.value;

    // =========================
    // VALIDATION
    // =========================
    if (!result) {

        alert("Please select inspection result.");

        return;
    }

    if (!findings.trim()) {

        alert("Findings are required.");

        return;
    }

    if (
        (
            result === "For Resubmission" ||
            result === "Failed"
        ) &&
        !recommendations.trim()
    ) {

        alert("Recommendations are required.");

        return;
    }

    if (
        result === "Failed" &&
        !remarks.trim()
    ) {

        alert(
            "Remarks are required for failed inspections."
        );

        return;
    }

    if (
        result === "For Resubmission" &&
        (!reinspectionDate || !reinspectionTime)
    ) {

        alert(
            "Please set reinspection date and time."
        );

        return;
    }

    // VALIDATE REINSPECTION DATE/TIME
    if (result === "For Resubmission") {

        const now = new Date();

        const selectedReinspection =
            new Date(`${reinspectionDate}T${reinspectionTime}`);

        // INVALID DATE
        if (isNaN(selectedReinspection.getTime())) {

            alert("Invalid reinspection schedule.");

            return;
        }

        // PAST DATE/TIME
        if (selectedReinspection <= now) {

            alert(
                "Reinspection schedule cannot be in the past."
            );

            return;
        }
    }

    // =========================
    // CONFIRMATION MESSAGE
    // =========================
    let confirmMessage = `
    Inspection Type: ${nextType}
    Result: ${result}
    `;

        // PASSED
        if (result === "Passed") {

            confirmMessage += `

    This inspection will move the permit to:
    FOR PAYMENT
    `;
        }

        // FOR RESUBMISSION
        else if (
            result === "For Resubmission"
        ) {

            confirmMessage += `

    This inspection will require:
    REINSPECTION

    Reinspection Schedule:
    Date: ${formatDateDisplay(reinspectionDate)}
    Time: ${formatTime(reinspectionTime)}
    `;
        }

        // FAILED
        else if (result === "Failed") {

            confirmMessage += `

    This inspection will mark the permit as:
    REJECTED
    `;
        }

        confirmMessage += `

    Do you want to submit this inspection report?
    `;

    const confirmed =
        confirm(confirmMessage);

    if (!confirmed) {
        return;
    }

    // =========================
    // SUBMIT REPORT
    // =========================
    try {

        const response = await fetch(
            `${API_URL}/inspections/submit-report/${inspectionId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    result,
                    findings,
                    recommendations,
                    remarks,
                    inspection_type: nextType,

                    reinspection_date: reinspectionDate,
                    reinspection_time: reinspectionTime
                })
            }
        );

        const data = await response.json();

        if (data.success) {

            alert("Inspection report submitted successfully.");

            closeReportModal();

            closeInspectionModal();

            fetchAssignedInspections();

        } else {

            alert(
                data.message ||
                "Failed to submit report."
            );
        }

    } catch (error) {

        console.error(error);

        alert("Server error while submitting report.");
    }
}

// ========================
// SCHEDULE MODAL
// ========================
function openScheduleModal(inspectionId) {
    
    const inspection =
        [...allAssigned, ...allHistory]
            .find(i => i.inspection_id === inspectionId);

    if (!inspection) return;

    let autoInspectionType = "Initial";

    if (inspection.status === "Rescheduled") {
        autoInspectionType = "Reinspection";
    }

    else if (inspection.status === "Deferred") {
        autoInspectionType = "Final";
    }

    else if (inspection.status === "Inspected") {
        autoInspectionType = "Initial";
    }

    const now = new Date();

    const today =
        `${now.getFullYear()}-${
            String(now.getMonth() + 1).padStart(2, "0")
        }-${
            String(now.getDate()).padStart(2, "0")
        }`;

        const editableStatuses = [
            "Assigned",
            "Rescheduled",
            "Deferred"
        ];

        const isLockedSchedule =
            !editableStatuses.includes(inspection.status);

    document.getElementById("scheduleModalBody").innerHTML = `
        <div class="modal-section">
            <h3>📌 Permit Reference</h3>
            <div class="form-row two">
                <div class="field"><label>Control Number</label><div class="static-value">${inspection.control_number}</div></div>
                <div class="field"><label>Project Title</label><div class="static-value">${inspection.project_title}</div></div>
            </div>
        </div>

        <div class="modal-section">
            <h3>📅 Schedule Details</h3>
            <div class="form-row two">
                <div class="field">
                    <label>Inspection Date</label>
                    <input
                        type="date"
                        id="scheduleDate"
                        ${isLockedSchedule ? "readonly disabled" : ""} 
                        min="${today}" value="${inspection.schedule_date ? 
                        inspection.schedule_date.split("T")[0] : ""}"
                    >
                </div>
                <div class="field">
                    <label>Inspection Time</label>
                    <input type="time" id="scheduleTime" value="${inspection.schedule_time ? inspection.schedule_time.slice(0,5) : "09:00"}">
                </div>
            </div>
        </div>

        <div class="modal-actions">
            <button class="secondary-btn" onclick="closeScheduleModal()">Cancel</button>
            <button
                id="scheduleSaveBtn"
                class="primary-btn"
                onclick="saveSchedule(${inspectionId})"
                disabled
            >
                💾 Save Schedule
            </button>
        </div>
    `;

    document.getElementById("scheduleModal").classList.add("show");

    const scheduleDate =
        document.getElementById("scheduleDate");

    const scheduleTime =
        document.getElementById("scheduleTime");

    const scheduleBtn =
        document.getElementById("scheduleSaveBtn");

    function validateSchedule() {

        if (
            scheduleDate.value &&
            scheduleTime.value
        ) {

            scheduleBtn.disabled = false;

        } else {

            scheduleBtn.disabled = true;
        }
    }

    validateSchedule();

    updateMinTime("scheduleDate", "scheduleTime");

    scheduleDate.addEventListener(
        "input",
        () => {
            validateSchedule();
            updateMinTime("scheduleDate", "scheduleTime");
        }
    );

    scheduleTime.addEventListener(
        "input",
        validateSchedule
    );
}

function closeScheduleModal() {
    document.getElementById("scheduleModal").classList.remove("show");
}

async function saveSchedule(inspectionId) {

    const date =
        document.getElementById("scheduleDate").value;

    const time =
        document.getElementById("scheduleTime").value;

    if (!date || !time) {

        alert("Please select date and time");

        return;
    }

    // VALIDATE PAST DATE/TIME
    const now = new Date();

    const selectedDateTime =
        new Date(`${date}T${time}`);

    if (selectedDateTime < now) {

        alert("You cannot select a past time.");

        return;
    }

    const confirmed = confirm(
        `Are you sure you want to save this inspection schedule?\n\nDate: ${formatDateDisplay(date)}\nTime: ${formatTime(time)}`
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/inspections/set-schedule/${inspectionId}`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    schedule_date: date,
                    schedule_time: time
                })
            }
        );

        const data = await response.json();

        if (data.success) {

            alert("Schedule updated");

            closeScheduleModal();

            fetchAssignedInspections();
        }

    } catch (error) {

        console.error(error);
    }
}

// ========================
// PROGRESS TRACKER
// ========================
function buildInspectionTracker(status, result) {
    const steps = [
        "Assigned",
        "Scheduled",
        "In Progress",
        "Inspected",
        "Completed"
    ];

    const statusMap = {
        "Scheduled": 1,
        "In Progress": 2,
        "Inspected": 3,
        "Completed": 4
    };
    
    const activeIndex = statusMap[status] ?? 0;

    return `
        <div class="progress-tracker">
            ${steps.map((step, i) => {
                const isCompleted = i < activeIndex;
                const isActive = i === activeIndex;
                return `
                    <div class="progress-step ${isCompleted ? "completed" : isActive ? "active" : ""}">
                        <div class="circle">${isCompleted ? "✓" : i + 1}</div>
                        <p>${step}</p>
                    </div>
                    ${i < steps.length - 1 ? `<div class="line ${i < activeIndex ? "completed" : ""}"></div>` : ""}
                `;
            }).join("")}
        </div>
        ${result ? `
            <div style="text-align:center; margin-top:-10px;">
                <span class="result-badge ${resultClass(result)}">Result: ${result}</span>
            </div>
        ` : ""}
    `;
}

// ========================
// HELPERS
// ========================
function getInspectionById(inspectionId) {
    return [...allAssigned, ...allHistory]
        .find(i => i.inspection_id === inspectionId);
}

function statusClass(status) {
    return (status || "").toLowerCase().replace(/\s+/g, "-");
}

function resultClass(result) {
    if (!result) return "";
    return result.toLowerCase().replace(/\s+/g, "-");
}

function formatDateDisplay(dateStr) {

    if (!dateStr) return "—";

    return new Date(dateStr).toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

function formatTime(timeStr) {
    if (!timeStr) return "—";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${m} ${ampm}`;
}

// ========================
// AUTH
// ========================
function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById("dropdownMenu").classList.toggle("show");
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();
    window.location.href = "index.html";
}

// CLOSE MODAL ON OVERLAY CLICK
window.addEventListener("click", (e) => {
    ["inspectionModal", "reportModal", "scheduleModal"].forEach(id => {
        const modal = document.getElementById(id);
        if (e.target === modal) modal.classList.remove("show");
    });
});

/* 
Polish the table style, status badge and other

Create the modal for inspection in applicant and admmin dashboard and their activity logs

Create payment modal form admin and applicant
Create the clearance for the final

admin dashboard should not fetched the inspection process, only the inspector

applicant and admin should have history that's where all the completed (approved/rejected) fetched
*/
