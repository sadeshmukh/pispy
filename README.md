# Astro Starter Kit: Basics

```sh
bun create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun dev`             | Starts local dev server at `localhost:4321`      |
| `bun build`           | Build your production site to `./dist/`          |
| `bun preview`         | Preview your build locally, before deploying     |
| `bun astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun astro -- --help` | Get help using the Astro CLI                     |

## 🐳 Docker Deployment

You can build and deploy the application along with the **Pangolin Newt** agent using Docker Compose.

### 1. Configure Credentials
Copy `.env.example` to `.env` and fill in your Pangolin Newt credentials:
```sh
cp .env.example .env
```
Open `.env` and update:
* `PANGOLIN_ENDPOINT`: The URL of your Pangolin instance (defaults to `https://app.pangolin.net`).
* `NEWT_ID`: Your unique site/tunnel ID from your Pangolin dashboard.
* `NEWT_SECRET`: Your site/tunnel secret key from your Pangolin dashboard.

### 2. Start the Stack
Build the web container and start the services:
```sh
docker compose up -d --build
```

### 3. Automatic Discovery
The `web` container has labels configured in [docker-compose.yml](file:///home/devuser/pispy/docker-compose.yml) which allow the `pangolin-newt` agent to automatically detect the service and expose it securely:
```yaml
labels:
  - "pangolin.proxy-resources.pispy.name=Pispy"
  - "pangolin.proxy-resources.pispy.protocol=http"
  - "pangolin.proxy-resources.pispy.targets[0].method=http"
  - "pangolin.proxy-resources.pispy.targets[0].port=4321"
```

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

