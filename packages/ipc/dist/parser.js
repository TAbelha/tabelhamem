const VALID_METHODS = [
    'global',
    'link',
    'unlink',
    'status',
    'list',
    'search',
    'health',
    'search-digest',
];
export function parseIPCArgs(args) {
    if (args.length === 0) {
        throw new Error('método não especificado');
    }
    const method = args[0];
    if (!VALID_METHODS.includes(method)) {
        throw new Error(`método desconhecido: ${method}`);
    }
    const filters = {};
    let json = false;
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--json') {
            json = true;
        }
        else if (arg.includes('=')) {
            const [key, ...rest] = arg.split('=');
            const value = rest.join('=');
            filters[key] = value;
        }
    }
    return { method, filters, json };
}
