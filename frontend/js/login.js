document.getElementById("loginForm")
.addEventListener("submit", async function(e){

    e.preventDefault();

    const loginBtn = document.querySelector("#loginForm button");

    const data = {
        email: document.getElementById("login_email").value,
        password: document.getElementById("login_password").value
    };

    try {

        // =========================
        // LOADING STATE
        // =========================
        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";

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

        // =========================
        // ERROR HANDLING
        // =========================
        if(!response.ok){
            alert(result.message || "Login failed");
            return;
        }

        // =========================
        // SUCCESS LOGIN
        // =========================
        if(result.token){

            localStorage.setItem("token", result.token);
            localStorage.setItem("role", result.role);
            localStorage.setItem("user_id", result.user.user_id);

            // ADD THIS
            localStorage.setItem("user", JSON.stringify({

                user_id: result.user.user_id,

                first_name: result.user.first_name,
                middle_name: result.user.middle_name,
                last_name: result.user.last_name,

                contact_number: result.user.contact_number,

                street_address: result.user.street_address,
                barangay: result.user.barangay,
                city: result.user.city,
                zip_code: result.user.zip_code,

                role: result.role
            }));
            alert("Login successful");

            // =========================
            // ROLE REDIRECT
            // =========================
            if(result.role === "Super Admin"){
                window.location.href = "superadmin-dashboard.html";
            }
            else if(result.role === "Admin"){
                window.location.href = "admin-dashboard.html";
            }
            else if(result.role === "Inspector"){
                window.location.href = "inspector-dashboard.html";
            }
            else{
                window.location.href = "applicant-dashboard.html";
            }

        } else {
            alert("Invalid login response");
        }

    } catch(error){

        console.error(error);
        alert("Server error. Please try again.");

    } finally {

        // =========================
        // RESET BUTTON
        // =========================
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";

    }

});