# Google Calendar MCP Server

A Model Context Protocol (MCP) server implementation for Google Calendar integration with Claude Desktop.

## Features

- Google Calendar event management (get, create, update, delete)
- OAuth2 authentication with Google Calendar API
- MCP SDK integration for Claude Desktop
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
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/Desktop",
        "/Users/username/Downloads",
        "/Users/username/Documents"
      ]
    },
    "brave-search": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-brave-search"
      ],
      "env": {
        "BRAVE_API_KEY": "your_brave_api_key"
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

## Storage and Logging

The server stores the following data:

- **OAuth Token**: Stored in `token.json` in the current working directory
- **Logs**: Stored in `~/.google-calendar-mcp/logs/` in the user's home directory

## Troubleshooting

If you encounter any issues:

1. Check the logs in your home directory at `~/.google-calendar-mcp/logs/`
2. Make sure your Google OAuth credentials are correctly configured
3. Ensure you have sufficient permissions for Google Calendar API access
4. Verify your Claude Desktop configuration is correct

### Common Errors

- **JSON Parsing Errors**: Make sure your MCP server is properly initialized with the latest SDK
- **Authentication Errors**: Verify your Google OAuth credentials
- **Connection Errors**: Check that the server is running on the expected port

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

## Changes in version 0.1.5

- Fixed TypeScript type errors in MCP server implementation
- Updated to use the correct McpServer API methods:
  - `addTool` instead of `registerTool`
  - `close` instead of `disconnect`
- Added explicit type annotation for parameters
- Fixed TCP socket handling for better Claude Desktop compatibility
- Enhanced error reporting and logging

## License

MIT
