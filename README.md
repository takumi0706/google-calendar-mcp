# Google Calendar MCP Server

> **🔔 VERSION UPDATE NOTICE 🔔**  
> Version 1.0.3 fixes the "Invalid state parameter" error during re-authentication by improving the OAuth server lifecycle management. Version 1.0.2 includes a fix for the `updateEvent` function to preserve existing event data when performing partial updates.

![Version](https://img.shields.io/badge/version-1.0.3-blue.svg)
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

Updates an existing calendar event. The function fetches the existing event data first and merges it with the update data, preserving fields that are not included in the update request.

**Parameters:**
- `calendarId` (optional): Calendar ID (uses primary calendar if omitted)
- `eventId` (required): ID of the event to update
- `event`: Event details object containing fields to update (same structure as createEvent, all fields optional)
  - Only fields that are explicitly provided will be updated
  - Fields not included in the update request will retain their existing values
  - This allows for partial updates without losing data

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
npx @takumi0706/google-calendar-mcp@1.0.3
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
- **Invalid state parameter**: If you see `Authentication failed: Invalid state parameter` when re-authenticating, update to version 1.0.3 or later which fixes the OAuth server lifecycle management. In older versions, you may need to close port 4153 and restart the application.
- **Connection Errors**: Make sure only one instance of the server is running
- **Disconnection Issues**: Ensure your server is properly handling MCP messages without custom TCP sockets

## Version History

### Version 1.0.3 Changes
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
