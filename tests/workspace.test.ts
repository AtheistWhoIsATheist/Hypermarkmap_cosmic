import { parseGoogleDocToMarkdown, type GoogleDocDocument } from '../src/services/workspace/docsService';
import { GOOGLE_WORKSPACE_SCOPES } from '../src/services/workspace/authService';

function runWorkspaceTests() {
  console.log('===============================================================');
  console.log('  GOOGLE WORKSPACE INTEGRATION: DRIVE & DOCS VERIFICATION');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  // Test 1: Google Doc AST to Markdown Parsing
  try {
    const mockDoc: GoogleDocDocument = {
      documentId: 'doc-test-123',
      title: 'Apophatic Negation and The Inverted Ground',
      body: {
        content: [
          {
            paragraph: {
              elements: [{ textRun: { content: 'Apophatic Negation and The Inverted Ground\n' } }],
              paragraphStyle: { namedStyleType: 'TITLE' }
            }
          },
          {
            paragraph: {
              elements: [{ textRun: { content: 'Section 1: The Void as Pure Potency\n' } }],
              paragraphStyle: { namedStyleType: 'HEADING_1' }
            }
          },
          {
            paragraph: {
              elements: [
                {
                  textRun: {
                    content:
                      'The negation of metaphysical being does not terminate in inert vacuity; rather, it yields the inverted ground where [[Nothingness]] discloses absolute relationality.\n'
                  }
                }
              ],
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }
            }
          },
          {
            paragraph: {
              elements: [{ textRun: { content: 'God must become nothing so that God may be.\n' } }],
              paragraphStyle: { namedStyleType: 'NORMAL_TEXT' }
            }
          },
          {
            paragraph: {
              elements: [{ textRun: { content: 'First corollary of ontological groundlessness\n' } }],
              bullet: { listId: 'kix.list.1', nestingLevel: 0 }
            }
          }
        ]
      }
    };

    const markdown = parseGoogleDocToMarkdown(mockDoc);
    if (!markdown.includes('# Apophatic Negation and The Inverted Ground')) {
      throw new Error('Title missing from parsed markdown');
    }
    if (!markdown.includes('## Section 1: The Void as Pure Potency')) {
      throw new Error('Heading 1 missing or misformatted in markdown');
    }
    if (!markdown.includes('[[Nothingness]]')) {
      throw new Error('Wikilink in paragraph body was not preserved');
    }
    if (!markdown.includes('- First corollary of ontological groundlessness')) {
      throw new Error('Bullet list element was not formatted with dash bullet');
    }
    if (!markdown.includes('googleDocId: "doc-test-123"')) {
      throw new Error('Frontmatter googleDocId missing');
    }

    console.log('  ✓ PASS: parseGoogleDocToMarkdown converts Google Docs AST into CommonMark with frontmatter');
    passed++;
  } catch (err) {
    console.error('  ✗ FAIL: parseGoogleDocToMarkdown failed:', err);
    failed++;
  }

  // Test 2: Scopes Configuration
  try {
    const requiredScopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents.readonly'
    ];
    for (const req of requiredScopes) {
      if (!GOOGLE_WORKSPACE_SCOPES.includes(req)) {
        throw new Error(`Missing required scope: ${req}`);
      }
    }
    console.log('  ✓ PASS: GOOGLE_WORKSPACE_SCOPES contains all approved Drive and Docs scopes');
    passed++;
  } catch (err) {
    console.error('  ✗ FAIL: Scopes configuration test failed:', err);
    failed++;
  }

  console.log('---------------------------------------------------------------');
  console.log(`  WORKSPACE RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('---------------------------------------------------------------');

  if (failed > 0) process.exit(1);
}

runWorkspaceTests();
