# Google Calendar MCP Server

![Version](https://img.shields.io/badge/version-0.3.3-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg)

A Model Context Protocol (MCP) server implementation for Google Calendar integration with Claude Desktop.

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
- **Open**: For automatic browser opening during auth

## Storage and Logging

The server stores the following data:

- **OAuth Token**: Stored in memory only (no file-based storage in v0.3.3+)
- **Logs**: Stored in `~/.google-calendar-mcp/logs/` in the user's home directory

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

## License

MIT