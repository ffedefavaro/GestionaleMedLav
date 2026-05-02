## 2025-05-14 - [Enforced Authentication and Database Encryption]
**Vulnerability:** The application had a functional Login component and encryption utilities but did not enforce them. The main entry point (App.tsx) initialized the database unencrypted and provided full access to the dashboard without authentication.
**Learning:** Having security components (Login, CryptoJS) in a codebase does not guarantee security if the main execution flow bypasses them. Architectural enforcement at the root level is required.
**Prevention:** Always gate sensitive resource initialization (like a medical database) behind an authentication state. Use a "secure by default" approach where the application remains locked until explicit credentials are provided and verified.
