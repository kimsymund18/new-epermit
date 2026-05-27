const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        let uploadPath = path.join(
            __dirname,
            "../uploads/documents"
        );

        // =========================
        // SAVE LOCATION MAPS
        // =========================
        if (
            file.fieldname === "project_location_map"
        ) {

            uploadPath = path.join(
                __dirname,
                "../uploads/maps"
            );
        }

        // =========================
        // SAVE APPLICATION FORMS
        // =========================
        if (
            file.fieldname === "application_form"
        ) {

            uploadPath = path.join(
                __dirname,
                "../uploads/applications"
            );
        }

        // =========================
        // SAVE PAYMENT PROOFS
        // =========================
        if (
            file.fieldname === "proof"
        ) {

            uploadPath = path.join(
                __dirname,
                "../uploads/payments"
            );
        }

        // =========================
        // CREATE FOLDER IF MISSING
        // =========================
        if (!fs.existsSync(uploadPath)) {

            fs.mkdirSync(uploadPath, {
                recursive: true
            });
        }

        console.log(
            "UPLOAD PATH:",
            uploadPath
        );

        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1E9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage
});

module.exports = upload;