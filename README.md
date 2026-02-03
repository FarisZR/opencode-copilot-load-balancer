# OpenCode Copilot Multi-Account Load Balancer

A powerful load-balancing plugin for OpenCode that routes GitHub Copilot requests across multiple accounts.

## Core Features

- **Multi-Account Support**: Add multiple GitHub.com and Enterprise accounts.
- **Hybrid Load Balancing**: Smart selection strategy with LRU rotation and failure-aware cooldowns.
- **Model Awareness**: Automatically detects and caches model availability per account.
- **Observability**: Toast notifications and TUI-integrated logging for transparent account attribution.

## Getting Started

See [template/README.md](template/README.md) for installation and usage instructions.

## Documentation

- [Architecture](template/docs/ARCHITECTURE.md) - How the load balancer works under the hood.
- [Configuration](template/docs/CONFIGURATION.md) - Detailed configuration options and management tools.

## Development

See [template/AGENTS.md](template/AGENTS.md) for development workflows and build commands.

## License

MIT
