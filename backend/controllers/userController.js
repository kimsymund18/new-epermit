const db = require("../config/db");
const bcrypt = require("bcrypt");

exports.createStaff = async (req, res) => {

    try {

        const {
            first_name,
            middle_name,
            last_name,
            email,
            password,
            role,
            contact_number,
            department
        } = req.body;

        const hashedPassword =
            await bcrypt.hash(password, 10);

        // INSERT USER
        const userSql = `
            INSERT INTO users
            (email, password, role)
            VALUES (?, ?, ?)
        `;

        const [userResult] =
            await db.query(
                userSql,
                [
                    email,
                    hashedPassword,
                    role
                ]
            );

        const userId =
            userResult.insertId;

        // INSERT STAFF PROFILE
        const staffSql = `
            INSERT INTO staff_profiles
            (
                user_id,
                first_name,
                middle_name,
                last_name,
                contact_number,
                department
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        await db.query(
            staffSql,
            [
                userId,
                first_name,
                middle_name,
                last_name,
                contact_number,
                department
            ]
        );

        res.json({
            success: true,
            message:
                "Staff created successfully"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};