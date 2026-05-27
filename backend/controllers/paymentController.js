const db = require("../config/db");

const logActivity =
    require("../utils/activityLogger");

// =========================
// CREATE ASSESSMENT
// =========================
exports.createAssessment = async (req, res) => {
    try {
        const { permitId } = req.params;

        const {
            application_fee,
            inspection_fee,
            other_fee,
            payment_method,
            remarks
        } = req.body;

        const total_amount =
            Number(application_fee || 0) +
            Number(inspection_fee || 0) +
            Number(other_fee || 0);

        // CHECK EXISTING
        const [existing] = await db.query(`
            SELECT payment_id
            FROM payments
            WHERE permit_id = ?
        `, [permitId]);

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Assessment already exists"
            });
        }

        // CREATE PAYMENT
        const [result] = await db.query(`
            INSERT INTO payments (
                permit_id,
                application_fee,
                inspection_fee,
                other_fee,
                total_amount,
                payment_method,
                remarks,
                encoded_by,
                encoded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            permitId,
            application_fee || 0,
            inspection_fee || 0,
            other_fee || 0,
            total_amount,
            payment_method || null,
            remarks || null,
            req.user.user_id
        ]);

        // ✅ FORCE CONSISTENT STATUS (important)
        await db.query(`
            UPDATE permits
            SET status = 'For Payment'
            WHERE permit_id = ?
        `, [permitId]);

        await logActivity(db, {
            permit_id: permitId,
            activity_type: "payment",
            old_status: "For Assessment",
            new_status: "For Payment",
            title: "Assessment Generated",
            message: `Assessment bill generated. Total amount due: ₱${total_amount.toLocaleString("en-US", {
                minimumFractionDigits: 2
            })}`,
            created_by: req.user.user_id
        });

        res.json({
            success: true,
            payment_id: result.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =========================
// GET PAYMENT DETAILS
// =========================
exports.getPayment = async (req, res) => {

    try {

        const { permitId } = req.params;

        // =========================
        // GET PERMIT FIRST
        // =========================
        const [permitRows] = await db.query(`
            SELECT
                permit_id,
                control_number,
                owner_name,
                permit_type,
                project_title,
                status
            FROM permits
            WHERE permit_id = ?
        `, [permitId]);

        if (!permitRows.length) {

            return res.status(404).json({
                success: false,
                message: "Permit not found"
            });
        }

        // =========================
        // GET PAYMENT (OPTIONAL)
        // =========================
        const [paymentRows] = await db.query(`
            SELECT
                pay.*,

                pd.file_path AS receipt_path

            FROM payments pay

            LEFT JOIN payment_documents pd
                ON pay.payment_id = pd.payment_id
                AND pd.document_type = 'Proof of Payment'

            WHERE pay.permit_id = ?
        `, [permitId]);

        res.json({

            success: true,

            permit: permitRows[0],

            payment:
                paymentRows.length > 0
                    ? {
                        ...paymentRows[0],

                        // include permit status directly
                        status: permitRows[0].status,

                        control_number:
                            permitRows[0].control_number,

                        permit_type:
                            permitRows[0].permit_type
                    }
                    : null
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false
        });
    }
};

// =========================
// APPLICANT SUBMIT PAYMENT
// =========================
exports.submitPayment = async (req, res) => {

    try {

        const { permitId } = req.params;

        const {
            reference_number,
            payment_method
        } = req.body;

        const proofFile = req.file;

        // CHECK EXISTING
        const [existing] = await db.query(`
            SELECT payment_status
            FROM payments
            WHERE permit_id = ?
        `, [permitId]);

        if (!existing.length) {

            return res.status(404).json({
                success: false,
                message: "Payment assessment not found"
            });
        }

        if (existing[0].payment_status === "Verified") {

            return res.status(400).json({
                success: false,
                message: "Payment already verified"
            });
        }

        const oldStatus =
            existing[0].payment_status;

        // UPDATE PAYMENT
        await db.query(`
            UPDATE payments
            SET

                reference_number = ?,
                payment_method = ?,

                payment_status = 'For Verification',
                paid_at = NOW()

            WHERE permit_id = ?
        `, [
            reference_number,
            payment_method,
            permitId
        ]);

        // =========================
        // SAVE PAYMENT DOCUMENT
        // =========================
        if (proofFile) {

            const [paymentRows] = await db.query(`
                SELECT payment_id
                FROM payments
                WHERE permit_id = ?
            `, [permitId]);

            const paymentId =
                paymentRows[0].payment_id;

            // REMOVE OLD PROOF
            await db.query(`
                DELETE FROM payment_documents
                WHERE payment_id = ?
            `, [paymentId]);

            // SAVE NEW PROOF
            await db.query(`
                INSERT INTO payment_documents (

                    payment_id,
                    file_name,
                    file_path,
                    file_size,
                    mime_type,
                    document_type

                )
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                paymentId,
                proofFile.filename,
                `/uploads/payments/${proofFile.filename}`,
                proofFile.size,
                proofFile.mimetype,
                'Proof of Payment'
            ]);
        }

        // UPDATE PERMIT STATUS
        await db.query(`
            UPDATE permits
            SET status = 'For Payment Verification'
            WHERE permit_id = ?
        `, [permitId]);

        // ACTIVITY LOG
        await logActivity(db, {

            permit_id: permitId,

            activity_type: "payment",

            old_status:
                oldStatus || "For Payment",

            new_status:
                "For Payment Verification",

            title: "Payment Submitted",

            message:
                "Applicant submitted payment details.",

            created_by:
                req.user.user_id
        });

        res.json({

            success: true,

            message:
                "Payment submitted successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false
        });
    }
};

// =========================
// VERIFY / RESUBMIT PAYMENT
// =========================
exports.verifyPayment = async (req, res) => {

    try {

        const { permitId } = req.params;

        const {
            payment_status,
            remarks
        } = req.body;

        // =========================
        // VALIDATE STATUS
        // =========================
        if (
            ![
                "Verified",
                "Resubmission"
            ].includes(payment_status)
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
        }

        // =========================
        // GET PAYMENT
        // =========================
        const [rows] = await db.query(`
            SELECT
                payment_id,
                payment_status
            FROM payments
            WHERE permit_id = ?
        `, [permitId]);

        if (!rows.length) {

            return res.status(404).json({
                success: false,
                message: "Payment not found"
            });
        }

        const payment =
            rows[0];

        const oldPaymentStatus =
            payment.payment_status;

        // =========================
        // VERIFIED FLOW
        // =========================
        if (payment_status === "Verified") {

            // UPDATE PAYMENT
            await db.query(`
                UPDATE payments
                SET
                    payment_status = 'Verified',
                    remarks = NULL,
                    verified_by = ?,
                    verified_at = NOW()
                WHERE permit_id = ?
            `, [
                req.user.user_id,
                permitId
            ]);

            // UPDATE PERMIT
            await db.query(`
                UPDATE permits
                SET status = 'For Clearance'
                WHERE permit_id = ?
            `, [permitId]);

            // ACTIVITY LOG
            await logActivity(db, {

                permit_id: permitId,

                activity_type: "payment",

                old_status:
                    oldPaymentStatus,

                new_status:
                    "Verified",

                title:
                    "Payment Verified",

                message:
                    "Payment verified and forwarded for clearance.",

                created_by:
                    req.user.user_id
            });

            return res.json({

                success: true,

                message:
                    "Payment verified successfully"
            });
        }

        // =========================
        // RESUBMISSION FLOW
        // =========================
        if (payment_status === "Resubmission") {

            // UPDATE PAYMENT
            await db.query(`
                UPDATE payments
                SET
                    payment_status = 'Resubmission',
                    remarks = ?,
                    verified_by = ?,
                    verified_at = NOW()
                WHERE permit_id = ?
            `, [
                remarks || null,
                req.user.user_id,
                permitId
            ]);

            // UPDATE PERMIT
            await db.query(`
                UPDATE permits
                SET status = 'For Payment'
                WHERE permit_id = ?
            `, [permitId]);

            // ACTIVITY LOG
            await logActivity(db, {

                permit_id: permitId,

                activity_type: "payment",

                old_status:
                    oldPaymentStatus,

                new_status:
                    "Resubmission",

                title:
                    "Payment Resubmission Requested",

                message:
                    "Payment requires resubmission.",

                remarks:
                    remarks || null,

                created_by:
                    req.user.user_id
            });

            return res.json({

                success: true,

                message:
                    "Payment marked for resubmission"
            });
        }

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

