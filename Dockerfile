FROM microsoft/dotnet:2.1-sdk as build-env

RUN  curl -sl https://deb.nodesource.com/setup_8.x | bash -
RUN  curl -ss https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt update && apt install --no-install-recommends curl build-essential nodejs yarn -y -qq


WORKDIR /app
COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn

COPY WebSocketsPlayground.csproj WebSocketsPlayground.csproj
RUN dotnet restore

COPY . .
RUN yarn run web:compile-min

RUN dotnet publish -c Release -o out

FROM microsoft/dotnet:2.1-aspnetcore-runtime-alpine

WORKDIR /app
COPY --from=build-env /app/out .
CMD ["dotnet", "WebSocketsPlayground.dll"]
