module.exports = async function logActivity(connection, data) {

    try {

        await connection.query(`
            INSERT INTO permit_activities (
                permit_id,
                inspection_id,
                activity_type,
                event_type,
                old_status,
                new_status,
                title,
                message,
                remarks,
                document_name,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            data.permit_id,
            data.inspection_id || null,
            data.activity_type,
            data.event_type || null,
            data.old_status || null,
            data.new_status || null,
            data.title || null,
            data.message || null,
            data.remarks || null,
            data.document_name || null,
            data.created_by || null
        ]);

    } catch (error) {

        console.error(
            "Activity Logger Error:",
            error.message
        );
    }
};