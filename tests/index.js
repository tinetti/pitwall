// Entry point so `node --test tests/` works on every supported Node.
//
// Node 22 expands a directory argument and discovers `*.test.js` itself; Node 26 treats the
// argument as a file or glob and resolves a directory to its `index.js`. Importing each suite
// here satisfies both — it is not itself a test file, so default discovery never double-runs it.
import './frontmatter.test.js';
import './providers.test.js';
import './repo.test.js';
