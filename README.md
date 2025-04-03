# Google Calendar MCP Server

> **🔔 VERSION UPDATE NOTICE 🔔**  
> Version 1.0.1 includes a fix for Node.js v20.9.0+ compatibility with the 'open' package, which is now ESM-only in version 10+. Version 1.0.0 marks our first production-ready release with comprehensive code refactoring and internationalization.

![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Security](https://img.shields.io/badge/security-enhanced-green.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)

<a href="https://glama.ai/mcp/servers/@takumi0706/google-calendar-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@takumi0706/google-calendar-mcp/badge"  alt="image"/>
</a>

## Project Overview

Google Calendar MCP Server is an MCP (Model Context Protocol) server implementation that enables integration between Google Calendar and Claude Desktop. This project enables Claude to interact with the user's Google Calendar, providing the ability to display, create, update, and delete calendar events through natural language interaction.

### Core Features

- **Google Calendar integration**: Provides a bridge between Claude Desktop and the Google Calendar API
- **MCP implementation**: Follows the Model Context Protocol specification for AI assistant tool integration
- **OAuth2 authentication**: Handles the Google API authentication flow securely
- **Event management**: Supports comprehensive calendar event operations (get, create, update, delete)
- **Color support**: Ability to set and update event colors using colorId parameter
- **STDIO transport**: Uses standard input/output for communication with Claude Desktop

## Technical Architecture

This project uses:

- **TypeScript**: For type-safe code development
- **MCP SDK**: Uses `@modelcontextprotocol/sdk` for integration with Claude Desktop
- **Google API**: Uses `googleapis` for Google Calendar API access
- **Zod**: Implements schema validation for request/response data
- **Environment-based configuration**: Uses dotenv for configuration management
- **Helmet.js**: For security headers
- **AES-256-GCM**: For token encryption
- **Jest**: For unit testing and coverage
- **GitHub Actions**: For CI/CD

## Main Components

1. **MCP Server**: Core server implementation that handles communication with Claude Desktop
2. **Google Calendar Tools**: Calendar operations (retrieval, creation, update, deletion)
3. **Authentication Handler**: Management of OAuth2 flow with Google API
4. **Schema Validation**: Ensuring data integrity in all operations
5. **Token Manager**: Secure handling of authentication tokens

## Available Tools

This MCP server provides the following tools for interacting with Google Calendar:

### 1. getEvents

Retrieves calendar events with various filtering options.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `timeMin` (optional): Start time for event retrieval (ISO 8601 format, e.g., "2025-03-01T00:00:00Z")
- `timeMax` (optional): End time for event retrieval (ISO 8601 format)
- `maxResults` (optional): Maximum number of events to retrieve (default: 10)
- `orderBy` (optional): Sort order ("startTime" or "updated")

### 2. createEvent

Creates a new calendar event.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `event`: Event details object containing:
  - `summary` (required): Event title
  - `description` (optional): Event description
  - `location` (optional): Event location
  - `start`: Start time object with:
    - `dateTime` (optional): ISO 8601 format (e.g., "2025-03-15T09:00:00+09:00")
    - `date` (optional): YYYY-MM-DD format for all-day events
    - `timeZone` (optional): Time zone (e.g., "Asia/Tokyo")
  - `end`: End time object (same format as start)
  - `attendees` (optional): Array of attendees with email and optional displayName
  - `colorId` (optional): Event color ID (1-11)

### 3. updateEvent

Updates an existing calendar event.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `eventId` (required): ID of the event to update
- `event`: Event details object containing fields to update (same structure as createEvent, all fields optional)

### 4. deleteEvent

Deletes a calendar event.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `eventId` (required): ID of the event to delete

## Development Guidelines

When adding new functions, modifying code, or fixing bugs, please semantically increase the version for each change using `npm version` command.
Also, please make sure that your coding is clear and follows all the necessary coding rules, such as OOP.
The version script will automatically run `npm install` when the version is updated, but you should still build, run lint, and test your code before submitting it.

### Code Structure

- **src/**: Source code directory
  - **auth/**: Authentication handling
  - **config/**: Configuration settings
  - **mcp/**: MCP server implementation
  - **tools/**: Google Calendar tool implementations
  - **utils/**: Utility functions and helpers

### Best Practices

- Proper typing according to TypeScript best practices
- Maintaining comprehensive error handling
- Ensure proper authentication flow
- Keep dependencies up to date
- Write clear documentation for all functions
- Implement security best practices
- Follow the OAuth 2.1 authentication standards
- Use schema validation for all input/output data

### Testing

- Implement unit tests for core functionality
- Thoroughly test authentication flow
- Verify calendar manipulation against Google API
- Run tests with coverage reports
- Ensure security tests are included

## Deployment

This package is published on npm as `@takumi0706/google-calendar-mcp`:

```bash
npx @takumi0706/google-calendar-mcp@1.0.1
```

### Prerequisites

1. Create a Google Cloud Project and enable the Google Calendar API
2. Configure OAuth2 credentials in the Google Cloud Console
3. Set up environment variables:

```bash
# Create a .env file with your Google OAuth credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4153/oauth2callback
# Optional: Token encryption key (auto-generated if not provided)
TOKEN_ENCRYPTION_KEY=32-byte-hex-key
# Optional: Auth server port and host (default port: 4153, host: localhost)
AUTH_PORT=4153
AUTH_HOST=localhost
# Optional: MCP server port and host (default port: 3000, host: localhost)
PORT=3000
HOST=localhost
```

### Claude Desktop Configuration

Add the server to your `claude_desktop_config.json`:

```json
{
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
        "GOOGLE_REDIRECT_URI": "http://localhost:4153/oauth2callback"
      }
    }
  }
}
```

## Security Considerations

- **OAuth tokens** are stored in memory only (not stored in a file-based storage)
- **Sensitive credentials** must be provided as environment variables
- **Token encryption** using AES-256-GCM for secure storage
- **PKCE implementation** with explicit code_verifier and code_challenge generation
- **State parameter validation** for CSRF protection
- **Security headers** applied using Helmet.js
- **Rate limiting** for API endpoint protection
- **Input validation** with Zod schema

For more details, see [SECURITY.md](SECURITY.md).

## Maintenance

- Regular updates to maintain compatibility with the Google Calendar API
- Version updates are documented in README.md
- Logs are stored in the user's home directory `~/.google-calendar-mcp/logs/`

## Troubleshooting

If you encounter any issues:

1. Check the logs in your home directory at `~/.google-calendar-mcp/logs/`
2. Make sure your Google OAuth credentials are correctly configured
3. Ensure you have sufficient permissions for Google Calendar API access
4. Verify your Claude Desktop configuration is correct

### Common Errors

- **JSON Parsing Errors**: If you see errors like `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`, it's typically due to malformed JSON-RPC messages. This issue has been fixed in version 0.6.7 and later. If you're still experiencing these errors, please update to the latest version.
- **Authentication Errors**: Verify your Google OAuth credentials
- **Connection Errors**: Make sure only one instance of the server is running
- **Disconnection Issues**: Ensure your server is properly handling MCP messages without custom TCP sockets

## Version History

### Version 1.0.1 Changes
- Fixed compatibility issue with Node.js v20.9.0+ and the 'open' package (v10+)
- Replaced static import with dynamic import for the ESM-only 'open' package
- Improved error handling for browser opening during OAuth authentication
- Enhanced code comments for better maintainability

### Version 1.0.0 Changes
- Major version release marking production readiness
- Comprehensive code refactoring for improved maintainability
- Internationalization of all messages and comments (translated Japanese to English)
- Enhanced code consistency and readability
- Improved error messages for better user experience
- Updated documentation to reflect current state of the project
- Standardized coding style throughout the codebase

### Version 0.8.0 Changes
- Enhanced OAuth authentication flow to handle refresh token issues
- Added `prompt: 'consent'` parameter to force Google to show the consent screen and provide a new refresh token
- Modified authentication flow to work with just an access token if a refresh token is not available
- Improved token refresh logic to handle cases where there's no refresh token or if the refresh token is invalid
- Updated token storage to save refreshed access tokens for better token management
- Fixed potential infinite loop in token refresh logic

### Version 0.7.0 Changes
- Fixed OAuth callback handling issue that caused "Cannot GET /oauth2callback" errors
- Added automatic redirection from MCP server to OAuth server for callback handling
- Improved compatibility with different OAuth redirect URI configurations
- Enhanced error handling for OAuth authentication flow
- Updated documentation to reflect the OAuth callback handling fix

### Version 0.6.9 Changes
- Fixed OAuth authentication prompt issue that caused repeated authentication requests
- Improved authentication flow to prevent multiple browser windows from opening
- Enhanced token refresh mechanism to properly handle expired tokens
- Updated documentation to reflect the OAuth authentication fix

### Version 0.6.8 Changes
- Fixed port conflict issues when multiple instances are running
- Improved version management system
- Enhanced server startup and shutdown procedures
- Updated dependencies to latest compatible versions

### Version 0.6.7 Changes
- Fixed critical JSON parsing bug that caused errors when using the MCP Inspector
- Improved logging to prevent interference with JSON-RPC messages
- Enhanced message handling in STDIO transport
- Improved error handling for malformed JSON messages
- Added automated npm install process when updating the version using npm version command
- Updated documentation to reflect the JSON parsing bug fix and automated npm install process

### Version 0.6.6 Changes
- Added dedicated JSON-RPC message parsing utility in utils/json-parser.ts
- Created comprehensive test suite for JSON parsing to prevent regression
- Implemented 10 test cases covering various malformed JSON scenarios
- Refactored server.ts to use the common JSON parsing utility
- Improved code maintainability and testability

### Version 0.6.5 Changes
- Completely redesigned JSON-RPC message processing to resolve parsing errors
- Simplified and improved the algorithm for extracting valid JSON from messages
- Fixed the "Unexpected non-whitespace character after JSON at position 4" error
- Enhanced error handling with more descriptive error messages
- Improved logging for better diagnostics and troubleshooting

### Version 0.6.4 Changes
- Further improved JSON-RPC message processing to handle malformed messages more robustly
- Enhanced regex pattern for JSON object and array extraction with non-greedy matching
- Added balanced bracket matching algorithm to find the correct end of JSON objects and arrays
- Fixed ESLint warnings in the regex patterns
- Improved error logging for better diagnostics
- Updated version number in package.json and server.ts

### Version 0.6.3 Changes
- Fixed JSON-RPC message processing to handle malformed messages more robustly
- Improved regex pattern for JSON object extraction
- Added fallback mechanism for JSON parsing
- Updated version number in server.ts to match package.json

### Version 0.6.2 Changes
- Implemented HTML sanitization to prevent cross-site scripting (XSS) vulnerabilities
- Added escapeHtml utility function to safely handle user-controlled data in HTML responses
- Fixed potential XSS vulnerabilities in OAuth error handling
- Added comprehensive test suite for HTML sanitization functionality
- Improved overall security posture against injection attacks

### Version 0.6.1 Changes
- Fixed logger configuration to ensure info logs go to stdout instead of stderr
- Updated dependencies to resolve outdated package warnings
- Removed unnecessary @types/helmet dependency
- Fixed eslint version to be compatible with @typescript-eslint packages
- Improved overall stability and compatibility

### Version 0.6.0 Changes
- Version upgrade to maintain compatibility with the latest dependencies
- Implemented OAuth 2.1 authentication at the transport layer
- Added support for JSON-RPC batch processing for multiple requests
- Enhanced PKCE implementation with explicit code_verifier and code_challenge generation
- Improved CSRF protection with explicit state parameter validation
- Fixed TokenManager cleanup timer to properly release resources when tests complete
- Improved handling of interval timers to prevent potential memory leaks
- Enhanced resource management for better application stability
- Improved overall stability and performance
- Enhanced code quality and maintainability

### Version 0.5.1 Changes
- Minor bug fixes and stability improvements
- Documentation updates

### Version 0.5.0 Changes
- Added color support for calendar events with colorId parameter
- Enhanced event creation and update capabilities
- Updated @modelcontextprotocol/sdk from 1.7.0 to 1.8.0
- Updated googleapis from 133.0.0 to 148.0.0
- Updated winston from 3.11.0 to 3.17.0
- Updated zod from 3.22.4 to 3.24.2
- Improved stability and compatibility with latest dependencies

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
- Added basic OAuth authentication flow enhancements
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
- Updated to use the latest MCP SDK API (v1.8.0+)
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
