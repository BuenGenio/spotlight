// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseQuery, describeQuery, buildQuery, parseResults} from '../lib/search/query.js';
import {popupWidth} from '../lib/popup/behavior/appearance.js';

test('plain searches stay with GNOME providers', () => {
    assert.equal(parseQuery('calculator').scoped, false);
    assert.equal(parseQuery('https://example.org').scoped, false);
});
test('scopes, aliases, quoted phrases and smart quotes', () => {
    assert.deepEqual(parseQuery('files:"annual report" type:pdf'), {
        scoped: true, mode: 'files', text: 'annual report', types: ['pdf'], error: '',
    });
    assert.equal(parseQuery('folders: photos').mode, 'folders');
    assert.equal(parseQuery('contents:“annual report”').text, 'annual report');
    assert.equal(parseQuery('FILE:budget').mode, 'files');
    assert.equal(parseQuery('content:"say \\"hello\\""').text, 'say "hello"');
});
test('invalid or unfinished input gets actionable explanations', () => {
    assert.match(parseQuery('files:x folders:y').error, /Choose one scope/);
    assert.match(parseQuery('files:"unfinished').error, /Close the quoted/);
    assert.match(parseQuery('type:').error, /Enter a file extension/);
    assert.match(parseQuery('folders:home type:pdf').error, /File types apply/);
    assert.throws(() => buildQuery(parseQuery('content:')), /Enter text/);
});
test('names and contents use different ontology paths', () => {
    const names = buildQuery(parseQuery('files:invoice'));
    assert.match(names, /GRAPH tracker:FileSystem/);
    assert.match(names, /FILTER NOT EXISTS \{ \?file nie:interpretedAs \?folder \. \?folder a nfo:Folder/);
    assert.match(names, /CONTAINS\(LCASE\(\?name\), "invoice"\)/);
    assert.doesNotMatch(names, /fts:match/);
    const content = buildQuery(parseQuery('content:invoice'));
    assert.match(content, /nie:isStoredAs \?file ; fts:match/);
    assert.match(content, /nie:plainTextContent/);
    assert.doesNotMatch(content, /CONTAINS\(LCASE\(\?name/);
});
test('file types support extensions, MIME types, and media categories', () => {
    assert.match(buildQuery(parseQuery('type:pdf,docx invoice')), /STRENDS\(LCASE\(\?name\), ".pdf"\).*\|\|.*".docx"/);
    assert.match(buildQuery(parseQuery('type:image')), /STRSTARTS\(\?mime, "image\/"\)/);
    assert.match(buildQuery(parseQuery('type:image/png')), /\?mime = "image\/png"/);
    assert.deepEqual(parseQuery('ext:.PDF,pdf').types, ['pdf']);
});
test('explainers describe the query in plain language', () => {
    assert.equal(describeQuery(parseQuery('files:invoice type:pdf')), 'File names · containing “invoice” · type: pdf');
    assert.match(describeQuery(parseQuery('folders:photos')), /Folder names/);
});
test('query values stay inside literals; output contains only unique local URIs', () => {
    const query = buildQuery(parseQuery('files:"x\\" ) } UNION { ?s ?p ?o } #"'));
    assert.match(query, /\\"/);
    assert.match(query, /LIMIT 12$/);
    assert.deepEqual(parseResults('Results:\n  file:///a%20b\n  None\n file:///a%20b\n https://example.org\n'), ['file:///a%20b']);
});
test('width respects preference and monitor cap', () => {
    assert.equal(popupWidth(900, 2560), 900);
    assert.equal(popupWidth(2400, 1280), 1088);
    assert.equal(popupWidth(400, 320), 272);
});
