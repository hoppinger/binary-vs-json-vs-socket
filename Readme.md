# Binary vs json

## Deployment

build and push new version of the application with

    service docker start
    docker build -t hoppinger.azurecr.io/binary-vs-json:latest .
    docker push hoppinger.azurecr.io/binary-vs-json:latest

Deploy it with

    helm upgrade --install --namespace testing binary-vs-json deployment