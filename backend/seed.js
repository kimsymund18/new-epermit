const db = require("./config/db");

const bcrypt = require("bcrypt");

async function createSuperAdmin() {

    try {

        // CHECK IF SUPER ADMIN EXISTS
        const [rows] = await db.query(
            `SELECT * FROM users
             WHERE role = 'Super Admin'`
        );

        if(rows.length === 0){

            // HASH PASSWORD
            const hashedPassword = await bcrypt.hash(
                "123456",
                10
            );

            // INSERT SUPER ADMIN
            const [result] = await db.query(
                `INSERT INTO users
                (
                    email,
                    password,
                    role,
                    status
                )
                VALUES (?, ?, ?, ?)`,
                [
                    "superadmin@system.com",
                    hashedPassword,
                    "Super Admin",
                    "Active"
                ]
            );

            console.log("✅ Super Admin created");

        } else {

            console.log("ℹ️ Super Admin already exists");

        }

    } catch(error){

        console.error(
            "Super Admin creation error:",
            error
        );

    }

}

module.exports = createSuperAdmin;