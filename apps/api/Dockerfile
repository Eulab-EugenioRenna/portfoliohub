FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci
COPY apps/api apps/api
RUN npm run build --workspace=@portfoliohub/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules node_modules
COPY --from=build /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=build /workspace/apps/api/package.json apps/api/package.json
COPY --from=build /workspace/apps/api/dist apps/api/dist
WORKDIR /workspace/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
