const express = require("express");
const router = express.Router();

const {
    upload,
    uploadClearance,
    releaseClearance,
    getClearanceDocuments,
    deleteClearanceDocument
} = require("../controllers/clearanceController");

// IMPORT YOUR EXISTING AUTH MIDDLEWARE
// adjust the path to match your project structure
const authMiddleware =
    require("../middleware/authMiddleware");

/* =========================================
   GET CLEARANCE DOCUMENTS
   Both admin and applicant can view
========================================= */
router.get(
    "/:permitId",
    authMiddleware,
    getClearanceDocuments
);

/* =========================================
   UPLOAD CLEARANCE DOCUMENT (ADMIN)
========================================= */
router.post(
    "/upload/:permitId",
    authMiddleware,
    upload.single("clearance_file"),
    uploadClearance
);

/* =========================================
   RELEASE CLEARANCE (ADMIN)
   Sets permit status to Approved
========================================= */
router.post(
    "/release/:permitId",
    authMiddleware,
    releaseClearance
);

/* =========================================
   DELETE CLEARANCE DOCUMENT (ADMIN)
========================================= */
router.delete(
    "/document/:documentId",
    authMiddleware,
    deleteClearanceDocument
);

module.exports = router;