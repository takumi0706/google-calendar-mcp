# Security Policy

## Supported Versions

We currently provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | :white_check_mark: |
| 0.3.x   | :white_check_mark: |
| 0.2.7   | :x: 　　　　　　　　　|
| < 0.2.7 | :x:                |

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

## Details of Security Measures

### 1. Token Encryption

Refresh tokens are protected using AES-256-GCM encryption:
- Unique initialization vector (IV) for each token
- Integrity verification with authentication tag
- Use of encryption key from environment variable or randomly generated

### 2. OAuth 2.0 Authentication Flow

Implementation of OAuth 2.0 best practices:
- Use of unique state parameter for protection against CSRF attacks
- PKCE extension to protect against code interception attacks
- Strict validation during authentication code exchange
- Authentication sessions with expiration

### 3. Rate Limiting and Protection

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
