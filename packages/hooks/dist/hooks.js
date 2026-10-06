export function createHooks(config) {
    return {
        'session.idle': async (event) => {
            const sessionID = event.properties?.sessionID;
            if (sessionID) {
                await writeSessionSummary(config.project, sessionID);
            }
        },
        'session.deleted': async (event) => {
            const sessionID = event.properties?.sessionID;
            if (sessionID) {
                await writeSessionSummary(config.project, sessionID);
            }
        },
        'session.compacted': async (event) => {
            const sessionID = event.properties?.sessionID;
            if (sessionID) {
                await writeCompactionSummary(config.project, sessionID);
            }
        },
    };
}
async function writeSessionSummary(project, sessionID) {
    // TODO: Implement session summary writing
}
async function writeCompactionSummary(project, sessionID) {
    // TODO: Implement compaction summary writing
}
