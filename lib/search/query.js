// SPDX-License-Identifier: GPL-3.0-or-later
export const SEARCH_EXAMPLES = [
    ['files:invoice', 'File names containing invoice'],
    ['folders:photos', 'Folder names containing photos'],
    ['content:"annual report"', 'Indexed file contents containing this phrase'],
    ['type:pdf invoice', 'PDF file names containing invoice'],
    ['type:image', 'Indexed images, using their MIME type'],
];

const SCOPES = {file: 'files', files: 'files', folder: 'folders', folders: 'folders', content: 'content', contents: 'content'};
const MIME_GROUPS = {image: 'image/', images: 'image/', audio: 'audio/', video: 'video/', text: 'text/'};

export function parseQuery(input) {
    const tokens = [];
    let token = '';
    let quote = '';
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === '\\' && quote && ['\\', quote].includes(input[i + 1]))
            token += input[++i];
        else if (quote && ch === quote)
            quote = '';
        else if (!quote && ['"', '“', '”'].includes(ch))
            quote = ch === '“' ? '”' : ch;
        else if (!quote && /\s/.test(ch)) {
            if (token)
                tokens.push(token);
            token = '';
        } else
            token += ch;
    }
    if (token)
        tokens.push(token);
    const query = {scoped: false, mode: 'files', text: '', types: [], error: ''};
    const words = [];
    let scope = '';
    let awaitingType = false;
    for (const word of tokens) {
        const match = /^(files?|folders?|contents?|type|ext):(.*)$/i.exec(word);
        if (!match) {
            if (awaitingType) {
                query.types.push(...word.toLowerCase().split(','));
                awaitingType = false;
            } else
                words.push(word);
            continue;
        }
        query.scoped = true;
        const [, rawKey, value] = match;
        const key = rawKey.toLowerCase();
        if (key === 'type' || key === 'ext') {
            if (value)
                query.types.push(...value.toLowerCase().split(','));
            else
                awaitingType = true;
        } else {
            if (scope && scope !== SCOPES[key])
                query.error = 'Choose one scope: files:, folders:, or content:.';
            scope = SCOPES[key];
            query.mode = scope;
            if (value)
                words.push(value);
        }
    }
    query.text = words.join(' ');
    query.types = [...new Set(query.types.map(t => t.replace(/^\./, '')))];
    if (query.scoped && quote)
        query.error = 'Close the quoted phrase to search.';
    if (awaitingType || query.types.some(t => !/^[a-z0-9][a-z0-9.+_/-]*$/.test(t)))
        query.error = 'Enter a file extension or MIME type, for example type:pdf or type:image/png.';
    if (query.mode === 'folders' && query.types.length)
        query.error = 'File types apply to files; remove folders: or type:.';
    return query;
}

export function describeQuery(query) {
    if (query.error)
        return query.error;
    if (!query.scoped)
        return 'Search apps, files, settings, and other GNOME providers.';
    const labels = {files: 'File names', folders: 'Folder names', content: 'Indexed file contents'};
    const parts = [labels[query.mode]];
    if (query.text)
        parts.push(`containing “${query.text}”`);
    if (query.types.length)
        parts.push(`type: ${query.types.join(', ')}`);
    return parts.join(' · ');
}

// SPARQL string literals and FTS phrases have separate escaping rules.
export function sparqlLiteral(text) {
    return JSON.stringify(text).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function buildQuery(query) {
    if (!query.scoped || query.error)
        throw new Error('A valid scoped query is required.');
    const conditions = ['?file a nfo:FileDataObject ; nie:url ?url ; nfo:fileName ?name .'];
    const folderPattern = '?file nie:interpretedAs ?folder . ?folder a nfo:Folder .';
    if (query.mode === 'folders')
        conditions.push(folderPattern);
    else
        conditions.push(`FILTER NOT EXISTS { ${folderPattern} }`);
    if (query.mode !== 'content' && query.text)
        conditions.push(`FILTER(CONTAINS(LCASE(?name), ${sparqlLiteral(query.text.toLowerCase())}))`);
    const outside = [];
    if (query.mode === 'content' && query.text) {
        const phrase = `"${query.text.replace(/"/g, '""')}"`;
        outside.push(`?content nie:isStoredAs ?file ; fts:match ${sparqlLiteral(phrase)} .`);
        // Metadata and extracted text share an FTS index; require a match in the text itself.
        outside.push(`FILTER(CONTAINS(LCASE(nie:plainTextContent(?content)), ${sparqlLiteral(query.text.toLowerCase())}))`);
    }
    if (query.mode === 'content' && !query.text)
        throw new Error('Enter text after content: to search indexed contents.');
    const base = `GRAPH tracker:FileSystem { ${conditions.join(' ')} } ${outside.join(' ')} FILTER(STRSTARTS(?url, "file://"))`;
    const branches = [];
    const extensions = [];
    for (const type of query.types) {
        const mime = MIME_GROUPS[type] || (type.includes('/') ? type : '');
        if (!mime) {
            extensions.push(`STRENDS(LCASE(?name), ${sparqlLiteral(`.${type}`)})`);
            continue;
        }
        const family = mime.split('/')[0];
        const graph = {image: 'tracker:Pictures', audio: 'tracker:Audio', video: 'tracker:Video', text: 'tracker:Documents'}[family] || '?mediaGraph';
        const filter = mime.endsWith('/') ? `STRSTARTS(?mime, ${sparqlLiteral(mime)})` : `?mime = ${sparqlLiteral(mime)}`;
        branches.push(`${base} GRAPH ${graph} { ?info nie:isStoredAs ?file ; nie:mimeType ?mime . FILTER(${filter}) }`);
    }
    if (extensions.length)
        branches.push(`${base} FILTER(${extensions.join(' || ')})`);
    const body = branches.length ? branches.map(branch => `{ ${branch} }`).join(' UNION ') : base;
    return `SELECT DISTINCT ?url WHERE { ${body} } LIMIT 12`;
}

export function parseResults(output) {
    return [...new Set(output.split('\n').map(line => line.trim()).filter(line => line.startsWith('file://')))];
}
