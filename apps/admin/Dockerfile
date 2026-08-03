FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci
COPY apps/admin apps/admin
COPY apps/web/src/app/ui apps/web/src/app/ui
COPY packages/design-system packages/design-system
RUN npm run build --workspace=@portfoliohub/admin

FROM nginx:1.29-alpine AS runtime
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin/dist/admin/browser /usr/share/nginx/html
EXPOSE 80
