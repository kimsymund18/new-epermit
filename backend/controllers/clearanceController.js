const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const logActivity = require("../utils/activityLogger");

/* =========================================
   MULTER STORAGE
========================================= */
const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        const dir = path.resolve(
            __dirname, "../uploads/clearance"
        );

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        cb(null, dir);
    },

    filename: (req, file, cb) => {

        const unique =
            Date.now() + "-" +
            Math.round(Math.random() * 1e9);

        const ext =
            path.extname(file.originalname);

        cb(null, `clearance-${unique}${ext}`);
    }
});

const upload = multer({ storage });

/* =========================================
   UPLOAD CLEARANCE DOCUMENT (ADMIN)
   POST /api/clearance/upload/:permitId
========================================= */
const uploadClearance = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { permitId } = req.params;
        const adminId = req.user.user_id;

        // VALIDATE PERMIT EXISTS + STATUS
        const [permits] = await connection.query(
            `SELECT * FROM permits WHERE permit_id = ?`,
            [permitId]
        );

        if (!permits.length) {
            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        const permit = permits[0];

        if (permit.status !== "For Clearance") {
            return res.status(400).json({
                success: false,
                message: "Permit is not in For Clearance status"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        const filePath =
            `uploads/clearance/${req.file.filename}`;

        // INSERT CLEARANCE DOCUMENT
        await connection.query(`
            INSERT INTO permit_clearance_documents (
                permit_id,
                document_type,
                file_name,
                file_path,
                file_size,
                mime_type,
                uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            permitId,
            req.body.document_type || "Other",
            req.file.originalname,
            filePath,
            req.file.size,
            req.file.mimetype,
            adminId
        ]);

        // LOG ACTIVITY
        await logActivity(connection, {
            permit_id: permitId,
            activity_type: "permit_status",
            event_type: "clearance_uploaded",
            old_status: "For Clearance",
            new_status: "For Clearance",
            title: "Clearance Document Uploaded",
            message: `Admin uploaded clearance document: ${req.file.originalname}`,
            created_by: adminId
        });

        return res.json({
            success: true,
            message: "Clearance document uploaded successfully"
        });

    } catch (error) {

        console.error("Upload clearance error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        connection.release();
    }
};

/* =========================================
   RELEASE CLEARANCE (ADMIN)
   POST /api/clearance/release/:permitId
   - Sets permit status to Approved
   - Logs activity
========================================= */
const releaseClearance = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { permitId } = req.params;
        const adminId = req.user.user_id;

        // CHECK PERMIT
        const [permits] = await connection.query(
            `SELECT * FROM permits WHERE permit_id = ?`,
            [permitId]
        );

        if (!permits.length) {
            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        // CHECK DOCUMENTS UPLOADED
        const [docs] = await connection.query(
            `SELECT * FROM permit_clearance_documents
             WHERE permit_id = ? AND is_active = 1`,
            [permitId]
        );

        if (!docs.length) {
            return res.status(400).json({
                success: false,
                message: "Please upload at least one clearance document before releasing"
            });
        }

        // UPDATE PERMIT STATUS TO APPROVED
        await connection.query(`
            UPDATE permits
            SET status = 'Approved',
                reviewed_by = ?,
                reviewed_at = NOW()
            WHERE permit_id = ?
        `, [adminId, permitId]);

        // LOG ACTIVITY
        await logActivity(connection, {
            permit_id: permitId,
            activity_type: "permit_status",
            event_type: "clearance_released",
            old_status: "For Clearance",
            new_status: "Approved",
            title: "Clearance Released",
            message: "Your clearance has been officially released. You may now download your documents.",
            created_by: adminId
        });

        return res.json({
            success: true,
            message: "Clearance released. Permit is now Approved."
        });

    } catch (error) {

        console.error("Release clearance error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        connection.release();
    }
};

/* =========================================
   GET CLEARANCE DOCUMENTS
   GET /api/clearance/:permitId
========================================= */
const getClearanceDocuments = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { permitId } = req.params;

        // GET PERMIT INFO
        const [permits] = await connection.query(`
            SELECT
                p.*,
                CONCAT(
                    COALESCE(a.first_name, ''),
                    ' ',
                    COALESCE(a.middle_name, ''),
                    ' ',
                    COALESCE(a.last_name, '')
                ) AS applicant_full_name,
                CONCAT(
                    COALESCE(sp.first_name, ''),
                    ' ',
                    COALESCE(sp.last_name, '')
                ) AS reviewed_by_name
            FROM permits p
            LEFT JOIN applicants a ON p.user_id = a.user_id
            LEFT JOIN staff_profiles sp ON p.reviewed_by = sp.user_id
            WHERE p.permit_id = ?
        `, [permitId]);

        if (!permits.length) {
            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        // GET CLEARANCE DOCUMENTS
        const [documents] = await connection.query(`
            SELECT
                pcd.*,
                CONCAT(
                    COALESCE(sp.first_name, ''),
                    ' ',
                    COALESCE(sp.last_name, '')
                ) AS uploaded_by_name
            FROM permit_clearance_documents pcd
            LEFT JOIN staff_profiles sp ON pcd.uploaded_by = sp.user_id
            WHERE pcd.permit_id = ?
            AND pcd.is_active = 1
            ORDER BY pcd.uploaded_at DESC
        `, [permitId]);

        return res.json({
            success: true,
            permit: permits[0],
            documents
        });

    } catch (error) {

        console.error("Get clearance error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        connection.release();
    }
};

/* =========================================
   DELETE CLEARANCE DOCUMENT (ADMIN)
   DELETE /api/clearance/document/:documentId
========================================= */
const deleteClearanceDocument = async (req, res) => {

    const connection = await db.getConnection();

    try {

        const { documentId } = req.params;
        const adminId = req.user.user_id;

        const [docs] = await connection.query(
            `SELECT * FROM permit_clearance_documents WHERE clearance_document_id = ?`,
            [documentId]
        );

        if (!docs.length) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            });
        }

        // SOFT DELETE
        await connection.query(`
            UPDATE permit_clearance_documents
            SET is_active = 0
            WHERE clearance_document_id = ?
        `, [documentId]);

        await logActivity(connection, {
            permit_id: docs[0].permit_id,
            activity_type: "permit_status",
            event_type: "clearance_document_removed",
            title: "Clearance Document Removed",
            message: `Document removed: ${docs[0].file_name}`,
            created_by: adminId
        });

        return res.json({
            success: true,
            message: "Document removed"
        });

    } catch (error) {

        console.error("Delete clearance doc error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });

    } finally {
        connection.release();
    }
};

module.exports = {
    upload,
    uploadClearance,
    releaseClearance,
    getClearanceDocuments,
    deleteClearanceDocument
};