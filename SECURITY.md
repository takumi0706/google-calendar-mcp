# Security Policy

## Supported Versions

We currently provide security updates for the following versions:

| Version | Supported          |
|---------|--------------------|
| 1.0.5   | :white_check_mark: |
| 1.0.4   | :white_check_mark: |
| 1.0.3   | :white_check_mark: |
| 1.0.2   | :x:                |
| 1.0.1   | :x:                |
| 1.0.0   | :x:                |
| < 0.8.0 | :x:                |

## Reporting a Vulnerability

We take the security of Google Calendar MCP seriously. If you believe you've found a security vulnerability, please follow these steps:

1. **Do not disclose the vulnerability publicly**
2. **Email us directly** at [ganndamu0706@gmail.com](mailto:ganndamu0706@gmail.com) with details about the vulnerability
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggestions for mitigation (if any)

## What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a more detailed response within 7 days, indicating next steps
- We will work with you to understand and address the issue
- We will keep you informed about our progress

## Security Mechanisms

The Google Calendar MCP handles OAuth tokens and calendar data, which may contain sensitive information. We've implemented the following security measures:

### Security Features Added in Version 1.0.5

1. **Enhanced Input Validation for Recurring Events**:
   - Added strict schema validation for the `recurrence` parameter using Zod
   - Implemented proper validation of RFC5545 RRULE format strings
   - Enhanced error handling for invalid recurrence patterns

### Security Features Added in Version 1.0.4

1. **Dependency Updates and Maintenance**:
   - Updated dependencies to patch security vulnerabilities
   - Improved compatibility with secure Node.js environments
   - Maintained and verified existing security measures

### Security Features Added in Version 1.0.0

1. **Internationalization and Improved Error Handling**:
   - Standardized all error messages in English for better clarity and consistency
   - Enhanced error messages to provide more specific information about what went wrong
   - Improved error handling patterns throughout the codebase
   - Standardized logging format for better diagnostics and troubleshooting

2. **Code Refactoring for Security**:
   - Comprehensive code review and refactoring to identify and address potential security issues
   - Improved code organization and structure for better maintainability and security
   - Enhanced documentation of security-related code and features
   - Standardized coding patterns for handling sensitive data

### Security Features Added in Version 0.8.x

1. **Enhanced OAuth Authentication Flow (v0.8.0)**:
   - Improved handling of refresh token issues for more robust authentication
   - Added `prompt: 'consent'` parameter to force Google to show the consent screen and provide a new refresh token
   - Modified authentication flow to work with just an access token if a refresh token is not available
   - Improved token refresh logic to handle cases where there's no refresh token or if the refresh token is invalid
   - Updated token storage to save refreshed access tokens for better token management
   - Fixed potential infinite loop in token refresh logic
   - Enhanced overall security and reliability of the OAuth authentication process

### Security Features Added in Version 0.7.x

1. **OAuth Callback Handling Improvements (v0.7.0)**:
   - Fixed OAuth callback handling issue that caused "Cannot GET /oauth2callback" errors
   - Added automatic redirection from MCP server to OAuth server for callback handling
   - Improved compatibility with different OAuth redirect URI configurations
   - Enhanced error handling for OAuth authentication flow
   - Strengthened security by ensuring proper handling of authentication callbacks

### Security Features Added in Version 0.6.x

1. **Enhanced XSS Protection**:
   - Implementation of HTML sanitization to prevent cross-site scripting vulnerabilities
   - Addition of escapeHtml utility function to safely handle user-controlled data in HTML responses
   - Comprehensive test suite for HTML sanitization functionality
   - Fixing of potential XSS vulnerabilities in OAuth error handling
   - Improved overall security posture against injection attacks

2. **JSON Parsing Bug Fix (v0.6.7)**:
   - Fixed critical JSON parsing bug that caused errors when using the MCP Inspector
   - Improved logging to prevent interference with JSON-RPC messages
   - Enhanced message handling in STDIO transport
   - Improved error handling for malformed JSON messages

3. **OAuth Authentication Improvements (v0.6.9)**:
   - Fixed OAuth authentication prompt issue that caused repeated authentication requests
   - Improved authentication flow to prevent multiple browser windows from opening
   - Enhanced token refresh mechanism to properly handle expired tokens
   - Strengthened security by preventing unnecessary re-authentication attempts

### Security Features Added in Version 0.4.x

1. **Enhanced Token Management**:
   - AES-256-GCM encryption for protecting tokens
   - Proper token expiration management
   - In-memory storage only (no persistent file storage)

2. **Enhanced OAuth Authentication Flow**:
   - Implementation of state parameter for CSRF attack prevention
   - PKCE (Proof Key for Code Exchange) implementation for authentication strengthening
   - Strict validation of authentication requests

3. **Security Headers and Middleware**:
   - Secure HTTP headers setup using Helmet.js
   - Content Security Policy (CSP) implementation
   - Rate limiting to prevent brute force attacks
   - XSS protection

4. **Input Validation**:
   - Strict schema validation using Zod
   - Rigorous format checking for dates, times, email addresses, etc.
   - Length limitations and sanitization processing

### Existing Security Features

- Local-only server operation
- Secure handling of OAuth credentials
- Regular security updates

## Best Practices for Users

To ensure secure usage of Google Calendar MCP:

1. Keep your environment variables secure and do not expose them in public repositories
2. Always use the latest version of the package
3. Regularly review your Google Cloud Console for any suspicious activities
4. Limit the OAuth scopes to only what's necessary for your use case
5. Set appropriate rate limits for your project
6. When extending the application, always sanitize user input before including it in HTML responses
7. Follow the example of using the escapeHtml utility function for any user-controlled data in your custom code

## Details of Security Measures

### 1. HTML Sanitization and XSS Protection

Protection against cross-site scripting (XSS) attacks:
- Implementation of escapeHtml utility function that escapes HTML special characters (&, <, >, ", ')
- Sanitization of all user-controlled data before inclusion in HTML responses
- Comprehensive test suite to ensure proper sanitization in various scenarios
- Secure handling of error messages in OAuth flows to prevent reflected XSS

### 2. Token Encryption

Refresh tokens are protected using AES-256-GCM encryption:
- Unique initialization vector (IV) for each token
- Integrity verification with authentication tag
- Use of encryption key from environment variable or randomly generated

### 3. OAuth 2.0 Authentication Flow

Implementation of OAuth 2.0 best practices:
- Use of unique state parameter for protection against CSRF attacks
- PKCE extension to protect against code interception attacks
- Strict validation during authentication code exchange
- Authentication sessions with expiration

### 4. Rate Limiting and Protection

Protection against denial of service attacks:
- Rate limiting for API endpoints
- Special rate limiting for OAuth authentication endpoints
- Temporary blocking and gradual back-off

## Security Updates

Security updates will be announced through:
- GitHub repository releases
- npm package updates
- Release notes documentation

Thank you for helping keep Google Calendar MCP and its users safe!
