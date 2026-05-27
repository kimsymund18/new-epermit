let selectedService = "";

let isClickNavigating = false;

// ==============================
// SCROLL SPY (AUTO ACTIVE NAV)
// ==============================

let lastActiveSection = "home";

window.addEventListener("scroll", () => {

    if (isClickNavigating) return;

    let closestSection = "home";
    let minDistance = Infinity;

    sections.forEach(section => {

        const rect = section.getBoundingClientRect();

        const distance = Math.abs(rect.top);

        if (distance < minDistance) {
            minDistance = distance;
            closestSection = section.dataset.section;
        }
    });

    if (closestSection === lastActiveSection) return;

    lastActiveSection = closestSection;

    navLinks.forEach(link => {

        const href = link.getAttribute("href").substring(1);

        link.classList.toggle(
            "active-nav",
            href === closestSection
        );

    });

});

const navLinks =
    document.querySelectorAll(".navbar-nav .nav-link");

const sections =
    document.querySelectorAll(".page-section");

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const authTitle =
    document.getElementById("authTitle");

const confirmInput =
    document.getElementById("confirm_password");

const passwordInput =
    document.getElementById("register_password");

const helpText =
    document.getElementById("passwordHelp");

// ==============================
// NAVIGATION
// ==============================

navLinks.forEach(link => {

    link.addEventListener("click", e => {

        e.preventDefault();

        const targetId =
            link.getAttribute("href").substring(1);

        setSection(targetId);

    });

});

function setSection(targetId) {

    isClickNavigating = true;

    sections.forEach(sec => {
        sec.classList.toggle(
            "active",
            sec.dataset.section === targetId
        );
    });

    navLinks.forEach(link => {
        link.classList.remove("active-nav");
    });

    document
        .querySelector(`.nav-link[href="#${targetId}"]`)
        ?.classList.add("active-nav");

    const targetSection =
        document.querySelector(`[data-section="${targetId}"]`);

    if (targetSection) {
        targetSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    if (targetId === "auth") {
        showLoginForm();
    }

    setTimeout(() => {
        isClickNavigating = false;
    }, 700);
}

// ==============================
// AUTH FORM TOGGLE
// ==============================

function showRegisterForm() {

    loginForm.classList.remove("active-form");
    loginForm.classList.add("hidden-form");

    registerForm.classList.remove("hidden-form");
    registerForm.classList.add("active-form");

    authTitle.innerText = "Register";
}

function showLoginForm() {

    registerForm.classList.remove("active-form");
    registerForm.classList.add("hidden-form");

    loginForm.classList.remove("hidden-form");
    loginForm.classList.add("active-form");

    authTitle.innerText = "Login";
}

document
    .getElementById("showRegister")
    .addEventListener("click", showRegisterForm);

document
    .getElementById("showLogin")
    .addEventListener("click", showLoginForm);

// ==============================
// LOGIN
// ==============================

loginForm.addEventListener(
    "submit",
    async function (e) {

        e.preventDefault();

        const submitBtn =
            loginForm.querySelector("button");

        submitBtn.disabled = true;

        submitBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

        try {

            const data = {
                email:
                    document.getElementById("login_email").value,

                password:
                    document.getElementById("login_password").value
            };

            const response = await fetch(
                "http://localhost:5000/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                }
            );

            const result = await response.json();

            if (result.token) {

                localStorage.setItem(
                    "token",
                    result.token
                );

                localStorage.setItem(
                    "role",
                    result.role
                );

                localStorage.setItem(
                    "user",
                    JSON.stringify(result.user)
                );

                showToast(
                    "Login successful",
                    "success"
                );

                setTimeout(() => {

                    if(result.role === "Super Admin"){
                        window.location.href =
                            "superadmin-dashboard.html";
                    }

                    else if(result.role === "Admin"){
                        window.location.href =
                            "admin-dashboard.html";
                    }

                    else if(result.role === "Inspector"){
                        window.location.href =
                            "inspector-dashboard.html";
                    }

                    else{
                        window.location.href =
                            "applicant-dashboard.html";
                    }

                }, 800);

            } else {

                showToast(
                    result.message,
                    "error"
                );

            }

        } catch (err) {

            showToast(
                "Server connection failed",
                "error"
            );

            console.error(err);

        } finally {

            submitBtn.disabled = false;

            submitBtn.innerHTML = "Login";
        }
    }
);

// ==============================
// REGISTER
// ==============================

registerForm.addEventListener(
    "submit",
    async function (e) {

        e.preventDefault();

        const password =
            passwordInput.value;

        const confirmPassword =
            confirmInput.value;

        if(password !== confirmPassword){

            showToast(
                "Passwords do not match",
                "error"
            );

            return;
        }

        const submitBtn =
            registerForm.querySelector("button");

        submitBtn.disabled = true;

        submitBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';

        try {

            const data = {

                first_name:
                    document.getElementById("first_name").value,

                middle_name:
                    document.getElementById("middle_name").value,

                last_name:
                    document.getElementById("last_name").value,

                birthdate:
                    document.getElementById("birthdate").value,

                contact_number:
                    document.getElementById("contact_number").value,

                street_address:
                    document.getElementById("street_address").value,

                barangay:
                    document.getElementById("barangay").value,

                city:
                    document.getElementById("city").value,

                zip_code:
                    document.getElementById("zip_code").value,

                email:
                    document.getElementById("register_email").value,

                password: password
            };

            const response = await fetch(
                "http://localhost:5000/api/auth/register",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data)
                }
            );

            const result = await response.json();

            showToast(
                result.message,
                response.ok ? "success" : "error"
            );

            if(response.ok){

                registerForm.reset();

                helpText.innerText = "";

                confirmInput.classList.remove(
                    "is-valid",
                    "is-invalid"
                );

                passwordInput.classList.remove(
                    "is-valid",
                    "is-invalid"
                );

                showToast(
                    "Registration successful! Please login.",
                    "success"
                );

                setTimeout(() => {
                    showLoginForm();
                }, 1000);
            }

        } catch (err) {

            showToast(
                "Registration failed",
                "error"
            );

            console.error(err);

        } finally {

            submitBtn.disabled = false;

            submitBtn.innerHTML = "Register";
        }
    }
);

// ==============================
// PASSWORD TOGGLE
// ==============================

function togglePassword(id, el){

    const input =
        document.getElementById(id);

    const icon =
        el.querySelector("i");

    if(input.type === "password"){

        input.type = "text";

        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");

    } else {

        input.type = "password";

        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

// ==============================
// PASSWORD VALIDATION
// ==============================

confirmInput.addEventListener("input", () => {

    if(confirmInput.value !== passwordInput.value){

        confirmInput.classList.add("is-invalid");

        confirmInput.classList.remove("is-valid");

        helpText.innerText =
            "Passwords do not match";

        helpText.style.color = "red";

    } else {

        confirmInput.classList.add("is-valid");

        confirmInput.classList.remove("is-invalid");

        helpText.innerText =
            "Passwords match";

        helpText.style.color = "green";
    }
});

// ==============================
// PASSWORD STRENGTH CHECKER
// ==============================

passwordInput.addEventListener("input", () => {

    const password =
        passwordInput.value;

    let strength = 0;

    // LENGTH
    if(password.length >= 8){
        strength++;
    }

    // UPPERCASE
    if(/[A-Z]/.test(password)){
        strength++;
    }

    // NUMBER
    if(/[0-9]/.test(password)){
        strength++;
    }

    // SPECIAL CHAR
    if(/[^A-Za-z0-9]/.test(password)){
        strength++;
    }

    if(password.length === 0){

        helpText.innerText = "";

        return;
    }

    if(strength <= 1){

        helpText.innerText =
            "Weak password";

        helpText.style.color =
            "#ef4444";
    }

    else if(strength <= 3){

        helpText.innerText =
            "Medium password";

        helpText.style.color =
            "#f59e0b";
    }

    else {

        helpText.innerText =
            "Strong password";

        helpText.style.color =
            "#22c55e";
    }
});

// ==============================
// CONTACT NUMBER FORMAT
// ==============================

const contactInput =
    document.getElementById("contact_number");

contactInput.addEventListener("input", () => {

    let value =
        contactInput.value.replace(/\D/g, "");

    // LIMIT 11 DIGITS
    value = value.substring(0, 11);

    contactInput.value = value;
});

// ==============================
// ZIP CODE FORMAT
// ==============================

const zipInput =
    document.getElementById("zip_code");

zipInput.addEventListener("input", () => {

    let value =
        zipInput.value.replace(/\D/g, "");

    value = value.substring(0, 4);

    zipInput.value = value;
});

// ==============================
// BIRTHDATE LIMIT
// ==============================

const birthdateInput =
    document.getElementById("birthdate");

const today =
    new Date().toISOString().split("T")[0];

birthdateInput.max = today;

// ==============================
// AGE VALIDATION
// ==============================

birthdateInput.addEventListener("change", () => {

    const birthdate =
        new Date(birthdateInput.value);

    const todayDate =
        new Date();

    let age =
        todayDate.getFullYear() -
        birthdate.getFullYear();

    const monthDiff =
        todayDate.getMonth() -
        birthdate.getMonth();

    if (
        monthDiff < 0 ||
        (
            monthDiff === 0 &&
            todayDate.getDate() < birthdate.getDate()
        )
    ) {
        age--;
    }

    if (age < 18) {

        showToast(
            "You must be at least 18 years old",
            "error"
        );

        birthdateInput.value = "";
    }

});

function showLoader(){

    document.getElementById("globalLoader")
        .style.display = "flex";
}

function hideLoader(){

    document.getElementById("globalLoader")
        .style.display = "none";
}

// ==============================
// MODAL SYSTEM
// ==============================

function openServiceModal(service) {

    selectedService = service;

    const title =
        document.getElementById("modalTitle");

    const modalIcon =
        document.getElementById("modalIcon");

    const desc =
        document.getElementById("modalDescription");

    const docsList =
        document.getElementById("modalDocumentsList"); 

    let content = "";
    let fileName = "";
    let filePath = "";

    if (service === "Zoning Clearance") {

        fileName = "Unified Application for Bldg Permit.pdf";
        filePath = `documents/${fileName}`;

        content = `
        <p>
        Accept complete zoning clearance applications and simplify land-use verification through a digital platform.
        </p>

        <ul>
            <li>Lot plan with vicinity map certified by Geodetic Engineer</li>
            <li>Certified true copy of TCT (land title)</li>
            <li>Photocopy of Tax Declaration (land/building)</li>
            <li>Photocopy of Real Property Tax Receipts</li>
            <li>Barangay Construction Permit/Clearance</li>
            <li>Architectural Plan / Site Development Plan (1 set)</li>
        </ul>
        `;

        docsList.innerHTML = `
        <a href="documents/zoning-clearance-form.pdf"
        download
        class="doc-item">

            <div class="doc-left">
                <i class="fa-solid fa-file-pdf"></i>
                <span>Download Zoning Clearance Form</span>
            </div>

            <i class="fa-solid fa-download"></i>
        </a>
        `;
    }

    else if (
        service ===
        "Fire Safety Evaluation Clearance"
    ) {

        fileName = "Unified Application for Bldg Permit.pdf";
        filePath = `documents/${fileName}`;

        content = `
        <p>
        Ensure compliance with fire safety standards through digital application processes.
        </p>

        <ul>

            <li>Architectural Plan (3 sets)</li>
            <li>Structural Plan (3 sets)</li>
            <li>Plumbing Plan (3 sets)</li>
            <li>Electrical Plan (3 sets)</li>
            <li>Mechanical Plan (if applicable)</li>
            <li>Electronic Plan (if applicable)</li>
            <li>Fire Protection Plan (if applicable)</li>
            <li>Detailed Bill of Materials with Labor Cost signed and sealed</li>
            <li>PTR/PRC Originally signed and sealed</li>
        </ul>
        `;

        docsList.innerHTML = `
        <a href="documents/fire-safety-form.pdf"
        download
        class="doc-item">

            <div class="doc-left">
                <i class="fa-solid fa-file-pdf"></i>
                <span>Download Fire Safety Form</span>
            </div>

            <i class="fa-solid fa-download"></i>
        </a>
        `;
    }

    else if (service === "Building Permit") {

        fileName = "Unified Application for Bldg Permit.pdf";
        filePath = `documents/${fileName}`;

        content = `
        <p>
        Apply for building permits through an integrated approval system.
        </p>

        <ul>

            <li>Locational Clearance (Zoning Admin Office)</li>
            <li>Fire Safety Evaluation Clearance (BFP)</li>
            <li>Certified True Copy of Transfer Certificate of Title (TCT)</li>
            <li>Tax Declaration & Tax Receipt (Current Year) - Land & Building"</li>
            <li>Location Plan (signed & sealed by Geodetic Engineer)</li>
            <li>4 Sets Building Plans (Blue Print)",
            <li>Contract of Lease (if applicant is not the registered owner)</li>
            <li>Barangay Clearance</li>
            <li>Construction Safety Health Program (DOLE)</li>
            <li>Soil Test Result (3-storey building & higher)</li>
        </ul>
        `;

        docsList.innerHTML = `
        <a href="documents/building-permit-form.pdf"
        download
        class="doc-item">

            <div class="doc-left">
                <i class="fa-solid fa-file-pdf"></i>
                <span>Download Building Permit Form</span>
            </div>

            <i class="fa-solid fa-download"></i>
        </a>
        `;
    }

    // =====================================
    // MODAL ICON SWITCH
    // =====================================

    if(service === "Building Permit"){

        modalIcon.innerHTML = `
            <i class="fa-solid fa-building"></i>
        `;

        modalIcon.style.background =
            "linear-gradient(135deg,#f97316,#ea580c)";
    }

    else if(service === "Zoning Clearance"){

        modalIcon.innerHTML = `
            <i class="fa-solid fa-map-location-dot"></i>
        `;

        modalIcon.style.background =
            "linear-gradient(135deg,#3b82f6,#2563eb)";
    }

    else if(
        service ===
        "Fire Safety Evaluation Clearance"
    ){

        modalIcon.innerHTML = `
            <i class="fa-solid fa-fire-extinguisher"></i>
        `;

        modalIcon.style.background =
            "linear-gradient(135deg,#ef4444,#dc2626)";
    }

    docsList.innerHTML = `
    <a href="${filePath}"
    download
    class="doc-item">

        <div class="doc-left">
            <i class="fa-solid fa-file-pdf"></i>

            <span>
            ${fileName
                .replace(".pdf", "")
                .replaceAll("-", " ")
            }
            </span>
        </div>

        <i class="fa-solid fa-download"></i>
    </a>
    `;

    title.innerText = service;

    desc.innerHTML = content;

    const modal =
        document.getElementById("serviceModal");

    modal.classList.add("show-modal");
    document.body.style.overflow = "hidden";
}

function closeServiceModal() {

    const modal =
        document.getElementById("serviceModal");

    modal.classList.remove("show-modal");

    document.body.style.overflow = "auto";
}

// CLOSE ON OUTSIDE CLICK
window.onclick = function(event){

    const modal =
        document.getElementById("serviceModal");

    if(event.target === modal){
        closeServiceModal();
    }
};

// ESC CLOSE
document.addEventListener("keydown", e => {

    if(e.key === "Escape"){
        closeServiceModal();
    }
});

// ==============================
// TOAST NOTIFICATIONS
// ==============================

function showToast(message, type = "success") {

    const toast =
        document.createElement("div");

    toast.className =
        `custom-toast ${type}`;

    toast.innerHTML = `
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 100);

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 3000);
}

// ==============================
// INITIAL LOAD
// ==============================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setSection("home");
    }
);

function toggleChatUI() {

    const box =
        document.getElementById("chatBoxUI");

    if (box.style.display === "block") {
        box.style.display = "none";
    } else {
        box.style.display = "block";
    }
}

function handleProceed() {
    closeServiceModal();
    setSection("auth");
}

function navigateTo(sectionId) {
    setSection(sectionId);
}

function openRequirementsModal() {
    document
        .getElementById("requirementsModal")
        .classList.add("show-modal");
}

function closeRequirementsModal() {
    document
        .getElementById("requirementsModal")
        .classList.remove("show-modal");
}
