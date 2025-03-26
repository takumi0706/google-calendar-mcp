# Security Policy

## Supported Versions

Currently, we are providing security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | :white_check_mark: |
| 0.2.7   | :x: 　　　　　　　　　|
| 0.2.6   | :x: 　　　　　　　　　|
| < 0.2.6 | :x:                |

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

## Security Considerations

The Google Calendar MCP handles OAuth tokens and calendar data, which may contain sensitive information. We've implemented the following security measures:

- In-memory token storage (no persistent file storage since v0.3.3)
- Local-only server operation
- Secure handling of OAuth credentials
- Regular security updates

## Best Practices for Users

To ensure secure usage of Google Calendar MCP:

1. Keep your environment variables secure and do not expose them in public repositories
2. Always use the latest version of the package
3. Regularly review your Google Cloud Console for any suspicious activities
4. Limit the OAuth scopes to only what's necessary for your use case

## Security Updates

Security updates will be announced through:
- GitHub repository releases
- npm package updates
- Release notes documentation

Thank you for helping keep Google Calendar MCP and its users safe!
