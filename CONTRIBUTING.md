# Contributing to Google Calendar MCP

## Development

To set up the project for development:

```bash
# Clone the repository
git clone https://github.com/takumi0706/google-calendar-mcp.git
cd google-calendar-mcp

# Install dependencies
npm install

# Create a .env file with your Google credentials
cat > .env << EOL
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
EOL

# Run in development mode
npm run dev
```

## Testing

Run tests with:

```bash
npm test
```

## Building

Build the project with:

```bash
npm run build
```

## Code Style

We use ESLint and Prettier to maintain code quality and style:

```bash
# Lint the code
npm run lint

# Format the code
npm run format
```

### Internationalization Guidelines

To maintain consistency throughout the codebase:

1. All code comments should be written in English
2. All user-facing messages should be in English
3. Variable names, function names, and other identifiers should be in English
4. Log messages should be in English for better troubleshooting
5. Documentation should be in English

This ensures that the codebase is accessible to developers worldwide and maintains a consistent style.

## Release Process

### Manual NPM Publishing

To publish a new version to npm manually:

1. Update the version in `package.json`
2. Run the following commands:

```bash
# Commit all changes
git add .
git commit -m "Prepare for release vX.Y.Z"

# Create a new tag
git tag vX.Y.Z

# Push to GitHub
git push
git push --tags

# Publish to npm
npm publish --access public
```

### Automated Publishing via GitHub Actions

To trigger an automated release:

1. Go to the GitHub repository
2. Click on "Releases" tab
3. Click "Draft a new release"
4. Enter the version tag (e.g., `v0.1.0`)
5. Add a title and description
6. Click "Publish release"

This will trigger the GitHub Action workflow to automatically publish to npm.

## NPM Token Setup

To set up the NPM_TOKEN secret for GitHub Actions:

1. Generate an NPM access token:
   - Log in to your npm account on https://www.npmjs.com/
   - Go to your profile > Access Tokens > Generate New Token
   - Select "Automation" token type
   - Save the generated token

2. Add the token to GitHub repository secrets:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name it `NPM_TOKEN`
   - Paste your npm token in the value field
   - Click "Add secret"
