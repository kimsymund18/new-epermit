const express = require("express");

const router = express.Router();

const permitController =
    require("../controllers/permitController");

const authMiddleware =
    require("../middleware/authMiddleware");

const upload =
    require("../middleware/uploadMiddleware");

const db =
    require("../config/db");

const departmentPermitMap =
    require("../utils/departmentPermitMap");

// =========================
// SUBMIT APPLICATION
// =========================
router.post(
    "/submit",
    authMiddleware,
    upload.any(),
    permitController.submitPermit
);

// =========================
// FETCH APPLICATIONS
// =========================
router.get(
    "/my-permits",
    authMiddleware,
    permitController.getMyPermits
);

// =========================
// GET ALL PERMITS
// =========================
router.get(
    "/all-permits",
    authMiddleware,
    async (req, res) => {

    try {

        const userDepartment =
            req.user.department;

        const permitType =
            departmentPermitMap[userDepartment];

        let query = `
            SELECT
                p.*,
                u.email
            FROM permits p
            JOIN users u
                ON p.user_id = u.user_id
            WHERE p.status NOT IN ('Rejected', 'For Clearance', 'Approved')
        `;

        let values = [];

        // FILTER ONLY FOR DEPARTMENT ADMINS
        if (permitType) {

            query += `
                AND p.permit_type = ?
            `;

            values.push(permitType);
        }

        query += `
            ORDER BY p.submitted_at DESC
        `;

        const [results] =
            await db.query(query, values);

        res.json({
            success: true,
            permits: results
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// =========================
// RECENT RESUBMISSIONS
// =========================
router.get(
    "/recent-resubmissions",
    authMiddleware,
    async (req, res) => {

    try {

        const permitType =
            departmentPermitMap[
                req.user.department
            ];

        let query = `
            SELECT
                l.log_id,
                l.created_at,

                pd.document_id,
                pd.document_name,

                p.project_title,
                p.owner_name,
                p.control_number

            FROM document_review_logs l

            JOIN permit_documents pd
                ON l.document_id = pd.document_id

            JOIN permits p
                ON l.permit_id = p.permit_id

            WHERE l.new_status = 'Resubmission'
        `;

        let values = [];

        if (permitType) {

            query += `
                AND p.permit_type = ?
            `;

            values.push(permitType);
        }

        query += `
            ORDER BY l.created_at DESC
            LIMIT 5
        `;

        const [activities] =
            await db.query(query, values);

        res.json({
            success: true,
            activities
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// MY ACTIVITIES
// =========================
router.get(
    "/my-activities",
    authMiddleware,
    async (req, res) => {

        try {

            const userId = req.user.user_id;

            const [activities] = await db.query(`

                /* =========================
                PERMIT STATUS ACTIVITIES
                ========================= */
                SELECT
                    p.permit_id,
                    NULL AS log_id,

                    'permit_status' AS activity_type,

                    NULL AS document_name,

                    p.status AS new_status,
                    NULL AS old_status,
                    NULL AS remarks,

                    p.project_title,
                    p.permit_type,
                    p.control_number,

                    p.last_updated AS created_at

                FROM permits p

                WHERE p.user_id = ?

                UNION ALL

                /* =========================
                DOCUMENT REVIEW ACTIVITIES
                ========================= */
                SELECT
                    p.permit_id,
                    l.log_id,

                    'document_review' AS activity_type,

                    COALESCE(
                        l.document_name,
                        pd.document_name,
                        'Unknown Document'
                    ) AS document_name,

                    l.new_status,
                    l.old_status,
                    l.remarks,

                    p.project_title,
                    p.permit_type,
                    p.control_number,

                    l.created_at

                FROM document_review_logs l

                JOIN permits p
                    ON l.permit_id = p.permit_id

                LEFT JOIN permit_documents pd
                    ON l.document_id = pd.document_id

                WHERE p.user_id = ?

                ORDER BY created_at DESC, log_id DESC

                LIMIT 10

            `, [userId, userId]);

            res.json({
                success: true,
                activities
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

router.get("/activities/recent", authMiddleware, async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT *
            FROM permit_activities
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            activities: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// APPLICANT: APPLICATION HISTORY
// =========================
router.get(
    "/my-permits/history",
    authMiddleware,
    async (req, res) => {

        try {

            const user_id = req.user.user_id;

            const [permits] = await db.query(
                `
                SELECT
                    p.permit_id,
                    p.control_number,
                    p.permit_type,
                    p.project_title,
                    p.status,
                    p.submitted_at,
                    p.last_updated,

                    CONCAT(
                        sp.first_name,
                        ' ',
                        COALESCE(sp.middle_name, ''),
                        ' ',
                        sp.last_name
                    ) AS reviewed_by

                FROM permits p

                LEFT JOIN users u
                    ON p.reviewed_by = u.user_id

                LEFT JOIN staff_profiles sp
                    ON u.user_id = sp.user_id

                WHERE p.user_id = ?
                AND p.status IN (
                    'Rejected',
                    'For Clearance',
                    'Approved'
                )

                ORDER BY p.submitted_at DESC
                `,
                [user_id]
            );

            res.json({
                success: true,
                permits
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

// =========================
// ADMIN: APPLICATION HISTORY
// =========================
router.get(
    "/history",
    authMiddleware,
    async (req, res) => {
        try {
            const permitType =
                departmentPermitMap[req.user.department];

            let query = `
                SELECT
                    p.permit_id,
                    p.control_number,
                    p.permit_type,
                    p.project_title,
                    p.owner_name,
                    p.status,
                    p.submitted_at,
                    u.email
                FROM permits p
                JOIN users u ON p.user_id = u.user_id
                WHERE p.status IN ('Rejected', 'For Clearance', 'Approved')
            `;

            let values = [];

            if (permitType) {
                query += ` AND p.permit_type = ?`;
                values.push(permitType);
            }

            query += ` ORDER BY p.submitted_at DESC`;

            const [permits] = await db.query(query, values);

            res.json({ success: true, permits });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);


// =========================
// FETCH FILTERED INSPECTORS
// =========================
router.get(
    "/inspectors/:permitId",
    authMiddleware,
    async (req, res) => {

        try {

            const { permitId } = req.params;

            // =========================
            // GET PERMIT TYPE
            // =========================
            const [permitRows] = await db.query(`
                SELECT permit_type
                FROM permits
                WHERE permit_id = ?
            `, [permitId]);

            if (!permitRows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Permit not found"
                });
            }

            const permitType =
                permitRows[0].permit_type;

            // =========================
            // MAP PERMIT -> DEPARTMENT
            // =========================
            let department = null;

            if (
                permitType === "Building Permit"
            ) {

                department = "OBO";

            } else if (
                permitType === "Zoning Clearance"
            ) {

                department = "Zoning";

            } else if (
                permitType ===
                "Fire Safety Evaluation Clearance"
            ) {

                department = "Fire Safety";
            }

            // =========================
            // FETCH INSPECTORS
            // =========================
            const [inspectors] = await db.query(`
                SELECT
                    u.user_id,
                    sp.first_name,
                    sp.middle_name,
                    sp.last_name,
                    sp.department

                FROM users u

                JOIN staff_profiles sp
                    ON u.user_id = sp.user_id

                WHERE u.role = 'Inspector'
                AND u.status = 'Active'
                AND sp.department = ?

                ORDER BY
                    sp.first_name ASC,
                    sp.last_name ASC
            `, [department]);

            res.json({
                success: true,
                inspectors
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

// =========================
// GET INSPECTION STATUS
// =========================
router.get(
    "/:permitId/inspection",
    authMiddleware,
    permitController.getInspectionStatus
);

// =========================
// FETCH SINGLE APPLICATION
// =========================
router.get("/:id", authMiddleware, async (req, res) => {

    try {

        const permitId = req.params.id;

        // =========================
        // FETCH PERMIT
        // =========================
        const [permitRows] = await db.query(
        `
        SELECT
            permits.*,

            applicants.first_name,
            applicants.middle_name,
            applicants.last_name,
            applicants.contact_number AS applicant_contact_number,

            inspections.inspection_id,
            inspections.schedule_date,
            inspections.schedule_time,
            inspections.status AS inspection_status,
            inspections.inspection_type,
            inspections.findings,
            inspections.recommendations,
            inspections.remarks AS inspection_remarks,

            CONCAT(
                sp.first_name,
                ' ',
                sp.last_name
            ) AS inspector_name,

            sp.department AS inspector_department

        FROM permits

        LEFT JOIN applicants
            ON permits.user_id = applicants.user_id

        LEFT JOIN inspections
            ON permits.permit_id = inspections.permit_id

        LEFT JOIN users iu
            ON inspections.inspector_id = iu.user_id

        LEFT JOIN staff_profiles sp
            ON iu.user_id = sp.user_id

        WHERE permits.permit_id = ?
        `,
        [permitId]
        );

        if (permitRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        const permitType =
            departmentPermitMap[
                req.user.department
            ];

        if (
            permitType &&
            permitRows[0].permit_type !== permitType
        ) {

            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        // =========================
        // FETCH DOCUMENTS
        // =========================
        const [documents] = await db.query(
            `
            SELECT
                document_id,
                category,
                document_key,
                document_name,
                file_name,
                file_path,
                status,
                remarks,
                uploaded_at
            FROM permit_documents
            WHERE permit_id = ?
            `,
            [permitId]
        );

        res.json({
            success: true,
            permit: permitRows[0],
            documents
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// UPLOAD REQUIRED uploadedDocuments
// =========================
router.post(
    "/upload-document/:permitId",
    authMiddleware,
    upload.single("file"),
    permitController.uploadDocument
);

router.put(
    "/review-documents/:permitId",
    authMiddleware,
    permitController.reviewDocuments
);

router.get(
    "/recent-review-activities",
    authMiddleware,
    permitController.getRecentReviewActivities
);

// =========================
// ASSIGN INSPECTOR
// =========================
router.post(
    "/assign-inspector/:permitId",
    authMiddleware,
    permitController.assignInspector
);

module.exports = router;
