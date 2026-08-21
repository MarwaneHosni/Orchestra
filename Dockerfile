# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV HUSKY=0
ENV CI=true
RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orchestra/api... build

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
