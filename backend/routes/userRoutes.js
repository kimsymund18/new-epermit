const express = require("express");
const router = express.Router();

const { createStaff } = require("../controllers/userController");
const db = require("../config/db");

const authMiddleware =
    require("../middleware/authMiddleware");

// CREATE STAFF (admin/inspector)
router.post("/create-staff", createStaff);

// GET ALL USERS WITH STAFF PROFILE (SUPERADMIN)
router.get("/all-users", async (req, res) => {

    try {

        const sql = `
            SELECT 
                u.user_id,
                u.email,
                u.role,
                u.status,
                u.created_at,

                COALESCE(
                    sp.first_name,
                    a.first_name
                ) AS first_name,

                COALESCE(
                    sp.middle_name,
                    a.middle_name
                ) AS middle_name,

                COALESCE(
                    sp.last_name,
                    a.last_name
                ) AS last_name,

                COALESCE(
                    sp.department,
                    'Applicant'
                ) AS department

            FROM users u

            LEFT JOIN staff_profiles sp
                ON u.user_id = sp.user_id

            LEFT JOIN applicants a
                ON u.user_id = a.user_id

            WHERE u.role != 'Super Admin'

            ORDER BY u.created_at DESC
        `;

        const [results] =
            await db.query(sql);

        res.json({
            success: true,
            users: results
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

/* =========================================
   UPDATE USER STATUS
========================================= */

router.put(
    "/update-status/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;

            const { status } =
                req.body;

            const sql = `
                UPDATE users
                SET status = ?
                WHERE user_id = ?
            `;

            await db.query(
                sql,
                [status, userId]
            );

            res.json({
                success: true,
                message:
                    `User ${status === "Active"
                        ? "activated"
                        : "deactivated"} successfully`
            });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                success: false,
                message: err.message
            });

        }

    }
);

router.get(
    "/me",
    authMiddleware,
    async (req, res) => {

        try {

            const userId = req.user.user_id;

            const [rows] = await db.query(
                `
                SELECT
                    u.user_id,
                    u.email,
                    u.role,

                    sp.first_name,
                    sp.middle_name,
                    sp.last_name,
                    sp.department

                FROM users u

                LEFT JOIN staff_profiles sp
                    ON u.user_id = sp.user_id

                WHERE u.user_id = ?
                `,
                [userId]
            );

            if (rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            res.json({
                success: true,
                user: rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }
);

module.exports = router;