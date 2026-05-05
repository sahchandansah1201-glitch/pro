# Project Name

Welcome to the project.

## Doctor Hygiene Scan

This project uses `doctor-hygiene` to maintain code quality and consistency.

### Forbidden Patterns
The following patterns are prohibited and will cause the scan to fail:
- Use of `console.log` in production code.
- Hardcoded API keys or secrets.
- Usage of deprecated internal modules.
- Missing JSDoc comments for public functions.

### How to run the scan locally
To check your code for violations, run the following command in your terminal:

```bash
npm run doctor-hygiene
```

### How to fix violations
1. Run the scan to see the list of errors.
2. Open the files indicated in the output.
3. Apply the suggested fixes (e.g., remove logs, add documentation, or replace deprecated code).
4. Run `npm run doctor-hygiene` again to verify that all issues are resolved.
