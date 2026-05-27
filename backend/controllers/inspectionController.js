const db = require("../config/db");

const logActivity =
    require("../utils/activityLogger");

exports.getAssignedInspections = async (req, res) => {

    try {

        const inspectorId = req.user.user_id;

        const [rows] = await db.query(`
            SELECT
                i.*,

                p.control_number,
                p.permit_type,
                p.project_title,
                p.project_location,
                p.estimated_cost,
                p.owner_name,

                p.contact_number AS owner_contact_number,

                p.applicant_type,
                p.applicant_name,

                CONCAT(a.first_name, ' ', a.last_name)
                    AS applicant_account_name,

                a.contact_number
                    AS applicant_contact_number

            FROM inspections i

            JOIN permits p
                ON i.permit_id = p.permit_id

            LEFT JOIN users u
                ON p.user_id = u.user_id

            LEFT JOIN applicants a
                ON u.user_id = a.user_id

            WHERE i.inspector_id = ?
            AND i.status NOT IN ('Completed', 'Rejected')

            ORDER BY i.created_at DESC
        `, [inspectorId]);

        console.log(rows);

        res.json({
            success: true,
            inspections: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

exports.getInspectionHistory = async (req, res) => {

    try {

        const inspectorId = req.user.user_id;

        const [rows] = await db.query(`
            SELECT
                i.*,

                p.status AS permit_status,

                p.control_number,
                p.permit_type,
                p.project_title,
                p.project_location,
                p.estimated_cost,
                p.owner_name,

                p.contact_number AS owner_contact_number,

                p.applicant_type,
                p.applicant_name,

                CONCAT(a.first_name, ' ', a.last_name)
                    AS applicant_account_name,

                a.contact_number
                    AS applicant_contact_number

            FROM inspections i

            JOIN permits p
                ON i.permit_id = p.permit_id

            JOIN users u
                ON p.user_id = u.user_id

            JOIN applicants a
                ON u.user_id = a.user_id

            WHERE i.inspector_id = ?
            AND i.status = 'Completed'
            AND p.status IN ('Approved', 'Rejected')

            ORDER BY i.completed_at DESC
        `, [inspectorId]);
        res.json({
            success: true,
            inspections: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false
        });
    }
};

exports.setSchedule = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const { inspectionId } = req.params;

        const {
            schedule_date,
            schedule_time
        } = req.body;

        // =========================
        // GET INSPECTION + PERMIT
        // =========================
        const [rows] = await connection.query(`
            SELECT
                i.permit_id,
                p.project_title
            FROM inspections i
            JOIN permits p
                ON i.permit_id = p.permit_id
            WHERE i.inspection_id = ?
        `, [inspectionId]);

        if (!rows.length) {

            throw new Error("Inspection not found");
        }

        const inspection = rows[0];

        // =========================
        // UPDATE INSPECTION
        // =========================
        await connection.query(`
            UPDATE inspections
            SET
                schedule_date = ?,
                schedule_time = ?,
                status = 'Scheduled'
            WHERE inspection_id = ?
        `, [
            schedule_date,
            schedule_time,
            inspectionId
        ]);

        // =========================
        // LOG ACTIVITY
        // =========================
        await logActivity(connection, {
            permit_id: inspection.permit_id,
            inspection_id: inspectionId,
            activity_type: "inspection",

            event_type: "inspection_scheduled",

            new_status: "Scheduled",

            title: "Inspection Scheduled",
            message: `Inspection scheduled on ${schedule_date} at ${schedule_time}.`,

            created_by: req.user.user_id
        });

        await connection.commit();

        res.json({
            success: true,
            message: "Schedule updated"
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false
        });

    } finally {

        connection.release();
    }
};

exports.startInspection = async (req, res) => {

    const connection = await db.getConnection();
    const { inspectionId } = req.params;

    try {
        await connection.beginTransaction();

        await connection.query(`
            UPDATE inspections
            SET status = 'In Progress'
            WHERE inspection_id = ?
        `, [inspectionId]);

        // =========================
        // GET INSPECTION DETAILS
        // =========================
        const [inspectionRows] =
        await connection.query(`
            SELECT
                i.permit_id,
                p.project_title
            FROM inspections i
            JOIN permits p
                ON i.permit_id = p.permit_id
            WHERE i.inspection_id = ?
        `, [inspectionId]);

        const inspection =
            inspectionRows[0];

        // =========================
        // LOG ACTIVITY
        // =========================
        await logActivity(connection, {
            permit_id: inspection.permit_id,
            inspection_id: inspectionId,
            activity_type: "inspection",

            event_type: "inspection_started",

            old_status: "Scheduled",
            new_status: "In Progress",

            title: "Inspection Started",
            message: "Inspection has started.",

            created_by: req.user.user_id
        });

        await connection.query(`
            UPDATE permits p
            JOIN inspections i
                ON p.permit_id = i.permit_id
            SET p.status = 'For Visitation'
            WHERE i.inspection_id = ?
        `, [inspectionId]);

        await connection.commit();

        res.json({
            success: true,
            message: "Inspection started"
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to start inspection"
        });

    } finally {
        connection.release();
    }
};

exports.finishInspection = async (req, res) => {

    const connection = await db.getConnection();

    const { inspectionId } = req.params;

    try {

        await connection.beginTransaction();

        await connection.query(`
            UPDATE inspections
            SET
                status = 'Inspected',
                actual_inspection_at = NOW()
            WHERE inspection_id = ?
        `, [inspectionId]);

        // =========================
        // GET INSPECTION DETAILS
        // =========================
        const [inspectionRows] =
        await connection.query(`
            SELECT
                i.permit_id,
                p.project_title
            FROM inspections i
            JOIN permits p
                ON i.permit_id = p.permit_id
            WHERE i.inspection_id = ?
        `, [inspectionId]);

        const inspection =
            inspectionRows[0];

        // =========================
        // LOG ACTIVITY
        // =========================
        await logActivity(connection, {
            permit_id: inspection.permit_id,
            inspection_id: inspectionId,
            activity_type: "inspection",

            event_type: "inspection_completed",

            old_status: "In Progress",
            new_status: "Inspected",

            title: "Inspection Completed",
            message: "Inspection completed successfully.",

            created_by: req.user.user_id
        });

        await connection.commit();

        res.json({
            success: true,
            message: "Inspection finished"
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to finish inspection"
        });

    } finally {

        connection.release();
    }
};

exports.submitReport = async (req, res) => {

    const connection = await db.getConnection();

    try {

        await connection.beginTransaction();

        const { inspectionId } = req.params;

        let {
            result,
            findings,
            recommendations,
            remarks,
            inspection_type,
            reinspection_date,
            reinspection_time
        } = req.body;

        // =========================
        // NORMALIZE EMPTY VALUES
        // =========================
        reinspection_date =
            reinspection_date || null;

        reinspection_time =
            reinspection_time || null;

        // =========================
        // GET INSPECTION + PERMIT
        // =========================
        const [inspectionRows] = await connection.query(`
            SELECT
                i.inspection_id,
                i.permit_id,

                i.status AS inspection_status,

                p.status AS permit_status

            FROM inspections i

            JOIN permits p
                ON i.permit_id = p.permit_id

            WHERE i.inspection_id = ?
        `, [inspectionId]);

        if (!inspectionRows.length) {

            throw new Error("Inspection not found");
        }

        const inspection =
            inspectionRows[0];

        const currentInspectionStatus =
            inspection.inspection_status;

        const currentPermitStatus =
            inspection.permit_status;

        const permitId =
            inspection.permit_id;

        // =========================
        // DETERMINE NEXT STATUS
        // =========================
        let nextInspectionStatus =
            "Completed";

        let nextPermitStatus =
            "For Payment";

        // =========================
        // PASSED
        // =========================
        if (result === "Passed") {

            nextInspectionStatus =
                "Completed";

            nextPermitStatus =
                "For Payment";
        }

        // =========================
        // FOR RESUBMISSION
        // =========================
        else if (result === "For Resubmission") {

            if (
                currentInspectionStatus === "Inspected"
            ) {

                nextInspectionStatus =
                    "Rescheduled";

            } else if (
                currentInspectionStatus === "Rescheduled"
            ) {

                nextInspectionStatus =
                    "Deferred";
            }

            nextPermitStatus =
                "For Reinspection";
        }

        // =========================
        // FAILED
        // =========================
        else if (result === "Failed") {

            nextInspectionStatus =
                "Completed";

            nextPermitStatus =
                "Rejected";
        }

        // =========================
        // UPDATE INSPECTION
        // =========================
        await connection.query(`
            UPDATE inspections
            SET
                result = ?,
                findings = ?,
                recommendations = ?,
                remarks = ?,
                inspection_type = ?,
                status = ?,

                schedule_date =
                    CASE
                        WHEN ? IS NOT NULL
                        THEN ?
                        ELSE schedule_date
                    END,

                schedule_time =
                    CASE
                        WHEN ? IS NOT NULL
                        THEN ?
                        ELSE schedule_time
                    END,

                completed_at =
                    CASE
                        WHEN ? = 'Completed'
                        THEN NOW()
                        ELSE NULL
                    END

            WHERE inspection_id = ?
        `, [
            result,
            findings,
            recommendations,
            remarks,
            inspection_type,
            nextInspectionStatus,

            reinspection_date,
            reinspection_date,

            reinspection_time,
            reinspection_time,

            nextInspectionStatus,

            inspectionId
        ]);

        // =========================
        // UPDATE PERMIT STATUS
        // =========================
        await connection.query(`
            UPDATE permits
            SET status = ?
            WHERE permit_id = ?
        `, [
            nextPermitStatus,
            permitId
        ]);

        // =========================
        // ACTIVITY LOGS
        // =========================

        // PASSED
        if (result === "Passed") {

            await logActivity(connection, {
                permit_id: permitId,
                inspection_id: inspectionId,

                activity_type: "inspection",

                event_type: "inspection_passed",

                old_status: currentPermitStatus,
                new_status: "For Payment",

                title: "Inspection Passed",

                message:
                    "Inspection passed and moved to payment processing.",

                created_by: req.user.user_id
            });
        }

        // FOR RESUBMISSION
        else if (result === "For Resubmission") {

            await logActivity(connection, {
                permit_id: permitId,
                inspection_id: inspectionId,

                activity_type: "inspection",

                event_type: "reinspection_required",

                old_status: currentPermitStatus,
                new_status: "For Reinspection",

                title: "Reinspection Required",

                message:
                    `Reinspection scheduled on ${reinspection_date} at ${reinspection_time}.`,

                created_by: req.user.user_id
            });
        }

        // FAILED
        else if (result === "Failed") {

            await logActivity(connection, {
                permit_id: permitId,
                inspection_id: inspectionId,

                activity_type: "inspection",

                event_type: "inspection_failed",

                old_status: currentPermitStatus,
                new_status: "Rejected",

                title: "Inspection Failed",

                message:
                    "Inspection failed and permit was rejected.",

                created_by: req.user.user_id
            });
        }

        await connection.commit();

        res.json({
            success: true,
            message:
                "Inspection report submitted successfully"
        });

    } catch (error) {

        await connection.rollback();

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to submit report"
        });

    } finally {

        connection.release();
    }
};

exports.getActivities = async (req, res) => {

    try {

        const { permitId } = req.params;

        const [activities] = await db.query(`
            SELECT
                pa.activity_id,
                pa.permit_id,
                pa.inspection_id,
                pa.activity_type,
                pa.old_status,
                pa.new_status,
                pa.title,
                pa.message,
                pa.remarks,
                pa.document_name,
                pa.created_at,

                CONCAT(sp.first_name, ' ', sp.last_name) AS staff_name

            FROM permit_activities pa

            LEFT JOIN users u
                ON pa.created_by = u.user_id

            LEFT JOIN staff_profiles sp
                ON u.user_id = sp.user_id

            WHERE pa.permit_id = ?

            ORDER BY pa.created_at DESC
        `, [permitId]);

        res.json({
            success: true,
            activities
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch activities"
        });
    }
};

exports.getInspectorActivities = async (req, res) => {
    try {

        const inspectorId = req.user.user_id;

        const [rows] = await db.query(`
            SELECT
                pa.activity_id,
                pa.permit_id,
                pa.inspection_id,
                pa.activity_type,
                pa.event_type,
                pa.old_status,
                pa.new_status,
                pa.title,
                pa.message,
                pa.created_at,

                p.project_title,
                p.permit_type,

                i.schedule_date,
                i.schedule_time,
                i.status AS inspection_status,
                i.result

            FROM permit_activities pa

            LEFT JOIN inspections i
                ON pa.inspection_id = i.inspection_id

            JOIN permits p
                ON pa.permit_id = p.permit_id

            WHERE i.inspector_id = ?

            ORDER BY pa.created_at DESC
            LIMIT 20
        `, [inspectorId]);

        res.json({
            success: true,
            activities: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

exports.getApplicantActivities = async (req, res) => {
    try {

        const userId = req.user.user_id;

        const [rows] = await db.query(`
            SELECT
                pa.activity_id,
                pa.activity_type,
                pa.event_type,
                pa.old_status,
                pa.new_status,
                pa.title,
                pa.message,
                pa.remarks,
                pa.created_at,

                p.project_title,
                p.permit_type,

                i.schedule_date,
                i.schedule_time,
                i.status AS inspection_status,
                i.result

            FROM permit_activities pa
            JOIN permits p ON pa.permit_id = p.permit_id
            LEFT JOIN inspections i ON pa.inspection_id = i.inspection_id

            WHERE p.user_id = ?

            ORDER BY pa.created_at DESC
            LIMIT 50;
        `, [userId]);

        res.json({
            success: true,
            activities: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

exports.getApplicantUnifiedActivities = async (req, res) => {

    try {

        const userId = req.user.user_id;

        const [rows] = await db.query(`
            SELECT
                pa.activity_id,
                pa.permit_id,
                pa.inspection_id,

                pa.activity_type,
                pa.event_type,
                pa.old_status,
                pa.new_status,
                pa.title,
                pa.message,
                pa.remarks,
                pa.created_at,

                p.project_title,
                p.permit_type,

                i.schedule_date,
                i.schedule_time,
                i.status AS inspection_status,
                i.result

            FROM permit_activities pa

            JOIN permits p
                ON pa.permit_id = p.permit_id

            LEFT JOIN inspections i
                ON pa.inspection_id = i.inspection_id

            WHERE p.user_id = ?

            ORDER BY pa.created_at DESC

            LIMIT 50
        `, [userId]);

        res.json({
            success: true,
            activities: rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false
        });
    }
};