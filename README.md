# Google Calendar MCP Server

![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Security](https://img.shields.io/badge/security-enhanced-green.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)

<a href="https://glama.ai/mcp/servers/@takumi0706/google-calendar-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@takumi0706/google-calendar-mcp/badge"  alt=""/>
</a>


A Model Context Protocol (MCP) server implementation for Google Calendar integration with Claude Desktop. This server enables you to manage Google Calendar events using Claude through the MCP integration.

## 🆕 Security and Quality Improvements (v0.4.0)

### Security Enhancements
- **Token Encryption**: Secure token storage with AES-256-GCM encryption
- **OAuth Flow Improvements**: CSRF protection and PKCE implementation
- **Security Headers**: HTTP security headers applied using Helmet.js
- **Rate Limiting**: API endpoint protection against abuse
- **Input Validation**: Strict data validation with Zod schema

### Quality Improvements
- **Test Coverage**: Enhanced unit and integration tests
- **Error Handling**: Unified error format and detailed logging
- **CI/CD Pipeline**: Automated build, test, and security scanning with GitHub Actions
- **Documentation**: Detailed API reference and security guidelines
- **Code Quality**: Strict TypeScript type definitions and consistent coding style

## Features

- Google Calendar event management (get, create, update, delete)
- OAuth2 authentication with Google Calendar API
- MCP SDK integration for Claude Desktop
- Automatic browser opening for authorization
- In-memory token management (no file-based storage)
- Simple setup and configuration

## Installation

```bash
npx @takumi0706/google-calendar-mcp
```

## Usage

### Prerequisites

1. Create a Google Cloud Project and enable the Google Calendar API
2. Configure OAuth2 credentials in the Google Cloud Console
3. Set up environment variables:

```bash
# Create a .env file with your Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
# Optional: Token encryption key (auto-generated if not provided)
TOKEN_ENCRYPTION_KEY=32-byte-hex-key
```

### Claude Desktop Configuration

Add the server to your `claude_desktop_config.json`:

```json
{
  "globalShortcut": "Shift+Alt+Space",
  "mcpServers": {
    "google-calendar": {
      "command": "npx",
      "args": [
        "-y",
        "@takumi0706/google-calendar-mcp"
      ],
      "env": {
        "GOOGLE_CLIENT_ID": "your_client_id",
        "GOOGLE_CLIENT_SECRET": "your_client_secret",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth2callback"
      }
    }
  }
}
```

## API

This MCP server provides the following functions for Google Calendar:

- `getEvents`: Retrieve events from the user's calendar
- `createEvent`: Create a new calendar event
- `updateEvent`: Update an existing calendar event
- `deleteEvent`: Delete a calendar event

## Implementation Details

This server uses:

- **MCP SDK**: `@modelcontextprotocol/sdk` for Claude Desktop integration
- **Google APIs**: `googleapis` for Google Calendar API access
- **TypeScript**: For type-safe code
- **Zod**: For schema validation
- **Helmet.js**: For security headers
- **AES-256-GCM**: For token encryption
- **Jest**: For unit testing and coverage
- **GitHub Actions**: For CI/CD

## Storage and Logging

The server stores the following data:

- **OAuth Token**: Stored in memory only (no file-based storage in v0.3.3+)
- **Logs**: Stored in `~/.google-calendar-mcp/logs/` in the user's home directory

## Security Measures

Security features introduced in v0.4.0:

1. **Token Encryption**:
   - Protection of tokens with AES-256-GCM encryption
   - Unique initialization vector (IV) for each token
   - Encryption key from environment variable or auto-generated

2. **OAuth Authentication Enhancements**:
   - Unique state values for CSRF attack protection
   - PKCE to prevent authorization code interception
   - Strict authentication flow validation

3. **Web Security**:
   - Content Security Policy (CSP)
   - XSS protection
   - HTTPS connection recommended
   - Rate limiting

For more details, see [SECURITY.md](SECURITY.md).

## Troubleshooting

If you encounter any issues:

1. Check the logs in your home directory at `~/.google-calendar-mcp/logs/`
2. Make sure your Google OAuth credentials are correctly configured
3. Ensure you have sufficient permissions for Google Calendar API access
4. Verify your Claude Desktop configuration is correct

### Common Errors

- **JSON Parsing Errors**: If you see errors like `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`, it's typically due to malformed JSON-RPC messages. This has been fixed in version 0.2.6+.
- **Authentication Errors**: Verify your Google OAuth credentials
- **Connection Errors**: Make sure only one instance of the server is running
- **Disconnection Issues**: Ensure your server is properly handling MCP messages without custom TCP sockets

## Version History

### Version 0.4.2 Changes
- Improved tools registration to properly expose tool details to clients
- Enhanced server capabilities registration with explicit tool definitions
- Fixed order of operations in server initialization
- Improved code documentation and comments

### Version 0.4.1 Changes
- Refactored code architecture for better maintainability
- Implemented ToolsManager class to encapsulate tool definitions
- Improved code organization by moving functionality from server.ts to tools.ts
- Removed unused imports and type definitions
- Enhanced code quality and readability

### Version 0.4.0 Changes
- Implemented token encryption system (AES-256-GCM)
- Enhanced OAuth authentication flow with CSRF protection and PKCE
- Added security headers using Helmet.js
- Implemented rate limiting for DDoS protection
- Enhanced input validation and error handling
- Improved test coverage
- Automated CI/CD with GitHub Actions
- Enhanced security documentation

### Version 0.3.3 Changes
- Removed file-based token storage and improved in-memory token management
- Fixed various memory leaks and improved resource management
- Enhanced stability and error handling

### Version 0.3.2 Changes
- Added automatic browser opening for Google Calendar authorization
- Improved user experience during authentication flow

### Version 0.3.1 Changes
- Updated server version indicator
- Fixed minor bugs in event handling

### Version 0.2.7 Fixes
- Fixed JSON-RPC message processing to handle malformed messages
- Improved message processing between client and server with more robust parsing
- Enhanced logging format with better context information
- Added debug mode support for troubleshooting JSON-RPC messages

### Version 0.2.6 Fixes
- Fixed JSON-RPC message handling that was causing parsing errors
- Removed custom TCP socket server which was causing connection issues
- Added proper error handling for transport errors
- Improved logging of message exchanges between client and server

### Version 0.2.0 Changes
- Updated to use the latest MCP SDK API (v1.7.0+)
- Migrated from `Server` class to the modern `McpServer` class
- Improved type safety with properly typed tool handlers
- Fixed update operations to handle partial event updates properly
- Enhanced error handling with detailed error messages
- Optimized performance when handling calendar operations
- Simplified implementation with direct API calls

## Development

To contribute to this project:

```bash
# Clone the repository
git clone https://github.com/takumi0706/google-calendar-mcp.git
cd google-calendar-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Testing

To run the tests:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm test -- --coverage
```

## License

MIT
