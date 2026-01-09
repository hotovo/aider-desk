---
title: "Running AiderDesk with Docker"
sidebar_label: "Docker"
---

# Running AiderDesk with Docker

AiderDesk provides a Docker image that allows you to run the application in headless mode and interact with it through your web browser. This is particularly useful for:
- Running AiderDesk on a remote server
- Containerizing your development environment
- Deploying AiderDesk in cloud environments
- Running multiple isolated instances

## Quick Start

### Pull and Run

The Docker image is published to the GitHub Container Registry (ghcr.io):

```bash
docker pull ghcr.io/hotovo/aider-desk:latest
```

Run the container with persistent data and configuration volumes:

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v /path/to/your/data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  ghcr.io/hotovo/aider-desk:latest
```

After starting the container, access AiderDesk in your browser at:
```
http://localhost:24337
```

## Configuration

### Persistent Data Volume

AiderDesk stores all configuration, settings, and project data in the `/app/data` directory. To preserve your data across container restarts, you must mount this directory as a volume.

**Example:**

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  ghcr.io/hotovo/aider-desk:latest
```

This will:
- Create a directory `~/aiderdesk-data` on your host machine
- Mount it to `/app/data` inside the container
- Persist all settings, API keys, project configurations, and logs

### Mounting Global Configuration Directory

The `~/.aider-desk` directory on your host machine contains global configuration and custom files that you may want to persist:

- **Agent profiles** (`.aider-desk/agents/`) - Custom agent configurations
- **Skills** (`.aider-desk/agents/`) - Reusable skills for agent mode
- **Custom commands** (`.aider-desk/commands/`) - User-defined commands
- **Hooks** (`.aider-desk/hooks/`) - Custom hooks for automation
- **Custom prompts** (`.aider-desk/prompts/`) - Custom prompt templates
- **Rules** (`.aider-desk/rules/`) - Custom rules and guidelines

Since the Docker container runs as the `root` user, the home directory inside the container is `/root`. To persist these global configurations, mount `~/.aider-desk` to `/root/.aider-desk`.

**Example:**

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  ghcr.io/hotovo/aider-desk:latest
```

This will:
- Mount your `~/.aider-desk` directory from the host to `/root/.aider-desk` inside the container
- Persist all your agent profiles, skills, custom commands, hooks, and prompts
- Ensure your custom configurations are available across container restarts

**Note:** The `~/.aider-desk` directory will be created on your host machine automatically the first time you run AiderDesk (outside of Docker), or you can create it manually before running the container.

### Opening Projects

You can open projects in AiderDesk using two methods:

#### Method 1: Using the `AIDER_DESK_PROJECTS` Environment Variable

Set the `AIDER_DESK_PROJECTS` environment variable to automatically open projects when the container starts. The variable accepts a comma-separated list of project paths.

**Example:**

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects:/projects \
  -e AIDER_DESK_PROJECTS="/projects/my-app,/projects/other-app" \
  ghcr.io/hotovo/aider-desk:latest
```

**Important:** The project paths specified in `AIDER_DESK_PROJECTS` must be accessible from within the container. This means each project directory must be mounted as a volume.

#### Method 2: Opening Projects via the UI

Alternatively, you can open projects directly from the AiderDesk interface after the container is running:

1. Access AiderDesk in your browser at `http://localhost:24337`
2. Click the "Open Project" button in the top toolbar
3. Type the **full path** to your project as it exists inside the container
4. Click "Open"

**Example paths:**
- `/projects/my-app` (if mounted)
- `/workspace/my-project` (if mounted)

**Important:** The path you enter must be the path as seen from inside the Docker container, not your host machine path. Ensure the project directory is mounted as a volume.

### Project Volume Mounting

To access your projects from within the Docker container, you need to mount each project directory as a volume.

**Example with multiple projects:**

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects/my-app:/projects/my-app \
  -v ~/projects/other-app:/projects/other-app \
  -e AIDER_DESK_PROJECTS="/projects/my-app,/projects/other-app" \
  ghcr.io/hotovo/aider-desk:latest
```

**Directory structure:**
```
Host machine:                     Inside container:
~/projects/my-app/    →         /projects/my-app/
~/projects/other-app/  →         /projects/other-app/
~/.aider-desk/       →         /root/.aider-desk/
~/aiderdesk-data/     →         /app/data/
```

### Port Configuration

By default, AiderDesk runs on port `24337`. You can change the exposed port mapping using Docker's `-p` flag.

**Example - Use a different host port:**

```bash
docker run -d \
  --name aiderdesk \
  -p 8080:24337 \
  -v ~/aiderdesk-data:/app/data \
  ghcr.io/hotovo/aider-desk:latest
```

Now access AiderDesk at `http://localhost:8080`.

### Authentication

For production environments, you may want to enable authentication. AiderDesk supports Basic Auth via environment variables.

**Example:**

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -e AIDER_DESK_USERNAME=admin \
  -e AIDER_DESK_PASSWORD=your-secure-password \
  ghcr.io/hotovo/aider-desk:latest
```

When you access `http://localhost:24337`, you'll be prompted for username and password.

## Complete Examples

### Example 1: Single Project Setup

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/my-project:/workspace/project \
  -e AIDER_DESK_PROJECTS="/workspace/project" \
  ghcr.io/hotovo/aider-desk:latest
```

### Example 2: Multiple Projects with Authentication

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects:/projects \
  -e AIDER_DESK_PROJECTS="/projects/frontend,/projects/backend,/projects/api" \
  -e AIDER_DESK_USERNAME=myuser \
  -e AIDER_DESK_PASSWORD=mypassword \
  ghcr.io/hotovo/aider-desk:latest
```

### Example 3: Manual Project Opening (No Environment Variable)

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects:/projects \
  ghcr.io/hotovo/aider-desk:latest
```

Then:
1. Open `http://localhost:24337` in your browser
2. Click "Open Project"
3. Enter `/projects/my-app` (or any mounted project path)
4. Click "Open"

### Example 4: Docker Compose Setup

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  aiderdesk:
    image: ghcr.io/hotovo/aider-desk:latest
    container_name: aiderdesk
    ports:
      - "24337:24337"
    volumes:
      # Persistent data directory
      - ./aiderdesk-data:/app/data
      # Global configuration (agent profiles, skills, custom commands, hooks, prompts)
      - ~/.aider-desk:/root/.aider-desk
      # Mount your projects
      - ./projects/frontend:/projects/frontend
      - ./projects/backend:/projects/backend
    environment:
      # Auto-open projects
      - AIDER_DESK_PROJECTS=/projects/frontend,/projects/backend
      # Optional: Authentication
      - AIDER_DESK_USERNAME=admin
      - AIDER_DESK_PASSWORD=secure-password
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:24337/', (r) => {process.exit(r.statusCode === 200 || r.statusCode === 404 ? 0 : 1)}).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
```

Run with:
```bash
docker-compose up -d
```

### Example 5: Specific Version

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects:/projects \
  ghcr.io/hotovo/aider-desk:1.0.0
```

## Accessing AiderDesk

Once your container is running, access the web interface:

```
http://localhost:24337
```

If you changed the port mapping:
```
http://localhost:YOUR_MAPPED_PORT
```

If you enabled authentication, you'll be prompted to log in with the username and password you set.

## Managing the Container

### View Logs

```bash
docker logs aiderdesk
```

### Follow Logs in Real-time

```bash
docker logs -f aiderdesk
```

### Stop the Container

```bash
docker stop aiderdesk
```

### Start a Stopped Container

```bash
docker start aiderdesk
```

### Remove the Container

```bash
docker rm aiderdesk
```

### Enter the Container (for debugging)

```bash
docker exec -it aiderdesk /bin/bash
```

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AIDER_DESK_PORT` | Port for the web server | `24337` | No |
| `AIDER_DESK_USERNAME` | Basic auth username | - | No |
| `AIDER_DESK_PASSWORD` | Basic auth password | - | No |
| `AIDER_DESK_PROJECTS` | Comma-separated list of project paths | - | No |

## Troubleshooting

### Container Fails to Start

Check the logs for error messages:
```bash
docker logs aiderdesk
```

### Cannot Access AiderDesk in Browser

1. Verify the container is running:
   ```bash
   docker ps
   ```

2. Check the port mapping:
   ```bash
   docker port aiderdesk
   ```

3. Ensure no firewall is blocking the port

4. Try accessing from inside the container:
   ```bash
   docker exec aiderdesk curl http://localhost:24337
   ```

### Projects Not Accessible

1. Verify the project directory is mounted:
   ```bash
   docker inspect aiderdesk | grep -A 10 Mounts
   ```

2. Check the path exists inside the container:
   ```bash
   docker exec aiderdesk ls -la /projects/my-app
   ```

3. Ensure you're using the correct path when opening projects (container path, not host path)

### Data Not Persisted

Ensure you're mounting the `/app/data` volume:
```bash
-v ~/aiderdesk-data:/app/data
```

Without this volume mount, all data will be lost when the container is removed.

### Global Configuration Not Persisted

If your agent profiles, skills, custom commands, hooks, or prompts are not persisting:

1. Ensure you're mounting the `~/.aider-desk` directory:
   ```bash
   -v ~/.aider-desk:/root/.aider-desk
   ```

2. Verify the directory exists on your host:
   ```bash
   ls -la ~/.aider-desk
   ```

3. Check if it's mounted correctly inside the container:
   ```bash
   docker exec aiderdesk ls -la /root/.aider-desk
   ```

**Note:** The `~/.aider-desk` directory will be created automatically the first time you run AiderDesk outside of Docker, or you can create it manually before running the container.

### Permission Issues

If you encounter permission errors accessing mounted volumes:

1. Ensure the host directory has appropriate permissions
2. Consider using the same user ID for the container:
   ```bash
   docker run -d \
     --name aiderdesk \
     -p 24337:24337 \
     -v ~/aiderdesk-data:/app/data \
     -u $(id -u):$(id -g) \
     ghcr.io/hotovo/aider-desk:latest
   ```

### Health Check Failing

The container includes a health check that verifies the server is responding. If the health check fails:

1. Check the container logs for errors
2. Ensure the port is not conflicting with other services
3. Verify there's enough system resources (memory, CPU)

## Advanced Usage

### Custom Aider Version

You can use a custom version of Aider by setting the `AIDER_DESK_AIDER_VERSION` environment variable (see [Custom Aider Version](./custom-aider-version.md) for details):

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -e AIDER_DESK_AIDER_VERSION="0.36.1" \
  ghcr.io/hotovo/aider-desk:latest
```

### Extra Python Packages

To install additional Python packages, see [Extra Python Packages](./extra-python-packages.md).

### Using the REST API

Once running, you can interact with AiderDesk via its REST API. See [REST API](../features/rest-api.md) for complete API documentation.

**Example API call:**

```bash
curl -X POST http://localhost:24337/api/get-context-files \
  -H "Content-Type: application/json" \
  -d '{"projectDir": "/projects/my-app"}'
```

## Security Considerations

1. **Authentication**: Always enable Basic Auth in production environments
2. **HTTPS**: For remote access, use a reverse proxy with SSL/TLS termination
3. **Network Isolation**: Consider using Docker networks to isolate AiderDesk
4. **Volume Permissions**: Ensure sensitive data volumes have appropriate permissions
5. **Regular Updates**: Keep the Docker image updated for security patches

## Support

For issues, questions, or contributions:
- GitHub Repository: https://github.com/hotovo/aider-desk
- Documentation: https://aiderdesk.hotovo.com
- Issues: https://github.com/hotovo/aider-desk/issues
