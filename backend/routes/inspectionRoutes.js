const express = require("express");

const router = express.Router();

const authMiddleware =
    require("../middleware/authMiddleware");

const inspectionController =
    require("../controllers/inspectionController");

// =========================
// GET ASSIGNED INSPECTIONS
// =========================
router.get(
    "/assigned",
    authMiddleware,
    inspectionController.getAssignedInspections
);

// =========================
// GET HISTORY
// =========================
router.get(
    "/history",
    authMiddleware,
    inspectionController.getInspectionHistory
);

// =========================
// SET SCHEDULE
// =========================
router.put(
    "/set-schedule/:inspectionId",
    authMiddleware,
    inspectionController.setSchedule
);

// =========================
// START INSPECTION
// =========================
router.put(
    "/start-inspection/:inspectionId",
    authMiddleware,
    inspectionController.startInspection
);

// =========================
// FINISH INSPECTION
// =========================
router.put(
    "/finish-inspection/:inspectionId",
    authMiddleware,
    inspectionController.finishInspection
);

// =========================
// SUBMIT REPORT
// =========================
router.put(
    "/submit-report/:inspectionId",
    authMiddleware,
    inspectionController.submitReport
);

// =========================
// GET ACTIVITIES
// =========================
router.get(
    "/activities/:permitId",
    authMiddleware,
    inspectionController.getActivities
);

router.get(
    "/activities",
    authMiddleware,
    inspectionController.getInspectorActivities
);

router.get(
    "/applicant-activities",
    authMiddleware,
    inspectionController.getApplicantActivities
);

router.get(
    "/applicant",
    authMiddleware,
    inspectionController.getApplicantUnifiedActivities
);

module.exports = router;