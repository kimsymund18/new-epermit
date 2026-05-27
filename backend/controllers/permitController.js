const db = require("../config/db");
const fs = require("fs");
const logActivity = require("../utils/activityLogger");

function toRelativePath(fullPath) {
    return fullPath
        .replace(/\\/g, "/")
        .replace(/^.*\/uploads\//, "uploads/");
}

exports.submitPermit = async (req, res) => {

    try {

        const user_id = req.user.user_id;

        const {
            permit_type,
            project_title,
            project_location,
            owner_name,
            contact_number,
            full_address,
            applicant_type,
            applicant_name,
            estimated_cost
        } = req.body;

        // =========================
        // GENERATE CONTROL NUMBER
        // =========================
        const control_number =
            "PRM-" + Date.now();

        // =========================
        // INSERT PERMIT
        // =========================
        const [permitResult] = await db.query(
            `
            INSERT INTO permits
            (
                user_id,
                control_number,
                permit_type,
                project_title,
                project_location,
                estimated_cost,
                owner_name,
                applicant_type,
                applicant_name,
                contact_number,
                full_address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                user_id,
                control_number,
                permit_type,
                project_title,
                project_location,
                estimated_cost,
                owner_name,
                applicant_type,
                applicant_name,
                contact_number,
                full_address
            ]
            );

        const permit_id = permitResult.insertId;

        // =========================
        // INSERT DOCUMENTS
        // =========================
        if (req.files && req.files.length > 0) {

            for (const file of req.files) {

                const documentLabels = {
                    application_form: "Application Form",
                    project_location_map: "Project Location Map"
                };

                await db.query(
                `
                INSERT INTO permit_documents
                (
                    permit_id,
                    category,
                    document_key,
                    document_name,
                    file_name,
                    file_path,
                    file_size,
                    mime_type
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    permit_id,

                    file.fieldname === "project_location_map"
                        ? "Location"
                        : "Application",

                    file.fieldname,

                    documentLabels[file.fieldname] || file.fieldname,

                    file.originalname,

                    toRelativePath(file.path),

                    file.size,

                    file.mimetype
                ]
                );
            }
        }

        res.status(201).json({

            success: true,

            message: "Application submitted successfully",

            permit_id,

            control_number
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

exports.getMyPermits = async (req, res) => {

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

                CASE

                    WHEN p.status IN (
                        'For Inspection',
                        'For Visitation',
                        'For Reinspection'
                    )

                    THEN TRIM(
                        CONCAT(
                            isp.first_name,
                            ' ',
                            COALESCE(isp.middle_name, ''),
                            ' ',
                            isp.last_name
                        )
                    )

                    ELSE TRIM(
                        CONCAT(
                            rsp.first_name,
                            ' ',
                            COALESCE(rsp.middle_name, ''),
                            ' ',
                            rsp.last_name
                        )
                    )

                END AS reviewed_by

            FROM permits p

            -- REVIEWER
            LEFT JOIN users ru
                ON p.reviewed_by = ru.user_id

            LEFT JOIN staff_profiles rsp
                ON ru.user_id = rsp.user_id

            -- LATEST INSPECTION
            LEFT JOIN inspections i
                ON i.inspection_id = (
                    SELECT inspection_id
                    FROM inspections
                    WHERE permit_id = p.permit_id
                    ORDER BY inspection_id DESC
                    LIMIT 1
                )

            -- INSPECTOR
            LEFT JOIN users iu
                ON i.inspector_id = iu.user_id

            LEFT JOIN staff_profiles isp
                ON iu.user_id = isp.user_id

            WHERE p.user_id = ?

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
            message: "Server Error"
        });
    }
};

exports.uploadDocument = async (req, res) => {

    try {

        const { permitId } = req.params;

        const {
            document_key,
            document_name
        } = req.body;

        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        // =========================
        // SET CATEGORY
        // =========================
        let category = "Requirement";

        // KEEP ORIGINAL CATEGORY
        if (document_key === "application_form") {
            category = "Application";
        }

        if (document_key === "project_location_map") {
            category = "Location";
        }

        // =========================
        // DELETE OLD FILE IF EXISTS
        // =========================
        const [oldDocs] = await db.query(
            `
            SELECT file_path
            FROM permit_documents
            WHERE permit_id = ?
            AND document_key = ?
            `,
            [permitId, document_key]
        );

        if (oldDocs.length > 0) {

            const oldPath = oldDocs[0].file_path;

            // CHECK IF FILE EXISTS
            if (oldPath && fs.existsSync(oldPath)) {

                fs.unlinkSync(oldPath);

                console.log("Old file deleted:", oldPath);
            }
        }

        // =========================
        // CHECK EXISTING DOCUMENT
        // =========================
        const [existingRows] = await db.query(
            `
            SELECT status
            FROM permit_documents
            WHERE permit_id = ?
            AND document_key = ?
            `,
            [permitId, document_key]
        );

        const existingStatus =
            existingRows.length > 0
                ? existingRows[0].status
                : null;

        // IF REJECTED -> RESUBMISSION
        // OTHERWISE -> PENDING
        const newStatus =
            existingStatus === "Rejected"
                ? "Resubmission"
                : "Pending";

        // =========================
        // UPSERT DOCUMENT
        // =========================
        await db.query(
            `
            INSERT INTO permit_documents
            (
                permit_id,
                category,
                document_key,
                document_name,
                file_name,
                file_path,
                file_size,
                mime_type,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)

            ON DUPLICATE KEY UPDATE
                category = VALUES(category),
                file_name = VALUES(file_name),
                file_path = VALUES(file_path),
                file_size = VALUES(file_size),
                mime_type = VALUES(mime_type),
                status = VALUES(status),
                uploaded_at = CURRENT_TIMESTAMP
            `,
            [
                permitId,
                category,
                document_key,
                document_name,
                file.originalname,
                toRelativePath(file.path),
                file.size,
                file.mimetype,
                newStatus
            ]
        );

        // =========================
        // LOG RESUBMISSION EVENT
        // =========================
        if (newStatus === "Resubmission") {

            await db.query(`
                INSERT INTO document_review_logs
                (
                    document_id,
                    permit_id,
                    old_status,
                    new_status,
                    remarks,
                    reviewed_by,
                    document_name
                )
                VALUES
                (
                    (
                        SELECT document_id
                        FROM permit_documents
                        WHERE permit_id = ?
                        AND document_key = ?
                    ),
                    ?,
                    'Rejected',
                    'Resubmission',
                    'Applicant resubmitted document',
                    NULL,
                    ?
                )
            `,[
                permitId,
                document_key,
                permitId,
                document_name
            ]);

            // ACTIVITY FEED
            await logActivity(db, {

                permit_id: permitId,

                activity_type: "document_review",

                old_status: "Rejected",

                new_status: "Resubmission",

                title: "Document Reuploaded",

                message: `${document_name} was re-submitted by applicant.`,

                remarks: "Applicant uploaded revised document.",

                document_name: document_name,

                created_by: req.user.user_id
            });
        }

        res.json({
            success: true,
            message: "Document uploaded successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.reviewDocuments = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const permitId = req.params.permitId;

        const {
            permitStatus,
            documentChanges,
            forceStatusUpdate
        } = req.body;

        const reviewedBy = req.user.user_id;

        // GET CURRENT PERMIT STATUS
        const [permitRows] = await connection.query(`
            SELECT status
            FROM permits
            WHERE permit_id = ?
        `, [permitId]);

        const currentPermitStatus = permitRows[0]?.status;

        // UPDATE DOCUMENTS + LOGS
        for (const change of documentChanges || []) {

            const [oldRows] = await connection.query(
                `
                SELECT status
                FROM permit_documents
                WHERE document_id = ?
                `,
                [change.document_id]
            );

            const oldStatus = oldRows[0]?.status || "Pending";

            await connection.query(
                `
                UPDATE permit_documents
                SET
                    status = ?,
                    remarks = ?,
                    reviewed_by = ?
                WHERE document_id = ?
                `,
                [
                    change.status,
                    change.remarks || null,
                    reviewedBy,
                    change.document_id
                ]
            );

            // =========================
            // FIX: resolve document_name FIRST
            // =========================
            let document_name = change.document_name;

            if (!document_name) {
                const [rows] = await connection.query(
                    `
                    SELECT document_name
                    FROM permit_documents
                    WHERE document_id = ?
                    `,
                    [change.document_id]
                );

                document_name = rows?.[0]?.document_name || "Unknown Document";
            }

            // INSERT LOG (FIXED PLACEHOLDERS)
            await connection.query(
                `
                INSERT INTO document_review_logs
                (
                    document_id,
                    permit_id,
                    old_status,
                    new_status,
                    remarks,
                    reviewed_by,
                    document_name
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    change.document_id,
                    permitId,
                    oldStatus,
                    change.status,
                    change.remarks || null,
                    reviewedBy,
                    document_name
                ]
            );

            // ACTIVITY LOG (ONLY FOR REJECT/RESUBMISSION)
            if (
                change.status === "Rejected" ||
                change.status === "Resubmission" ||
                change.status === "Approved"
            ) {

                let title = "Document Review";
                let message = "";

            if (change.status === "Approved") {
                title = "Document Approved";
                message = `${document_name} was approved by admin.`;
            } else if (change.status === "Rejected" || change.status === "Resubmission") {
                title = "Document Rejected";
                message = `${document_name} was rejected by admin.`;
            }

                await logActivity(connection, {

                    permit_id: permitId,

                    activity_type: "document_review",

                    old_status: oldStatus,

                    new_status: change.status,

                    title,

                    message,

                    remarks: change.remarks || null,

                    document_name,

                    created_by: reviewedBy
                });
            }
        }

        // UPDATE PERMIT STATUS (ONLY IF CHANGED)
        const shouldUpdatePermitStatus =
            permitStatus &&
            permitStatus !== currentPermitStatus;

        if (shouldUpdatePermitStatus) {

            await connection.query(`
                UPDATE permits
                SET
                    status = ?,
                    reviewed_by = ?,
                    reviewed_at = NOW()
                WHERE permit_id = ?
            `, [
                permitStatus,
                reviewedBy,
                permitId
            ]);

            await logActivity(connection, {
                permit_id: permitId,
                activity_type: "permit_status",
                old_status: currentPermitStatus,
                new_status: permitStatus,
                title: "Permit Status Update",
                message: `Permit moved from ${currentPermitStatus} to ${permitStatus}`,
                created_by: reviewedBy
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message: "Documents reviewed successfully"
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {

        connection.release();
    }
};

const departmentPermitMap =
    require("../utils/departmentPermitMap");

exports.getRecentReviewActivities =
async (req, res) => {

    try {

        const permitType =
            departmentPermitMap[
                req.user.department
            ];

        let query = `
        SELECT
            l.activity_id,
            l.permit_id,
            l.inspection_id,
            l.activity_type,
            l.old_status,
            l.new_status,
            l.title,
            l.message,
            l.remarks,
            
            COALESCE(l.document_name, d.document_name, 'Unknown Document') AS document_name,

            l.created_at,

            p.project_title,
            p.permit_type,
            p.owner_name

        FROM document_review_logs l

        JOIN permits p
            ON l.permit_id = p.permit_id

        LEFT JOIN permit_documents d
            ON l.document_id = d.document_id
        `;

        let values = [];

        if (permitType) {

            query += `
                WHERE p.permit_type = ?
            `;

            values.push(permitType);
        }

        query += `
            ORDER BY l.created_at DESC
            LIMIT 10
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
            success: false
        });
    }
};

exports.assignInspector = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const { permitId } = req.params;

        const { inspector_id } = req.body;

        const reviewedBy = req.user.user_id;

        // =========================
        // AUTO-APPROVE DOCUMENTS
        // =========================
        // APPROVE ALL PENDING OR RESUBMISSION
        const [documents] = await connection.query(`
            SELECT
                document_id,
                status,
                document_name
            FROM permit_documents
            WHERE permit_id = ?
            AND status IN ('Pending', 'Resubmission')
        `, [permitId]);

        for (const doc of documents) {

            // UPDATE DOCUMENT STATUS
            await connection.query(`
                UPDATE permit_documents
                SET
                    status = 'Approved',
                    remarks = NULL,
                    reviewed_by = ?
                WHERE document_id = ?
            `, [
                reviewedBy,
                doc.document_id
            ]);

            // INSERT REVIEW LOG
            await connection.query(`
                INSERT INTO document_review_logs (
                    document_id,
                    permit_id,
                    old_status,
                    new_status,
                    remarks,
                    reviewed_by,
                    document_name
                )
                VALUES (?, ?, ?, 'Approved', ?, ?, ?)
            `, [
                doc.document_id,
                permitId,
                doc.status,
                'Automatically approved before inspection assignment',
                reviewedBy,
                doc.document_name
            ]);

            // =========================
            // ACTIVITY LOG
            // =========================
            await logActivity(connection, {

                permit_id: permitId,

                activity_type: "permit_status",

                event_type: "inspector_assigned",

                old_status: oldStatus,

                new_status: "For Inspection",

                title: "Inspector Assigned",

                message:
                    `Assigned to Inspector ${inspector.first_name} ${inspector.last_name}`,

                created_by: reviewedBy

            });
        }

        // =========================
        // CREATE INSPECTION
        // =========================
        const [inspectionResult] = await connection.query(`
            INSERT INTO inspections (

                permit_id,
                inspector_id,
                created_by

            )
            VALUES (?, ?, ?)
        `, [

            permitId,
            inspector_id,
            reviewedBy

        ]);

        const inspectionId =
            inspectionResult.insertId;

        // =========================
        // GET CURRENT STATUS
        // =========================
        const [permitRows] = await connection.query(`
            SELECT status
            FROM permits
            WHERE permit_id = ?
        `, [permitId]);

        const oldStatus = permitRows[0]?.status || null;

        // =========================
        // UPDATE PERMIT STATUS
        // =========================
        await connection.query(`
            UPDATE permits
            SET
                status = 'For Inspection',
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE permit_id = ?
        `, [

            reviewedBy,
            permitId

        ]);

        // =========================
        // GET INSPECTOR NAME
        // =========================
        const [inspectorRows] = await connection.query(`
            SELECT
                first_name,
                last_name
            FROM staff_profiles
            WHERE user_id = ?
        `, [inspector_id]);

        const inspector = inspectorRows[0];

        // =========================
        // LOG ACTIVITY
        // =========================
        await logActivity(connection, {

            permit_id: permitId,

            inspection_id: inspectionId,

            activity_type: "permit_status",

            old_status: oldStatus,

            new_status: "For Inspection",

            title: "Inspector Assigned",

            message:
                `Assigned to Inspector ${inspector.first_name} ${inspector.last_name}`,

            created_by: reviewedBy

        });

        await connection.commit();

        res.json({

            success: true,

            message:
                "Inspector assigned successfully"

        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({

            success: false,

            message: "Server error"
        });

    } finally {

        connection.release();
    }
};

// =========================
// GET INSPECTION STATUS
// =========================
exports.getInspectionStatus = async (req, res) => {

    try {

        const { permitId } = req.params;

        // =========================
        // FETCH PERMIT
        // =========================
        const [permitRows] = await db.query(`
            SELECT
                permit_id,
                control_number,
                permit_type,
                project_title,
                project_location,
                estimated_cost,
                owner_name,
                contact_number,
                status
            FROM permits
            WHERE permit_id = ?
        `, [permitId]);

        if (permitRows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        // =========================
        // FETCH INSPECTION
        // =========================
        const [inspectionRows] = await db.query(`
            SELECT
                inspection_id,
                inspection_type,
                status,
                result,
                schedule_date,
                schedule_time,
                actual_inspection_at,
                findings,
                recommendations,
                remarks,
                completed_at,
                created_at
            FROM inspections
            WHERE permit_id = ?
            ORDER BY inspection_id DESC
            LIMIT 1
        `, [permitId]);

        res.json({

            success: true,

            permit: permitRows[0],

            inspection:
                inspectionRows.length > 0
                    ? inspectionRows[0]
                    : null
        });

    } catch (error) {

        console.error(
            "GET INSPECTION STATUS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};