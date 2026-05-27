const express = require("express");
const router = express.Router();

const authMiddleware =
    require("../middleware/authMiddleware");

const upload =
    require("../middleware/uploadMiddleware");

const paymentController =
    require("../controllers/paymentController");

// =========================
// 1. PAYMENT ACTIVITIES (IF ANY)
// =========================
router.get(
    "/my-activities",
    authMiddleware,
    async (req, res) => {
        // ...
    }
);

// =========================
// 2. CREATE ASSESSMENT
// =========================
router.post(
    "/assessment/:permitId",
    authMiddleware,
    paymentController.createAssessment
);

// =========================
// 3. SUBMIT PAYMENT
// =========================
router.post(
    "/submit/:permitId",
    authMiddleware,
    upload.single("proof"),
    paymentController.submitPayment
);

// =========================
// 4. VERIFY / RESUBMISSION
// =========================
router.post(
    "/verify/:permitId",
    authMiddleware,
    paymentController.verifyPayment
);

// =========================
// 5. GET PAYMENT (MUST BE LAST)
// =========================
router.get(
    "/:permitId",
    authMiddleware,
    paymentController.getPayment
);

module.exports = router;