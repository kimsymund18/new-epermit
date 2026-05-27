document.getElementById("registerForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const get = (id) => document.getElementById(id)?.value;

    const data = {
        first_name: get("first_name"),
        middle_name: get("middle_name"),
        last_name: get("last_name"),
        birthdate: get("birthdate"),

        contact_number: get("contact_number"),

        street_address: get("street_address"),
        barangay: get("barangay"),
        city: get("city"),
        zip_code: get("zip_code"),

        email: get("register_email"),
        password: get("register_password"),
        confirm_password: get("confirm_password")
    };

    console.log(data);

    const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();

    alert(result.message);

    // ✅ RESET FORM AFTER SUCCESS
    this.reset();

    // optional: clear password validation UI
    document.getElementById("passwordHelp").innerText = "";
    document.getElementById("confirm_password").style.borderColor = "";
});