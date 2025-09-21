# Google Calendar MCP Server
![Apr-15-2025 12-17-08](https://github.com/user-attachments/assets/8970351e-c90d-42e3-8609-b4dfe33f8615)


> **🔔 VERSION UPDATE NOTICE 🔔**  
> Version 1.0.5 adds support for recurring events through the `recurrence` parameter in both `createEvent` and `updateEvent` tools. This allows you to create and modify recurring events directly without having to set them up manually after creation.

![](https://badge.mcpx.dev?type=server 'MCP Server')
![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/takumi0706/google-calendar-mcp)](https://archestra.ai/mcp-catalog/takumi0706__google-calendar-mcp)

[![日本語](https://img.shields.io/badge/日本語-クリック-青)](README.ja.md)
[![English](https://img.shields.io/badge/English-Click-blue)](README.md)


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
- **Hono**: Lightweight and fast web framework for the authentication server
- **OAuth2 Providers**: Uses `@hono/oauth-providers` for PKCE-enabled OAuth2 flow
- **Zod**: Implements schema validation for request/response data
- **Environment-based configuration**: Uses dotenv for configuration management
- **AES-256-GCM**: For token encryption using Node.js crypto module
- **Open**: For automatic browser launching during authentication
- **Readline**: For manual authentication input in server environments
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
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted, empty string, null, or undefined)
- `timeMin` (optional): Start time for event retrieval (ISO 8601 format, e.g., "2025-03-01T00:00:00Z"). Empty strings, null, or undefined values are ignored
- `timeMax` (optional): End time for event retrieval (ISO 8601 format). Empty strings, null, or undefined values are ignored
- `maxResults` (optional): Maximum number of events to retrieve (default: 10)
- `orderBy` (optional): Sort order ("startTime" or "updated"). Defaults to "startTime" if empty string, null, or undefined

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
  - `recurrence` (optional): Array of recurrence rules in RFC5545 format (e.g., ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"])

### 3. updateEvent

Updates an existing calendar event. The function fetches the existing event data first and merges it with the update data, preserving fields that are not included in the update request.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `eventId` (required): ID of the event to update
- `event`: Event details object containing fields to update (same structure as createEvent, all fields optional)
  - Only fields that are explicitly provided will be updated
  - Fields not included in the update request will retain their existing values
  - This allows for partial updates without losing data
  - `recurrence` parameter can be updated to modify recurring event patterns

### 4. deleteEvent

Deletes a calendar event.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `eventId` (required): ID of the event to delete

### 5. authenticate

Re-authenticates with Google Calendar. This is useful when you want to switch between different Google accounts without having to restart Claude.

**Parameters:**
- None

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
npx @takumi0706/google-calendar-mcp@1.0.7
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
# Optional: Enable manual authentication (useful when localhost is not accessible)
USE_MANUAL_AUTH=true
```

### Claude Desktop Configuration

Add the server to your `claude_desktop_config.json`. If you're running in an environment where localhost is not accessible, add the `USE_MANUAL_AUTH` environment variable set to "true".

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
- **Rate limiting** for API endpoint protection
- **Input validation** with Zod schema

For more details, see [SECURITY.md](SECURITY.md).

## Maintenance

- Regular updates to maintain compatibility with the Google Calendar API
- Version updates are documented in README.md

## Troubleshooting

If you encounter any issues:

1. Make sure your Google OAuth credentials are correctly configured
2. Ensure you have sufficient permissions for Google Calendar API access
3. Verify your Claude Desktop configuration is correct

### Common Errors

- **JSON Parsing Errors**: If you see errors like `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`, it's typically due to malformed JSON-RPC messages. This issue has been fixed in version 0.6.7 and later. If you're still experiencing these errors, please update to the latest version.
- **Authentication Errors**: Verify your Google OAuth credentials
- **Invalid state parameter**: If you see `Authentication failed: Invalid state parameter` when re-authenticating, update to version 1.0.3 or later which fixes the OAuth server lifecycle management. In older versions, you may need to close port 4153 and restart the application.
- **Connection Errors**: Make sure only one instance of the server is running
- **Disconnection Issues**: Ensure your server is properly handling MCP messages without custom TCP sockets
- **Cannot access localhost**: If you're running the application in an environment where localhost is not accessible (like a remote server or container), enable manual authentication by setting `USE_MANUAL_AUTH=true`. This will allow you to manually enter the authorization code shown by Google after authorizing the application.
- **MCP Parameter Validation Errors**: If you see error -32602 with empty string parameters, update to version 1.0.7 or later which handles empty strings, null, and undefined values properly.

## Version History

### Version 1.0.7 Changes
- Enhanced parameter validation for MCP tools to properly handle empty strings, null, and undefined values
- Fixed MCP error -32602 when empty string parameters were passed to getEvents tool
- Improved preprocessArgs function to skip empty values, allowing Zod schema defaults to be applied correctly
- Added comprehensive test coverage for empty parameter handling

### Version 1.0.6 Changes
- Fixed the scope is not needed in this google calendar mcp server

### Version 1.0.5 Changes
- Added support for recurring events through the `recurrence` parameter in both `createEvent` and `updateEvent` tools
- Allows creation and modification of recurring events directly without manual setup

### Version 1.0.4 Changes
- Maintenance release with version number update
- No functional changes from version 1.0.3
- Ensures compatibility with the latest dependencies

### Version 1.0.3 Changes
- Added new `authenticate` tool to allow re-authentication without restarting Claude
- Made it possible to switch between different Google accounts during a session
- Exposed authentication functionality through the MCP interface
- Enhanced user experience by eliminating the need to restart for account switching
- Added manual authentication option for environments where localhost is not accessible
- Implemented readline interface for entering authorization codes manually
- Added USE_MANUAL_AUTH environment variable to enable manual authentication
- Updated zod dependency to the latest version (3.24.2)
- Improved schema validation with the latest zod features
- Enhanced code stability and security
- Fixed "Invalid state parameter" error during re-authentication
- Modified OAuth server to start on-demand and shut down after authentication
- Improved server lifecycle management to prevent port conflicts
- Enhanced error handling for authentication flow

### Version 1.0.2 Changes
- Fixed `updateEvent` function to preserve existing event data when performing partial updates
- Added `getEvent` function to fetch existing event data before updating
- Modified `updateEvent` to merge update data with existing data to prevent data loss
- Updated schema validation to make all fields optional in update requests
- Improved documentation for the `updateEvent` function

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

## Installation

### Quick Start (Recommended)

Install directly from npm:

```bash
npm install -g @takumi0706/google-calendar-mcp
```

### Manual Installation

For development or customization:

```bash
# Clone the repository
git clone https://github.com/takumi0706/google-calendar-mcp.git
cd google-calendar-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run the server
npm start
```

## Production Deployment

For production use, the server requires valid Google OAuth credentials. The server will fail to start without proper credentials, ensuring security compliance.

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
