# Scrapegoat Documentation

Welcome to the Scrapegoat documentation! This directory contains comprehensive guides for installation, architecture, configuration, and development.

## Documentation Overview

### Getting Started

- **[INSTALL.md](../INSTALL.md)** - Complete installation guide
  - Prerequisites and system requirements
  - Step-by-step installation process
  - Database setup with pgvector
  - Service installation with systemd
  - nginx reverse proxy configuration
  - Verification and testing steps

### Understanding Scrapegoat

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design
  - Three-service architecture overview
  - Database schema and vector search
  - Fetcher pipeline (HTTP, Playwright, Crawl4AI)
  - Storage pipeline for documents and screenshots
  - Communication patterns and data flow
  - Port allocation and routing

### Configuration

- **[NGINX.md](NGINX.md)** - Reverse proxy configuration
  - Complete nginx setup guide
  - Location block precedence explained
  - SSL/TLS configuration
  - Endpoint routing table
  - Common issues and solutions

### Problem Solving

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions
  - Service startup issues
  - Database connection problems
  - MCP integration issues
  - Crawl4AI Docker problems
  - nginx routing issues
  - Performance optimization

### Development

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guide
  - Development environment setup
  - Project structure overview
  - Development workflow
  - Testing guidelines
  - Code standards and style guide
  - Pull request process

### Quick Reference

- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command reference
  - Service management commands
  - Database operations
  - API operations
  - Docker commands
  - Troubleshooting commands

## Quick Links

### Installation
- [Prerequisites](../INSTALL.md#prerequisites)
- [Database Setup](../INSTALL.md#database-setup)
- [Service Installation](../INSTALL.md#service-installation-linux-systemd)
- [Verification](../INSTALL.md#verification)

### Configuration
- [Environment Variables](../INSTALL.md#environment-configuration)
- [nginx Setup](NGINX.md#complete-nginx-configuration)
- [SSL/TLS](NGINX.md#ssltls-configuration)

### Troubleshooting
- [Service Issues](TROUBLESHOOTING.md#service-issues)
- [Database Problems](TROUBLESHOOTING.md#database-problems)
- [MCP Issues](TROUBLESHOOTING.md#mcp-connection-issues)

### Development
- [Development Setup](CONTRIBUTING.md#development-setup)
- [Project Structure](CONTRIBUTING.md#project-structure)
- [Testing](CONTRIBUTING.md#testing)
- [Code Standards](CONTRIBUTING.md#code-standards)

## Getting Help

If you can't find what you're looking for:

1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/yourusername/scrapegoat/issues)
3. Ask in [GitHub Discussions](https://github.com/yourusername/scrapegoat/discussions)
4. Review the [Architecture Documentation](ARCHITECTURE.md)

## Additional Resources

- [Main README](../README.md) - Project overview and quick start
- [CHANGELOG](../CHANGELOG.md) - Version history and changes
- [.env.example](../.env.example) - Configuration reference
- [GitHub Repository](https://github.com/yourusername/scrapegoat)
- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP specification
- [Crawl4AI Documentation](https://github.com/unclecode/crawl4ai)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
