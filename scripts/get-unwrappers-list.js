const Database = require("better-sqlite3");


function main() {

    const db = new Database("events.db", {readonly: true});

    const stmt = db.prepare(`
    SELECT DISTINCT
        '0x' || SUBSTR(topic1, -40) AS cleaned_topic1
    FROM contract_logs
    WHERE label = 'UNWRAP';
    `);

    const rows = stmt.iterate();

    for(const row of rows) 
    {
        console.log(row.cleaned_topic1);
    }

    db.close();

}

main();